import { downloadFile } from '@/features/files/file-data'
import { ContractNodes } from './contract-nodes'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
} from 'antd'
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
} from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { getProblemMessage } from '@/api/client/http'
import { useCurrentSession } from '@/features/auth/auth-session'
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
  type Field,
} from '@/features/business/business-ui'
import {
  dateTime,
  label,
  money,
  options,
  pager,
  useBusinessQuery,
  useCapabilities,
  useListFilters,
} from '@/features/business/business-data'
import type {
  Page,
  Project,
  ProjectDetail,
} from '@/features/business/business-types'
import { FileDetailDrawer, ProjectFiles } from '@/features/files/file-workspace'
import type { FileWorkspace } from '@/features/files/file-types'
import type {
  ContractArchive,
  ContractDetail,
  ContractLinkedFile,
  ContractMaster,
} from './contract-types'

const archiveName = (value: string) =>
  ({
    DRAFT: '待提交',
    SUBMITTED: '待归档接收',
    ARCHIVED: '已归档',
    RETURNED: '退回补齐',
  })[value] ?? label(value)
const linkKind = (value: string) =>
  ({
    SIGNED: '主合同签署件',
    TECHNICAL: '技术附件',
    SUPPLEMENT: '补充协议',
    AMENDMENT: '合同变更',
    TERMINATION: '终止依据',
    OTHER: '其他签署资料',
  })[value] ?? label(value)
const masterFields: Field[] = [
  { name: 'number', label: '合同编号', maxLength: 80 },
  { name: 'title', label: '合同名称' },
  { name: 'partyA', label: '甲方主体', maxLength: 240 },
  { name: 'partyB', label: '乙方主体', maxLength: 240 },
  { name: 'amount', label: '合同总额（元）', type: 'number' },
  { name: 'signedOn', label: '实际签署日期', type: 'date' },
  { name: 'effectiveOn', label: '生效日期', type: 'date' },
  { name: 'scope', label: '约定范围', type: 'textarea' },
]

function ProjectField() {
  const [search, setSearch] = useState(''),
    deferred = useDeferredValue(search)
  const query = useBusinessQuery<Page<Project>>(
    `/api/projects?q=${encodeURIComponent(deferred)}&pageSize=50`,
  )
  return (
    <Form.Item
      name="projectId"
      label="来源项目"
      extra="选择原商机已建立的项目空间，客户与商机自动关联。"
      rules={[{ required: true, message: '请选择来源项目' }]}
    >
      <Select
        showSearch={{ filterOption: false, onSearch: setSearch }}
        loading={query.isFetching}
        options={query.data?.items
          .filter((p) => p.status !== 'CLOSED')
          .map((p) => ({ value: p.id, label: `${p.name} · ${p.code}` }))}
        notFoundContent={
          query.isPending ? '正在搜索…' : '未找到可选项目，可输入名称继续查找'
        }
      />
    </Form.Item>
  )
}
export function ContractWorkspace() {
  const { id } = useParams()
  return id ? (
    <ContractRecord id={id} />
  ) : (
    <BusinessPage>
      <ContractList />
    </BusinessPage>
  )
}

export function ContractList({ project }: { project?: ProjectDetail }) {
  const filters = useListFilters(),
    [command, setCommand] = useState<Command | null>(null),
    navigate = useNavigate(),
    capabilities = useCapabilities()
  const params = new URLSearchParams(filters.query)
  params.delete('tab')
  if (project) params.set('projectId', project.project.id)
  const query = useBusinessQuery<Page<ContractMaster>>(
    `/api/contracts?${params}`,
  )
  const create = () =>
    setCommand({
      title: '登记已签署合同',
      description: '记录已完成签署的合同事实，签署文件随后上传并提交归档。',
      path: '/api/contracts',
      values: project ? { projectId: project.project.id } : undefined,
      fields: masterFields,
      formExtra: project ? (
        <Alert type="info" title={`来源项目：${project.project.name}`} />
      ) : (
        <ProjectField />
      ),
      submitLabel: '登记合同',
      onSuccess: (result) => {
        const data = result as ContractDetail
        navigate(`/contracts/${data.contract.id}`)
      },
    })
  const canCreate = project
    ? project.allowedActions.includes('CONTRACT_EDIT')
    : capabilities.data?.includes('CONTRACT_EDIT')
  return (
    <div className="business-stack">
      {!project && (
        <PageHeading
          title="合同台账"
          description="从营销签署事实到综合管理归档，节点、文件与变更持续可追溯。"
          extra={
            <>
              <RefreshButton onClick={query.refetch} />
              {canCreate && (
                <Button type="primary" onClick={create}>
                  登记合同
                </Button>
              )}
            </>
          }
        />
      )}
      <Panel
        title={project ? '关联合同' : '签署后合同'}
        className="business-panel--table"
        extra={
          project &&
          canCreate && (
            <Button type="primary" onClick={create}>
              登记合同
            </Button>
          )
        }
      >
        <div className="business-panel-body business-toolbar">
          <Input.Search
            aria-label="搜索合同"
            placeholder="搜索合同、客户或项目"
            defaultValue={filters.params.get('q') ?? ''}
            allowClear
            onSearch={(value) => filters.update('q', value)}
          />
          <Select
            aria-label="合同履约状态"
            placeholder="全部履约状态"
            options={options(['SIGNED', 'EFFECTIVE', 'TERMINATED'])}
            value={filters.params.get('status') ?? undefined}
            allowClear
            onChange={(value) => filters.update('status', value)}
          />
          <Select
            aria-label="合同归档状态"
            placeholder="全部归档状态"
            options={['DRAFT', 'SUBMITTED', 'ARCHIVED', 'RETURNED'].map(
              (value) => ({ value, label: archiveName(value) }),
            )}
            value={filters.params.get('archiveStatus') ?? undefined}
            allowClear
            onChange={(value) => filters.update('archiveStatus', value)}
          />
        </div>
        <QueryState query={query}>
          <Table
            size="small"
            rowKey="id"
            dataSource={query.data?.items ?? []}
            scroll={{ x: 960 }}
            pagination={pager(query.data, (page, size) => {
              filters.update('pageSize', size)
              filters.update('page', page)
            })}
            columns={[
              {
                title: '合同 / 编号',
                width: 280,
                render: (_, c) => (
                  <div>
                    <Link
                      className="business-title-link"
                      to={`/contracts/${c.id}`}
                    >
                      {c.title}
                    </Link>
                    <div className="business-muted">
                      {c.number} {c.primaryContract && <Tag>当前主合同</Tag>}
                    </div>
                  </div>
                ),
              },
              {
                title: '客户 / 项目',
                width: 240,
                render: (_, c) => (
                  <div>
                    {c.customerName}
                    <div className="business-muted">{c.projectName}</div>
                  </div>
                ),
              },
              {
                title: '签约金额',
                align: 'right',
                width: 140,
                render: (_, c) =>
                  c.amount === null ? '敏感内容受限' : money(c.amount),
              },
              {
                title: '履约状态',
                width: 100,
                render: (_, c) => <Status value={c.status} />,
              },
              {
                title: '归档状态',
                width: 120,
                render: (_, c) => (
                  <Status
                    value={c.archiveStatus}
                    text={archiveName(c.archiveStatus)}
                  />
                ),
              },
              { title: '签署日期', dataIndex: 'signedOn', width: 110 },
              { title: '责任商务', dataIndex: 'salesOwnerName', width: 110 },
            ]}
          />
        </QueryState>
      </Panel>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </div>
  )
}

function ContractRecord({ id }: { id: string }) {
  const query = useBusinessQuery<ContractDetail>(`/api/contracts/${id}`),
    [command, setCommand] = useState<Command | null>(null),
    [selectedFile, setSelectedFile] = useState<string>(),
    [fileManager, setFileManager] = useState(false),
    [params, setParams] = useSearchParams(),
    session = useCurrentSession()
  const d = query.data,
    c = d?.contract
  const fileQuery = useBusinessQuery<FileWorkspace>(
    c && d.filesVisible ? `/api/projects/${c.projectId}/files` : undefined,
  )
  const can = (action: string) => d?.allowedActions.includes(action),
    editable = can('CONTRACT_EDIT') && c?.archiveStatus !== 'SUBMITTED'
  const fileOptions =
    fileQuery.data?.items
      .filter((f) => f.classification === 'CONTRACT' && f.currentVersionId)
      .map((f) => ({
        value: f.currentVersionId!,
        label: `${f.title} · 当前发布版`,
      })) ?? []
  function addFile() {
    if (!c) return
    setCommand({
      title: '关联合同签署资料',
      path: `/api/contracts/${id}/files`,
      values: { version: c.version, kind: 'SIGNED' },
      description:
        '只可关联本项目中已发布的合同敏感资料。主合同签署件修订后，原引用保留在历史中。',
      fields: [
        {
          name: 'kind',
          label: '签署资料类别',
          type: 'select',
          options: ['SIGNED', 'TECHNICAL', 'OTHER'].map((value) => ({
            value,
            label: linkKind(value),
          })),
        },
        {
          name: 'fileVersionId',
          label: '有效文件版本',
          type: 'select',
          options: fileOptions,
          hint: fileOptions.length
            ? '选择当前发布版本'
            : '请先到项目资料上传，并由另一名授权成员发布。',
          wide: true,
        },
      ],
    })
  }
  function addNode() {
    if (!c || !d) return
    setCommand({
      title: '登记合同约定节点',
      path: `/api/contracts/${id}/nodes`,
      values: { version: c.version, kind: 'PAYMENT' },
      fields: [
        { name: 'title', label: '节点名称' },
        {
          name: 'kind',
          label: '节点类型',
          type: 'select',
          options: options(['PAYMENT', 'ACCEPTANCE']),
        },
        { name: 'dueDate', label: '约定日期', type: 'date' },
        {
          name: 'amount',
          label: '约定金额（元）',
          type: 'number',
          required: false,
          hint: '付款节点必填；不自动生成收付款实际。',
        },
        ...(c.everArchived
          ? [
              {
                name: 'recordId',
                label: '签署变更依据',
                type: 'select' as const,
                options: d.records
                  .filter((r) => r.kind !== 'TERMINATION')
                  .map((r) => ({ value: r.id, label: r.title })),
                wide: true,
              },
            ]
          : []),
        { name: 'conditions', label: '条件与验收依据', type: 'textarea' },
      ],
    })
  }
  function amend() {
    if (!c) return
    setCommand({
      title: '登记补充、变更或终止',
      path: `/api/contracts/${id}/records`,
      values: { version: c.version, kind: 'SUPPLEMENT' },
      description:
        '记录实际签署后的补充事实，保留原主合同与文件关系。保存后需重新提交归档。',
      fields: [
        {
          name: 'kind',
          label: '关系类型',
          type: 'select',
          options: ['SUPPLEMENT', 'AMENDMENT', 'TERMINATION'].map((value) => ({
            value,
            label: linkKind(value),
          })),
        },
        { name: 'title', label: '记录名称' },
        { name: 'signedOn', label: '实际签署日期', type: 'date' },
        {
          name: 'amountAfter',
          label: '调整后的合同总额（元）',
          type: 'number',
          required: false,
          hint: '仅金额调整时填写；终止记录不修改签约金额。',
        },
        {
          name: 'fileVersionId',
          label: '已发布签署文件',
          type: 'select',
          options: fileOptions,
          wide: true,
        },
        { name: 'description', label: '调整内容与依据', type: 'textarea' },
      ],
    })
  }
  function submit() {
    if (!c) return
    setCommand({
      title: '提交综合管理归档',
      path: `/api/contracts/${id}/archive-submissions`,
      values: { version: c.version },
      description:
        '系统将锁定合同、节点与当前文件版本，由另一名授权归档人员接收。',
      fields: [{ name: 'note', label: '归档移交说明', type: 'textarea' }],
      submitLabel: '提交归档',
    })
  }
  function review(r: ContractArchive, decision: string) {
    setCommand({
      title: decision === 'ARCHIVED' ? '接收合同归档' : '退回补齐资料',
      path: `/api/contracts/${id}/archive-reviews/${r.id}`,
      values: { version: r.version, decision },
      fields: [{ name: 'comment', label: '接收核验意见', type: 'textarea' }],
      submitLabel: decision === 'ARCHIVED' ? '确认接收归档' : '退回补齐',
    })
  }
  const archive = d?.archiveReviews[0]
  const filePanel = d && (
    <Panel
      title="签署文件"
      className="business-panel--table"
      extra={
        <Space>
          {can('FILE_READ') && (
            <Button
              size="small"
              icon={<FolderOpen size={14} />}
              onClick={() => setFileManager(true)}
            >
              项目资料
            </Button>
          )}
          {editable && d.filesVisible && (
            <Button size="small" onClick={addFile}>
              关联文件
            </Button>
          )}
        </Space>
      }
    >
      <SignedFiles data={d} onOpen={setSelectedFile} />
    </Panel>
  )
  const historyPanel = d && (
    <Panel title="操作历史">
      <History events={d.history} limit={8} />
    </Panel>
  )
  const nodesPanel = d && (
    <ContractNodes data={d} onAdd={addNode} onCommand={setCommand} />
  )
  return (
    <BusinessPage className="contract-workspace">
      <QueryState query={query}>
        {d && c && (
          <>
            <PageHeading
              title={c.title}
              description={`${c.number} · 客户：${c.customerName} · 责任商务：${c.salesOwnerName}`}
              extra={
                <>
                  <Link to="/contracts">
                    <Button icon={<ArrowLeft size={15} />}>合同台账</Button>
                  </Link>
                  {editable && !c.everArchived && (
                    <Button
                      onClick={() =>
                        setCommand({
                          title: '更正合同主档',
                          path: `/api/contracts/${id}`,
                          method: 'PATCH',
                          values: { ...c },
                          fields: masterFields,
                        })
                      }
                    >
                      编辑主档
                    </Button>
                  )}
                  {editable &&
                    ['DRAFT', 'RETURNED'].includes(c.archiveStatus) && (
                      <Button type="primary" onClick={submit}>
                        提交归档
                      </Button>
                    )}
                </>
              }
            />
            <Facts
              items={[
                {
                  label: '履约状态',
                  value: <Status value={c.status} />,
                  note: c.primaryContract ? '项目当前主合同' : '关联历史合同',
                },
                {
                  label: '归档状态',
                  value: archiveName(c.archiveStatus),
                  note: c.archivedAt
                    ? `上次归档 ${dateTime(c.archivedAt)}`
                    : '待综合管理接收',
                },
                {
                  label: '合同金额',
                  value: c.amount === null ? '敏感内容受限' : money(c.amount),
                  note: '按实际签署事实登记',
                },
                {
                  label: '签署日期',
                  value: c.signedOn,
                  note: `生效日期 ${c.effectiveOn}`,
                },
              ]}
            />
            {!d.sensitiveVisible && (
              <Alert
                type="info"
                showIcon
                title="当前展示合同摘要。主体、金额、签署文件与商务明细需独立授权。"
              />
            )}
            <Tabs
              activeKey={params.get('section') ?? 'overview'}
              onChange={(section) => setParams({ section })}
              items={[
                {
                  key: 'overview',
                  label: '合同总览',
                  children: (
                    <div className="business-split">
                      <div className="business-stack">
                        {nodesPanel}
                        {filePanel}
                        {historyPanel}
                      </div>
                      <div className="business-stack">
                        <Panel
                          title={
                            <Space>
                              <FileCheck2 size={18} />
                              归档进度
                            </Space>
                          }
                        >
                          <Timeline
                            items={[
                              {
                                color: 'green',
                                content: (
                                  <>
                                    <strong>营销登记</strong>
                                    <div className="business-muted">
                                      {c.salesOwnerName} · {c.signedOn}
                                    </div>
                                  </>
                                ),
                              },
                              {
                                color: d.missingItems.length
                                  ? 'orange'
                                  : 'green',
                                content: (
                                  <>
                                    <strong>签署资料核验</strong>
                                    <div className="business-muted">
                                      {d.filesVisible
                                        ? d.missingItems.length
                                          ? `${d.missingItems.length} 项待补齐`
                                          : '当前文件核验齐备'
                                        : '按敏感资料权限核验'}
                                    </div>
                                  </>
                                ),
                              },
                              {
                                color:
                                  c.archiveStatus === 'ARCHIVED'
                                    ? 'green'
                                    : 'blue',
                                content: (
                                  <>
                                    <strong>综合管理接收</strong>
                                    <div className="business-muted">
                                      {archiveName(c.archiveStatus)}
                                      {c.archivedByName &&
                                        ` · ${c.archivedByName}`}
                                    </div>
                                  </>
                                ),
                              },
                            ]}
                          />
                          {!!d.missingItems.length && (
                            <Alert
                              type="warning"
                              showIcon
                              title="归档资料待补齐"
                              description={d.missingItems.map((item) => (
                                <div key={item}>{item}</div>
                              ))}
                            />
                          )}
                          {archive?.status === 'SUBMITTED' &&
                            can('CONTRACT_ARCHIVE') &&
                            session.data?.accountId !== archive.submittedBy && (
                              <Space wrap>
                                <Button
                                  type="primary"
                                  onClick={() => review(archive, 'ARCHIVED')}
                                >
                                  接收归档
                                </Button>
                                <Button
                                  onClick={() => review(archive, 'RETURNED')}
                                >
                                  退回补齐
                                </Button>
                              </Space>
                            )}
                          {archive?.reviewComment && (
                            <p className="business-text">
                              最近意见：{archive.reviewComment}
                            </p>
                          )}
                        </Panel>
                        <Panel
                          title="关联项目"
                          extra={
                            <Link to={`/projects/${c.projectId}`}>
                              进入项目 <ArrowUpRight size={13} />
                            </Link>
                          }
                        >
                          <Descriptions
                            size="small"
                            column={1}
                            items={[
                              {
                                key: 'name',
                                label: '项目',
                                children: c.projectName,
                              },
                              {
                                key: 'code',
                                label: '编号',
                                children: c.projectCode,
                              },
                              {
                                key: 'customer',
                                label: '客户',
                                children: can('CRM_CUSTOMER_READ') ? (
                                  <Link to={`/crm/customers/${c.customerId}`}>
                                    {c.customerName}
                                  </Link>
                                ) : (
                                  c.customerName
                                ),
                              },
                              {
                                key: 'opp',
                                label: '商机',
                                children: can('CRM_OPPORTUNITY_READ') ? (
                                  <Link
                                    to={`/crm/opportunities/${c.opportunityId}`}
                                  >
                                    查看原始商机
                                  </Link>
                                ) : (
                                  '已关联原商机'
                                ),
                              },
                            ]}
                          />
                          {!c.primaryContract &&
                            c.archiveStatus === 'ARCHIVED' &&
                            editable && (
                              <Button
                                onClick={() =>
                                  setCommand({
                                    title: '设为项目当前主合同',
                                    path: `/api/contracts/${id}/make-primary`,
                                    values: { version: c.version },
                                    fields: [
                                      {
                                        name: 'reason',
                                        label: '调整原因',
                                        type: 'textarea',
                                      },
                                    ],
                                  })
                                }
                              >
                                设为当前主合同
                              </Button>
                            )}
                        </Panel>
                        {d.sensitiveVisible && (
                          <Panel title="合同概要">
                            <Descriptions
                              size="small"
                              column={1}
                              items={[
                                { key: 'a', label: '甲方', children: c.partyA },
                                { key: 'b', label: '乙方', children: c.partyB },
                              ]}
                            />
                            <p className="business-text">{c.scope}</p>
                          </Panel>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'files',
                  label: `签署文件 ${d.files.filter((f) => f.active).length}`,
                  children: filePanel,
                },
                {
                  key: 'records',
                  label: `补充与变更 ${d.records.length}`,
                  children: (
                    <Panel
                      title="签署关系与调整记录"
                      extra={
                        editable &&
                        c.status !== 'TERMINATED' && (
                          <Button type="primary" onClick={amend}>
                            登记补充 / 变更
                          </Button>
                        )
                      }
                    >
                      {d.records.length ? (
                        d.records.map((r) => (
                          <div className="business-record" key={r.id}>
                            <Space>
                              <h3>{r.title}</h3>
                              <Tag>{linkKind(r.kind)}</Tag>
                            </Space>
                            <p className="business-muted">
                              签署日期 {r.signedOn} · {r.createdByName}
                            </p>
                            <p className="business-text">{r.description}</p>
                            {r.amountAfter !== null && (
                              <p>
                                总额调整：{money(r.amountBefore)} →{' '}
                                {money(r.amountAfter)}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="暂无补充协议、变更或终止记录"
                        />
                      )}
                    </Panel>
                  ),
                },
                {
                  key: 'archive',
                  label: `归档记录 ${d.archiveReviews.length}`,
                  children: (
                    <div className="business-stack">
                      {d.archiveReviews.length ? (
                        d.archiveReviews.map((r) => (
                          <Panel
                            key={r.id}
                            title={
                              <Space>
                                {archiveName(r.status)}
                                <span className="business-muted">
                                  {dateTime(r.createdAt)}
                                </span>
                              </Space>
                            }
                          >
                            <Descriptions
                              size="small"
                              column={2}
                              items={[
                                {
                                  key: 'by',
                                  label: '提交人',
                                  children: r.submitterName,
                                },
                                {
                                  key: 'reviewer',
                                  label: '接收人',
                                  children: r.reviewerName ?? '待接收',
                                },
                              ]}
                            />
                            <p className="business-text">{r.submissionNote}</p>
                            {r.reviewComment && (
                              <p>接收意见：{r.reviewComment}</p>
                            )}
                          </Panel>
                        ))
                      ) : (
                        <Panel>
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="完成资料准备后，提交综合管理归档"
                          />
                        </Panel>
                      )}
                      {historyPanel}
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
      {selectedFile && (
        <FileDetailDrawer
          id={selectedFile}
          onClose={() => setSelectedFile(undefined)}
        />
      )}
      {fileManager && c && (
        <Drawer
          open
          title="项目资料 · 合同归档准备"
          size={1040}
          onClose={() => setFileManager(false)}
          className="business-drawer"
        >
          <ProjectFiles projectId={c.projectId} defaultKind="CONTRACT" />
        </Drawer>
      )}
    </BusinessPage>
  )
}

function SignedFiles({
  data,
  onOpen,
}: {
  data: ContractDetail
  onOpen: (id: string) => void
}) {
  const { message } = App.useApp(),
    [loading, setLoading] = useState<string>()
  async function download(row: ContractLinkedFile) {
    setLoading(row.id)
    try {
      await downloadFile(
        row.file.documentId,
        row.file.versionId,
        row.file.filename,
      )
    } catch (error) {
      message.error(getProblemMessage(error))
    } finally {
      setLoading(undefined)
    }
  }
  return (
    <Table
      size="small"
      rowKey="id"
      dataSource={data.files}
      scroll={{ x: 660 }}
      pagination={false}
      locale={{
        emptyText: data.filesVisible
          ? '尚未关联签署资料，可从项目资料选择当前已发布版本'
          : '合同文件需独立资料权限',
      }}
      columns={[
        {
          title: '签署文件',
          width: 255,
          render: (_, row) => (
            <div>
              <Button
                type="link"
                className="business-title-link"
                onClick={() => onOpen(row.file.documentId)}
              >
                <FileText size={15} />
                {row.file.title}
              </Button>
              <div className="business-muted">
                {linkKind(row.kind)} · 合同敏感
              </div>
            </div>
          ),
        },
        {
          title: '版本',
          width: 72,
          render: (_, row) => `v${row.file.versionNumber}`,
        },
        {
          title: '引用状态',
          width: 125,
          render: (_, row) => (
            <Status
              value={row.file.status}
              text={
                !row.active
                  ? '历史引用'
                  : row.file.current && row.file.status === 'PUBLISHED'
                    ? '当前已发布'
                    : '依据已失效'
              }
            />
          ),
        },
        {
          title: '操作',
          width: 170,
          render: (_, row) => (
            <Space>
              <Button size="small" onClick={() => onOpen(row.file.documentId)}>
                查看
              </Button>
              {data.allowedActions.includes('FILE_DOWNLOAD') && (
                <Button
                  size="small"
                  icon={<Download size={13} />}
                  loading={loading === row.id}
                  onClick={() => void download(row)}
                >
                  下载
                </Button>
              )}
            </Space>
          ),
        },
      ]}
    />
  )
}
