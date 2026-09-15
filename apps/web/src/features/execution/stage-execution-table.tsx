import { Button, Progress, Space, Table } from 'antd'
import {
  executionLabel,
  actualToday,
  type ExecutionObject,
  type StageExecution,
} from './execution-types'
import { ExecutionStatus } from './execution-ui'
import type { ExecutionActions } from './execution-commands'

const dateRange = (start?: string | null, end?: string | null) =>
  start
    ? `${start} 至 ${end ? (end.slice(0, 4) === start.slice(0, 4) ? end.slice(5) : end) : '尚未完成'}`
    : '尚未发生'

export function StageExecutionTable({
  objects,
  stages,
  names,
  selected,
  onSelect,
  actions,
}: {
  objects: ExecutionObject[]
  stages: StageExecution[]
  names: Map<string, string>
  selected: string
  onSelect: (id: string) => void
  actions: ExecutionActions
}) {
  const rows = objects
    .filter((o) => o.kind === 'STAGE' && !o.archived)
    .map((object) => ({
      object,
      actual: stages.find((s) => s.id === object.id)!,
    }))
  const days = rows
    .flatMap(({ object, actual }) => [
      object.content.stage?.startsOn,
      object.content.stage?.endsOn,
      actual.startedOn,
      actual.completedOn,
    ])
    .filter((d): d is string => !!d)
    .map((d) => Date.parse(d))
  const from = Math.min(...days),
    to = Math.max(...days),
    span = Math.max(86400000, to - from)
  const bar = (
    start: string | null | undefined,
    end: string | null | undefined,
    actual = false,
  ) =>
    start && (
      <span
        className={
          actual
            ? 'execution-time-bar execution-time-bar--actual'
            : 'execution-time-bar'
        }
        title={`${actual ? '实际' : '计划'}：${start} 至 ${end ?? '今'}`}
        style={{
          left: `${Math.max(0, ((Date.parse(start) - from) / span) * 100)}%`,
          width: `${Math.max(1, Math.min(100, ((Date.parse(end ?? actualToday()) - Date.parse(start)) / span) * 100))}%`,
        }}
      />
    )
  return (
    <Table
      size="small"
      rowKey={(row) => row.object.id}
      tableLayout="fixed"
      dataSource={rows}
      scroll={{ x: 780 }}
      pagination={
        rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false
      }
      rowClassName={(r) =>
        r.object.id === selected ? 'execution-selected-row' : ''
      }
      columns={[
        {
          title: '阶段与责任',
          width: 172,
          render: (_, r) => (
            <>
              <Button
                type="link"
                size="small"
                className="execution-title-button"
                onClick={() => onSelect(r.object.id)}
              >
                {r.object.content.stage?.title}
                {r.object.content.stage?.focus && (
                  <span className="execution-focus">重点</span>
                )}
              </Button>
              <span className="business-cell-sub">
                {names.get(r.object.content.stage?.ownerId ?? '') ??
                  '历史责任人'}
              </span>
            </>
          ),
        },
        {
          title: '当前状态',
          width: 110,
          render: (_, r) => <ExecutionStatus value={r.actual.status} />,
        },
        {
          title: '计划 / 实际',
          width: 152,
          render: (_, r) => (
            <>
              <span>
                {dateRange(
                  r.object.content.stage?.startsOn,
                  r.object.content.stage?.endsOn,
                )}
              </span>
              <span className="business-cell-sub">
                {dateRange(r.actual.startedOn, r.actual.completedOn)}
              </span>
            </>
          ),
        },
        {
          title: '报告进度',
          width: 90,
          render: (_, r) => (
            <Progress
              percent={r.actual.progress}
              size="small"
              status={r.actual.status === 'COMPLETED' ? 'success' : 'normal'}
            />
          ),
        },
        {
          title: (
            <span>
              计划与实际时间
              <span className="business-cell-sub">浅蓝：计划 · 深蓝：实际</span>
            </span>
          ),
          width: 150,
          render: (_, r) => (
            <div className="execution-time-track">
              {bar(
                r.object.content.stage?.startsOn,
                r.object.content.stage?.endsOn,
              )}
              {bar(r.actual.startedOn, r.actual.completedOn, true)}
            </div>
          ),
        },
        {
          title: '操作',
          width: 106,
          render: (_, r) => (
            <Space orientation="vertical" size={3}>
              {r.actual.allowedActions.slice(0, 1).map((a) => (
                <Button
                  key={a}
                  size="small"
                  onClick={() => actions.stage(r.object, r.actual, a)}
                >
                  {executionLabel(a)}
                </Button>
              ))}
              <Button
                type="link"
                size="small"
                onClick={() => onSelect(r.object.id)}
              >
                查看阶段
              </Button>
            </Space>
          ),
        },
      ]}
    />
  )
}
