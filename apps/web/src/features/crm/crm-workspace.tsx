import {
  Alert,
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
} from 'antd'
import { ArrowLeft, ArrowUpRight, Building2, FileText } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { postJson, getProblemMessage } from '@/api/client/http'
import { useCurrentSession } from '@/features/auth/auth-session'
import {
  AddButton,
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
  resultLabel,
  label,
  money,
  options,
  pager,
  personField,
  reasonField,
  useBusinessQuery,
  useCapabilities,
  useListFilters,
  usePeople,
} from '@/features/business/business-data'
import type {
  Customer,
  CustomerDetail,
  Contact,
  MergePreview,
  Opportunity,
  OpportunityDetail,
  Page,
  Person,
  ProjectDetail,
} from '@/features/business/business-types'

const customerFields = (people: Person[]): Field[] => [
  { name: 'name', label: '客户全称', wide: true },
  { name: 'shortName', label: '客户简称', required: false },
  {
    name: 'kind',
    label: '客户类型',
    type: 'select',
    options: options(['PROSPECT', 'CUSTOMER']),
  },
  {
    name: 'identifier',
    label: '统一社会信用代码 / 唯一标识',
    wide: true,
    required: false,
    maxLength: 80,
    hint: '没有标识时可先记录；同一标识只能对应一个有效客户。',
  },
  { name: 'industry', label: '所属行业', required: false },
  { name: 'region', label: '所在区域', required: false },
  { name: 'source', label: '客户来源' },
  personField('ownerAccountId', '客户负责人', people),
  {
    name: 'status',
    label: '使用状态',
    type: 'select',
    options: options(['ACTIVE', 'INACTIVE']),
  },
]
const opportunityFields = (
  people: Person[],
  customers: Customer[],
): Field[] => [
  { name: 'title', label: '商机名称', wide: true },
  {
    name: 'customerId',
    label: '所属客户',
    type: 'select',
    options: customers.map((c) => ({ value: c.id, label: c.name })),
    wide: true,
  },
  {
    name: 'eventKey',
    label: '独立采购事件标识',
    required: false,
    hint: '同一客户有同名商机时，用采购批次、标段等区分独立事件。',
  },
  personField('ownerAccountId', '营销负责人', people),
  { name: 'source', label: '商机来源' },
  {
    name: 'procurementMethod',
    label: '采购方式',
    type: 'select',
    options: [
      { value: 'TENDER', label: '招投标' },
      { value: 'DIRECT', label: '直接采购' },
    ],
  },
  {
    name: 'estimatedAmount',
    label: '预计金额（元）',
    type: 'number',
    required: false,
  },
  { name: 'targetDate', label: '目标签约日期', type: 'date', required: false },
  {
    name: 'background',
    label: '项目背景与客户诉求',
    type: 'textarea',
    required: false,
    maxLength: 8000,
  },
]
function DuplicateHints({ exclude }: { exclude?: string }) {
  const name = Form.useWatch<string>('name') ?? ''
  const identifier = Form.useWatch<string>('identifier') ?? ''
  const search = useDeferredValue(
    new URLSearchParams({ q: name, identifier }).toString(),
  )
  const query = useBusinessQuery<Customer[]>(
    name.trim().length >= 2 || identifier
      ? `/api/crm/customers/duplicates?${search}`
      : undefined,
  )
  const matches = query.data?.filter((c) => c.id !== exclude) ?? []
  return matches.length ? (
    <Alert
      type="warning"
      showIcon
      title="发现可能重复的客户"
      description={
        <div>
          {matches.map((c) => (
            <div key={c.id}>
              {c.name} · {c.ownerName} · {label(c.status)}
            </div>
          ))}
          <p>请核对后使用原客户；确认是独立主体时再保存。</p>
        </div>
      }
    />
  ) : null
}
export function CustomerWorkspace() {
  const { id } = useParams()
  return id ? <CustomerRecord id={id} /> : <CustomerList />
}
function CustomerList() {
  const filters = useListFilters(),
    navigate = useNavigate()
  const query = useBusinessQuery<Page<Customer>>(
    `/api/crm/customers?${filters.query}`,
  )
  const people = usePeople(),
    capabilities = useCapabilities(),
    session = useCurrentSession()
  const [command, setCommand] = useState<Command | null>(null)
  return (
    <BusinessPage>
      <PageHeading
        title="客户管理"
        description="维护客户主体、关键联系人与关联商机，让每一次接洽都有据可查。"
        extra={
          <>
            <RefreshButton onClick={query.refetch} />
            {capabilities.data?.includes('CRM_CUSTOMER_CREATE') && (
              <AddButton
                onClick={() =>
                  setCommand({
                    title: '新建客户',
                    description:
                      '先核对客户主体，再补充业务信息。联系人可在保存后继续添加。',
                    path: '/api/crm/customers',
                    values: {
                      kind: 'PROSPECT',
                      status: 'ACTIVE',
                      ownerAccountId: session.data?.accountId,
                    },
                    fields: customerFields(people.data ?? []),
                    formExtra: <DuplicateHints />,
                    onSuccess: (r) =>
                      navigate(
                        `/crm/customers/${(r as CustomerDetail).customer.id}`,
                      ),
                  })
                }
              >
                新建客户
              </AddButton>
            )}
          </>
        }
      />
      <Panel
        className="business-panel--table"
        title="客户档案"
        subtitle="同一客户共用一份档案，商机与项目持续关联。"
        extra={
          <span className="business-muted">
            {query.data?.total ?? '—'} 位客户符合当前条件
          </span>
        }
      >
        <div className="business-panel-body business-toolbar">
          <Input.Search
            aria-label="搜索客户"
            placeholder="搜索客户名称、简称或标识"
            defaultValue={filters.params.get('q') ?? ''}
            onSearch={(v) => filters.update('q', v)}
            allowClear
          />
          <Select
            aria-label="客户状态"
            placeholder="全部状态"
            value={filters.params.get('status') ?? undefined}
            allowClear
            options={options(['ACTIVE', 'INACTIVE', 'MERGED'])}
            onChange={(v) => filters.update('status', v)}
          />
        </div>
        <QueryState query={query}>
          <Table<Customer>
            rowKey="id"
            size="small"
            dataSource={query.data?.items}
            scroll={{ x: 1050 }}
            pagination={pager(query.data, (page, size) => {
              filters.update('pageSize', size)
              filters.update('page', page)
            })}
            columns={[
              {
                title: '客户名称',
                dataIndex: 'name',
                width: 260,
                render: (_, c) => (
                  <>
                    <Link
                      className="business-cell-title"
                      to={`/crm/customers/${c.id}`}
                    >
                      {c.name}
                    </Link>
                    <span className="business-cell-sub">
                      {c.code}
                      {c.shortName ? ` · ${c.shortName}` : ''}
                    </span>
                  </>
                ),
              },
              { title: '类型', dataIndex: 'kind', width: 110, render: label },
              {
                title: '行业 / 区域',
                width: 170,
                render: (_, c) => (
                  <>
                    {c.industry ?? '未填写'}
                    <span className="business-cell-sub">
                      {c.region ?? '区域待补充'}
                    </span>
                  </>
                ),
              },
              { title: '负责人', dataIndex: 'ownerName', width: 110 },
              { title: '来源', dataIndex: 'source', width: 130 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 90,
                render: (v) => <Status value={v} />,
              },
              {
                title: '最近更新',
                dataIndex: 'updatedAt',
                width: 135,
                render: dateTime,
              },
            ]}
          />
        </QueryState>
      </Panel>
      <div className="business-two-col">
        <Panel title="从客户到项目">
          <p className="business-text business-text-small">
            客户档案 → 独立商机 →
            项目空间。合同与后续经营记录沿用同一客户主体，减少重复录入。
          </p>
        </Panel>
        <Panel title="发现重复客户">
          <p className="business-text business-text-small">
            打开需要保留的客户档案，预览待合并客户的联系人、商机和字段冲突，再确认归并；历史客户仍可追溯。
          </p>
        </Panel>
      </div>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </BusinessPage>
  )
}
function CustomerRecord({ id }: { id: string }) {
  const query = useBusinessQuery<CustomerDetail>(`/api/crm/customers/${id}`),
    people = usePeople(),
    capabilities = useCapabilities(),
    session = useCurrentSession()
  const [command, setCommand] = useState<Command | null>(null),
    [merge, setMerge] = useState(false)
  const data = query.data,
    c = data?.customer,
    can = (a: string) => data?.allowedActions.includes(a)
  const contactCommand = (contact?: Contact): Command => ({
    title: contact ? '编辑联系人' : '添加联系人',
    path: `/api/crm/customers/${id}/contacts${contact ? `/${contact.id}` : ''}`,
    method: contact ? 'PATCH' : 'POST',
    values: contact ? { ...contact } : { status: 'ACTIVE' },
    fields: [
      { name: 'name', label: '联系人姓名' },
      { name: 'position', label: '职务', required: false },
      { name: 'phone', label: '联系电话', required: false, maxLength: 80 },
      { name: 'email', label: '电子邮箱', required: false, maxLength: 200 },
      {
        name: 'status',
        label: '联系人状态',
        type: 'select',
        options: options(['ACTIVE', 'INACTIVE']),
      },
    ],
  })
  return (
    <BusinessPage>
      <Link to="/crm/customers">
        <ArrowLeft size={14} className="inline" /> 返回客户列表
      </Link>
      <QueryState query={query}>
        {c && data && (
          <>
            <PageHeading
              title={c.name}
              description={`${c.code} · ${c.shortName ?? '客户档案'}`}
              extra={
                <>
                  <Status value={c.status} />
                  {can('CRM_CUSTOMER_EDIT') && (
                    <Button
                      onClick={() =>
                        setCommand({
                          title: '编辑客户',
                          path: `/api/crm/customers/${id}`,
                          method: 'PATCH',
                          values: { ...c },
                          fields: customerFields(people.data ?? []),
                          formExtra: <DuplicateHints exclude={id} />,
                        })
                      }
                    >
                      编辑档案
                    </Button>
                  )}
                  {can('CRM_CUSTOMER_MERGE') && (
                    <Button onClick={() => setMerge(true)}>合并重复客户</Button>
                  )}
                  {capabilities.data?.includes('CRM_OPPORTUNITY_CREATE') &&
                    c.status === 'ACTIVE' && (
                      <AddButton
                        onClick={() =>
                          setCommand({
                            title: '登记商机',
                            path: '/api/crm/opportunities',
                            values: {
                              customerId: id,
                              ownerAccountId: session.data?.accountId,
                              source: c.source,
                              procurementMethod: 'TENDER',
                            },
                            fields: opportunityFields(people.data ?? [], [c]),
                          })
                        }
                      >
                        登记商机
                      </AddButton>
                    )}
                </>
              }
            />
            {c.mergedIntoId && (
              <Alert
                type="info"
                showIcon
                title={
                  <>
                    本档案已归并至{' '}
                    <Link to={`/crm/customers/${c.mergedIntoId}`}>
                      有效客户档案
                    </Link>
                    ，历史信息保留。
                  </>
                }
              />
            )}
            <Facts
              items={[
                { label: '客户负责人', value: c.ownerName },
                { label: '客户类型', value: label(c.kind) },
                {
                  label: '关联商机',
                  value: data.opportunities.length,
                  note: '当前有权查看的商机',
                },
                {
                  label: '联系人',
                  value: data.contacts.length,
                  note: '联系方式按权限展示',
                },
              ]}
            />
            <div className="business-split">
              <div className="business-stack">
                <Panel title="客户信息">
                  <Descriptions
                    column={{ xs: 1, sm: 2 }}
                    size="small"
                    items={[
                      {
                        key: 'identifier',
                        label: '主体标识',
                        children: c.identifier ?? '待补充',
                        span: 2,
                      },
                      {
                        key: 'industry',
                        label: '所属行业',
                        children: c.industry ?? '—',
                      },
                      {
                        key: 'region',
                        label: '所在区域',
                        children: c.region ?? '—',
                      },
                      { key: 'source', label: '客户来源', children: c.source },
                      {
                        key: 'updated',
                        label: '最近更新',
                        children: dateTime(c.updatedAt),
                      },
                    ]}
                  />
                </Panel>
                <Panel
                  title="关键联系人"
                  className="business-panel--table"
                  extra={
                    can('CRM_CONTACT_EDIT') &&
                    can('CRM_CONTACT_READ') && (
                      <Button
                        size="small"
                        onClick={() => setCommand(contactCommand())}
                      >
                        添加联系人
                      </Button>
                    )
                  }
                >
                  <Table<Contact>
                    rowKey="id"
                    size="small"
                    dataSource={data.contacts}
                    pagination={false}
                    scroll={{ x: 620 }}
                    columns={[
                      {
                        title: '姓名 / 职务',
                        render: (_, r) => (
                          <>
                            {r.name}
                            <span className="business-cell-sub">
                              {r.position ?? '—'}
                            </span>
                          </>
                        ),
                      },
                      {
                        title: '联系方式',
                        render: (_, r) =>
                          r.contactVisible ? (
                            <>
                              {r.phone ?? '—'}
                              <span className="business-cell-sub">
                                {r.email ?? '—'}
                              </span>
                            </>
                          ) : (
                            <span className="business-muted">
                              需联系方式查看权限
                            </span>
                          ),
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (v) => <Status value={v} />,
                      },
                      {
                        title: '操作',
                        width: 70,
                        render: (_, r) =>
                          can('CRM_CONTACT_EDIT') &&
                          r.contactVisible && (
                            <button
                              className="business-link"
                              onClick={() => setCommand(contactCommand(r))}
                            >
                              编辑
                            </button>
                          ),
                      },
                    ]}
                  />
                </Panel>
                <Panel title="关联商机" className="business-panel--table">
                  <Table<Opportunity>
                    rowKey="id"
                    size="small"
                    dataSource={data.opportunities}
                    pagination={false}
                    columns={[
                      {
                        title: '商机',
                        render: (_, r) => (
                          <Link to={`/crm/opportunities/${r.id}`}>
                            {r.title}
                          </Link>
                        ),
                      },
                      { title: '分级', dataIndex: 'grade' },
                      {
                        title: '预计金额',
                        dataIndex: 'estimatedAmount',
                        render: money,
                      },
                      {
                        title: '结果',
                        dataIndex: 'result',
                        render: (v, row) => (
                          <Status
                            value={v}
                            text={resultLabel(v, row.procurementMethod)}
                          />
                        ),
                      },
                    ]}
                    scroll={{ x: 560 }}
                  />
                </Panel>
              </div>
              <Panel title="档案动态">
                <History events={data.history} />
              </Panel>
            </div>
          </>
        )}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
      {merge && c && (
        <CustomerMerge target={c} onClose={() => setMerge(false)} />
      )}
    </BusinessPage>
  )
}
function CustomerMerge({
  target,
  onClose,
}: {
  target: Customer
  onClose: () => void
}) {
  const [q, setQ] = useState(''),
    [source, setSource] = useState<string>(),
    [preview, setPreview] = useState<MergePreview>(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string>()
  const candidates = useBusinessQuery<Page<Customer>>(
    `/api/crm/customers?status=ACTIVE&pageSize=50&q=${encodeURIComponent(useDeferredValue(q))}`,
  )
  const [command, setCommand] = useState<Command | null>(null)
  async function inspect() {
    if (!source) return
    setLoading(true)
    try {
      setPreview(
        await postJson<MergePreview>(
          `/api/crm/customers/${target.id}/merge-preview`,
          { sourceId: source },
        ),
      )
      setError(undefined)
    } catch (e) {
      setError(getProblemMessage(e))
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <Drawer
        title="合并预览"
        open
        size={660}
        onClose={onClose}
        maskClosable={false}
        destroyOnHidden
      >
        <p className="business-form-intro">
          保留客户：{target.name}。先核对影响范围，再提交合并。
        </p>
        <Space wrap>
          <Select
            aria-label="选择待合并客户"
            style={{ width: 320, maxWidth: '100%' }}
            showSearch={{ onSearch: setQ, filterOption: false }}
            placeholder="搜索并选择待合并客户"
            options={candidates.data?.items
              .filter((c) => c.id !== target.id)
              .map((c) => ({ value: c.id, label: c.name }))}
            value={source}
            onChange={(v) => {
              setSource(v)
              setPreview(undefined)
            }}
          />
          <Button
            loading={loading}
            disabled={!source}
            onClick={() => void inspect()}
          >
            预览影响
          </Button>
        </Space>
        {error && <Alert type="error" title={error} />}{' '}
        {preview && (
          <div className="business-stack" style={{ marginTop: 16 }}>
            <Alert
              type="warning"
              showIcon
              title={`将归并 ${preview.contacts} 位联系人、${preview.opportunities} 条商机`}
              description={
                preview.conflicts.length
                  ? preview.conflicts.join('；')
                  : '没有检测到字段冲突。原客户保留为已合并档案。'
              }
            />
            <Button
              type="primary"
              onClick={() =>
                setCommand({
                  title: '确认合并客户',
                  path: `/api/crm/customers/${target.id}/merge`,
                  values: {
                    version: preview.target.version,
                    sourceId: preview.source.id,
                    sourceVersion: preview.source.version,
                    fieldPolicy: 'KEEP_TARGET',
                  },
                  fields: [
                    {
                      name: 'fieldPolicy',
                      label: '冲突字段处理',
                      type: 'select',
                      options: [
                        { value: 'KEEP_TARGET', label: '保留目标客户字段' },
                        {
                          value: 'USE_SOURCE',
                          label: '采用待合并客户的非空字段',
                        },
                      ],
                      wide: true,
                    },
                    reasonField,
                  ],
                  description: `${preview.source.name} → ${preview.target.name}。联系人与商机归入目标档案；历史来源保持可追溯。`,
                  onSuccess: onClose,
                  submitLabel: '确认合并',
                })
              }
            >
              继续合并
            </Button>
          </div>
        )}
      </Drawer>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </>
  )
}

export function OpportunityWorkspace() {
  const { id } = useParams()
  return id ? <OpportunityRecord id={id} /> : <OpportunityList />
}
function OpportunityList() {
  const filters = useListFilters(),
    navigate = useNavigate(),
    people = usePeople(),
    capabilities = useCapabilities(),
    session = useCurrentSession()
  const query = useBusinessQuery<Page<Opportunity>>(
      `/api/crm/opportunities?${filters.query}`,
    ),
    customers = useBusinessQuery<Page<Customer>>(
      '/api/crm/customers?status=ACTIVE&pageSize=50',
    )
  const [command, setCommand] = useState<Command | null>(null)
  return (
    <BusinessPage>
      <PageHeading
        title="商机管理"
        description="分级判断机会质量，跟进记录下一步行动，经营结果单独确认。"
        extra={
          <>
            <RefreshButton onClick={query.refetch} />
            {capabilities.data?.includes('CRM_OPPORTUNITY_CREATE') && (
              <AddButton
                onClick={() =>
                  setCommand({
                    title: '登记商机',
                    description:
                      '登记后从 D 级、线索识别开始；后续根据事实独立调整商机分级与销售进度。',
                    path: '/api/crm/opportunities',
                    values: {
                      ownerAccountId: session.data?.accountId,
                      procurementMethod: 'TENDER',
                    },
                    fields: opportunityFields(
                      people.data ?? [],
                      customers.data?.items ?? [],
                    ),
                    onSuccess: (r) =>
                      navigate(
                        `/crm/opportunities/${(r as OpportunityDetail).opportunity.id}`,
                      ),
                  })
                }
              >
                登记商机
              </AddButton>
            )}
          </>
        }
      />
      <Panel
        className="business-panel--table"
        title="商机跟进台账"
        extra={
          <span className="business-muted">
            {query.data?.total ?? '—'} 条符合条件
          </span>
        }
      >
        <div className="business-panel-body business-toolbar">
          <Input.Search
            aria-label="搜索商机"
            placeholder="搜索商机、客户、采购事件"
            defaultValue={filters.params.get('q') ?? ''}
            allowClear
            onSearch={(v) => filters.update('q', v)}
          />
          <Select
            aria-label="商机分级"
            placeholder="全部分级"
            options={options(['A', 'B', 'C', 'D'])}
            value={filters.params.get('grade') ?? undefined}
            allowClear
            onChange={(v) => filters.update('grade', v)}
          />
          <Select
            aria-label="跟进健康度"
            placeholder="全部跟进状态"
            options={options([
              'ON_TRACK',
              'MISSING_ACTION',
              'OVERDUE',
              'STALE',
              'CLOSED',
            ])}
            value={filters.params.get('health') ?? undefined}
            allowClear
            onChange={(v) => filters.update('health', v)}
          />
          <Select
            aria-label="商机状态"
            placeholder="全部商机"
            options={options(['ACTIVE', 'CLOSED'])}
            value={filters.params.get('status') ?? undefined}
            allowClear
            onChange={(v) => filters.update('status', v)}
          />
        </div>
        <QueryState query={query}>
          <Table<Opportunity>
            rowKey="id"
            size="small"
            dataSource={query.data?.items}
            scroll={{ x: 1230 }}
            pagination={pager(query.data, (page, size) => {
              filters.update('pageSize', size)
              filters.update('page', page)
            })}
            columns={[
              {
                title: '商机 / 客户',
                width: 280,
                render: (_, r) => (
                  <>
                    <Link
                      className="business-cell-title"
                      to={`/crm/opportunities/${r.id}`}
                    >
                      {r.title}
                    </Link>
                    <span className="business-cell-sub">{r.customerName}</span>
                  </>
                ),
              },
              {
                title: '分级',
                dataIndex: 'grade',
                width: 66,
                render: (v) => <TagGrade value={v} />,
              },
              {
                title: '销售进度',
                dataIndex: 'progress',
                width: 110,
                render: label,
              },
              {
                title: '预计金额',
                dataIndex: 'estimatedAmount',
                width: 140,
                render: money,
              },
              { title: '负责人', dataIndex: 'ownerName', width: 90 },
              {
                title: '下一步行动',
                width: 245,
                render: (_, r) => (
                  <div className="business-cell-multiline">
                    {r.nextAction ?? '待补充行动计划'}
                    <span className="business-cell-sub">
                      {r.nextOwnerName ?? '—'} · {r.nextDueDate ?? '未定日期'}
                    </span>
                  </div>
                ),
              },
              {
                title: '跟进状态',
                dataIndex: 'health',
                width: 115,
                render: (v) => <Status value={v} />,
              },
              {
                title: '经营结果',
                dataIndex: 'result',
                width: 100,
                render: (v, row) => (
                  <Status
                    value={v}
                    text={resultLabel(v, row.procurementMethod)}
                  />
                ),
              },
            ]}
          />
        </QueryState>
      </Panel>
      <div className="business-two-col">
        <Panel title="让每次跟进指向下一步">
          <p className="business-text business-text-small">
            记录沟通事实，并明确下一步行动、责任人和日期。逾期、超过 30
            天未跟进或缺少行动计划的商机会在列表中提示。
          </p>
        </Panel>
        <Panel title="开始售前协作">
          <p className="business-text business-text-small">
            打开商机，创建唯一的项目空间，指定售前负责人。现场调研、需求梳理、方案与报价等动作可并行推进。
          </p>
        </Panel>
      </div>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </BusinessPage>
  )
}
function TagGrade({ value }: { value: string }) {
  return (
    <span
      style={{ fontWeight: 650, color: value === 'A' ? '#2167f3' : '#60718a' }}
    >
      {value} 级
    </span>
  )
}
function OpportunityRecord({ id }: { id: string }) {
  const query = useBusinessQuery<OpportunityDetail>(
      `/api/crm/opportunities/${id}`,
    ),
    people = usePeople(),
    session = useCurrentSession(),
    navigate = useNavigate()
  const [command, setCommand] = useState<Command | null>(null),
    data = query.data,
    o = data?.opportunity
  const can = (a: string) => data?.allowedActions.includes(a)
  const base = `/api/crm/opportunities/${id}`
  return (
    <BusinessPage>
      <Link to="/crm/opportunities">
        <ArrowLeft size={14} className="inline" /> 返回商机列表
      </Link>
      <QueryState query={query}>
        {o && data && (
          <>
            <PageHeading
              title={o.title}
              description={`${o.code}${o.eventKey ? ` · ${o.eventKey}` : ''}`}
              extra={
                <>
                  <Status value={o.status} />
                  {can('CRM_OPPORTUNITY_EDIT') && (
                    <Button
                      onClick={() =>
                        setCommand({
                          title: '编辑商机信息',
                          path: base,
                          method: 'PATCH',
                          values: { ...o },
                          fields: opportunityFields(people.data ?? [], [
                            {
                              id: o.customerId,
                              name: o.customerName,
                            } as Customer,
                          ]).map((f) =>
                            ['customerId', 'ownerAccountId'].includes(f.name)
                              ? { ...f, disabled: true }
                              : f,
                          ),
                        })
                      }
                    >
                      编辑信息
                    </Button>
                  )}
                  {o.projectId ? (
                    <Button
                      type="primary"
                      onClick={() => navigate(`/projects/${o.projectId}`)}
                    >
                      进入项目空间 <ArrowUpRight size={15} />
                    </Button>
                  ) : (
                    can('PROJECT_CREATE') && (
                      <AddButton
                        onClick={() =>
                          setCommand({
                            title: '创建项目空间',
                            path: '/api/projects',
                            values: {
                              opportunityId: id,
                              presalesOwnerId: session.data?.accountId,
                            },
                            description:
                              '沿用客户与商机信息，建立售前协作空间。立项通过后才能在批准范围内记录投入。',
                            fields: [
                              personField(
                                'presalesOwnerId',
                                '售前负责人',
                                people.data ?? [],
                              ),
                            ],
                            onSuccess: (r) =>
                              navigate(
                                `/projects/${(r as ProjectDetail).project.id}`,
                              ),
                          })
                        }
                      >
                        创建项目空间
                      </AddButton>
                    )
                  )}
                </>
              }
            />
            <Facts
              items={[
                { label: '商机分级', value: <TagGrade value={o.grade} /> },
                { label: '销售进度', value: label(o.progress) },
                {
                  label: '预计金额',
                  value: money(o.estimatedAmount),
                  note: o.targetDate
                    ? `目标签约 ${o.targetDate}`
                    : '目标签约日期待明确',
                },
                {
                  label:
                    o.procurementMethod === 'TENDER'
                      ? '招投标结果'
                      : '经营结果',
                  value: resultLabel(o.result, o.procurementMethod),
                  note:
                    o.procurementMethod === 'TENDER'
                      ? '结果需明确记录'
                      : '直接采购',
                },
              ]}
            />
            <div className="business-split">
              <div className="business-stack">
                <Panel title="下一步行动" extra={<Status value={o.health} />}>
                  {o.nextAction ? (
                    <>
                      <p className="business-text">{o.nextAction}</p>
                      <div className="business-detail-meta">
                        <span>责任人 {o.nextOwnerName}</span>
                        <span>计划日期 {o.nextDueDate}</span>
                      </div>
                    </>
                  ) : (
                    <p className="business-text business-muted">
                      尚未明确下一步行动，请在跟进中补充责任人和计划日期。
                    </p>
                  )}
                  {can('CRM_OPPORTUNITY_EDIT') && (
                    <Button
                      type="primary"
                      style={{ marginTop: 12 }}
                      onClick={() =>
                        setCommand({
                          title: '记录商机跟进',
                          path: `${base}/activities`,
                          values: {
                            version: o.version,
                            assigneeId: session.data?.accountId,
                          },
                          fields: [
                            {
                              name: 'fact',
                              label: '本次沟通事实',
                              type: 'textarea',
                            },
                            {
                              name: 'nextAction',
                              label: '下一步行动',
                              type: 'textarea',
                              required: false,
                            },
                            {
                              ...personField(
                                'assigneeId',
                                '下一步责任人',
                                people.data ?? [],
                              ),
                              required: false,
                            },
                            {
                              name: 'dueDate',
                              label: '行动日期',
                              type: 'date',
                              required: false,
                            },
                          ],
                          description:
                            '下一步行动、责任人和日期需同时填写；暂无下一步时三项均留空。',
                          transform: (v) => {
                            if (!v.nextAction)
                              return { ...v, assigneeId: null, dueDate: null }
                            return v
                          },
                        })
                      }
                    >
                      记录跟进
                    </Button>
                  )}
                </Panel>
                <Panel title="商机背景">
                  <Descriptions
                    column={{ xs: 1, sm: 2 }}
                    size="small"
                    items={[
                      {
                        key: 'customer',
                        label: '客户',
                        children: (
                          <Link to={`/crm/customers/${o.customerId}`}>
                            {o.customerName}
                          </Link>
                        ),
                        span: 2,
                      },
                      {
                        key: 'owner',
                        label: '营销负责人',
                        children: o.ownerName,
                      },
                      { key: 'source', label: '商机来源', children: o.source },
                    ]}
                  />
                  <p
                    className="business-text business-text-small"
                    style={{ marginTop: 12 }}
                  >
                    {o.background ?? '背景待补充'}
                  </p>
                </Panel>
                <Panel title="跟进记录">
                  <Tabs
                    items={[
                      {
                        key: 'activities',
                        label: `沟通事实 ${data.activities.length}`,
                        children: data.activities.length ? (
                          <div>
                            {data.activities.map((a) => (
                              <div className="business-output-row" key={a.id}>
                                <span className="business-output-icon">
                                  <FileText size={17} />
                                </span>
                                <div className="business-output-info">
                                  <p className="business-text business-text-small">
                                    {a.fact}
                                  </p>
                                  {a.nextAction && (
                                    <p className="business-cell-sub">
                                      下一步：{a.nextAction} · {a.assigneeName}{' '}
                                      · {a.dueDate}
                                    </p>
                                  )}
                                  <p className="business-cell-sub">
                                    {a.recordedByName} · {dateTime(a.createdAt)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="尚未记录跟进"
                          />
                        ),
                      },
                      {
                        key: 'history',
                        label: '完整操作历史',
                        children: <History events={data.history} />,
                      },
                    ]}
                  />
                </Panel>
              </div>
              <div className="business-stack business-rail">
                <Panel title="商机判断">
                  <p className="business-form-intro">
                    分级和销售进度独立维护，每次调整都记录依据。
                  </p>
                  {can('CRM_OPPORTUNITY_EDIT') && (
                    <Space wrap>
                      <Button
                        onClick={() =>
                          setCommand({
                            title: '调整商机分级',
                            path: `${base}/classification`,
                            values: { version: o.version, grade: o.grade },
                            fields: [
                              {
                                name: 'grade',
                                label: '商机分级',
                                type: 'select',
                                options: options(['A', 'B', 'C', 'D']),
                              },
                              reasonField,
                            ],
                          })
                        }
                      >
                        调整分级
                      </Button>
                      <Button
                        onClick={() =>
                          setCommand({
                            title: '调整销售进度',
                            path: `${base}/classification`,
                            values: {
                              version: o.version,
                              progress: o.progress,
                            },
                            fields: [
                              {
                                name: 'progress',
                                label: '销售进度',
                                type: 'select',
                                options: options([
                                  'LEAD',
                                  'QUALIFIED',
                                  'SOLUTION',
                                  'QUOTATION',
                                  'NEGOTIATION',
                                ]),
                              },
                              reasonField,
                            ],
                          })
                        }
                      >
                        调整进度
                      </Button>
                    </Space>
                  )}
                </Panel>
                <Panel title="经营结果">
                  <div className="business-gate">
                    <div className="business-gate-title">
                      <Building2 size={16} />
                      {o.procurementMethod === 'TENDER' ? '招投标' : '直接采购'}
                      <Status
                        value={o.result}
                        text={resultLabel(o.result, o.procurementMethod)}
                      />
                    </div>
                    <p>
                      成功后继续合同与项目衔接；失败、取消或终止将关闭售前空间，保留全部历史。
                    </p>
                  </div>
                  {can('CRM_OPPORTUNITY_RESULT') &&
                    (o.status === 'CLOSED' ? (
                      <Button
                        onClick={() =>
                          setCommand({
                            title: '重开商机',
                            path: `${base}/reopen`,
                            values: { version: o.version },
                            fields: [reasonField],
                            description:
                              '重开后结果回到待定，恢复原售前项目状态；原关闭原因与证据保留。',
                          })
                        }
                      >
                        重开商机
                      </Button>
                    ) : (
                      <Button
                        onClick={() =>
                          setCommand({
                            title: '记录经营结果',
                            path: `${base}/result`,
                            values: {
                              version: o.version,
                              reasonCategory: 'OTHER',
                            },
                            fields: [
                              {
                                name: 'result',
                                label: '经营结果',
                                type: 'select',
                                options: options([
                                  'SUCCESS',
                                  'FAILURE',
                                  'CUSTOMER_CANCELLED',
                                  'TERMINATED',
                                ]),
                              },
                              {
                                name: 'reasonCategory',
                                label: '原因分类',
                                type: 'select',
                                options: options([
                                  'PRICE',
                                  'TECHNICAL',
                                  'TIMING',
                                  'CUSTOMER',
                                  'OTHER',
                                ]),
                              },
                              reasonField,
                              {
                                name: 'evidence',
                                label: '结果依据 / 证据',
                                type: 'textarea',
                              },
                            ],
                            transform: (v) => ({
                              ...v,
                              status:
                                v.result === 'SUCCESS' ? 'ACTIVE' : 'CLOSED',
                            }),
                            submitLabel: '确认结果',
                          })
                        }
                      >
                        记录结果
                      </Button>
                    ))}
                </Panel>
              </div>
            </div>
          </>
        )}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </BusinessPage>
  )
}
