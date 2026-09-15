import { TaskDetailPage } from '@/features/tasks/task-workspace'
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
} from 'antd'
import { ArrowLeft, ArrowUpRight, ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCurrentSession } from '@/features/auth/auth-session'
import { WorkPackageContext } from '@/features/delivery/work-package-context'
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
  Assessment,
  Page,
  Project,
  ProjectDetail,
  Requirement,
  RequirementDetail,
  WorkDetail,
  WorkReference,
} from '@/features/business/business-types'

const impactFields: Field[] = [
  { name: 'clarification', label: '澄清后的需求', type: 'textarea' },
  { name: 'category', label: '需求类别' },
  {
    name: 'baselineImpact',
    label: '影响已确认的范围 / 合同 / 验收基线',
    type: 'switch',
  },
  { name: 'scopeImpact', label: '范围影响', type: 'textarea' },
  { name: 'technicalImpact', label: '技术影响', type: 'textarea' },
  { name: 'scheduleImpact', label: '工期影响', type: 'textarea' },
  { name: 'costImpact', label: '成本影响', type: 'textarea' },
  { name: 'contractImpact', label: '合同影响', type: 'textarea' },
  { name: 'acceptanceImpact', label: '验收影响', type: 'textarea' },
  { name: 'safetyImpact', label: '安全影响', type: 'textarea' },
]
const lifecycle = [
  'NEW',
  'ASSESSED',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'CLOSED',
]

function RequirementPeopleFields() {
  const id = Form.useWatch<string>('projectId')
  const query = useBusinessQuery<ProjectDetail>(
    id ? `/api/projects/${id}` : undefined,
  )
  const people =
    query.data?.members
      .filter((m) => m.active)
      .map((m) => ({ value: m.accountId, label: m.name })) ?? []
  return (
    <div className="business-form-grid">
      <Form.Item
        name="ownerAccountId"
        label="处理责任人"
        rules={[{ required: true, message: '请选择处理责任人' }]}
      >
        <Select
          showSearch={{ optionFilterProp: 'label' }}
          loading={query.isFetching}
          options={people}
          placeholder="选择项目成员"
        />
      </Form.Item>
      <Form.Item
        name="verifierAccountId"
        label="独立验证人"
        dependencies={['ownerAccountId']}
        rules={[
          { required: true, message: '请选择验证人' },
          ({ getFieldValue }) => ({
            validator: (_, value) =>
              value && value === getFieldValue('ownerAccountId')
                ? Promise.reject(new Error('验证人须与处理人不同'))
                : Promise.resolve(),
          }),
        ]}
      >
        <Select
          showSearch={{ optionFilterProp: 'label' }}
          options={people}
          placeholder="选择另一位项目成员"
        />
      </Form.Item>
      {query.isError && (
        <Alert
          className="business-field-wide"
          type="error"
          title="项目成员读取失败，请重新选择项目或重试。"
        />
      )}
    </div>
  )
}
export function RequirementWorkspace() {
  const { id } = useParams()
  return id ? (
    <RequirementRecord id={id} />
  ) : (
    <BusinessPage>
      <RequirementList />
    </BusinessPage>
  )
}
export function RequirementList({ project }: { project?: ProjectDetail }) {
  const filters = useListFilters(),
    navigate = useNavigate(),
    [command, setCommand] = useState<Command | null>(null)
  const params = new URLSearchParams(filters.params)
  if (project) params.set('projectId', project.project.id)
  const query = useBusinessQuery<Page<Requirement>>(
    `/api/requirements?${params}`,
  )
  const people = usePeople()
  const projects = useBusinessQuery<Page<Project>>(
    !project ? '/api/projects?pageSize=50' : undefined,
  )
  const selected = filters.params.get('projectId')
  const selectedProject = useBusinessQuery<ProjectDetail>(
    !project && selected ? `/api/projects/${selected}` : undefined,
  )
  const canCreate = (project ?? selectedProject.data)?.allowedActions.includes(
    'REQUIREMENT_CREATE',
  )
  const create = () =>
    setCommand({
      title: '登记原始需求',
      path: '/api/requirements',
      description:
        '原始诉求、来源和提出人保存后不可改写。先原样记录，再补充澄清、影响分析与处理决策。',
      values: {
        projectId: project?.project.id ?? selected,
        source: 'CUSTOMER',
        priority: 'NORMAL',
        importantCustomer: false,
      },
      fields: [
        {
          name: 'projectId',
          label: '所属项目',
          type: 'select',
          wide: true,
          disabled: !!project,
          options: project
            ? [{ value: project.project.id, label: project.project.name }]
            : projects.data?.items
                .filter((p) => p.status !== 'CLOSED')
                .map((p) => ({ value: p.id, label: p.name })),
        },
        { name: 'title', label: '需求标题', wide: true },
        {
          name: 'originalText',
          label: '原始诉求（原文）',
          type: 'textarea',
          maxLength: 8000,
        },
        {
          name: 'source',
          label: '需求来源',
          type: 'select',
          options: options([
            'SALES',
            'PRESALES',
            'DELIVERY',
            'CUSTOMER',
            'INTERNAL',
          ]),
        },
        { name: 'requester', label: '提出人 / 提出单位' },
        {
          name: 'priority',
          label: '优先级',
          type: 'select',
          options: options(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
        },
        {
          name: 'expectedOn',
          label: '期望完成日期',
          type: 'date',
          required: false,
        },
        {
          name: 'importantCustomer',
          label: '重要客户诉求，关闭时需客户确认依据',
          type: 'switch',
          wide: true,
        },
      ],
      formExtra: <RequirementPeopleFields />,
      onSuccess: (r) =>
        navigate(`/requirements/${(r as RequirementDetail).requirement.id}`),
    })
  return (
    <div className="business-stack">
      <PageHeading
        title={project ? '项目需求池' : '需求池'}
        description="原文留存 → 影响分析 → 人工分流 → 执行处理 → 独立验证"
        extra={
          <>
            <RefreshButton onClick={query.refetch} />
            {(canCreate || (!project && !selected)) && (
              <AddButton onClick={create}>登记需求</AddButton>
            )}
          </>
        }
      />
      <Panel
        title="需求处理队列"
        className="business-panel--table"
        extra={
          <span className="business-muted">
            {query.data?.total ?? '—'} 条符合条件
          </span>
        }
      >
        <div className="business-panel-body business-toolbar">
          <Input.Search
            aria-label="搜索需求"
            placeholder="搜索需求标题、编号或原文"
            defaultValue={filters.params.get('q') ?? ''}
            allowClear
            onSearch={(v) => filters.update('q', v)}
          />
          {!project && (
            <Select
              aria-label="筛选项目"
              style={{ minWidth: 180 }}
              placeholder="全部项目"
              showSearch={{ optionFilterProp: 'label' }}
              value={selected ?? undefined}
              allowClear
              options={projects.data?.items.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              onChange={(v) => filters.update('projectId', v)}
            />
          )}
          <Select
            aria-label="需求状态"
            placeholder="全部状态"
            value={filters.params.get('status') ?? undefined}
            allowClear
            options={options([
              'NEW',
              'ASSESSED',
              'IN_PROGRESS',
              'PENDING_VERIFICATION',
              'CLOSED',
              'ON_HOLD',
              'REJECTED',
            ])}
            onChange={(v) => filters.update('status', v)}
          />
          <Select
            aria-label="优先级"
            placeholder="全部优先级"
            value={filters.params.get('priority') ?? undefined}
            allowClear
            options={options(['URGENT', 'HIGH', 'NORMAL', 'LOW'])}
            onChange={(v) => filters.update('priority', v)}
          />
          <Select
            aria-label="需求来源"
            placeholder="全部来源"
            value={filters.params.get('source') ?? undefined}
            allowClear
            options={options([
              'SALES',
              'PRESALES',
              'DELIVERY',
              'CUSTOMER',
              'INTERNAL',
            ])}
            onChange={(v) => filters.update('source', v)}
          />
          <Select
            aria-label="处理责任人筛选"
            placeholder="全部处理人"
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            value={filters.params.get('ownerAccountId') ?? undefined}
            options={
              project
                ? project.members.map((m) => ({
                    value: m.accountId,
                    label: m.name,
                  }))
                : people.data?.map((p) => ({ value: p.id, label: p.name }))
            }
            onChange={(v) => filters.update('ownerAccountId', v)}
          />
        </div>
        <QueryState query={query}>
          <Table<Requirement>
            rowKey="id"
            size="small"
            dataSource={query.data?.items}
            scroll={{ x: 1080 }}
            pagination={pager(query.data, (page, size) => {
              filters.update('pageSize', size)
              filters.update('page', page)
            })}
            columns={[
              {
                title: '需求 / 项目',
                width: 295,
                render: (_, r) => (
                  <>
                    <Link
                      className="business-cell-title"
                      to={`/requirements/${r.id}`}
                    >
                      {r.title}
                    </Link>
                    <span className="business-cell-sub">
                      {r.code}
                      {!project ? ` · ${r.projectName}` : ''}
                    </span>
                  </>
                ),
              },
              { title: '来源', dataIndex: 'source', width: 80, render: label },
              {
                title: '优先级',
                dataIndex: 'priority',
                width: 80,
                render: (v) => <Status value={v} />,
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: (v) => <Status value={v} />,
              },
              {
                title: '处理 / 验证',
                width: 135,
                render: (_, r) => (
                  <>
                    {r.ownerName}
                    <span className="business-cell-sub">
                      验证 · {r.verifierName}
                    </span>
                  </>
                ),
              },
              {
                title: '处理路径',
                dataIndex: 'disposition',
                width: 110,
                render: label,
              },
              {
                title: '期望完成',
                dataIndex: 'expectedOn',
                width: 110,
                render: (v) => v ?? '—',
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
        <Panel title="处理路径由人确认">
          <p className="business-text business-text-small">
            可以直接处理、暂缓、拒绝，或关联任务、问题、工作包草稿和变更。影响已确认基线时，必须走正式变更。
          </p>
        </Panel>
        <Panel title="完成后继续验证">
          <p className="business-text business-text-small">
            处理完成需提供证据，再由独立人员验证；重要客户诉求还需客户确认依据。完成下游工作不会自动关闭原需求。
          </p>
        </Panel>
      </div>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </div>
  )
}
function AssessmentContent({ assessment }: { assessment: Assessment }) {
  return (
    <dl className="business-assessment">
      {impactFields.map((f) => (
        <div key={f.name} style={{ display: 'contents' }}>
          <dt>{f.label}</dt>
          <dd>
            {f.name === 'baselineImpact'
              ? assessment.baselineImpact
                ? '是，需正式变更'
                : '否'
              : String(assessment[f.name as keyof Assessment] ?? '—')}
          </dd>
        </div>
      ))}
    </dl>
  )
}
function RequirementRecord({ id }: { id: string }) {
  const query = useBusinessQuery<RequirementDetail>(`/api/requirements/${id}`),
    session = useCurrentSession(),
    [command, setCommand] = useState<Command | null>(null)
  const data = query.data,
    r = data?.requirement,
    base = `/api/requirements/${id}`
  const project = useBusinessQuery<ProjectDetail>(
    r ? `/api/projects/${r.projectId}` : undefined,
  )
  const work = useBusinessQuery<WorkReference[]>(
    r ? `/api/work-items?projectId=${r.projectId}` : undefined,
  )
  const can = (a: string) => data?.allowedActions.includes(a)
  const latest = data?.assessments[0],
    members =
      project.data?.members
        .filter((m) => m.active)
        .map((m) => ({
          id: m.accountId,
          name: m.name,
          organizationUnitId: '',
        })) ?? []
  const edit = (): Command => ({
    title: '调整需求责任与优先级',
    path: base,
    method: 'PATCH',
    values: r ? { ...r } : {},
    description:
      '原始诉求保持不变。责任交接会保留历任处理人，原处理人不能通过交接转为验证人。',
    fields: [
      personField('ownerAccountId', '处理责任人', members),
      personField('verifierAccountId', '独立验证人', members),
      {
        name: 'priority',
        label: '优先级',
        type: 'select',
        options: options(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
      },
      {
        name: 'expectedOn',
        label: '期望完成日期',
        type: 'date',
        required: false,
      },
      reasonField,
    ],
  })
  const assess = (): Command => ({
    title: '澄清与影响分析',
    path: `${base}/assess`,
    values: {
      ...(latest ?? {}),
      version: r?.version,
      baselineImpact: latest?.baselineImpact ?? false,
    },
    description:
      '原始需求不变；本次澄清及七类影响形成独立评估记录。没有影响的项目也需说明依据。',
    fields: impactFields,
    submitLabel: '保存影响分析',
  })
  const route = (): Command => ({
    title: '确认需求处理路径',
    path: `${base}/route`,
    values: {
      version: r?.version,
      disposition: latest?.baselineImpact ? 'CHANGE' : 'DIRECT',
    },
    description: latest?.baselineImpact
      ? '本需求影响已确认基线，执行前必须建立并批准正式变更。'
      : '根据影响分析选择处理方式。转为下游工作时可新建记录，也可关联本项目已有记录。',
    fields: [
      {
        name: 'disposition',
        label: '处理方式',
        type: 'select',
        wide: true,
        options: options(
          latest?.baselineImpact
            ? ['CHANGE', 'HOLD', 'REJECT']
            : [
                'DIRECT',
                'TASK',
                'ISSUE',
                'WORK_PACKAGE',
                'CHANGE',
                'HOLD',
                'REJECT',
              ],
        ),
      },
      {
        name: 'existingWorkItemId',
        label: '关联已有处理记录（留空则新建）',
        type: 'select',
        required: false,
        wide: true,
        options: work.data?.map((w) => ({
          value: w.id,
          label: `${label(w.kind)} · ${w.title} · ${label(w.status)}`,
        })),
      },
      reasonField,
    ],
    submitLabel: '确认分流',
  })
  const verify = (): Command => ({
    title: '独立验证需求',
    path: `${base}/verify`,
    values: { version: r?.version, decision: 'APPROVED' },
    description:
      '依据完成证据和原始诉求核对结果。验证通过后关闭；不满足条件时退回继续处理。',
    fields: [
      {
        name: 'decision',
        label: '验证结论',
        type: 'select',
        options: [
          { value: 'APPROVED', label: '验证通过，关闭需求' },
          { value: 'RETURNED', label: '退回继续处理' },
        ],
        wide: true,
      },
      { name: 'comment', label: '验证意见', type: 'textarea' },
      {
        name: 'customerEvidence',
        label: '客户确认依据',
        type: 'textarea',
        required: false,
        hint: r?.importantCustomer
          ? '重要客户诉求：验证通过时必须填写客户确认依据。'
          : '如已取得客户确认，可补充记录。',
      },
    ],
    submitLabel: '提交验证结论',
  })
  return (
    <BusinessPage>
      <Link
        to={r ? `/projects/${r.projectId}?tab=requirements` : '/requirements'}
      >
        <ArrowLeft size={14} className="inline" /> 返回需求池
      </Link>
      <QueryState query={query}>
        {r && data && (
          <>
            <PageHeading
              title={r.title}
              description={`${r.code} · ${r.projectName}`}
              extra={
                <>
                  <Status value={r.status} />
                  {can('REQUIREMENT_EDIT') &&
                    !['CLOSED', 'REJECTED'].includes(r.status) && (
                      <Button onClick={() => setCommand(edit())}>
                        调整责任
                      </Button>
                    )}
                  {can('REQUIREMENT_EDIT') &&
                    ['CLOSED', 'REJECTED', 'ON_HOLD'].includes(r.status) && (
                      <Button
                        onClick={() =>
                          setCommand({
                            title: '重开需求',
                            path: `${base}/reopen`,
                            values: { version: r.version },
                            description:
                              '原文、评估、分流与验证记录完整保留；重新进入澄清与影响分析。',
                            fields: [reasonField],
                          })
                        }
                      >
                        重开需求
                      </Button>
                    )}
                </>
              }
            />
            <Facts
              items={[
                {
                  label: '需求来源',
                  value: label(r.source),
                  note: `提出人 · ${r.requester}`,
                },
                {
                  label: '处理责任人',
                  value: r.ownerName,
                  note: `优先级 · ${label(r.priority)}`,
                },
                {
                  label: '独立验证人',
                  value: r.verifierName,
                  note: r.importantCustomer
                    ? '重要客户诉求'
                    : '独立核对完成结果',
                },
                {
                  label: '期望完成',
                  value: r.expectedOn ?? '待明确',
                  note: `处理路径 · ${label(r.disposition)}`,
                },
              ]}
            />
            <div className="business-steps" aria-label="需求处理进度">
              {lifecycle.map((s, i) => (
                <div
                  key={s}
                  className={`business-step ${s === r.status ? 'business-step--current' : ''}`}
                >
                  {i + 1}. {label(s)}
                </div>
              ))}
              {!lifecycle.includes(r.status) && (
                <div className="business-step business-step--current">
                  {label(r.status)}
                </div>
              )}
            </div>
            <div className="business-split">
              <div className="business-stack">
                <Panel
                  title={
                    <Space>
                      <ClipboardList size={17} color="#527bc3" />
                      原始诉求
                    </Space>
                  }
                  subtitle="按提出时原文保留，后续澄清单独记录。"
                >
                  <p className="business-text">{r.originalText}</p>
                </Panel>
                <Panel
                  title="澄清与影响分析"
                  extra={
                    can('REQUIREMENT_EDIT') &&
                    ['NEW', 'ASSESSED', 'ON_HOLD'].includes(r.status) && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => setCommand(assess())}
                      >
                        {latest ? '补充评估' : '开始澄清'}
                      </Button>
                    )
                  }
                >
                  {data.assessments.length ? (
                    <Tabs
                      items={data.assessments.map((a, i) => ({
                        key: a.id,
                        label:
                          i === 0
                            ? '最新评估'
                            : `历史 ${data.assessments.length - i}`,
                        children: (
                          <>
                            <AssessmentContent assessment={a} />
                            <p className="business-muted">
                              {a.createdByName} · {dateTime(a.createdAt)}
                            </p>
                          </>
                        ),
                      }))}
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="等待澄清需求及七类影响"
                    />
                  )}
                </Panel>
                <Panel
                  title="关联处理记录"
                  subtitle="下游工作完成后，仍需对原需求提交完成证据并独立验证。"
                >
                  {data.links.length ? (
                    data.links.map((l) => (
                      <div key={l.id} className="business-output-row">
                        <span className="business-output-icon">
                          <ClipboardList size={17} />
                        </span>
                        <div className="business-output-info">
                          {l.workItemId ? (
                            <Link to={`/work-items/${l.workItemId}`}>
                              {l.title}{' '}
                              <ArrowUpRight size={13} className="inline" />
                            </Link>
                          ) : (
                            <span>{l.title}</span>
                          )}
                          <span className="business-cell-sub">
                            {label(l.kind)} ·{' '}
                            {l.active ? '当前处理路径' : '历史关联'}
                            {l.approved ? ' · 已审批' : ''}
                          </span>
                        </div>
                        <Status value={l.status} />
                      </div>
                    ))
                  ) : (
                    <p className="business-text business-text-small business-muted">
                      尚未关联下游工作；直接处理的需求可在本页提交完成证据。
                    </p>
                  )}
                </Panel>
                {r.completionEvidence && (
                  <Panel title="处理与验证证据">
                    <dl className="business-assessment">
                      <dt>完成说明</dt>
                      <dd>
                        {r.completionEvidence}
                        <span className="business-cell-sub">
                          {r.completedByName}
                        </span>
                      </dd>
                      <dt>验证意见</dt>
                      <dd>
                        {r.verificationComment ?? '待验证'}
                        {r.verifiedByName && (
                          <span className="business-cell-sub">
                            {r.verifiedByName} · {dateTime(r.verifiedAt)}
                          </span>
                        )}
                      </dd>
                      <dt>客户依据</dt>
                      <dd>{r.customerEvidence ?? '未记录'}</dd>
                    </dl>
                  </Panel>
                )}
              </div>
              <aside className="business-stack business-rail">
                <Panel title="当前待办">
                  <p
                    className="business-text business-text-small"
                    style={{ marginBottom: 12 }}
                  >
                    {r.status === 'NEW'
                      ? '补充需求澄清与七类影响分析。'
                      : r.status === 'ASSESSED'
                        ? '根据最新评估，确认人工处理路径。'
                        : r.status === 'IN_PROGRESS'
                          ? '完成当前处理记录并准备可核对的证据。'
                          : r.status === 'PENDING_VERIFICATION'
                            ? '等待独立验证；重要客户诉求需客户确认依据。'
                            : r.status === 'CLOSED'
                              ? '需求已验证关闭，处理全过程继续保留。'
                              : '当前需求未进入执行，可按新事实重开。'}
                  </p>
                  <Space wrap>
                    {can('REQUIREMENT_EDIT') &&
                      ['NEW', 'ON_HOLD'].includes(r.status) && (
                        <Button
                          type="primary"
                          onClick={() => setCommand(assess())}
                        >
                          澄清与评估
                        </Button>
                      )}
                    {can('REQUIREMENT_EDIT') && r.status === 'ASSESSED' && (
                      <Button
                        type="primary"
                        onClick={() => setCommand(route())}
                      >
                        确认处理路径
                      </Button>
                    )}
                    {can('REQUIREMENT_EDIT') && r.status === 'IN_PROGRESS' && (
                      <Button
                        type="primary"
                        onClick={() =>
                          setCommand({
                            title: '提交需求完成证据',
                            path: `${base}/complete`,
                            values: { version: r.version },
                            fields: [
                              {
                                name: 'evidence',
                                label: '完成说明与证据',
                                type: 'textarea',
                              },
                            ],
                            description:
                              '确认关联的处理记录已完成并验证。涉及基线的需求必须有已批准且完成的正式变更。',
                            submitLabel: '提交独立验证',
                          })
                        }
                      >
                        提交完成证据
                      </Button>
                    )}
                    {can('REQUIREMENT_VERIFY') &&
                      r.status === 'PENDING_VERIFICATION' &&
                      session.data?.accountId !== r.ownerAccountId && (
                        <Button
                          type="primary"
                          onClick={() => setCommand(verify())}
                        >
                          独立验证
                        </Button>
                      )}
                  </Space>
                  {latest?.baselineImpact && (
                    <div
                      className="business-warning-strip"
                      style={{ marginTop: 12 }}
                    >
                      影响已确认基线，需正式变更批准后执行。
                    </div>
                  )}
                </Panel>
                <Panel title="需求流转记录">
                  <History events={data.history} />
                </Panel>
              </aside>
            </div>
          </>
        )}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </BusinessPage>
  )
}

export function WorkItemWorkspace() {
  const { id } = useParams(),
    query = useBusinessQuery<WorkDetail>(
      id ? `/api/work-items/${id}` : undefined,
    )
  const [command, setCommand] = useState<Command | null>(null),
    w = query.data,
    can = (a: string) => w?.allowedActions.includes(a)
  const transition = (action: string, title: string): Command => ({
    title,
    path: `/api/work-items/${id}/transition`,
    values: { version: w?.version, action },
    fields: [
      {
        name: 'evidence',
        label: action === 'COMPLETE' ? '完成证据' : '结论与依据',
        type: 'textarea',
      },
    ],
    submitLabel: '确认提交',
  })
  if (w?.taskWorkPackageId)
    return <TaskDetailPage projectId={w.projectId} id={w.id} />
  return (
    <BusinessPage>
      <Link
        to={
          w?.sourceRequirementId
            ? `/requirements/${w.sourceRequirementId}`
            : w
              ? `/delivery-initiation/${w.projectId}?section=packages`
              : '/requirements'
        }
      >
        <ArrowLeft size={14} className="inline" />{' '}
        {w?.sourceRequirementId ? '返回原需求' : '返回交付立项'}
      </Link>
      <QueryState query={query}>
        {w && (
          <>
            <PageHeading
              title={w.title}
              description={`${label(w.kind)} · ${w.projectName}`}
              extra={
                <Space>
                  <Status value={w.status} />
                  {w.kind === 'WORK_PACKAGE' && (
                    <Tag>
                      {w.deliveryState === 'BASELINED'
                        ? `基线 V${w.deliveryBaselineVersion}`
                        : w.deliveryState === 'IN_REVIEW'
                          ? '基线评审中'
                          : w.deliveryState === 'RETIRED'
                            ? '范围已停用'
                            : w.deliveryState === 'LEGACY_COMPLETE'
                              ? '历史完成记录'
                              : '待批准基线'}
                    </Tag>
                  )}
                </Space>
              }
            />
            <Facts
              items={[
                { label: '处理类型', value: label(w.kind) },
                { label: '处理责任人', value: w.ownerName },
                { label: '独立验证人', value: w.verifierName },
                { label: '计划完成', value: w.dueDate ?? '待明确' },
              ]}
            />
            {w.kind === 'WORK_PACKAGE' && (
              <Alert
                type="info"
                showIcon
                title={
                  w.deliveryState === 'BASELINED'
                    ? '当前工作包已接续批准基线；负责人提交完成证据后，仍须由指定验证人独立确认。'
                    : w.deliveryState === 'IN_REVIEW'
                      ? '当前工作包正在参与交付立项评审，本轮内容冻结。'
                      : w.deliveryState === 'RETIRED'
                        ? '此工作包范围已受控停用，原身份、来源与历史保留。'
                        : w.deliveryState === 'LEGACY_COMPLETE'
                          ? '此记录保留历史完成结果。'
                          : '当前工作包沿用原记录准备交付基线，批准前不能记录正式交付完成。'
                }
                description={
                  <Link
                    to={`/delivery-initiation/${w.projectId}?section=packages`}
                  >
                    查看原工作包的阶段、范围、计划与资源
                  </Link>
                }
              />
            )}
            <div className="business-split">
              <div className="business-stack">
                <Panel title="处理范围与要求">
                  <p className="business-text">{w.description}</p>
                </Panel>
                {w.kind === 'WORK_PACKAGE' &&
                  ['PREPARING', 'IN_REVIEW', 'BASELINED', 'RETIRED'].includes(
                    w.deliveryState,
                  ) && (
                    <WorkPackageContext
                      projectId={w.projectId}
                      workItemId={w.id}
                      onOpen={setCommand}
                    />
                  )}
                {w.evidence && (
                  <Panel title="完成证据">
                    <p className="business-text">{w.evidence}</p>
                  </Panel>
                )}
                <Panel title="审批与验证">
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      {
                        key: 'approval',
                        label: '变更审批',
                        children: w.approvedByName
                          ? `${w.approvedByName} · ${dateTime(w.approvedAt)}`
                          : w.kind === 'CHANGE'
                            ? '等待审批'
                            : '本类型无需变更审批',
                      },
                      {
                        key: 'verification',
                        label: '独立验证',
                        children: w.verifiedByName
                          ? `${w.verifiedByName} · ${dateTime(w.verifiedAt)}`
                          : '等待处理完成后验证',
                      },
                      {
                        key: 'source',
                        label: '原始需求',
                        children: w.sourceRequirementId ? (
                          <Link to={`/requirements/${w.sourceRequirementId}`}>
                            查看原始诉求与影响分析
                          </Link>
                        ) : (
                          '由交付立项建立，无来源需求'
                        ),
                      },
                    ]}
                  />
                </Panel>
              </div>
              <aside className="business-stack">
                <Panel title="推进处理">
                  <Space wrap>
                    {can('SUBMIT') &&
                      w.kind === 'CHANGE' &&
                      w.status === 'OPEN' && (
                        <Button
                          type="primary"
                          onClick={() =>
                            setCommand(transition('SUBMIT', '提交变更审批'))
                          }
                        >
                          提交审批
                        </Button>
                      )}
                    {can('APPROVE') &&
                      w.kind === 'CHANGE' &&
                      w.status === 'SUBMITTED' && (
                        <>
                          <Button
                            type="primary"
                            onClick={() =>
                              setCommand(transition('APPROVE', '批准正式变更'))
                            }
                          >
                            批准变更
                          </Button>
                          <Button
                            onClick={() =>
                              setCommand(transition('RETURN', '退回变更申请'))
                            }
                          >
                            退回
                          </Button>
                        </>
                      )}
                    {can('COMPLETE') &&
                      w.status ===
                        (w.kind === 'CHANGE' ? 'APPROVED' : 'OPEN') && (
                        <Button
                          type="primary"
                          onClick={() =>
                            setCommand(transition('COMPLETE', '提交完成证据'))
                          }
                        >
                          提交完成
                        </Button>
                      )}
                    {can('VERIFY') && w.status === 'PENDING_VERIFICATION' && (
                      <>
                        <Button
                          type="primary"
                          onClick={() =>
                            setCommand(transition('VERIFY', '独立验证处理结果'))
                          }
                        >
                          验证通过
                        </Button>
                        <Button
                          onClick={() =>
                            setCommand(transition('RETURN', '退回继续处理'))
                          }
                        >
                          退回
                        </Button>
                      </>
                    )}
                  </Space>
                  <p className="business-muted" style={{ marginTop: 12 }}>
                    {w.status === 'DONE'
                      ? w.sourceRequirementId
                        ? '处理记录已完成独立验证。原需求仍须另行提交证据并关闭。'
                        : '工作包已完成独立验证，原基线与执行证据保留。'
                      : '每次提交会保留结论与依据，审批和验证由独立人员执行。'}
                  </p>
                </Panel>
                <Panel title="处理历史">
                  <History
                    events={w.history.map((event) => ({
                      ...event,
                      description: event.description
                        .replace(
                          /^(OPEN|SUBMITTED|APPROVED|PENDING_VERIFICATION|DONE) → (OPEN|SUBMITTED|APPROVED|PENDING_VERIFICATION|DONE)；/,
                          (_match, from: string, to: string) =>
                            `${label(from)} → ${label(to)}；`,
                        )
                        .replace(
                          /^从原需求人工派生 (TASK|ISSUE|WORK_PACKAGE|CHANGE)。$/,
                          (_match, kind: string) =>
                            `从原需求人工派生${label(kind)}。`,
                        ),
                    }))}
                  />
                </Panel>
              </aside>
            </div>
          </>
        )}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </BusinessPage>
  )
}
