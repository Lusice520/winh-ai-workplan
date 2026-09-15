import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tabs,
} from 'antd'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Plus,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { getJson, getProblemMessage } from '@/api/client/http'
import { useCurrentSession } from '@/features/auth/auth-session'
import {
  BusinessPage,
  CommandDrawer,
  History,
  PageHeading,
  Panel,
  QueryState,
  RefreshButton,
  type Command,
} from '@/features/business/business-ui'
import {
  dateTime,
  label,
  pager,
  useBusinessQuery,
  useListFilters,
} from '@/features/business/business-data'
import type { Page, ProjectDetail } from '@/features/business/business-types'
import { configurationLabel } from './configuration-types'
import {
  archiveObjectCommand,
  commitmentCommand,
  configurationCommand,
  findingCommand,
  headerCommand,
  objectCommand,
  resourceCommand,
  resolveFindingCommand,
  reviewCommand,
  type DeliveryEditorContext,
} from './delivery-editor'
import {
  BudgetComposition,
  BudgetLinesReadout,
  DeliveryStatus,
  ObjectReadout,
  ResourceOverlapReadout,
  SnapshotDrawer,
  StageTimeline,
  type SnapshotTarget,
} from './delivery-components'
import {
  activeObjects,
  budgetCents,
  deliveryLabel,
  deliveryOptions,
  formatCents,
  objectName,
  objectTitle,
  personName,
  type DeliveryWorkspace as WorkspaceData,
  type DeliveryRow,
  type DeliveryObject,
  type DeliveryKind,
  type DeliveryResource,
  type DeliveryFinding,
  type PublishedDeliveryConfiguration,
  type ContractNodeCandidate,
  type WorkPackageCandidate,
} from './delivery-types'
import './delivery.css'
import { TransferSection } from './transfer-section'
import { ScopeSection } from './scope-section'
import { ObjectHistory } from './object-history'

export function DeliveryWorkspacePage() {
  const { id } = useParams()
  return id ? <DeliveryProjectSection projectId={id} /> : <DeliveryQueue />
}

function DeliveryQueue() {
  const filters = useListFilters()
  const query = useBusinessQuery<Page<DeliveryRow>>(
    `/api/delivery-initiation?${filters.query}`,
  )
  return (
    <BusinessPage>
      <PageHeading
        title="交付立项"
        description="接收商务移交，组织团队、实施范围与预算，完成独立评审后形成原项目执行基线。"
        extra={<RefreshButton onClick={query.refetch} />}
      />
      <Panel
        title="立项与评审队列"
        className="business-panel--table"
        subtitle="已通过 DG-01 移交或已开始立项准备的项目。"
      >
        <div className="business-panel-body business-toolbar">
          <Input.Search
            aria-label="搜索交付立项"
            placeholder="搜索项目、客户或编号"
            defaultValue={filters.params.get('q') ?? ''}
            allowClear
            onSearch={(value) => filters.update('q', value)}
          />
          <Select
            aria-label="立项状态"
            placeholder="全部状态"
            allowClear
            value={filters.params.get('status') ?? undefined}
            options={deliveryOptions([
              'NOT_STARTED',
              'PREPARING',
              'SUBMITTED',
              'IN_REVIEW',
              'RETURNED',
              'WITHDRAWN',
              'APPROVED',
            ])}
            onChange={(value) => filters.update('status', value)}
          />
          <span className="business-toolbar-end">
            {query.data?.total ?? '—'} 个项目符合条件
          </span>
        </div>
        <QueryState query={query}>
          <Table<DeliveryRow>
            rowKey="projectId"
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
                width: 300,
                render: (_, r) => (
                  <>
                    <Link
                      className="business-cell-title"
                      to={`/delivery-initiation/${r.projectId}`}
                    >
                      {r.projectName}
                    </Link>
                    <span className="business-cell-sub">
                      {r.customerName} · {r.projectCode}
                    </span>
                  </>
                ),
              },
              {
                title: '项目经理',
                dataIndex: 'managerName',
                render: (v) => v ?? '待确认',
                width: 145,
              },
              {
                title: '立项状态',
                dataIndex: 'status',
                render: (v) => <DeliveryStatus value={v} />,
                width: 120,
              },
              {
                title: '评审 / 基线',
                render: (_, r) => (
                  <>
                    {r.roundNumber ? `第 ${r.roundNumber} 轮` : '尚未提交'}
                    <span className="business-cell-sub">
                      {r.baselineVersion
                        ? `已批准 V${r.baselineVersion}`
                        : '待形成执行基线'}
                    </span>
                  </>
                ),
                width: 140,
              },
              {
                title: '未关闭遗留',
                render: (_, r) => (
                  <>
                    {r.openFindings} 项
                    {r.overdueFindings > 0 && (
                      <span className="delivery-warning-text">
                        {' '}
                        · 逾期 {r.overdueFindings}
                      </span>
                    )}
                  </>
                ),
                width: 150,
              },
              {
                title: '最近更新',
                dataIndex: 'updatedAt',
                render: dateTime,
                width: 140,
              },
              {
                title: '操作',
                width: 90,
                render: (_, r) => (
                  <Link to={`/delivery-initiation/${r.projectId}`}>
                    打开准备
                  </Link>
                ),
              },
            ]}
          />
        </QueryState>
      </Panel>
    </BusinessPage>
  )
}

export function DeliveryProjectSection({
  projectId,
  section: fixedSection,
  project,
}: {
  projectId: string
  section?: string
  project?: ProjectDetail
}) {
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate(),
    { message } = App.useApp()
  const query = useQuery({
    queryKey: ['business', `/api/delivery-initiation/${projectId}`],
    queryFn: ({ signal }) =>
      getJson<WorkspaceData>(`/api/delivery-initiation/${projectId}`, {
        signal,
      }),
    refetchInterval: 15000,
    retry: false,
  })
  const projectQuery = useBusinessQuery<ProjectDetail>(
    project ? undefined : `/api/projects/${projectId}`,
  )
  const session = useCurrentSession(),
    actorId = session.data?.accountId ?? ''
  const [command, setCommand] = useState<Command | null>(null),
    [snapshot, setSnapshot] = useState<SnapshotTarget | null>(null),
    [opening, setOpening] = useState(false)
  const data = query.data,
    members = (project ?? projectQuery.data)?.members
  const section = fixedSection ?? params.get('section') ?? 'overview'
  const go = (next: string) =>
    fixedSection
      ? navigate(`/delivery-initiation/${projectId}?section=${next}`)
      : setParams({ section: next })
  if (!data || query.isError)
    return (
      <BusinessPage>
        <QueryState query={query}>
          <span />
        </QueryState>
      </BusinessPage>
    )
  const can = (action: string) => data.allowedActions.includes(action),
    p = data.preparation
  const ctx: DeliveryEditorContext = {
    data,
    actorId,
    people:
      members
        ?.filter((m) => m.active)
        .map((m) => ({ value: m.accountId, label: m.name })) ??
      data.people.map((p) => ({ value: p.id, label: p.name })),
    candidates: [],
    contractNodes: [],
  }
  const approved = p?.status === 'APPROVED',
    frozen = p && ['SUBMITTED', 'IN_REVIEW'].includes(p.status)
  const canEditObject = (o: DeliveryObject) =>
    !o.archived &&
    (o.kind === 'BUDGET'
      ? can('EDIT_BUDGET')
      : can('EDIT') ||
        (can('EDIT_RESPONSIBLE_OBJECTS') &&
          (o.content.stage?.ownerId === actorId ||
            o.content.workPackage?.ownerId === actorId ||
            data.objects.find(
              (w) =>
                w.id ===
                (o.content.item?.workPackageId ??
                  o.content.plan?.workPackageId),
            )?.content.workPackage?.ownerId === actorId)))
  async function editObject(kind: DeliveryKind, object?: DeliveryObject) {
    setOpening(true)
    try {
      const candidates =
        kind === 'WORK_PACKAGE' && !object
          ? await getJson<WorkPackageCandidate[]>(
              `/api/delivery-initiation/${projectId}/work-packages`,
            )
          : []
      const contractNodes =
        kind === 'MILESTONE'
          ? await getJson<ContractNodeCandidate[]>(
              `/api/delivery-initiation/${projectId}/contract-nodes`,
            )
          : []
      setCommand(
        objectCommand({ ...ctx, candidates, contractNodes }, kind, object),
      )
    } catch (error) {
      message.error(getProblemMessage(error, '无法读取可关联对象，请重试。'))
    } finally {
      setOpening(false)
    }
  }
  async function selectConfiguration(kind: 'STAGE_TEMPLATE' | 'REVIEW_POLICY') {
    setOpening(true)
    try {
      const configs = await getJson<PublishedDeliveryConfiguration[]>(
        `/api/delivery-initiation/${projectId}/configurations?kind=${kind}`,
      )
      setCommand(configurationCommand(data!, kind, configs))
    } catch (error) {
      message.error(getProblemMessage(error))
    } finally {
      setOpening(false)
    }
  }
  const showObject = (o: DeliveryObject) =>
    setCommand({
      title: `${deliveryLabel(o.kind)} · ${objectTitle(o)}`,
      path: `object:${o.id}`,
      readOnly: true,
      fields: [],
      content: (
        <Tabs
          items={[
            {
              key: 'content',
              label: '当前内容',
              children: <ObjectReadout data={data} object={o} />,
            },
            {
              key: 'history',
              label: '修订记录',
              children: <ObjectHistory data={data} object={o} />,
            },
          ]}
        />
      ),
    })
  const budget = activeObjects(data, 'BUDGET')[0],
    passed = data.checks.filter((c) => c.status === 'PASS').length,
    restricted = data.checks.filter((c) => c.status === 'RESTRICTED').length,
    blocked = data.checks.filter((c) => c.status === 'BLOCKED').length
  const openResource = (r: DeliveryResource) =>
    setCommand(commitmentCommand(data, r))
  const showOverlaps = (r: DeliveryResource) =>
    setCommand({
      title: '资源重叠安排',
      path: `resource:${r.id}`,
      readOnly: true,
      fields: [],
      content: (
        <ResourceOverlapReadout projectId={projectId} resourceId={r.id} />
      ),
    })
  const content = !p ? (
    <Panel title="接收移交，开始准备">
      <Alert
        type="info"
        showIcon
        title={
          data.checks[0]?.status === 'PASS'
            ? 'DG-01 已通过，可组织交付立项准备。'
            : '先完成交付移交，再建立立项准备。'
        }
        description={data.checks[0]?.problems.join('；')}
      />
      <Space className="delivery-section-actions">
        <Link to={`/projects/${projectId}?tab=handover`}>查看原项目移交包</Link>
        {can('INITIALIZE') && (
          <Button
            type="primary"
            disabled={data.checks[0]?.status !== 'PASS'}
            onClick={() => setCommand(headerCommand(ctx))}
          >
            开始立项准备
          </Button>
        )}
      </Space>
    </Panel>
  ) : (
    <>
      {!fixedSection && (
        <>
          <div className="delivery-initiation-facts">
            <div>
              <span>项目主阶段</span>
              <strong>
                <ClipboardCheck size={18} />
                {label(data.project.mainStage)}
              </strong>
            </div>
            <div>
              <span>DG-01 状态</span>
              <strong>
                <CheckCircle2 size={19} />
                已接收 · {p.handover.number}
              </strong>
            </div>
            <div>
              <span>{approved ? '当前条件检查' : '立项准入检查'}</span>
              <strong>
                <CheckCircle2 size={20} />
                {passed} / {data.checks.length} <small>通过</small>
              </strong>
            </div>
            <div
              className={
                blocked > 0 ? 'delivery-fact-attention' : 'delivery-fact-ready'
              }
            >
              <strong>
                {blocked > 0 ? (
                  <CircleAlert size={25} />
                ) : (
                  <CheckCircle2 size={25} />
                )}
                {approved
                  ? `已批准 V${p.baselineVersion}`
                  : blocked > 0
                    ? `${blocked} 项待处理`
                    : restricted > 0
                      ? '待完整核验'
                      : '已具备申报条件'}
              </strong>
              {(restricted > 0 || (approved && blocked > 0)) && (
                <small>
                  {[
                    ...(blocked > 0 ? [`${blocked} 项需处理`] : []),
                    ...(restricted > 0 ? [`${restricted} 项查看受限`] : []),
                  ].join(' · ')}
                </small>
              )}
            </div>
          </div>
          {frozen && (
            <Alert
              type="info"
              showIcon
              title={`第 ${p.roundNumber} 轮评审中，当前准备内容已冻结。`}
              description="会签人与最终批准人按本轮规则处理；需要修改时由提交人撤回或由评审人退回。"
            />
          )}
          {section !== 'overview' && (
            <Tabs
              className="delivery-section-tabs"
              activeKey={section}
              onChange={go}
              items={[
                ['overview', '立项总览'],
                ['resources', '团队与资源'],
                ['work-packages', '专业工作包'],
                ['findings', '风险与遗留'],
                ['review', '评审与基线'],
                ...(approved ? [['scope-changes', '范围变更']] : []),
              ].map(([key, label]) => ({ key, label }))}
            />
          )}
        </>
      )}
      {fixedSection && (
        <div className="delivery-embedded-context">
          <span>
            {approved ? `执行基线 V${p.baselineVersion}` : '立项准备内容'} ·{' '}
            <DeliveryStatus value={p.status} />
          </span>
          <Link to={`/delivery-initiation/${projectId}`}>
            打开交付立项 <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
      {section === 'overview' ? (
        <DeliveryDashboard
          data={data}
          actorId={actorId}
          go={go}
          showObject={showObject}
          setCommand={setCommand}
          ctx={ctx}
          openResource={openResource}
        />
      ) : section === 'resources' ? (
        <ResourceSection
          data={data}
          actorId={actorId}
          ctx={ctx}
          setCommand={setCommand}
          openResource={openResource}
          showOverlaps={showOverlaps}
        />
      ) : section === 'findings' ? (
        <FindingSection
          data={data}
          actorId={actorId}
          ctx={ctx}
          setCommand={setCommand}
        />
      ) : section === 'scope-changes' ? (
        <ScopeSection data={data} ctx={ctx} setCommand={setCommand} />
      ) : section === 'review' ? (
        <ReviewSection
          data={data}
          actorId={actorId}
          setCommand={setCommand}
          setSnapshot={setSnapshot}
          selectConfiguration={selectConfiguration}
        />
      ) : (
        <ObjectSection
          data={data}
          section={section}
          canEdit={canEditObject}
          showObject={showObject}
          editObject={editObject}
          archive={(o) => setCommand(archiveObjectCommand(data, o))}
          budget={budget}
          selectConfiguration={selectConfiguration}
        />
      )}
    </>
  )
  return (
    <BusinessPage
      className={
        fixedSection ? 'delivery-embedded' : 'delivery-initiation-page'
      }
    >
      {!fixedSection && (
        <header className="delivery-initiation-heading">
          <div>
            <div className="delivery-heading-title">
              <Button
                type="text"
                size="small"
                aria-label="返回交付立项队列"
                icon={<ArrowLeft size={18} />}
                onClick={() => navigate('/delivery-initiation')}
              />
              <h1>{data.project.projectName}</h1>
              <DeliveryStatus value={p?.status ?? 'NOT_STARTED'} />
            </div>
            <p>
              <span>{data.project.projectCode}</span>
              <span>客户：{data.project.customerName}</span>
              <span>
                项目经理：
                {p ? personName(data, p.header.projectManagerId) : '待确认'}
              </span>
              {p && <span>{configurationLabel(p.header.projectType)}</span>}
            </p>
          </div>
          <Space wrap>
            {approved && (
              <Button onClick={() => go('scope-changes')}>范围变更</Button>
            )}
            <Link to={`/projects/${projectId}`}>
              <Button type="primary">打开项目空间</Button>
            </Link>
            {can('SUBMIT') && (
              <Button
                disabled={passed !== data.checks.length || opening}
                onClick={() => setCommand(reviewCommand(data, 'submit'))}
              >
                提交评审
              </Button>
            )}
            <RefreshButton onClick={query.refetch} />
          </Space>
        </header>
      )}
      {content}
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
      <SnapshotDrawer
        data={data}
        target={snapshot}
        onClose={() => setSnapshot(null)}
      />
    </BusinessPage>
  )
}

type SetCommand = (command: Command | null) => void
function DeliveryDashboard({
  data,
  actorId,
  go,
  showObject,
  setCommand,
  ctx,
  openResource,
}: {
  data: WorkspaceData
  actorId: string
  go: (section: string) => void
  showObject: (object: DeliveryObject) => void
  setCommand: SetCommand
  ctx: DeliveryEditorContext
  openResource: (resource: DeliveryResource) => void
}) {
  const p = data.preparation!,
    budget = activeObjects(data, 'BUDGET')[0]?.content.budget
  const can = (action: string) => data.allowedActions.includes(action)
  const pendingResource = data.resources.find((r) =>
    ['REQUESTED', 'CONFLICT'].includes(r.status),
  )
  const followups = data.findings.filter((f) => f.status !== 'CLOSED'),
    round = data.rounds[0]
  const summary: Record<string, string> = {
    HANDOVER: p.handover.number,
    RECEPTION: '商务范围与验收边界已确认',
    TEAM: `${data.resources.filter((r) => ['COMMITTED', 'RESOLVED'].includes(r.status)).length} 项资源已承诺`,
    STAGES: p.template
      ? `${p.template.name} · V${p.template.edition}`
      : '待选择发布模板',
    PLAN: `${activeObjects(data, 'MILESTONE').length} 个里程碑 · ${activeObjects(data, 'PLAN').length} 条计划`,
    SCOPE: `${activeObjects(data, 'ITEM').length} 项清单 · ${activeObjects(data, 'WORK_PACKAGE').length} 个工作包`,
    BUDGET: p.budgetReadable
      ? budget
        ? `${formatCents(budgetCents(budget))} · ${deliveryLabel(budget.mode)}`
        : '实施预算待建立'
      : '预算明细受限',
    FINDINGS: `${followups.filter((f) => f.blocking).length} 项阻断 · ${followups.filter((f) => !f.blocking).length} 项跟踪`,
    AUTHORITY: p.policy
      ? `${p.policy.name} · V${p.policy.edition}`
      : '待选择发布规则',
  }
  const headings: Record<string, string> = {
    HANDOVER: '交付依据',
    RECEPTION: '商务与范围',
    TEAM: '团队与资源',
    STAGES: '阶段模板',
    PLAN: '里程碑与计划',
    SCOPE: '清单与工作包',
    BUDGET: '实施预算',
    FINDINGS: '遗留事项',
    AUTHORITY: '版本与权限',
  }
  const more = (title: string, action: () => void) => (
    <Button size="small" type="link" onClick={action}>
      {title}
      <ChevronRight size={14} />
    </Button>
  )
  const checkDescription = () =>
    setCommand({
      title: '九项立项准入检查',
      path: 'delivery:checks',
      readOnly: true,
      fields: [],
      content: (
        <div className="delivery-check-explanations">
          {data.checks.map((check) => (
            <Alert
              key={check.code}
              type={
                check.status === 'PASS'
                  ? 'success'
                  : check.status === 'RESTRICTED'
                    ? 'info'
                    : 'warning'
              }
              showIcon
              title={check.title}
              description={
                check.problems.length
                  ? check.problems.join('；')
                  : '当前检查通过。提交与批准时会再次核验。'
              }
            />
          ))}
        </div>
      ),
    })
  return (
    <div className="delivery-dashboard-grid">
      <div className="delivery-dashboard-main">
        <Panel
          title="立项准入检查"
          extra={more('查看检查说明', checkDescription)}
          className="delivery-checklist-panel"
        >
          <div className="delivery-table-scroll">
            <table className="delivery-grid-table delivery-checklist">
              <thead>
                <tr>
                  <th>#</th>
                  <th>检查项</th>
                  <th>当前依据</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.checks.map((check, i) => (
                  <tr
                    key={check.code}
                    className={
                      check.status === 'BLOCKED'
                        ? 'delivery-row-attention'
                        : undefined
                    }
                  >
                    <td>{i + 1}</td>
                    <th>{headings[check.code] ?? check.title}</th>
                    <td title={check.problems.join('；')}>
                      <span className="delivery-cell-ellipsis">
                        {check.status !== 'PASS'
                          ? check.problems[0]
                          : summary[check.code]}
                      </span>
                    </td>
                    <td>
                      <DeliveryStatus value={check.status} />
                    </td>
                    <td>
                      {check.code === 'RECEPTION' ? (
                        <Button
                          size="small"
                          onClick={() =>
                            setCommand(
                              can('EDIT') && p.status !== 'APPROVED'
                                ? headerCommand(ctx)
                                : {
                                    ...headerCommand(ctx),
                                    readOnly: true,
                                    fields: [],
                                    content: (
                                      <Descriptions
                                        column={1}
                                        items={[
                                          {
                                            key: 'scope',
                                            label: '接收范围',
                                            children: p.header.scopeAcceptance,
                                          },
                                          {
                                            key: 'criteria',
                                            label: '验收边界',
                                            children:
                                              p.header.acceptanceCriteria,
                                          },
                                          {
                                            key: 'time',
                                            label: '时间约束',
                                            children: p.header.timeConstraints,
                                          },
                                          {
                                            key: 'followup',
                                            label: '移交遗留',
                                            children:
                                              p.header.handoverFollowups,
                                          },
                                        ]}
                                      />
                                    ),
                                  },
                            )
                          }
                        >
                          {check.status === 'PASS' ? '查看' : '补齐范围'}
                        </Button>
                      ) : (
                        <Link to={check.href}>
                          <Button
                            size="small"
                            type={
                              check.status === 'BLOCKED' ? 'primary' : 'default'
                            }
                          >
                            {check.status === 'BLOCKED' ? '去处理' : '查看'}
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="阶段与主计划"
          extra={
            <Link to={`/projects/${data.project.projectId}?tab=milestones`}>
              查看计划 <ChevronRight size={13} className="inline" />
            </Link>
          }
          className="delivery-plan-panel"
        >
          <StageTimeline data={data} onOpen={showObject} />
        </Panel>
        <Panel
          title="专业工作包"
          extra={more('查看全部', () => go('work-packages'))}
          className="delivery-work-package-panel"
        >
          <div className="delivery-table-scroll">
            <table className="delivery-grid-table delivery-work-table">
              <thead>
                <tr>
                  <th>工作包名称</th>
                  <th>负责人</th>
                  <th>所属阶段</th>
                  <th>计划完成</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {activeObjects(data, 'WORK_PACKAGE')
                  .slice(0, 4)
                  .map((o) => {
                    const w = o.content.workPackage!
                    return (
                      <tr key={o.id}>
                        <th>
                          <span
                            className="delivery-cell-ellipsis"
                            title={w.title}
                          >
                            {w.title}
                          </span>
                        </th>
                        <td>
                          <span
                            className="delivery-cell-ellipsis"
                            title={personName(data, w.ownerId)}
                          >
                            {personName(data, w.ownerId)}
                          </span>
                        </td>
                        <td>{objectName(data, w.stageId)}</td>
                        <td>{w.endsOn ?? '待明确'}</td>
                        <td>
                          <DeliveryStatus
                            value={
                              o.baselineVersion
                                ? 'BASELINED'
                                : p.status === 'SUBMITTED' ||
                                    p.status === 'IN_REVIEW'
                                  ? 'IN_REVIEW'
                                  : 'PREPARING'
                            }
                          />
                        </td>
                        <td>
                          <Button size="small" onClick={() => showObject(o)}>
                            查看
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
            {!activeObjects(data, 'WORK_PACKAGE').length && (
              <p className="delivery-empty-inline">
                尚未接纳或建立专业工作包。
              </p>
            )}
          </div>
        </Panel>
      </div>
      <aside className="delivery-dashboard-side">
        <Panel
          title="当前待办"
          extra={more('查看全部', () => go('resources'))}
          className="delivery-current-task-panel"
        >
          {pendingResource ? (
            <div className="delivery-task-card">
              <div className="delivery-task-copy">
                <CircleAlert size={25} />
                <div>
                  <h3>
                    {pendingResource.status === 'CONFLICT'
                      ? '协调专业资源冲突'
                      : '确认专业实施资源'}
                  </h3>
                  <p>
                    {objectName(data, pendingResource.request.workPackageId)}
                    ：每天 {pendingResource.request.dailyHours}{' '}
                    小时，待部门签认。
                  </p>
                </div>
              </div>
              <div className="delivery-task-footer">
                <div>
                  <small>责任人</small>
                  <span>
                    <UsersRound size={15} />
                    {personName(data, pendingResource.request.committerId)}
                  </span>
                </div>
                <div>
                  <small>需求开始</small>
                  <span>
                    <CalendarDays size={15} />
                    {pendingResource.request.startsOn}
                  </span>
                </div>
                <Button
                  type="primary"
                  onClick={() =>
                    can('RESOURCE_COMMIT') &&
                    pendingResource.request.committerId === actorId
                      ? openResource(pendingResource)
                      : go('resources')
                  }
                >
                  {can('RESOURCE_COMMIT') &&
                  pendingResource.request.committerId === actorId
                    ? '签认资源'
                    : '查看资源申请'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="delivery-task-ready">
              <ClipboardCheck size={27} />
              <div>
                <h3>
                  {can('REVIEW')
                    ? '待你完成专业会签'
                    : can('APPROVE')
                      ? '待公司最终决定'
                      : p.status === 'APPROVED'
                        ? '执行基线已生效'
                        : '资源申请已处理'}
                </h3>
                <p>
                  {p.status === 'APPROVED'
                    ? `原项目沿用 V${p.baselineVersion} 基线，工作包继续按责任推进。`
                    : '查看准入检查与评审安排，继续处理当前环节。'}
                </p>
                <Button size="small" onClick={() => go('review')}>
                  查看评审与基线
                </Button>
              </div>
            </div>
          )}
        </Panel>
        <Panel
          title="评审安排"
          extra={more('查看流程详情', () => go('review'))}
          className="delivery-review-panel"
        >
          <table className="delivery-grid-table delivery-review-table">
            <thead>
              <tr>
                <th>环节</th>
                <th>责任人</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>项目经理提交</th>
                <td>{personName(data, p.header.projectManagerId)}</td>
                <td>
                  <DeliveryStatus value={round ? 'AGREED' : 'PENDING'}>
                    {round ? `第 ${round.number} 轮已提交` : '待提交'}
                  </DeliveryStatus>
                </td>
              </tr>
              {(p.reviewAssignments ?? p.policy?.policy?.reviewers ?? []).map(
                (r) => {
                  const current = round?.reviews.find(
                    (review) => review.reviewerId === r.accountId,
                  )
                  return (
                    <tr key={r.accountId}>
                      <th>{configurationLabel(r.scope)}</th>
                      <td>{personName(data, r.accountId)}</td>
                      <td>
                        <DeliveryStatus value={current?.status ?? 'PENDING'} />
                      </td>
                    </tr>
                  )
                },
              )}
              <tr>
                <th>独立最终批准</th>
                <td>
                  {personName(
                    data,
                    p.finalApproverId ?? p.policy?.policy?.finalApproverId,
                  )}
                </td>
                <td>
                  <DeliveryStatus
                    value={
                      round &&
                      ['APPROVED', 'RETURNED', 'WITHDRAWN'].includes(
                        round.status,
                      )
                        ? round.status
                        : 'PENDING'
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="delivery-info-strip">
            <ClipboardCheck size={14} />
            <span>
              {round
                ? `第 ${round.number} 轮内容与评审意见分别留存。`
                : '提交后锁定本轮范围、预算、计划与责任安排。'}
            </span>
          </div>
        </Panel>
        <Panel
          title="预算构成"
          extra={
            p.budgetReadable && budget ? (
              <Link
                className="delivery-budget-total"
                to={`/projects/${data.project.projectId}?tab=budget`}
              >
                总额 <strong>{formatCents(budgetCents(budget))}</strong>
              </Link>
            ) : undefined
          }
          className="delivery-budget-panel"
        >
          <BudgetComposition budget={budget} readable={p.budgetReadable} />
        </Panel>
        <Panel
          title="跟踪事项"
          extra={more('查看全部', () => go('findings'))}
          className="delivery-followups-panel"
        >
          {followups.length ? (
            <div className="delivery-table-scroll">
              <table className="delivery-grid-table">
                <thead>
                  <tr>
                    <th>事项</th>
                    <th>责任人</th>
                    <th>期限</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.slice(0, 3).map((f) => (
                    <tr key={f.id}>
                      <th>
                        <button
                          className="delivery-text-button"
                          onClick={() => go('findings')}
                        >
                          {f.finding.title}
                        </button>
                      </th>
                      <td>{personName(data, f.finding.ownerId)}</td>
                      <td>{f.finding.dueDate}</td>
                      <td>
                        <DeliveryStatus value={f.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="delivery-clear-state">
              <CheckCircle2 size={20} />
              <span>当前没有未关闭的遗留事项。</span>
              {can('EDIT') && (
                <Button
                  size="small"
                  onClick={() => setCommand(findingCommand(ctx))}
                >
                  登记事项
                </Button>
              )}
            </div>
          )}
        </Panel>
      </aside>
    </div>
  )
}

function ResourceSection({
  data,
  actorId,
  ctx,
  setCommand,
  openResource,
  showOverlaps,
}: {
  data: WorkspaceData
  actorId: string
  ctx: DeliveryEditorContext
  setCommand: SetCommand
  openResource: (resource: DeliveryResource) => void
  showOverlaps: (resource: DeliveryResource) => void
}) {
  const p = data.preparation!,
    can = (action: string) => data.allowedActions.includes(action),
    beforeApproval = p.status !== 'APPROVED'
  const responsible = (r: DeliveryResource) =>
    can('EDIT') ||
    (can('EDIT_RESPONSIBLE_OBJECTS') &&
      data.objects.find((o) => o.id === r.request.workPackageId)?.content
        .workPackage?.ownerId === actorId)
  return (
    <div className="business-stack">
      <Panel
        title="项目分工"
        extra={
          can('EDIT') &&
          beforeApproval && (
            <Button size="small" onClick={() => setCommand(headerCommand(ctx))}>
              调整接收与分工
            </Button>
          )
        }
      >
        <div className="delivery-team-facts">
          <div>
            <UsersRound size={20} />
            <span>
              <small>项目经理</small>
              <strong>{personName(data, p.header.projectManagerId)}</strong>
            </span>
          </div>
          <div>
            <ClipboardCheck size={20} />
            <span>
              <small>技术负责人</small>
              <strong>{personName(data, p.header.technicalLeadId)}</strong>
            </span>
          </div>
          <div>
            <CheckCircle2 size={20} />
            <span>
              <small>部门已承诺</small>
              <strong>
                {
                  data.resources.filter((r) =>
                    ['COMMITTED', 'RESOLVED'].includes(r.status),
                  ).length
                }{' '}
                / {data.resources.filter((r) => r.status !== 'REVOKED').length}{' '}
                项申请
              </strong>
            </span>
          </div>
        </div>
      </Panel>
      {!beforeApproval && (
        <TransferSection
          data={data}
          actorId={actorId}
          people={ctx.people}
          setCommand={setCommand}
        />
      )}
      <Panel
        title="专业资源申请与承诺"
        className="business-panel--table"
        subtitle="申请人与部门资源承诺人分别处理；时间与投入调整后重新签认。"
        extra={
          (can('EDIT') ||
            (can('EDIT_RESPONSIBLE_OBJECTS') &&
              activeObjects(data, 'WORK_PACKAGE').some(
                (o) => o.content.workPackage?.ownerId === actorId,
              ))) &&
          beforeApproval && (
            <Button
              size="small"
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setCommand(resourceCommand(ctx))}
            >
              申请资源
            </Button>
          )
        }
      >
        <Table<DeliveryResource>
          size="small"
          rowKey="id"
          dataSource={data.resources}
          pagination={false}
          scroll={{ x: 1150 }}
          columns={[
            {
              title: '人员 / 工作包',
              width: 260,
              render: (_, r) => (
                <>
                  <strong>{personName(data, r.request.personId)}</strong>
                  <span className="business-cell-sub">
                    {objectName(data, r.request.workPackageId)}
                  </span>
                </>
              ),
            },
            {
              title: '需求窗口',
              width: 180,
              render: (_, r) => (
                <>
                  {r.request.startsOn}
                  <span className="business-cell-sub">
                    至 {r.request.endsOn}
                  </span>
                </>
              ),
            },
            {
              title: '每天工时',
              width: 105,
              render: (_, r) => (
                <>
                  {r.request.dailyHours} 小时
                  <span className="business-cell-sub">
                    容量 {r.commitment?.dailyCapacity ?? '待确认'}
                  </span>
                </>
              ),
            },
            {
              title: '指定承诺人',
              width: 170,
              render: (_, r) => personName(data, r.request.committerId),
            },
            {
              title: '签认结论',
              width: 180,
              render: (_, r) => (
                <>
                  <DeliveryStatus value={r.status} />
                  <span className="business-cell-sub">
                    {r.commitment?.conclusion ?? r.request.requestNote}
                  </span>
                </>
              ),
            },
            {
              title: '操作',
              width: 215,
              render: (_, r) => (
                <Space wrap>
                  {[
                    p.header.projectManagerId,
                    r.request.personId,
                    r.request.committerId,
                  ].includes(actorId) && (
                    <Button size="small" onClick={() => showOverlaps(r)}>
                      重叠安排
                    </Button>
                  )}
                  {beforeApproval && responsible(r) && (
                    <Button
                      size="small"
                      onClick={() => setCommand(resourceCommand(ctx, r))}
                    >
                      调整申请
                    </Button>
                  )}
                  {beforeApproval &&
                    can('RESOURCE_COMMIT') &&
                    r.request.committerId === actorId &&
                    r.status !== 'REVOKED' && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => openResource(r)}
                      >
                        签认
                      </Button>
                    )}
                </Space>
              ),
            },
          ]}
          expandable={{
            expandedRowRender: (r) => (
              <Descriptions
                size="small"
                column={2}
                items={[
                  {
                    key: 'request',
                    label: '资源要求',
                    children: r.request.requestNote,
                  },
                  {
                    key: 'conclusion',
                    label: '签认依据',
                    children: r.commitment?.conclusion ?? '尚未签认',
                  },
                  {
                    key: 'impact',
                    label: '冲突影响与协调',
                    children: r.commitment?.impact ?? '未登记',
                  },
                  {
                    key: 'escalate',
                    label: '升级路径',
                    children: r.commitment?.escalationPath ?? '未登记',
                  },
                  {
                    key: 'who',
                    label: '签认记录',
                    children: r.committedBy
                      ? `${personName(data, r.committedBy)} · ${dateTime(r.committedAt)}`
                      : '尚未签认',
                  },
                ]}
              />
            ),
          }}
        />
      </Panel>
    </div>
  )
}

function FindingSection({
  data,
  actorId,
  ctx,
  setCommand,
}: {
  data: WorkspaceData
  actorId: string
  ctx: DeliveryEditorContext
  setCommand: SetCommand
}) {
  const can = (action: string) => data.allowedActions.includes(action)
  return (
    <Panel
      title="风险、缺项与外部依赖"
      className="business-panel--table"
      subtitle="阻断事项关闭后才能提交；普通遗留明确责任、期限与升级路径，持续跟踪。"
      extra={
        can('EDIT') && (
          <Button
            size="small"
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setCommand(findingCommand(ctx))}
          >
            登记事项
          </Button>
        )
      }
    >
      <Table<DeliveryFinding>
        rowKey="id"
        size="small"
        dataSource={data.findings}
        pagination={false}
        scroll={{ x: 1050 }}
        columns={[
          {
            title: '事项 / 影响',
            width: 310,
            render: (_, f) => (
              <>
                <strong>{f.finding.title}</strong>
                <span className="business-cell-sub">
                  {deliveryLabel(f.finding.kind)} ·{' '}
                  {deliveryLabel(f.finding.impactCategory)} ·{' '}
                  {f.blocking ? '阻断提交' : '持续跟踪'}
                </span>
              </>
            ),
          },
          {
            title: '责任 / 独立验证',
            width: 190,
            render: (_, f) => (
              <>
                {personName(data, f.finding.ownerId)}
                <span className="business-cell-sub">
                  验证：{personName(data, f.finding.verifierId)}
                </span>
              </>
            ),
          },
          { title: '关闭期限', dataIndex: ['finding', 'dueDate'], width: 120 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 110,
            render: (v) => <DeliveryStatus value={v} />,
          },
          {
            title: '操作',
            width: 270,
            render: (_, f) => (
              <Space wrap>
                {can('EDIT') && f.status !== 'CLOSED' && (
                  <Button
                    size="small"
                    onClick={() => setCommand(findingCommand(ctx, f))}
                  >
                    调整
                  </Button>
                )}
                {can('HANDLE_FINDINGS') &&
                  f.status === 'OPEN' &&
                  f.finding.ownerId === actorId && (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() =>
                        setCommand(
                          resolveFindingCommand(data, f, 'SUBMIT_EVIDENCE'),
                        )
                      }
                    >
                      提交证据
                    </Button>
                  )}
                {can('VERIFY_FINDINGS') &&
                  f.status === 'PENDING_VERIFICATION' &&
                  f.finding.verifierId === actorId &&
                  actorId !== f.finding.ownerId && (
                    <>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() =>
                          setCommand(resolveFindingCommand(data, f, 'VERIFY'))
                        }
                      >
                        验证关闭
                      </Button>
                      <Button
                        size="small"
                        onClick={() =>
                          setCommand(resolveFindingCommand(data, f, 'RETURN'))
                        }
                      >
                        退回
                      </Button>
                    </>
                  )}
              </Space>
            ),
          },
        ]}
        expandable={{
          expandedRowRender: (f) => (
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'criteria',
                  label: '关闭条件',
                  children: f.finding.closingCriteria,
                },
                {
                  key: 'impact',
                  label: '影响范围',
                  children: f.finding.impactScope,
                },
                {
                  key: 'escalate',
                  label: '升级处理',
                  children: `${personName(data, f.finding.escalationOwnerId)} · ${f.finding.escalationPath}`,
                },
                {
                  key: 'evidence',
                  label: '完成证据',
                  children: f.evidence ?? '尚未提交',
                },
                {
                  key: 'result',
                  label: '验证意见',
                  children: f.verification ?? '尚未验证',
                },
              ]}
            />
          ),
        }}
      />
    </Panel>
  )
}

function ObjectSection({
  data,
  section,
  canEdit,
  showObject,
  editObject,
  archive,
  budget,
  selectConfiguration,
}: {
  data: WorkspaceData
  section: string
  canEdit: (object: DeliveryObject) => boolean
  showObject: (object: DeliveryObject) => void
  editObject: (kind: DeliveryKind, object?: DeliveryObject) => Promise<void>
  archive: (object: DeliveryObject) => void
  budget?: DeliveryObject
  selectConfiguration: (
    kind: 'STAGE_TEMPLATE' | 'REVIEW_POLICY',
  ) => Promise<void>
}) {
  const kinds: Record<string, DeliveryKind[]> = {
    stages: ['STAGE'],
    milestones: ['MILESTONE', 'PLAN'],
    items: ['ITEM'],
    'work-packages': ['WORK_PACKAGE'],
    plan: ['PLAN'],
    budget: ['BUDGET'],
  }
  const p = data.preparation!,
    editable = data.allowedActions.includes('EDIT'),
    selected = kinds[section]
  if (!selected)
    return (
      <Alert showIcon type="info" title="未找到此立项视图，请返回立项总览。" />
    )
  if (section === 'budget' && !p.budgetReadable)
    return <BudgetComposition readable={false} />
  return (
    <div className="business-stack">
      {section === 'stages' && (
        <Panel
          title="项目阶段模板"
          extra={
            editable &&
            !p.template && (
              <Button
                type="primary"
                size="small"
                onClick={() => void selectConfiguration('STAGE_TEMPLATE')}
              >
                选择阶段模板
              </Button>
            )
          }
        >
          {p.template ? (
            <>
              <p className="delivery-template-caption">
                <strong>
                  {p.template.name} · V{p.template.edition}
                </strong>
                <span>
                  在原阶段上维护本项目的适用范围、责任、日期与差异理由。
                </span>
              </p>
              <StageTimeline data={data} onOpen={showObject} />
            </>
          ) : (
            <Alert
              type="info"
              showIcon
              title="请先明确选择一个已发布阶段模板。"
            />
          )}
        </Panel>
      )}
      {selected.map((kind) => (
        <Panel
          key={kind}
          title={deliveryLabel(kind)}
          className={kind === 'BUDGET' ? '' : 'business-panel--table'}
          subtitle={
            kind === 'WORK_PACKAGE'
              ? '沿用已有需求与工作记录，负责人执行、独立验证人验收。'
              : kind === 'PLAN'
                ? '主计划与工作包计划的日期、前后置关系及交付窗口。'
                : undefined
          }
          extra={
            <Space>
              {kind === 'BUDGET' && budget && canEdit(budget) && (
                <Button
                  size="small"
                  onClick={() => void editObject(kind, budget)}
                >
                  修订预算
                </Button>
              )}
              {kind === 'BUDGET' && budget && (
                <Button size="small" onClick={() => showObject(budget)}>
                  查看授权范围
                </Button>
              )}
              {p.status !== 'APPROVED' &&
                (kind === 'BUDGET'
                  ? !budget && data.allowedActions.includes('EDIT_BUDGET')
                  : editable) && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<Plus size={14} />}
                    onClick={() => void editObject(kind)}
                  >
                    新增{deliveryLabel(kind)}
                  </Button>
                )}
            </Space>
          }
        >
          {kind === 'BUDGET' ? (
            budget?.content.budget ? (
              <>
                <div className="delivery-inline-total">
                  <span>
                    {deliveryLabel(budget.content.budget.mode)} ·{' '}
                    {budget.content.budget.scope}
                  </span>
                  <strong>
                    {formatCents(budgetCents(budget.content.budget))}
                  </strong>
                </div>
                <BudgetComposition budget={budget.content.budget} />
                <div className="delivery-subheading">费用明细与范围对应</div>
                <BudgetLinesReadout
                  data={data}
                  budget={budget.content.budget}
                />
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="实施预算尚未建立"
              />
            )
          ) : (
            <Table<DeliveryObject>
              rowKey="id"
              size="small"
              dataSource={data.objects.filter((o) => o.kind === kind)}
              pagination={false}
              scroll={{ x: 1050 }}
              columns={[
                {
                  title: '名称与范围',
                  width: 310,
                  render: (_, o) => (
                    <>
                      <button
                        className="delivery-text-button business-cell-title"
                        onClick={() => showObject(o)}
                      >
                        {objectTitle(o)}
                      </button>
                      <span className="business-cell-sub">
                        {o.content.workPackage?.scope ??
                          o.content.item?.acceptanceScope ??
                          o.content.milestone?.acceptanceCriteria ??
                          o.content.plan?.resourceConstraints ??
                          o.content.stage?.completionCriteria ??
                          '范围待补齐'}
                      </span>
                    </>
                  ),
                },
                {
                  title: kind === 'ITEM' ? '归属工作包' : '责任 / 关联',
                  width: 190,
                  render: (_, o) => (
                    <>
                      {o.content.stage ||
                      o.content.milestone ||
                      o.content.workPackage
                        ? personName(
                            data,
                            o.content.stage?.ownerId ??
                              o.content.milestone?.ownerId ??
                              o.content.workPackage?.ownerId,
                          )
                        : objectName(
                            data,
                            o.content.plan?.workPackageId ??
                              o.content.item?.workPackageId,
                          )}
                      <span className="business-cell-sub">
                        {o.content.stage
                          ? o.content.stage.applicable
                            ? '本项目适用'
                            : '本项目不适用'
                          : objectName(
                              data,
                              o.content.workPackage?.stageId ??
                                o.content.milestone?.stageId ??
                                o.content.plan?.stageId ??
                                o.content.item?.stageId,
                            )}
                      </span>
                    </>
                  ),
                },
                {
                  title: kind === 'ITEM' ? '数量 / 采购' : '日期',
                  width: 180,
                  render: (_, o) =>
                    o.content.item ? (
                      <>
                        {o.content.item.quantity ?? '待明确'}{' '}
                        {o.content.item.unit}
                        <span className="business-cell-sub">
                          {o.content.item.procurementNeeded
                            ? '需要采购'
                            : '无采购需求'}
                        </span>
                      </>
                    ) : (
                      <>
                        {o.content.milestone?.dueDate ??
                          o.content.stage?.startsOn ??
                          o.content.workPackage?.startsOn ??
                          o.content.plan?.startsOn ??
                          '待明确'}
                        {!o.content.milestone && (
                          <span className="business-cell-sub">
                            至{' '}
                            {o.content.stage?.endsOn ??
                              o.content.workPackage?.endsOn ??
                              o.content.plan?.endsOn ??
                              '待明确'}
                          </span>
                        )}
                      </>
                    ),
                },
                {
                  title: '版本与状态',
                  width: 140,
                  render: (_, o) => (
                    <>
                      <DeliveryStatus
                        value={
                          o.archived
                            ? 'REVOKED'
                            : o.baselineVersion
                              ? 'BASELINED'
                              : 'PREPARING'
                        }
                      >
                        {o.archived
                          ? '已停用'
                          : o.baselineVersion
                            ? `基线 V${o.baselineVersion}`
                            : '准备中'}
                      </DeliveryStatus>
                      <span className="business-cell-sub">
                        修订 {o.version}
                      </span>
                    </>
                  ),
                },
                {
                  title: '操作',
                  width: 220,
                  render: (_, o) => (
                    <Space wrap>
                      <Button size="small" onClick={() => showObject(o)}>
                        查看
                      </Button>
                      {canEdit(o) && (
                        <Button
                          size="small"
                          onClick={() => void editObject(kind, o)}
                        >
                          {p.status === 'APPROVED' && kind !== 'MILESTONE'
                            ? '提出变更'
                            : '编辑'}
                        </Button>
                      )}
                      {editable && !o.archived && (
                        <Button size="small" onClick={() => archive(o)}>
                          停用
                        </Button>
                      )}
                      {kind === 'WORK_PACKAGE' && (
                        <Link to={`/work-items/${o.id}`}>执行记录</Link>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </Panel>
      ))}
    </div>
  )
}

function ReviewSection({
  data,
  actorId,
  setCommand,
  setSnapshot,
  selectConfiguration,
}: {
  data: WorkspaceData
  actorId: string
  setCommand: SetCommand
  setSnapshot: (target: SnapshotTarget) => void
  selectConfiguration: (
    kind: 'STAGE_TEMPLATE' | 'REVIEW_POLICY',
  ) => Promise<void>
}) {
  const p = data.preparation!,
    can = (action: string) => data.allowedActions.includes(action),
    current = data.rounds[0]
  return (
    <div className="business-stack">
      <Panel
        title="本项目评审规则"
        extra={
          can('EDIT') &&
          p.status !== 'APPROVED' && (
            <Button
              size="small"
              onClick={() => void selectConfiguration('REVIEW_POLICY')}
            >
              选择发布规则
            </Button>
          )
        }
      >
        {p.policy ? (
          <Descriptions
            size="small"
            column={2}
            items={[
              {
                key: 'policy',
                label: '使用版本',
                children: `${p.policy.name} · V${p.policy.edition}`,
              },
              {
                key: 'risk',
                label: '当前风险等级',
                children: deliveryLabel(p.header.riskLevel),
              },
              {
                key: 'reviewers',
                label: '必要会签',
                children: (
                  p.reviewAssignments ??
                  p.policy.policy?.reviewers ??
                  []
                )
                  .map(
                    (r) =>
                      `${configurationLabel(r.scope)}：${personName(data, r.accountId)}`,
                  )
                  .join('；'),
              },
              {
                key: 'final',
                label: '独立最终批准',
                children: personName(
                  data,
                  p.finalApproverId ?? p.policy.policy?.finalApproverId,
                ),
              },
              {
                key: 'basis',
                label: '授权依据',
                span: 2,
                children:
                  p.policy.policy?.authorityBasis ??
                  '完整适用规则由具备预算权限的授权人员核验。',
              },
            ]}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            title="请项目经理选择适用的已发布评审规则。"
          />
        )}
        <Space className="delivery-section-actions" wrap>
          {can('SUBMIT') && (
            <Button
              type="primary"
              disabled={data.checks.some((check) => check.status !== 'PASS')}
              onClick={() => setCommand(reviewCommand(data, 'submit'))}
            >
              提交评审
            </Button>
          )}
          {can('REVIEW') && (
            <Button
              type="primary"
              onClick={() => setCommand(reviewCommand(data, 'review'))}
            >
              提交专业会签
            </Button>
          )}
          {can('APPROVE') && (
            <Button
              type="primary"
              onClick={() => setCommand(reviewCommand(data, 'decision'))}
            >
              最终决定
            </Button>
          )}
          {can('WITHDRAW') && (
            <Button onClick={() => setCommand(reviewCommand(data, 'withdraw'))}>
              撤回本轮
            </Button>
          )}
          {current && (
            <Button
              onClick={() =>
                setSnapshot({
                  id: current.id,
                  kind: 'rounds',
                  title: `第 ${current.number} 轮 · 提交快照`,
                })
              }
            >
              查看本轮提交内容
            </Button>
          )}
        </Space>
      </Panel>
      <Panel
        title="评审轮次"
        className="business-panel--table"
        subtitle="每轮提交内容与意见独立保留。退回后补齐，再发起新一轮。"
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={data.rounds}
          pagination={false}
          scroll={{ x: 900 }}
          columns={[
            {
              title: '轮次',
              width: 100,
              render: (_, r) => `第 ${r.number} 轮`,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (v) => <DeliveryStatus value={v} />,
            },
            {
              title: '提交人 / 时间',
              width: 210,
              render: (_, r) => (
                <>
                  {personName(data, r.submittedBy)}
                  <span className="business-cell-sub">
                    {dateTime(r.submittedAt)}
                  </span>
                </>
              ),
            },
            {
              title: '必要会签',
              render: (_, r) => (
                <Space wrap>
                  {r.reviews.map((review) => (
                    <DeliveryStatus key={review.id} value={review.status}>
                      {configurationLabel(review.scope)} ·{' '}
                      {deliveryLabel(review.status)}
                    </DeliveryStatus>
                  ))}
                </Space>
              ),
            },
            {
              title: '操作',
              width: 140,
              render: (_, r) => (
                <Button
                  size="small"
                  onClick={() =>
                    setSnapshot({
                      id: r.id,
                      kind: 'rounds',
                      title: `第 ${r.number} 轮 · 提交快照`,
                    })
                  }
                >
                  查看当轮内容
                </Button>
              ),
            },
          ]}
          expandable={{
            expandedRowRender: (r) => (
              <div className="delivery-round-details">
                <p>
                  <strong>申报说明：</strong>
                  {r.submissionNote}
                </p>
                {r.reviews.map((review) => (
                  <p key={review.id}>
                    <strong>
                      {configurationLabel(review.scope)} ·{' '}
                      {personName(data, review.reviewerId)}：
                    </strong>
                    {review.comment ?? '尚未提交意见'}
                    {review.reviewedAt && (
                      <small> · {dateTime(review.reviewedAt)}</small>
                    )}
                  </p>
                ))}
                {r.decisionNote && (
                  <p>
                    <strong>
                      最终处理 · {personName(data, r.decidedBy)}：
                    </strong>
                    {r.decisionNote}
                  </p>
                )}
              </div>
            ),
          }}
        />
      </Panel>
      <Panel
        title="批准基线"
        className="business-panel--table"
        subtitle="当前有效版本与历史版本并存，原对象标识和来源保持连续。"
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={data.baselines}
          pagination={false}
          scroll={{ x: 720 }}
          columns={[
            {
              title: '版本',
              width: 130,
              render: (_, b) => (
                <strong>
                  V{b.number}
                  {b.number === p.baselineVersion ? ' · 当前' : ''}
                </strong>
              ),
            },
            { title: '生效原因', dataIndex: 'reason' },
            {
              title: '确认人 / 时间',
              width: 220,
              render: (_, b) => (
                <>
                  {personName(data, b.approvedBy)}
                  <span className="business-cell-sub">
                    {dateTime(b.approvedAt)}
                  </span>
                </>
              ),
            },
            {
              title: '操作',
              width: 120,
              render: (_, b) => (
                <Button
                  size="small"
                  onClick={() =>
                    setSnapshot({
                      id: b.id,
                      kind: 'baselines',
                      title: `批准基线 V${b.number}`,
                    })
                  }
                >
                  查看版本
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      {data.changes.length > 0 && (
        <Panel title="批准后的范围变更" className="business-panel--table">
          <Table
            rowKey="id"
            size="small"
            dataSource={data.changes}
            pagination={false}
            scroll={{ x: 800 }}
            columns={[
              {
                title: '对象 / 调整原因',
                render: (_, change) => (
                  <>
                    <strong>{objectName(data, change.objectId)}</strong>
                    <span className="business-cell-sub">
                      {change.reason ?? '说明查看受限'}
                    </span>
                  </>
                ),
              },
              {
                title: '影响范围',
                dataIndex: 'impact',
                render: (value) => value ?? '查看受限',
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 120,
                render: (v) => <DeliveryStatus value={v} />,
              },
              {
                title: '操作',
                width: 120,
                render: (_, change) =>
                  can('DECIDE_CHANGE') &&
                  change.status === 'PENDING' &&
                  change.submittedBy !== actorId && (
                    <Button
                      size="small"
                      onClick={() =>
                        setCommand({
                          title: '独立确认范围变更',
                          path: `/api/delivery-initiation/${data.project.projectId}/changes/${change.id}/decision`,
                          values: {
                            version: p.version,
                            changeVersion: change.version,
                          },
                          description: `原因：${change.reason}；影响：${change.impact}；依据：${change.basis}`,
                          content: (() => {
                            const object = data.objects.find(
                              (o) => o.id === change.objectId,
                            )
                            return object ? (
                              <ObjectReadout
                                data={data}
                                object={{ ...object, content: change.content }}
                              />
                            ) : null
                          })(),
                          fields: [
                            {
                              name: 'decision',
                              label: '处理结论',
                              type: 'select',
                              options: deliveryOptions([
                                'APPROVED',
                                'RETURNED',
                              ]),
                            },
                            {
                              name: 'comment',
                              label: '确认意见与依据',
                              type: 'textarea',
                            },
                          ],
                        })
                      }
                    >
                      处理变更
                    </Button>
                  ),
              },
            ]}
            expandable={{
              expandedRowRender: (change) => (
                <div className="delivery-round-details">
                  <p>
                    <strong>调整依据：</strong>
                    {change.basis ?? '查看受限'}
                  </p>
                  <p>
                    <strong>提出人：</strong>
                    {personName(data, change.submittedBy)}
                  </p>
                  {change.archiveRequested && (
                    <Alert type="warning" title="申请停用此对象。" />
                  )}
                  {(() => {
                    const object = data.objects.find(
                      (o) => o.id === change.objectId,
                    )
                    return object ? (
                      <ObjectReadout
                        data={data}
                        object={{ ...object, content: change.content }}
                      />
                    ) : null
                  })()}
                  {change.decision && (
                    <p>
                      <strong>确认意见：</strong>
                      {change.decision}
                    </p>
                  )}
                </div>
              ),
            }}
          />
        </Panel>
      )}
      <Panel title="立项操作记录">
        <History events={data.history} limit={30} />
      </Panel>
    </div>
  )
}
