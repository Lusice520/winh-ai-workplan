import { Descriptions, Empty, Progress, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { dateTime } from '@/features/business/business-data'
import { EvidenceFiles } from '@/features/execution/execution-ui'
import {
  taskLabel,
  taskState,
  type TaskRow,
  type TaskEvent,
  type TaskSnapshot,
} from './task-types'

export function TaskStatus({ task }: { task: TaskRow }) {
  const state = taskState(task)
  return (
    <>
      <Tag
        color={
          task.needsReview
            ? 'orange'
            : state === 'DONE'
              ? 'green'
              : state === 'PENDING_VERIFICATION'
                ? 'orange'
                : state === 'IN_PROGRESS'
                  ? 'blue'
                  : undefined
        }
      >
        {taskLabel(state)}
      </Tag>
      {task.needsReview && <Tag color="orange">需复核计划</Tag>}
    </>
  )
}
export function TaskProgress({ task }: { task: TaskRow }) {
  return (
    <Progress
      size="small"
      percent={task.progress}
      status="normal"
      strokeColor={
        task.status === 'DONE' && !task.needsReview
          ? '#129b84'
          : task.status === 'PENDING_VERIFICATION' || task.needsReview
            ? '#cf8b25'
            : '#335eea'
      }
      format={(p) => `${p}%`}
    />
  )
}
const labels: Record<string, string> = {
  title: '任务',
  ownerName: '当时负责人',
  verifierName: '当时验证人',
  description: '内容',
  acceptanceCriteria: '完成标准',
  status: '原状态',
  startsOn: '计划开始',
  dueDate: '计划完成',
  estimatedDays: '预计人天',
  progress: '报告进度',
  actualStartedOn: '实际开始',
  actualCompletedOn: '提交完成日期',
  evidence: '成果依据',
  verifiedAt: '独立验证时间',
  baselineVersion: '依据基线版本',
}
function Snapshot({ value }: { value: TaskSnapshot }) {
  const facts: Record<string, unknown> | null = JSON.parse(value.json)
  return (
    <div>
      {facts ? (
        <Descriptions
          size="small"
          column={1}
          items={Object.entries(facts)
            .filter(([key]) => labels[key])
            .map(([key, v]) => ({
              key,
              label: labels[key],
              children: (
                <span className="business-text">
                  {v == null
                    ? '—'
                    : key === 'status'
                      ? taskLabel(String(v))
                      : key === 'verifiedAt'
                        ? dateTime(String(v))
                        : String(v)}
                </span>
              ),
            }))}
        />
      ) : (
        <span className="business-muted">此前没有任务执行记录</span>
      )}
      <EvidenceFiles
        files={value.files.files}
        restricted={value.files.restricted}
      />
    </div>
  )
}
export function TaskHistory({ events }: { events: TaskEvent[] }) {
  return events.length ? (
    <Table
      size="small"
      rowKey="id"
      dataSource={events}
      pagination={{ defaultPageSize: 10, showSizeChanger: false }}
      scroll={{ x: 560 }}
      columns={[
        {
          title: '操作 / 责任',
          width: 190,
          render: (_, e) => (
            <>
              <strong>{taskLabel(e.action)}</strong>
              <span className="business-cell-sub">
                {e.actorName} · {dateTime(e.at)}
              </span>
            </>
          ),
        },
        {
          title: '说明与依据',
          dataIndex: 'note',
          render: (v) => <span className="business-text">{v}</span>,
        },
        {
          title: '任务',
          width: 72,
          render: (_, e) => <Link to={`/work-items/${e.taskId}`}>原记录</Link>,
        },
      ]}
      expandable={{
        expandedRowRender: (e) => (
          <div className="task-comparison">
            <section>
              <h3>操作前</h3>
              <Snapshot value={e.before} />
            </section>
            <section>
              <h3>操作后</h3>
              <Snapshot value={e.after} />
            </section>
          </div>
        ),
      }}
    />
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无任务记录" />
  )
}
