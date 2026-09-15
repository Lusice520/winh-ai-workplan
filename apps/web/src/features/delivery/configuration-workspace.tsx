import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd'
import {
  ArrowLeft,
  CheckCheck,
  ClipboardCheck,
  FileClock,
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { getJson } from '@/api/client/http'
import {
  dateTime,
  money,
  pager,
  useBusinessQuery,
  useListFilters,
} from '@/features/business/business-data'
import {
  BusinessPage,
  CommandDrawer,
  History,
  PageHeading,
  Panel,
  QueryState,
  Status,
  type Command,
} from '@/features/business/business-ui'
import type { Page } from '@/features/business/business-types'
import { ConfigurationEditor } from './configuration-editor'
import {
  configurationLabel,
  type ConfigurationDetail,
  type ConfigurationKind,
  type ConfigurationRow,
  type StageDefinition,
} from './configuration-types'
import './configuration.css'

const root = '/system/delivery-configuration'
const api = '/api/delivery-configurations'
const statusName = (status: string) =>
  status === 'RETIRED' ? '已退役' : undefined

export function ConfigurationWorkspace() {
  const { id } = useParams()
  return id ? (
    <ConfigurationDetailPage key={id} id={id} />
  ) : (
    <ConfigurationList />
  )
}

function ConfigurationList() {
  const navigate = useNavigate()
  const filters = useListFilters()
  const kind: ConfigurationKind =
    filters.params.get('kind') === 'REVIEW_POLICY'
      ? 'REVIEW_POLICY'
      : 'STAGE_TEMPLATE'
  const params = new URLSearchParams(filters.query)
  params.set('kind', kind)
  const query = useBusinessQuery<Page<ConfigurationRow>>(`${api}?${params}`)
  const capabilities = useQuery({
    queryKey: ['business', `${api}/capabilities`],
    queryFn: () => getJson<string[]>(`${api}/capabilities`),
    refetchInterval: 15000,
    retry: false,
  })
  const canCreate = capabilities.data?.includes(
    kind === 'STAGE_TEMPLATE'
      ? 'DELIVERY_TEMPLATE_MANAGE'
      : 'DELIVERY_POLICY_MANAGE',
  )
  const [creating, setCreating] = useState(false)
  return (
    <BusinessPage className="delivery-config-page">
      <PageHeading
        title="交付模板与规则"
        description="明确项目适用阶段与评审分工，按版本发布并保留历史。"
        extra={
          <>
            <Button
              icon={<RefreshCw size={15} />}
              onClick={() => void query.refetch()}
            >
              刷新
            </Button>
            {canCreate && (
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => setCreating(true)}
              >
                新建{configurationLabel(kind)}
              </Button>
            )}
          </>
        }
      />
      <Tabs
        activeKey={kind}
        onChange={(key) => filters.update('kind', key)}
        items={[
          {
            key: 'STAGE_TEMPLATE',
            label: (
              <Space>
                <Layers size={16} />
                阶段模板
              </Space>
            ),
          },
          {
            key: 'REVIEW_POLICY',
            label: (
              <Space>
                <ShieldCheck size={16} />
                DG-02 评审规则
              </Space>
            ),
          },
        ]}
      />
      <div className="business-split delivery-config-split">
        <div className="business-stack">
          <Panel
            title={kind === 'STAGE_TEMPLATE' ? '阶段模板版本' : '评审规则版本'}
            className="business-panel--table"
            extra={
              <Space wrap>
                <Input.Search
                  aria-label="搜索交付配置"
                  placeholder="搜索名称或版本说明"
                  defaultValue={filters.params.get('q') ?? ''}
                  onSearch={(value) => filters.update('q', value)}
                  allowClear
                  className="delivery-config-search"
                />
                <Select
                  aria-label="配置发布状态"
                  placeholder="全部状态"
                  value={filters.params.get('status') ?? undefined}
                  onChange={(value) => filters.update('status', value)}
                  allowClear
                  options={['DRAFT', 'PUBLISHED', 'RETIRED'].map((value) => ({
                    value,
                    label: {
                      DRAFT: '草稿',
                      PUBLISHED: '已发布',
                      RETIRED: '已退役',
                    }[value],
                  }))}
                  className="delivery-config-status-filter"
                />
              </Space>
            }
          >
            <QueryState query={query}>
              <Table<ConfigurationRow>
                rowKey="id"
                size="small"
                scroll={{ x: 730 }}
                dataSource={query.data?.items}
                pagination={pager(query.data, (page, size) => {
                  filters.update('pageSize', size)
                  filters.update('page', page)
                })}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        filters.params.get('q') || filters.params.get('status')
                          ? '没有符合当前筛选条件的版本，请调整关键词或状态。'
                          : kind === 'STAGE_TEMPLATE'
                            ? '尚无阶段模板，先建立草稿并明确阶段要求。'
                            : '尚无评审规则，请按公司授权配置适用条件与评审人。'
                      }
                    />
                  ),
                }}
                columns={[
                  {
                    title: '名称 / 版本',
                    render: (_, row) => (
                      <div>
                        <Link
                          className="business-link"
                          to={`${root}/${row.id}`}
                        >
                          {row.name}
                        </Link>
                        <span className="business-cell-sub">
                          v{row.edition} · {row.createdByName}
                        </span>
                      </div>
                    ),
                    width: 260,
                  },
                  {
                    title: '适用项目',
                    render: (_, row) =>
                      row.projectTypes.map(configurationLabel).join('、') ||
                      '待明确',
                    width: 155,
                  },
                  {
                    title: kind === 'STAGE_TEMPLATE' ? '阶段' : '必要会签',
                    render: (_, row) =>
                      kind === 'STAGE_TEMPLATE'
                        ? `${row.stageCount} 项`
                        : `${row.reviewerCount} 人`,
                    width: 80,
                  },
                  {
                    title: '状态',
                    render: (_, row) => (
                      <Status
                        value={row.status}
                        text={statusName(row.status)}
                      />
                    ),
                    width: 90,
                  },
                  {
                    title: '最近更新',
                    render: (_, row) => dateTime(row.updatedAt),
                    width: 110,
                  },
                  {
                    title: '操作',
                    render: (_, row) => (
                      <Button
                        size="small"
                        onClick={() => navigate(`${root}/${row.id}`)}
                      >
                        查看
                      </Button>
                    ),
                    width: 75,
                  },
                ]}
              />
            </QueryState>
          </Panel>
          <Panel
            title="本页待完善版本"
            extra={<span className="business-muted">当前筛选结果</span>}
          >
            <div className="delivery-config-drafts">
              {query.data?.items
                .filter((item) => item.status === 'DRAFT')
                .map((item) => (
                  <Link
                    key={item.id}
                    to={`${root}/${item.id}`}
                    className="delivery-config-draft-link"
                  >
                    <FileClock size={18} />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        v{item.edition} ·{' '}
                        {kind === 'STAGE_TEMPLATE'
                          ? `${item.stageCount} 个阶段`
                          : `${item.reviewerCount} 名必要会签人`}
                      </small>
                    </span>
                    <span>去完善 →</span>
                  </Link>
                ))}
            </div>
            {!query.isPending &&
              !query.data?.items.some((item) => item.status === 'DRAFT') && (
                <p className="business-muted">当前页没有待完善草稿。</p>
              )}
          </Panel>
        </div>
        <div className="business-stack">
          <Panel
            title={
              <Space>
                <ClipboardCheck size={18} />
                发布与沿用
              </Space>
            }
          >
            <ol className="delivery-config-guide">
              <li>
                <strong>准备内容</strong>
                <span>
                  {kind === 'STAGE_TEMPLATE'
                    ? '阶段、适用性、责任、依赖和成果逐项定义。'
                    : '明确项目类型、预算范围、风险级别和评审分工。'}
                </span>
              </li>
              <li>
                <strong>检查并发布</strong>
                <span>
                  {kind === 'STAGE_TEMPLATE'
                    ? '补齐缺项后发布为可选版本。'
                    : '由具有公司授权的人员发布，配置人不自动取得发布权。'}
                </span>
              </li>
              <li>
                <strong>项目选择版本</strong>
                <span>原项目保留选用快照，新版本不会覆盖运行项目。</span>
              </li>
            </ol>
          </Panel>
          <Panel title="版本维护规则">
            <div className="delivery-config-rule">
              <CheckCheck size={18} />
              <p>
                <strong>已发布内容保持不变</strong>
                <span>内容调整时创建下一版草稿，历史版本继续可查。</span>
              </p>
            </div>
            <div className="delivery-config-rule">
              <FileClock size={18} />
              <p>
                <strong>退役停止新引用</strong>
                <span>已经使用的项目与批准事实继续保留。</span>
              </p>
            </div>
          </Panel>
        </div>
      </div>
      {creating && (
        <ConfigurationEditor
          kind={kind}
          onClose={() => setCreating(false)}
          onSaved={(detail) => navigate(`${root}/${detail.configuration.id}`)}
        />
      )}
    </BusinessPage>
  )
}

function ConfigurationDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['business', `${api}/${id}`],
    queryFn: () => getJson<ConfigurationDetail>(`${api}/${id}`),
    refetchInterval: 15000,
    retry: false,
  })
  const detail = query.data
  const [editing, setEditing] = useState(false)
  const [command, setCommand] = useState<Command | null>(null)
  const can = (action: string) => detail?.allowedActions.includes(action)
  function transition(action: 'publish' | 'next-version' | 'retire') {
    if (!detail) return
    const titles = {
      publish: '发布配置版本',
      'next-version': '创建下一版草稿',
      retire: '退役配置版本',
    }
    setCommand({
      title: titles[action],
      path: `${api}/${id}/${action}`,
      values: { version: detail.configuration.version },
      description:
        action === 'publish'
          ? '发布后本版本锁定，可供符合条件的项目选择。'
          : action === 'retire'
            ? '停止新项目选择本版本，已引用的项目快照和历史继续保留。'
            : `沿用 v${detail.configuration.edition} 内容建立新草稿，运行项目保持原版本。`,
      fields: [
        {
          name: 'reason',
          label: action === 'next-version' ? '新版准备说明' : '依据与原因',
          type: 'textarea',
          maxLength: 2000,
        },
      ],
      submitLabel:
        action === 'publish'
          ? '确认发布'
          : action === 'retire'
            ? '确认退役'
            : '创建草稿',
      onSuccess: (result) => {
        const updated = result as ConfigurationDetail
        if (updated.configuration.id !== id)
          navigate(`${root}/${updated.configuration.id}`)
      },
    })
  }
  return (
    <BusinessPage className="delivery-config-page">
      <Button
        type="text"
        icon={<ArrowLeft size={15} />}
        className="business-back"
        onClick={() =>
          navigate(
            `${root}?kind=${detail?.configuration.kind ?? 'STAGE_TEMPLATE'}`,
          )
        }
      >
        返回交付模板与规则
      </Button>
      <QueryState query={query}>
        {detail && (
          <>
            <PageHeading
              title={detail.configuration.name}
              description={`${configurationLabel(detail.configuration.kind)} · v${detail.configuration.edition} · ${detail.configuration.projectTypes.map(configurationLabel).join('、') || '适用项目待明确'}`}
              extra={
                <>
                  <Status
                    value={detail.configuration.status}
                    text={statusName(detail.configuration.status)}
                  />
                  {can('EDIT') && (
                    <Button onClick={() => setEditing(true)}>维护草稿</Button>
                  )}
                  {can('NEXT_VERSION') && (
                    <Button onClick={() => transition('next-version')}>
                      创建下一版
                    </Button>
                  )}
                  {can('RETIRE') && (
                    <Button onClick={() => transition('retire')}>
                      退役此版
                    </Button>
                  )}
                  {can('PUBLISH') && (
                    <Button
                      type="primary"
                      disabled={detail.problems.length > 0}
                      onClick={() => transition('publish')}
                    >
                      发布此版
                    </Button>
                  )}
                </>
              }
            />
            <div className="delivery-config-version-strip">
              <span>
                <strong>版本说明</strong>
                {detail.versionNote}
              </span>
              <span>
                <strong>
                  {detail.configuration.status === 'DRAFT'
                    ? '发布准备'
                    : '发布记录'}
                </strong>
                {detail.configuration.status === 'DRAFT'
                  ? `${detail.problems.length} 项待完善`
                  : `${detail.configuration.publishedByName} · ${dateTime(detail.configuration.publishedAt)}`}
              </span>
            </div>
            <div className="business-split delivery-config-split">
              <div className="business-stack">
                {detail.template && (
                  <StageDefinitionPanel stages={detail.template.stages} />
                )}
                {detail.policy && <PolicyDefinitionPanel detail={detail} />}
                <Panel title="版本历史" className="business-panel--table">
                  <Table<ConfigurationRow>
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: 570 }}
                    dataSource={detail.editions}
                    columns={[
                      {
                        title: '版本',
                        render: (_, row) => (
                          <Link
                            className="business-link"
                            to={`${root}/${row.id}`}
                          >
                            v{row.edition}
                            {row.id === id ? ' · 当前查看' : ''}
                          </Link>
                        ),
                        width: 145,
                      },
                      {
                        title: '状态',
                        render: (_, row) => (
                          <Status
                            value={row.status}
                            text={statusName(row.status)}
                          />
                        ),
                      },
                      {
                        title: '发布人',
                        render: (_, row) => row.publishedByName ?? '尚未发布',
                      },
                      {
                        title: '发布时间',
                        render: (_, row) => dateTime(row.publishedAt),
                      },
                      {
                        title: '最近更新',
                        render: (_, row) => dateTime(row.updatedAt),
                      },
                    ]}
                  />
                </Panel>
              </div>
              <div className="business-stack">
                <Panel
                  title={
                    detail.configuration.status === 'DRAFT'
                      ? '发布前检查'
                      : '版本状态'
                  }
                  extra={
                    detail.configuration.status === 'DRAFT' ? (
                      <Tag color={detail.problems.length ? 'orange' : 'green'}>
                        {detail.problems.length
                          ? `${detail.problems.length} 项待完善`
                          : '结构已齐备'}
                      </Tag>
                    ) : null
                  }
                >
                  {detail.problems.length > 0 ? (
                    <div className="delivery-config-problems">
                      {detail.problems.map((problem, index) => (
                        <div key={`${problem.field}-${index}`}>
                          <b>{index + 1}</b>
                          <span>{problem.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="delivery-config-ready">
                      <CheckCheck size={18} />
                      {detail.configuration.status === 'DRAFT'
                        ? '内容结构与发布条件已齐备。'
                        : '本版本内容已锁定，沿用原发布事实。'}
                    </p>
                  )}
                  {can('EDIT') && detail.problems.length > 0 && (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => setEditing(true)}
                    >
                      去完善草稿
                    </Button>
                  )}
                  {detail.configuration.status === 'RETIRED' && (
                    <Alert
                      type="warning"
                      showIcon
                      title="此版已停止新引用"
                      description={detail.retirementReason}
                    />
                  )}
                  {detail.configuration.kind === 'REVIEW_POLICY' && (
                    <p className="business-muted">
                      项目提交时还将核验适用条件、参与关系和评审人的当前权限。
                    </p>
                  )}
                </Panel>
                <Panel title="操作记录">
                  <History events={detail.history} limit={8} />
                </Panel>
                <Panel title="项目如何沿用">
                  <p className="business-muted">
                    项目使用选定版本建立自身快照。创建新版或退役此版，均保留已经形成的项目基线和评审记录。
                  </p>
                </Panel>
              </div>
            </div>
          </>
        )}
      </QueryState>
      {editing && detail && (
        <ConfigurationEditor
          kind={detail.configuration.kind}
          detail={detail}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </BusinessPage>
  )
}

function StageDefinitionPanel({ stages }: { stages: StageDefinition[] }) {
  return (
    <Panel
      title={`阶段定义 · ${stages.length} 项`}
      subtitle="适用性、责任与完成要求随项目快照保留。"
      className="business-panel--table"
    >
      <Table<StageDefinition>
        rowKey="code"
        size="small"
        pagination={false}
        scroll={{ x: 710 }}
        dataSource={stages}
        columns={[
          {
            title: '阶段',
            width: 160,
            render: (_, stage) => (
              <div>
                <strong>{stage.name}</strong>
                <span className="business-cell-sub">{stage.code}</span>
              </div>
            ),
          },
          {
            title: '适用',
            width: 95,
            render: (_, stage) => (
              <Tag
                color={stage.applicability === 'REQUIRED' ? 'blue' : undefined}
              >
                {configurationLabel(stage.applicability)}
              </Tag>
            ),
          },
          {
            title: '责任提示',
            dataIndex: 'ownerRoleHint',
            width: 130,
            render: (value: string | null) => value || '待填写',
          },
          {
            title: '前置 / 并行',
            width: 150,
            render: (_, stage) => (
              <div>
                {stage.predecessorCodes.length
                  ? `前置：${stage.predecessorCodes.join('、')}`
                  : '无前置'}
                <span className="business-cell-sub">
                  {stage.parallelCodes.length
                    ? `并行：${stage.parallelCodes.join('、')}`
                    : '未指定并行'}
                </span>
              </div>
            ),
          },
          {
            title: '完成条件',
            dataIndex: 'completionCriteria',
            render: (value: string | null) => value || '待填写',
          },
        ]}
        expandable={{
          rowExpandable: () => true,
          expandedRowRender: (stage) => (
            <div className="delivery-config-stage-content">
              {stage.condition && (
                <p className="delivery-config-condition">
                  <strong>适用条件</strong>
                  {stage.condition}
                </p>
              )}
              {(
                [
                  ['里程碑', stage.milestones],
                  ['规定动作', stage.actions],
                  ['交付成果', stage.deliverables],
                ] as const
              ).map(([title, items]) => (
                <div key={title}>
                  <strong>{title}</strong>
                  {items.length ? (
                    <ul>
                      {items.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>待完善</p>
                  )}
                </div>
              ))}
            </div>
          ),
        }}
      />
    </Panel>
  )
}

function PolicyDefinitionPanel({ detail }: { detail: ConfigurationDetail }) {
  const policy = detail.policy!
  const name = (id: string | null) =>
    detail.people.find((person) => person.id === id)?.name ?? '待指定'
  return (
    <>
      <Panel title="适用条件与公司授权">
        <Descriptions
          column={1}
          items={[
            {
              key: 'types',
              label: '项目类型',
              children:
                policy.projectTypes.map(configurationLabel).join('、') ||
                '待选择',
            },
            {
              key: 'budget',
              label: '预算范围',
              children: `${money(policy.minimumBudget)} 至 ${policy.maximumBudget == null ? '未设置上限' : money(policy.maximumBudget)}（含边界）`,
            },
            {
              key: 'risk',
              label: '风险级别',
              children:
                policy.riskLevels.map(configurationLabel).join('、') ||
                '待选择',
            },
            {
              key: 'basis',
              label: '授权依据',
              children: policy.authorityBasis || '待说明',
            },
          ]}
        />
      </Panel>
      <Panel
        title={`必要会签 · ${policy.reviewers.length} 人`}
        className="business-panel--table"
      >
        <Table
          rowKey="accountId"
          size="small"
          pagination={false}
          dataSource={policy.reviewers}
          columns={[
            { title: '范围', dataIndex: 'scope', render: configurationLabel },
            { title: '指定会签人', dataIndex: 'accountId', render: name },
            { title: '要求', render: () => '单独记录本范围意见' },
          ]}
        />
        <div className="delivery-config-final-approver">
          <ShieldCheck size={21} />
          <span>
            <strong>最终批准人</strong>
            <small>必要会签完成后独立作出最终决定</small>
          </span>
          <b>{name(policy.finalApproverId)}</b>
        </div>
      </Panel>
    </>
  )
}
