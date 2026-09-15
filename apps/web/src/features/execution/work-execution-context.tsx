import { Alert, Progress, Space } from 'antd'
import { Link } from 'react-router'
import { Panel, QueryState } from '@/features/business/business-ui'
import { useBusinessQuery } from '@/features/business/business-data'
import { executionTitle, type ExecutionWorkspace } from './execution-types'
import { ExecutionStatus } from './execution-ui'
import './execution.css'

export function WorkExecutionContext({
  projectId,
  workItemId,
}: {
  projectId: string
  workItemId: string
}) {
  const query = useBusinessQuery<ExecutionWorkspace>(
      `/api/projects/${projectId}/execution`,
    ),
    data = query.data
  const object = data?.objects.find((o) => o.id === workItemId),
    stage = data?.stages.find(
      (s) => s.id === object?.content.workPackage?.stageId,
    )
  const items =
    data?.items.filter(
      (i) =>
        data.objects.find((o) => o.id === i.id)?.content.item?.workPackageId ===
        workItemId,
    ) ?? []
  return (
    <Panel
      title="当前执行与清单验收"
      extra={
        stage && (
          <Link
            to={`/projects/${projectId}?tab=stages&executionStage=${stage.id}`}
          >
            进入原阶段执行
          </Link>
        )
      }
    >
      <QueryState query={query}>
        {data && stage && (
          <div className="business-stack">
            <Space wrap>
              <strong>
                {executionTitle(data.objects.find((o) => o.id === stage.id))}
              </strong>
              <ExecutionStatus value={stage.status} />
              <span className="execution-muted">
                阶段报告进度 {stage.progress}%
              </span>
            </Space>
            {stage.status !== 'IN_PROGRESS' && (
              <Alert
                showIcon
                type="info"
                title="新的工作包完成提交需在阶段进行中办理。已有独立完成结果和来源需求保持原事实。"
              />
            )}
            {items.map((i) => {
              const o = data.objects.find((o) => o.id === i.id)!
              return (
                <div key={i.id}>
                  <Link to={`/projects/${projectId}?tab=items`}>
                    {executionTitle(o)}
                  </Link>
                  <span className="business-cell-sub">
                    已验收 {i.totals.accepted} / {o.content.item?.quantity}{' '}
                    {o.content.item?.unit} · 待核验 {i.totals.pending} · 需重核{' '}
                    {i.totals.needsReview}
                  </span>
                  <Progress
                    size="small"
                    percent={Math.round(
                      (i.totals.accepted /
                        Math.max(0.01, o.content.item?.quantity ?? 0)) *
                        100,
                    )}
                  />
                </div>
              )
            })}
          </div>
        )}
      </QueryState>
    </Panel>
  )
}
