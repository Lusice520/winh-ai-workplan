import {
  Alert,
  Button,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Table,
  Timeline,
} from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useCurrentSession } from '@/features/auth/auth-session'
import {
  CommandDrawer,
  Panel,
  QueryState,
  Status,
  type Command,
  type Field,
} from '@/features/business/business-ui'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import type {
  ProjectDetail,
  WorkReference,
} from '@/features/business/business-types'
import type { FileWorkspace } from '@/features/files/file-types'
import { DeliveryProjectSection } from '@/features/delivery/delivery-workspace'
import { executionCommands, type ExecutionActions } from './execution-commands'
import {
  executionLabel,
  executionTitle,
  type ExecutionWorkspace,
  type ExecutionObject,
  type StageExecution,
} from './execution-types'
import { CompletionProblems, ExecutionStatus } from './execution-ui'
import { StageExecutionTable } from './stage-execution-table'
import { ItemExecutionTable, MilestoneExecutionTable } from './execution-tables'
import { ItemExecutionDrawer } from './item-execution-drawer'
import './execution.css'

export function ExecutionProjectSection({
  project,
  section,
}: {
  project: ProjectDetail
  section: 'stages' | 'items' | 'milestones'
}) {
  const projectId = project.project.id,
    [mode, setMode] = useState('actual')
  const query = useBusinessQuery<ExecutionWorkspace>(
    mode === 'actual' ? `/api/projects/${projectId}/execution` : undefined,
  )
  const work = useBusinessQuery<WorkReference[]>(
    project.allowedActions.includes('WORK_READ')
      ? `/api/work-items?projectId=${projectId}&kind=WORK_PACKAGE`
      : undefined,
  )
  const fileQuery = useBusinessQuery<FileWorkspace>(
    project.allowedActions.includes('FILE_READ')
      ? `/api/projects/${projectId}/files`
      : undefined,
  )
  const session = useCurrentSession(),
    [params, setParams] = useSearchParams()
  const [command, setCommand] = useState<Command | null>(null),
    [itemId, setItemId] = useState<string | null>(null),
    [keyword, setKeyword] = useState(''),
    [status, setStatus] = useState<string>()
  const data = query.data,
    names = new Map(project.members.map((m) => [m.accountId, m.name]))
  const files =
    fileQuery.data?.items.filter(
      (d) =>
        d.currentVersionId === d.latestVersion.id &&
        d.latestVersion.status === 'PUBLISHED',
    ) ?? []
  const fileField: Field | undefined = project.allowedActions.includes(
    'FILE_READ',
  )
    ? {
        name: 'fileVersionIds',
        label: '关联已发布资料',
        type: 'multiple',
        required: false,
        options: files.map((d) => ({
          value: d.latestVersion.id,
          label: `${d.title} · V${d.latestVersion.versionNumber}`,
        })),
        hint: fileQuery.isError
          ? '当前资料选项加载失败，可先保留文字依据，或关闭表单后刷新。'
          : '仅列出有权查看的当前已发布版本，可不选附件。',
      }
    : undefined
  const actions = executionCommands(
    projectId,
    project.members,
    session.data?.accountId ?? '',
    fileField,
    setCommand,
  )
  const selected =
    data?.objects.find(
      (o) =>
        o.id === params.get('executionStage') &&
        o.kind === 'STAGE' &&
        !o.archived,
    ) ??
    data?.objects.find((o) => o.content.stage?.focus && !o.archived) ??
    data?.objects.find((o) => o.kind === 'STAGE' && !o.archived)
  const choose = (id: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('executionStage', id)
        return next
      },
      { replace: true },
    )
  const itemObject = data?.objects.find((o) => o.id === itemId),
    itemOwner =
      data?.objects.find(
        (o) => o.id === itemObject?.content.item?.workPackageId,
      )?.content.workPackage?.ownerId ?? null
  const displayed =
    data?.objects
      .filter(
        (o) =>
          !keyword ||
          executionTitle(o).includes(keyword) ||
          (o.content.stage &&
            names.get(o.content.stage.ownerId ?? '')?.includes(keyword)),
      )
      .filter(
        (o) =>
          section !== 'stages' ||
          !status ||
          data.stages.find((s) => s.id === o.id)?.status === status,
      ) ?? []
  return (
    <div className="execution-workspace business-stack">
      <div className="execution-toolbar">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'actual', label: '执行与实际' },
            { value: 'baseline', label: '批准范围与计划' },
          ]}
        />
        <Space wrap>
          <Link to={`/delivery-initiation/${projectId}?section=scope-changes`}>
            范围变更
          </Link>
          <Button size="small" onClick={() => void query.refetch()}>
            刷新
          </Button>
        </Space>
      </div>
      {mode === 'baseline' ? (
        <DeliveryProjectSection
          projectId={projectId}
          section={section}
          project={project}
        />
      ) : (
        <QueryState query={query}>
          {data && (
            <>
              <div className="execution-summary">
                <strong>交付执行 · V{data.baselineVersion}</strong>
                <span>
                  <i className="execution-dot execution-dot--green" />
                  {
                    data.stages.filter((s) => s.status === 'COMPLETED').length
                  }{' '}
                  已完成
                </span>
                <span>
                  <i className="execution-dot" />
                  {
                    data.stages.filter((s) => s.status === 'IN_PROGRESS').length
                  }{' '}
                  进行中
                </span>
                <span>
                  {data.stages.filter((s) => s.status === 'NOT_STARTED').length}{' '}
                  未开始
                </span>
                <span className="execution-attention">
                  {data.reviewQueue?.length ?? 0} 项清单待我核验
                </span>
              </div>
              {data.projectStatus !== 'ACTIVE' && (
                <Alert
                  showIcon
                  type="warning"
                  title="项目当前已暂停或关闭，新执行事实暂不可登记。历史与已有核验记录仍可按权限查看。"
                />
              )}
              <div className="execution-layout">
                <div className="business-stack">
                  <Panel
                    title={
                      section === 'stages'
                        ? '阶段执行对照'
                        : section === 'items'
                          ? '项目清单执行'
                          : '里程碑实际与核验'
                    }
                    extra={
                      <Space wrap>
                        <Input
                          allowClear
                          size="small"
                          value={keyword}
                          placeholder={
                            section === 'stages' ? '名称或负责人' : '搜索名称'
                          }
                          aria-label="搜索执行对象"
                          onChange={(e) => setKeyword(e.target.value)}
                        />
                        {section === 'stages' && (
                          <Select
                            allowClear
                            size="small"
                            value={status}
                            placeholder="执行状态"
                            aria-label="执行状态筛选"
                            onChange={setStatus}
                            options={[
                              'NOT_STARTED',
                              'IN_PROGRESS',
                              'PAUSED',
                              'COMPLETED',
                              'NEEDS_REVIEW',
                            ].map((value) => ({
                              value,
                              label: executionLabel(value),
                            }))}
                          />
                        )}
                      </Space>
                    }
                  >
                    {section === 'stages' ? (
                      <StageExecutionTable
                        objects={displayed}
                        stages={data.stages}
                        names={names}
                        selected={selected?.id ?? ''}
                        onSelect={choose}
                        actions={actions}
                      />
                    ) : section === 'items' ? (
                      <ItemExecutionTable
                        objects={displayed}
                        items={data.items}
                        references={data.objects}
                        onOpen={setItemId}
                      />
                    ) : (
                      <MilestoneExecutionTable
                        objects={displayed}
                        milestones={data.milestones}
                        actions={actions}
                        names={names}
                      />
                    )}
                  </Panel>
                  {section === 'stages' && selected && (
                    <StageDetail
                      data={data}
                      object={selected}
                      row={data.stages.find((s) => s.id === selected.id)!}
                      names={names}
                      work={work.data}
                      actions={actions}
                    />
                  )}
                  {section === 'stages' && (
                    <Panel
                      title="项目清单执行"
                      subtitle="以当前批准数量为分母，验收比例仅计独立通过的有效数量。"
                    >
                      <ItemExecutionTable
                        objects={data.objects}
                        items={data.items}
                        onOpen={setItemId}
                      />
                    </Panel>
                  )}
                </div>
                <ExecutionAside
                  data={data}
                  actions={actions}
                  onItem={setItemId}
                />
              </div>
            </>
          )}
        </QueryState>
      )}
      {itemId && (
        <ItemExecutionDrawer
          projectId={projectId}
          id={itemId}
          ownerId={itemOwner}
          actions={actions}
          onClose={() => setItemId(null)}
        />
      )}
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </div>
  )
}
function StageDetail({
  data,
  object,
  row,
  names,
  work,
  actions,
}: {
  data: ExecutionWorkspace
  object: ExecutionObject
  row: StageExecution
  names: Map<string, string>
  work: WorkReference[] | undefined
  actions: ExecutionActions
}) {
  const packages = data.objects.filter(
    (o) => !o.archived && o.content.workPackage?.stageId === object.id,
  )
  return (
    <Panel
      title={
        <Space wrap>
          <span>当前查看：{executionTitle(object)}</span>
          <ExecutionStatus value={row.status} />
        </Space>
      }
      subtitle={`实际负责人：${names.get(object.content.stage?.ownerId ?? '') ?? '历史责任人'}；报告进度与最终完成结论分别记录。`}
      extra={
        <Space wrap size={4}>
          {row.allowedActions.map((a) => (
            <Button
              size="small"
              key={a}
              type={a === 'PROGRESS' ? 'primary' : 'default'}
              onClick={() => actions.stage(object, row, a)}
            >
              {executionLabel(a)}
            </Button>
          ))}
          <Button size="small" onClick={() => actions.history(object)}>
            执行历史
          </Button>
        </Space>
      }
    >
      <div className="execution-stage-detail">
        <div>
          <Table
            size="small"
            rowKey="id"
            tableLayout="fixed"
            dataSource={packages}
            pagination={false}
            scroll={{ x: 500 }}
            columns={[
              {
                title: '原专业工作包',
                render: (_, o) => (
                  <Link to={`/work-items/${o.id}`}>{executionTitle(o)}</Link>
                ),
              },
              {
                title: '负责人',
                width: 122,
                render: (_, o) =>
                  names.get(o.content.workPackage?.ownerId ?? '') ??
                  '历史责任人',
              },
              {
                title: '计划完成',
                width: 105,
                render: (_, o) => o.content.workPackage?.endsOn,
              },
              {
                title: '执行状态',
                width: 123,
                render: (_, o) =>
                  work?.find((w) => w.id === o.id) ? (
                    <Status value={work.find((w) => w.id === o.id)!.status} />
                  ) : (
                    <span className="execution-muted">进入工作包查看</span>
                  ),
              },
            ]}
          />
        </div>
        <div className="execution-stage-criteria">
          <h3>完成条件与当前缺项</h3>
          <p>{object.content.stage?.completionCriteria}</p>
          <CompletionProblems problems={row.blockers} />
        </div>
      </div>
      <div className="execution-stage-notes">
        <span>
          规定动作：
          {object.content.stage?.actions.join('、') || '依据原阶段范围'}
        </span>
        <span>
          成果：
          {object.content.stage?.deliverables.join('、') || '依据原阶段范围'}
        </span>
      </div>
    </Panel>
  )
}
function ExecutionAside({
  data,
  actions,
  onItem,
}: {
  data: ExecutionWorkspace
  actions: ExecutionActions
  onItem: (id: string) => void
}) {
  const mine = data.milestones.filter(
    (m) =>
      m.allowedActions.includes('VERIFY') ||
      m.allowedActions.includes('RETURN'),
  )
  const queue = data.reviewQueue ?? [],
    count = mine.length + queue.length
  return (
    <aside
      className={[
        'business-stack',
        'execution-aside',
        count ? 'execution-aside--has-review' : '',
      ].join(' ')}
    >
      <Panel
        title={`需要我处理（${count}）`}
        subtitle="来自原执行记录的指定核验；处理结果回写原对象。"
      >
        {queue.map((e) => (
          <div className="execution-review-card" key={e.id}>
            <ExecutionStatus value={e.status} />
            <strong>
              {executionTitle(data.objects.find((o) => o.id === e.itemId))}
            </strong>
            <p>
              {e.submitterName} 提交 {e.quantity}，实际发生于 {e.occurredOn}
            </p>
            <Button
              size="small"
              type="primary"
              onClick={() => onItem(e.itemId)}
            >
              核对本批验收
            </Button>
          </div>
        ))}
        {mine.map((m) => {
          const o = data.objects.find((o) => o.id === m.id)!
          return (
            <div className="execution-review-card" key={m.id}>
              <ExecutionStatus value={m.status} />
              <strong>{executionTitle(o)}</strong>
              <p>
                {m.submitterName} · {m.occurredOn}
              </p>
              <Button
                size="small"
                type="primary"
                onClick={() =>
                  actions.milestone(
                    o,
                    m,
                    m.allowedActions.includes('VERIFY') ? 'VERIFY' : 'RETURN',
                  )
                }
              >
                核对里程碑
              </Button>
            </div>
          )
        })}
        {!count && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="当前没有需要您核验的事项"
          />
        )}
      </Panel>
      <Panel
        title="最近执行记录"
        subtitle="实际日期与登记时间分别保留。"
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => actions.recent(data.recentEvents)}
          >
            查看记录
          </Button>
        }
      >
        {data.recentEvents.length ? (
          <Timeline
            items={data.recentEvents.slice(0, 3).map((e) => ({
              content: (
                <>
                  <strong>{executionLabel(e.action)}</strong>
                  <span className="business-cell-sub">
                    {e.occurredOn} · {e.actorName}
                  </span>
                  <p className="execution-event-note">{e.note}</p>
                  <span className="execution-muted">
                    登记于 {dateTime(e.at)}
                  </span>
                </>
              ),
            }))}
          />
        ) : (
          <p className="execution-muted">
            当前批准范围尚无执行记录，开始阶段后可登记。
          </p>
        )}
      </Panel>
      <Panel title="里程碑执行情况">
        <div className="execution-milestone-list">
          {data.milestones.map((m) => {
            const o = data.objects.find((o) => o.id === m.id)!
            return (
              <div key={m.id}>
                <strong>{executionTitle(o)}</strong>
                <ExecutionStatus value={m.status} />
                <span className="business-cell-sub">
                  计划 {o.content.milestone?.dueDate} · 实际{' '}
                  {m.occurredOn ?? '未发生'}
                </span>
              </div>
            )
          })}
        </div>
      </Panel>
    </aside>
  )
}
