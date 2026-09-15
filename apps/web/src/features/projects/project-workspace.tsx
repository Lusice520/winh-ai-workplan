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
} from 'antd'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import {
  BusinessPage,
  CommandDrawer,
  Facts,
  History,
  PageHeading,
  Panel,
  QueryState,
  RefreshButton,
  Status,
  type Command,
} from '@/features/business/business-ui'
import {
  dateTime,
  resultLabel,
  label,
  options,
  pager,
  personField,
  reasonField,
  useBusinessQuery,
  useListFilters,
  usePeople,
} from '@/features/business/business-data'
import type {
  Member,
  Page,
  Project,
  ProjectDetail,
} from '@/features/business/business-types'
import { PresalesBoard } from './presales-board'
import { ProjectFiles } from '@/features/files/file-workspace'
import { ContractList } from '@/features/contracts/contract-workspace'
import { RequirementList } from '@/features/requirements/requirement-workspace'
import { HandoverBoard } from '@/features/handover/handover-workspace'
import { DeliveryProjectSection } from '@/features/delivery/delivery-workspace'
import { ExecutionProjectSection } from '@/features/execution/execution-workspace'
import { ProjectFundsSection } from '@/features/income/funds-entry'

export function ProjectWorkspace() {
  const { id } = useParams()
  return id ? <ProjectRecord id={id} /> : <ProjectList />
}
function ProjectList() {
  const filters = useListFilters(),
    location = useLocation()
  const query = useBusinessQuery<Page<Project>>(
    `/api/projects?${filters.query}`,
  )
  const presales = location.pathname === '/presales'
  return (
    <BusinessPage>
      <PageHeading
        title={presales ? '售前工作台' : '项目空间'}
        description={
          presales
            ? '从项目进入售前协作，掌握动作进展、评审状态与投入边界。'
            : '客户、商机、成员与执行记录，在同一项目空间内持续衔接。'
        }
        extra={<RefreshButton onClick={query.refetch} />}
      />
      <Panel
        title={presales ? '售前项目' : '项目台账'}
        subtitle="项目从商机创建，沿用客户与营销负责人。"
        className="business-panel--table"
        extra={
          <Link to="/crm/opportunities">
            从商机创建 <ArrowUpRight size={14} className="inline" />
          </Link>
        }
      >
        <div className="business-panel-body business-toolbar">
          <Input.Search
            aria-label="搜索项目"
            placeholder="搜索项目名称或编号"
            defaultValue={filters.params.get('q') ?? ''}
            allowClear
            onSearch={(v) => filters.update('q', v)}
          />
          <Select
            aria-label="项目状态"
            placeholder="全部状态"
            options={options(['PENDING_INITIATION', 'ACTIVE', 'CLOSED'])}
            value={filters.params.get('status') ?? undefined}
            allowClear
            onChange={(v) => filters.update('status', v)}
          />
          <span className="business-toolbar-end">
            {query.data?.total ?? '—'} 个项目符合条件
          </span>
        </div>
        <QueryState query={query}>
          <Table<Project>
            rowKey="id"
            size="small"
            dataSource={query.data?.items}
            scroll={{ x: 1100 }}
            pagination={pager(query.data, (page, size) => {
              filters.update('pageSize', size)
              filters.update('page', page)
            })}
            columns={[
              {
                title: '项目 / 客户',
                width: 290,
                render: (_, p) => (
                  <>
                    <Link
                      className="business-cell-title"
                      to={`/projects/${p.id}?tab=presales`}
                    >
                      {p.name}
                    </Link>
                    <span className="business-cell-sub">
                      {p.customerName} · {p.code}
                    </span>
                  </>
                ),
              },
              {
                title: '阶段',
                dataIndex: 'mainStage',
                width: 100,
                render: label,
              },
              {
                title: '当前重点',
                dataIndex: 'focus',
                width: 120,
                render: label,
              },
              { title: '营销负责人', dataIndex: 'salesOwnerName', width: 110 },
              {
                title: '售前负责人',
                dataIndex: 'presalesOwnerName',
                width: 110,
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 120,
                render: (v) => (
                  <Status value={v === 'ACTIVE' ? 'IN_PROGRESS' : v} />
                ),
              },
              {
                title: '经营结果',
                dataIndex: 'result',
                width: 110,
                render: (v, row) => (
                  <Status
                    value={v}
                    text={resultLabel(v, row.procurementMethod)}
                  />
                ),
              },
              {
                title: '最近更新',
                dataIndex: 'updatedAt',
                width: 140,
                render: dateTime,
              },
            ]}
          />
        </QueryState>
      </Panel>
      <Panel title="项目内的协作方式">
        <div className="business-two-col">
          <p className="business-text business-text-small">
            售前动作按实际情况并行推进；立项与报价分别评审，批准范围决定可记录的投入。
          </p>
          <p className="business-text business-text-small">
            新诉求先进入需求池，保留原始表述，完成影响分析后由人决定处理方式，并交由独立人员验证。
          </p>
        </div>
      </Panel>
    </BusinessPage>
  )
}
function ProjectRecord({ id }: { id: string }) {
  const query = useBusinessQuery<ProjectDetail>(`/api/projects/${id}`),
    people = usePeople(),
    navigate = useNavigate()
  const [params, setParams] = useSearchParams(),
    [command, setCommand] = useState<Command | null>(null)
  const data = query.data,
    p = data?.project,
    can = (a: string) => data?.allowedActions.includes(a)
  const editMember = (member?: Member): Command => ({
    title: member ? '调整项目成员' : '添加项目成员',
    path: `/api/projects/${id}/members`,
    values: {
      version: p?.version,
      active: member?.active ?? true,
      accountId: member?.accountId,
      roleCodes: member?.roleCodes ?? ['PROJECT_CONTRIBUTOR'],
    },
    description:
      '项目权限仅在本项目内生效。成员有未完成责任时，请先交接再停用。',
    fields: [
      {
        ...personField('accountId', '项目成员', people.data ?? []),
        disabled: !!member,
      },
      {
        name: 'roleCodes',
        label: '项目角色',
        type: 'multiple',
        options: options([
          'PROJECT_OWNER',
          'PROJECT_CONTRIBUTOR',
          'PROJECT_REVIEWER',
        ]),
        wide: true,
      },
      { name: 'active', label: '启用成员', type: 'switch' },
      reasonField,
    ],
  })
  return (
    <BusinessPage className="business-page--project">
      <QueryState query={query}>
        {p && data && (
          <>
            <PageHeading
              title={p.name}
              description={`${p.code} · ${p.customerName}`}
              extra={
                <>
                  <Button
                    aria-label="返回项目列表"
                    icon={<ArrowLeft size={16} />}
                    onClick={() => navigate('/projects')}
                  />
                  <Status
                    value={p.status === 'ACTIVE' ? 'IN_PROGRESS' : p.status}
                  />
                  {can('CRM_OPPORTUNITY_READ') && (
                    <Button
                      onClick={() =>
                        navigate(`/crm/opportunities/${p.opportunityId}`)
                      }
                    >
                      查看商机
                    </Button>
                  )}
                  {can('DG2_READ') && (
                    <Link to={`/delivery-initiation/${id}`}>
                      <Button>交付立项</Button>
                    </Link>
                  )}
                  {can('PROJECT_EDIT') && (
                    <Button
                      onClick={() =>
                        setCommand({
                          title: '编辑项目信息',
                          path: `/api/projects/${id}`,
                          method: 'PATCH',
                          values: { ...p },
                          fields: [
                            { name: 'name', label: '项目名称', wide: true },
                            {
                              name: 'focus',
                              label: '当前工作重点',
                              type: 'select',
                              options: options([
                                'NOT_SET',
                                'SURVEY',
                                'REQUIREMENTS',
                                'SOLUTION',
                                'ESTIMATE',
                                'QUOTATION',
                                'BIDDING',
                                'HANDOVER',
                              ]),
                              disabled: p.mainStage !== 'PRESALES',
                              hint:
                                p.mainStage === 'DELIVERY'
                                  ? '交付重点在项目阶段中维护。'
                                  : undefined,
                              wide: true,
                            },
                            {
                              name: 'background',
                              label: '项目背景',
                              type: 'textarea',
                              required: false,
                              maxLength: 8000,
                            },
                          ],
                        })
                      }
                    >
                      编辑项目
                    </Button>
                  )}
                </>
              }
            />
            {p.status === 'CLOSED' && (
              <Alert
                type="info"
                showIcon
                title="项目已关闭，业务记录保留为只读。需要继续时，请在关联商机中说明原因并重开。"
              />
            )}
            <Facts
              items={[
                {
                  label: '项目阶段',
                  value: label(p.mainStage),
                  note:
                    p.mainStage === 'DELIVERY'
                      ? '交付重点见项目阶段'
                      : `当前重点 · ${label(p.focus)}`,
                },
                {
                  label: '营销负责人',
                  value: p.salesOwnerName,
                  note:
                    p.procurementMethod === 'TENDER'
                      ? '招投标项目'
                      : '直接采购项目',
                },
                {
                  label: '售前负责人',
                  value: p.presalesOwnerName,
                  note: `${data.members.filter((m) => m.active).length} 位有效成员`,
                },
                {
                  label: '经营结果',
                  value: resultLabel(p.result, p.procurementMethod),
                  note: '以商机确认结果为准',
                },
              ]}
            />
            <Tabs
              className="business-project-tabs"
              activeKey={
                params.get('tab') ??
                (can('PRESALES_READ') ? 'presales' : 'overview')
              }
              onChange={(tab) => setParams({ tab })}
              items={[
                {
                  key: 'overview',
                  label: '项目概览',
                  children: (
                    <div className="business-split">
                      <div className="business-stack">
                        <Panel title="项目背景">
                          <p className="business-text">
                            {p.background ?? '项目背景待补充'}
                          </p>
                        </Panel>
                        <Panel title="关联信息">
                          <Descriptions
                            column={1}
                            size="small"
                            items={[
                              {
                                key: 'customer',
                                label: '客户档案',
                                children: (
                                  <Link to={`/crm/customers/${p.customerId}`}>
                                    {p.customerName}
                                  </Link>
                                ),
                              },
                              {
                                key: 'opportunity',
                                label: '关联商机',
                                children: (
                                  <Link
                                    to={`/crm/opportunities/${p.opportunityId}`}
                                  >
                                    查看原始商机与跟进
                                  </Link>
                                ),
                              },
                              {
                                key: 'updated',
                                label: '最近更新',
                                children: dateTime(p.updatedAt),
                              },
                            ]}
                          />
                        </Panel>
                      </div>
                      <Panel title="项目动态">
                        <History events={data.history} />
                      </Panel>
                    </div>
                  ),
                },
                ...(can('PRESALES_READ')
                  ? [
                      {
                        key: 'presales',
                        label: '售前协作',
                        children: <PresalesBoard detail={data} />,
                      },
                    ]
                  : []),
                ...(can('REQUIREMENT_READ')
                  ? [
                      {
                        key: 'requirements',
                        label: '需求池',
                        children: <RequirementList project={data} />,
                      },
                    ]
                  : []),
                ...(can('CONTRACT_READ')
                  ? [
                      {
                        key: 'contracts',
                        label: '合同归档',
                        children: <ContractList project={data} />,
                      },
                    ]
                  : []),
                ...(can('FILE_READ')
                  ? [
                      {
                        key: 'files',
                        label: '项目资料',
                        children: <ProjectFiles projectId={p.id} />,
                      },
                    ]
                  : []),
                ...(can('HANDOVER_READ') || can('EARLY_START_READ')
                  ? [
                      {
                        key: 'handover',
                        label: '交付移交',
                        children: <HandoverBoard detail={data} />,
                      },
                    ]
                  : []),
                ...(can('DG2_READ')
                  ? [
                      {
                        key: 'stages',
                        label: '项目阶段',
                        children:
                          p.mainStage === 'DELIVERY' &&
                          can('DELIVERY_EXECUTION_READ') ? (
                            <ExecutionProjectSection
                              project={data}
                              section="stages"
                            />
                          ) : (
                            <DeliveryProjectSection
                              projectId={p.id}
                              section="stages"
                              project={data}
                            />
                          ),
                      },
                      {
                        key: 'milestones',
                        label: '里程碑与计划',
                        children:
                          p.mainStage === 'DELIVERY' &&
                          can('DELIVERY_EXECUTION_READ') ? (
                            <ExecutionProjectSection
                              project={data}
                              section="milestones"
                            />
                          ) : (
                            <DeliveryProjectSection
                              projectId={p.id}
                              section="milestones"
                              project={data}
                            />
                          ),
                      },
                      {
                        key: 'items',
                        label: '项目清单',
                        children:
                          p.mainStage === 'DELIVERY' &&
                          can('DELIVERY_EXECUTION_READ') ? (
                            <ExecutionProjectSection
                              project={data}
                              section="items"
                            />
                          ) : (
                            <DeliveryProjectSection
                              projectId={p.id}
                              section="items"
                              project={data}
                            />
                          ),
                      },
                    ]
                  : []),
                ...(can('FINANCE_READ') || can('DELIVERY_BUDGET_READ')
                  ? [
                      {
                        key: 'budget',
                        label: '资金计划',
                        children: <ProjectFundsSection project={data} />,
                      },
                    ]
                  : []),
                {
                  key: 'members',
                  label: `项目成员 ${data.members.filter((m) => m.active).length}`,
                  children: (
                    <Panel
                      title="成员与角色"
                      className="business-panel--table"
                      extra={
                        can('PROJECT_MEMBER_MANAGE') && (
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => setCommand(editMember())}
                          >
                            添加成员
                          </Button>
                        )
                      }
                    >
                      <Table<Member>
                        rowKey="id"
                        size="small"
                        dataSource={data.members}
                        pagination={false}
                        scroll={{ x: 620 }}
                        columns={[
                          {
                            title: '姓名',
                            render: (_, m) => (
                              <span className="business-person">
                                <span className="business-avatar">
                                  {m.name.slice(-2)}
                                </span>
                                {m.name}
                              </span>
                            ),
                          },
                          {
                            title: '职责',
                            render: (_, m) =>
                              [
                                m.salesOwner ? '营销负责人' : '',
                                m.presalesOwner ? '售前负责人' : '',
                              ]
                                .filter(Boolean)
                                .join('、') || '项目协作',
                          },
                          {
                            title: '项目角色',
                            render: (_, m) => (
                              <Space wrap>
                                {m.roleCodes.map((r) => (
                                  <Status key={r} value={r} />
                                ))}
                              </Space>
                            ),
                          },
                          {
                            title: '状态',
                            render: (_, m) => (
                              <Status
                                value={m.active ? 'ACTIVE' : 'INACTIVE'}
                              />
                            ),
                          },
                          {
                            title: '操作',
                            render: (_, m) =>
                              can('PROJECT_MEMBER_MANAGE') && (
                                <button
                                  className="business-link"
                                  onClick={() => setCommand(editMember(m))}
                                >
                                  调整
                                </button>
                              ),
                          },
                        ]}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="暂无项目成员"
                            />
                          ),
                        }}
                      />
                    </Panel>
                  ),
                },
                {
                  key: 'history',
                  label: '操作历史',
                  children: (
                    <Panel title="项目完整记录">
                      <History events={data.history} />
                    </Panel>
                  ),
                },
              ]}
            />
          </>
        )}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </BusinessPage>
  )
}
