import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Input,
  Select,
  Space,
  Table,
} from 'antd'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  BusinessPage,
  CommandDrawer,
  Facts,
  PageHeading,
  Panel,
  QueryState,
  RefreshButton,
  type Command,
  type Field,
} from '@/features/business/business-ui'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import type { ProjectDetail } from '@/features/business/business-types'
import type { FileWorkspace } from '@/features/files/file-types'
import {
  EvidenceFiles,
  ExecutionStatus,
} from '@/features/execution/execution-ui'
import { executionTitle } from '@/features/execution/execution-types'
import { taskActionCommand, taskPlanCommand } from './task-commands'
import { TaskHistory, TaskProgress, TaskStatus } from './task-ui'
import {
  matchesTask,
  taskLabel,
  taskPath,
  taskStats,
  type TaskDetail,
  type TaskWorkspace,
} from './task-types'
import './tasks.css'

export function TaskWorkspacePage() {
  const { projectId, workPackageId } = useParams(),
    navigate = useNavigate(),
    query = useBusinessQuery<TaskWorkspace>(
      projectId && workPackageId
        ? `/api/projects/${projectId}/work-packages/${workPackageId}/tasks`
        : undefined,
    ),
    project = useBusinessQuery<ProjectDetail>(
      projectId ? `/api/projects/${projectId}` : undefined,
    ),
    [params, setParams] = useSearchParams(),
    [command, setCommand] = useState<Command | null>(null),
    data = query.data
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  const onCreated = (result: unknown) => {
    if (
      result &&
      typeof result === 'object' &&
      'task' in result &&
      result.task &&
      typeof result.task === 'object' &&
      'id' in result.task &&
      typeof result.task.id === 'string'
    )
      void navigate(`/work-items/${result.task.id}`)
  }
  const stats = taskStats(data?.tasks ?? []),
    rows = data?.tasks.filter((r) => matchesTask(r, params)) ?? [],
    review =
      data?.tasks.filter((t) => t.allowedActions.includes('RETURN')) ?? [],
    wp = data?.workPackage.content.workPackage
  return (
    <BusinessPage className="task-page">
      <QueryState query={query}>
        {data && (
          <>
            <PageHeading
              title={`${executionTitle(data.workPackage)} · 任务执行`}
              description={data.projectName}
              extra={
                <>
                  <RefreshButton onClick={query.refetch} />
                  {data.allowedActions.includes('ADOPT') && (
                    <Button
                      disabled={!data.availableTasks.length || !project.data}
                      onClick={() =>
                        setCommand(
                          taskPlanCommand(
                            data,
                            project.data?.members ?? [],
                            'ADOPT',
                            onCreated,
                          ),
                        )
                      }
                    >
                      接纳原任务
                    </Button>
                  )}
                  {data.allowedActions.includes('CREATE') && (
                    <Button
                      type="primary"
                      disabled={!project.data}
                      onClick={() =>
                        setCommand(
                          taskPlanCommand(
                            data,
                            project.data?.members ?? [],
                            'CREATE',
                            onCreated,
                          ),
                        )
                      }
                    >
                      新建任务
                    </Button>
                  )}
                </>
              }
            />
            <div className="task-breadcrumb">
              <Link to={`/work-items/${data.workPackage.id}`}>
                ← 返回原工作包
              </Link>
              <span>
                计划 {wp?.startsOn} 至 {wp?.endsOn}
              </span>
              <ExecutionStatus value={data.stage.status} />
              <span>原包基线 V{data.workPackage.baselineVersion}</span>
            </div>
            <div className="task-facts">
              <Facts
                items={[
                  {
                    label: '有效任务',
                    value: stats.total,
                    note: stats.cancelled
                      ? `${stats.cancelled} 项已取消，单独保留`
                      : '来自本工作包',
                  },
                  {
                    label: '已独立验证',
                    value: `${stats.done} / ${stats.total}`,
                    note: `完成比例 ${stats.percent}%`,
                  },
                  {
                    label: '待验证',
                    value: stats.pending,
                    note: '报告完成后仍需独立核验',
                  },
                  {
                    label: '需复核计划',
                    value: stats.review,
                    note: '原范围或验收依据有变化',
                  },
                ]}
              />
            </div>
            <div className="task-layout">
              <main className="business-stack task-main">
                <Panel
                  className="task-list-panel"
                  title="任务列表"
                  extra={
                    <span className="business-muted">{rows.length} 项匹配</span>
                  }
                >
                  <div className="task-filter">
                    <Input
                      aria-label="任务名称或责任人"
                      placeholder="任务名称或责任人"
                      allowClear
                      value={params.get('q') ?? ''}
                      onChange={(e) => update('q', e.target.value)}
                    />
                    <Select
                      aria-label="任务状态"
                      placeholder="全部状态"
                      allowClear
                      value={params.get('state') ?? undefined}
                      onChange={(v) => update('state', v ?? '')}
                      options={[
                        'NOT_STARTED',
                        'IN_PROGRESS',
                        'PENDING_VERIFICATION',
                        'DONE',
                        'CANCELLED',
                        'NEEDS_REVIEW',
                      ].map((value) => ({
                        value,
                        label:
                          value === 'NEEDS_REVIEW'
                            ? '需复核计划'
                            : taskLabel(value),
                      }))}
                    />
                    <Button onClick={() => setParams({})}>重置</Button>
                  </div>
                  <details className="task-date-filter">
                    <summary>计划日期筛选</summary>
                    <Space wrap>
                      <label>
                        开始不早于{' '}
                        <Input
                          type="date"
                          aria-label="计划开始不早于"
                          value={params.get('from') ?? ''}
                          onChange={(e) => update('from', e.target.value)}
                        />
                      </label>
                      <label>
                        完成不晚于{' '}
                        <Input
                          type="date"
                          aria-label="计划完成不晚于"
                          value={params.get('to') ?? ''}
                          onChange={(e) => update('to', e.target.value)}
                        />
                      </label>
                    </Space>
                  </details>
                  <Table
                    size="small"
                    rowKey="id"
                    tableLayout="fixed"
                    dataSource={rows}
                    scroll={{
                      x: 850,
                      y: Number(params.get('pageSize')) > 10 ? 660 : undefined,
                    }}
                    pagination={{
                      current: Math.max(1, Number(params.get('page')) || 1),
                      pageSize: [20, 50].includes(
                        Number(params.get('pageSize')),
                      )
                        ? Number(params.get('pageSize'))
                        : 10,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50],
                      onChange: (page, size) =>
                        setParams(
                          (previous) => {
                            const next = new URLSearchParams(previous)
                            next.set('page', String(page))
                            next.set('pageSize', String(size))
                            return next
                          },
                          { replace: true },
                        ),
                      showTotal: (total) => `共 ${total} 项`,
                    }}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            data.tasks.length
                              ? '没有符合筛选条件的任务'
                              : '从新建任务或接纳原任务开始安排'
                          }
                        />
                      ),
                    }}
                    columns={[
                      {
                        title: '任务 / 完成标准',
                        width: 250,
                        render: (_, t) => (
                          <>
                            <Link
                              className="task-title"
                              to={`/work-items/${t.id}`}
                            >
                              {t.title}
                            </Link>
                            <span className="business-cell-sub task-two-lines">
                              {t.acceptanceCriteria}
                            </span>
                            {t.sourceRequirementId && (
                              <Link
                                className="task-source"
                                to={`/requirements/${t.sourceRequirementId}`}
                              >
                                原需求
                              </Link>
                            )}
                          </>
                        ),
                      },
                      {
                        title: '负责人 / 验证人',
                        width: 166,
                        render: (_, t) => (
                          <>
                            {t.ownerName}
                            <span className="business-cell-sub">
                              验证：{t.verifierName}
                            </span>
                          </>
                        ),
                      },
                      {
                        title: '计划 / 实际',
                        width: 134,
                        render: (_, t) => (
                          <>
                            {t.startsOn}
                            <span className="business-cell-sub">
                              至 {t.dueDate.slice(5)}
                            </span>
                            {t.actualCompletedOn && (
                              <span className="business-cell-sub">
                                提交 {t.actualCompletedOn}
                              </span>
                            )}
                          </>
                        ),
                      },
                      {
                        title: '本人报告进度',
                        width: 118,
                        render: (_, t) => <TaskProgress task={t} />,
                      },
                      {
                        title: '状态',
                        width: 110,
                        render: (_, t) => <TaskStatus task={t} />,
                      },
                      {
                        title: '操作',
                        width: 72,
                        render: (_, t) => (
                          <Link to={`/work-items/${t.id}`}>查看</Link>
                        ),
                      },
                    ]}
                  />
                </Panel>
                <Panel
                  title="最近任务记录"
                  extra={
                    data.recentEvents.length ? (
                      <Button
                        size="small"
                        onClick={() =>
                          setCommand({
                            title: '本包最近 20 条任务记录',
                            path: 'task-recent',
                            fields: [],
                            readOnly: true,
                            content: <TaskHistory events={data.recentEvents} />,
                          })
                        }
                      >
                        查看记录
                      </Button>
                    ) : undefined
                  }
                >
                  {data.recentEvents.slice(0, 3).map((e) => (
                    <div className="task-recent" key={e.id}>
                      <Link to={`/work-items/${e.taskId}`}>
                        {taskLabel(e.action)} ·{' '}
                        {data.tasks.find((t) => t.id === e.taskId)?.title ??
                          '原任务'}
                      </Link>
                      <span>
                        {e.actorName} · {dateTime(e.at)}
                      </span>
                      <p>{e.note}</p>
                    </div>
                  ))}
                  {!data.recentEvents.length && (
                    <p className="business-muted">
                      任务安排和执行后，实际记录会出现在这里。
                    </p>
                  )}
                </Panel>
              </main>
              <aside className="task-aside">
                <Panel
                  className="task-review-panel"
                  title={`本人待核验（${review.length}）`}
                  subtitle="只展示当前指定给你的验证事项。"
                >
                  {review.length ? (
                    review.map((t) => (
                      <div className="task-review-card" key={t.id}>
                        <TaskStatus task={t} />
                        <Link className="task-title" to={`/work-items/${t.id}`}>
                          {t.title}
                        </Link>
                        <p>
                          {t.ownerName} 提交 · 报告进度 {t.progress}%
                        </p>
                        <p className="business-muted">
                          {t.needsReview
                            ? '范围发生变化，先核对并退回修订。'
                            : t.acceptanceCriteria}
                        </p>
                        <Button
                          type="primary"
                          onClick={() => void navigate(`/work-items/${t.id}`)}
                        >
                          查看成果并核验
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="business-muted">
                      当前没有指定给你的待验证任务。
                    </p>
                  )}
                </Panel>
                <Panel className="task-criteria-panel" title="原工作包验收依据">
                  <dl className="task-criteria">
                    <dt>交付成果</dt>
                    <dd>{wp?.deliverables}</dd>
                    <dt>验收条件</dt>
                    <dd>{wp?.acceptanceCriteria}</dd>
                    <dt>清单范围</dt>
                    <dd>
                      {data.items.length} 项批准清单 ·{' '}
                      <Link to={`/projects/${data.projectId}?tab=items`}>
                        查看清单
                      </Link>
                    </dd>
                  </dl>
                  <Link
                    to={`/projects/${data.projectId}?tab=stages&executionStage=${wp?.stageId}`}
                  >
                    返回原阶段执行 →
                  </Link>
                  <p className="business-muted task-footnote">
                    任务完成后，工作包仍由原责任人提交并独立验证。
                  </p>
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

export function TaskDetailPage({
  projectId,
  id,
}: {
  projectId: string
  id: string
}) {
  const query = useBusinessQuery<TaskDetail>(
      `/api/projects/${projectId}/tasks/${id}`,
    ),
    project = useBusinessQuery<ProjectDetail>(`/api/projects/${projectId}`),
    fileQuery = useBusinessQuery<FileWorkspace>(
      project.data?.allowedActions.includes('FILE_READ')
        ? `/api/projects/${projectId}/files`
        : undefined,
    ),
    [command, setCommand] = useState<Command | null>(null),
    d = query.data,
    t = d?.task
  const fileField: Field | undefined = project.data?.allowedActions.includes(
    'FILE_READ',
  )
    ? {
        name: 'fileVersionIds',
        label: '关联当前已发布资料',
        type: 'multiple',
        required: false,
        options:
          fileQuery.data?.items
            .filter(
              (f) =>
                f.currentVersionId === f.latestVersion.id &&
                f.latestVersion.status === 'PUBLISHED',
            )
            .map((f) => ({
              value: f.latestVersion.id,
              label: `${f.title} · V${f.latestVersion.versionNumber}`,
            })) ?? [],
        hint: fileQuery.isError
          ? '资料加载失败，可关闭表单刷新；文字依据可单独提交。'
          : '保存和核验时再检查当前读取及发布状态。',
      }
    : undefined
  return (
    <BusinessPage className="task-page task-detail-page">
      <QueryState query={query}>
        {d && t && (
          <>
            <Link to={taskPath(projectId, d.workPackage.id)}>
              ← 返回原工作包任务
            </Link>
            <PageHeading
              title={t.title}
              description={`${d.projectName} · ${executionTitle(d.workPackage)}`}
              extra={
                <>
                  <TaskStatus task={t} />
                  <RefreshButton onClick={query.refetch} />
                </>
              }
            />
            {t.needsReview && (
              <Alert
                type="warning"
                showIcon
                title="当前任务需要复核计划"
                description="原范围或验收依据已变化。待验证先退回，已完成先明确重开，再核对当前安排。历史完成事实保留。"
              />
            )}
            <Facts
              items={[
                { label: '任务负责人', value: t.ownerName },
                { label: '独立验证人', value: t.verifierName },
                {
                  label: '计划日期',
                  value: t.startsOn,
                  note: `至 ${t.dueDate}`,
                },
                {
                  label: '预计投入',
                  value:
                    t.estimatedDays == null
                      ? '未填写'
                      : `${t.estimatedDays} 人天`,
                  note: '不作为实际工时',
                },
              ]}
            />
            <div className="task-layout">
              <main className="business-stack task-main">
                <Panel title="任务内容与完成标准">
                  <div className="task-comparison">
                    <section>
                      <h3>任务范围</h3>
                      <p className="business-text">{d.description}</p>
                    </section>
                    <section>
                      <h3>独立验证依据</h3>
                      <p className="business-text">{d.acceptanceCriteria}</p>
                    </section>
                  </div>
                  <Space wrap>
                    {d.itemIds.map((itemId) => (
                      <Link
                        key={itemId}
                        to={`/projects/${projectId}?tab=items`}
                      >
                        {executionTitle(d.items.find((o) => o.id === itemId))}
                      </Link>
                    ))}
                    {t.sourceRequirementId && (
                      <Link to={`/requirements/${t.sourceRequirementId}`}>
                        查看原始需求
                      </Link>
                    )}
                  </Space>
                </Panel>
                <Panel title="当前进展与成果">
                  <div className="task-actual">
                    <TaskProgress task={t} />
                    <Descriptions
                      size="small"
                      column={2}
                      items={[
                        {
                          key: 'start',
                          label: '实际开始',
                          children: t.actualStartedOn ?? '尚未发生',
                        },
                        {
                          key: 'end',
                          label: '提交完成日期',
                          children: t.actualCompletedOn ?? '尚未提交',
                        },
                        {
                          key: 'submitter',
                          label: '成果提交人',
                          children: d.submitterName ?? '—',
                        },
                        {
                          key: 'verified',
                          label: '独立通过',
                          children: d.verifiedAt
                            ? `${d.verifierName} · ${dateTime(d.verifiedAt)}`
                            : '尚未验证',
                        },
                      ]}
                    />
                  </div>
                  {d.evidence && <p className="business-text">{d.evidence}</p>}
                  <EvidenceFiles
                    files={d.files.files}
                    restricted={d.files.restricted}
                  />
                  <p className="business-muted">
                    任务成果依据基线 V{d.baselineVersion}
                    ；文件发布、清单验收和工作包完成分别保留独立结论。
                  </p>
                </Panel>
                <Panel
                  title="任务完整历史"
                  subtitle="每次修订、执行、核验与重开均保留前后事实和原文件版本。"
                >
                  <TaskHistory events={d.history} />
                </Panel>
              </main>
              <aside className="task-aside">
                <Panel className="task-review-panel" title="推进任务">
                  <Space orientation="vertical" className="task-actions">
                    {t.allowedActions.map((action) => (
                      <Button
                        key={action}
                        type={
                          ['COMPLETE', 'VERIFY', 'PROGRESS'].includes(action)
                            ? 'primary'
                            : 'default'
                        }
                        danger={action === 'CANCEL'}
                        disabled={
                          (action === 'EDIT' && !project.data) ||
                          (action === 'COMPLETE' &&
                            (project.isPending ||
                              (project.data?.allowedActions.includes(
                                'FILE_READ',
                              ) &&
                                fileQuery.isPending)))
                        }
                        onClick={() =>
                          setCommand(
                            action === 'EDIT'
                              ? taskPlanCommand(
                                  d,
                                  project.data?.members ?? [],
                                  'EDIT',
                                )
                              : taskActionCommand(d, action, fileField),
                          )
                        }
                      >
                        {taskLabel(action)}
                      </Button>
                    ))}
                  </Space>
                  {!t.allowedActions.length && (
                    <p className="business-muted">
                      当前角色或状态下没有可执行的任务动作。
                    </p>
                  )}
                </Panel>
                <Panel title="原交付上下文">
                  <Space orientation="vertical">
                    <Link to={`/work-items/${d.workPackage.id}`}>
                      原工作包与完成要求
                    </Link>
                    <Link
                      to={`/projects/${projectId}?tab=stages&executionStage=${d.workPackage.content.workPackage?.stageId}`}
                    >
                      原阶段执行
                    </Link>
                    <ExecutionStatus value={d.stage.status} />
                  </Space>
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
