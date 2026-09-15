import { Button, Collapse, Descriptions, Empty, Space, Table, Tag } from 'antd'
import { useState } from 'react'
import { FileDetailDrawer } from '@/features/files/file-workspace'
import { QueryState } from '@/features/business/business-ui'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import type { FileReference } from '@/features/files/file-types'
import { executionLabel, type ExecutionEvent } from './execution-types'

export function ExecutionStatus({ value }: { value: string }) {
  return (
    <Tag
      color={
        ['VERIFIED', 'COMPLETED', 'RECORDED'].includes(value)
          ? 'green'
          : ['PENDING', 'NEEDS_REVIEW', 'PAUSED'].includes(value)
            ? 'orange'
            : value === 'IN_PROGRESS'
              ? 'blue'
              : undefined
      }
    >
      {executionLabel(value)}
    </Tag>
  )
}
const factLabels: Record<string, string> = {
  status: '状态',
  progress: '报告进度',
  startedOn: '实际开始',
  completedOn: '实际完成',
  occurredOn: '实际日期',
  evidence: '完成依据',
  decision: '核验说明',
  requiresReceipt: '需到货',
  requiresInstallation: '需安装',
  brand: '品牌',
  model: '型号',
  supplier: '供应商',
  kind: '事件类型',
  quantity: '数量',
}
function FactsReadout({ json }: { json: string }) {
  let facts: Record<string, unknown> | null
  try {
    facts = JSON.parse(json)
  } catch {
    facts = null
  }
  if (!facts) return <span className="execution-muted">此前尚无记录</span>
  return (
    <Descriptions
      size="small"
      column={1}
      items={Object.entries(facts)
        .filter(([key]) => factLabels[key])
        .map(([key, value]) => ({
          key,
          label: factLabels[key],
          children:
            typeof value === 'boolean'
              ? value
                ? '是'
                : '否'
              : value == null
                ? '—'
                : ['status', 'kind'].includes(key)
                  ? executionLabel(String(value))
                  : String(value),
        }))}
    />
  )
}
export function ExecutionHistory({
  projectId,
  objectId,
}: {
  projectId: string
  objectId: string
}) {
  const query = useBusinessQuery<ExecutionEvent[]>(
    `/api/projects/${projectId}/execution/history/${objectId}`,
  )
  return (
    <QueryState query={query}>
      <ExecutionHistoryList events={query.data ?? []} />
    </QueryState>
  )
}
export function ExecutionHistoryList({ events }: { events: ExecutionEvent[] }) {
  return events.length ? (
    <Table
      size="small"
      rowKey="id"
      dataSource={events}
      pagination={{ pageSize: 10, showSizeChanger: false }}
      scroll={{ x: 490 }}
      columns={[
        { title: '实际日期', dataIndex: 'occurredOn', width: 112 },
        {
          title: '操作与责任',
          render: (_, e) => (
            <>
              <strong>{executionLabel(e.action)}</strong>
              <span className="business-cell-sub">
                {e.actorName} · {dateTime(e.at)}
              </span>
            </>
          ),
        },
        {
          title: '说明',
          dataIndex: 'note',
          render: (v) => <span className="business-text">{v}</span>,
        },
      ]}
      expandable={{
        expandedRowRender: (e) => (
          <div className="execution-compare">
            <section>
              <h3>操作前</h3>
              <FactsReadout json={e.beforeJson} />
              <EvidenceFiles
                files={e.beforeFiles.files}
                restricted={e.beforeFiles.restricted}
              />
            </section>
            <section>
              <h3>操作后</h3>
              <FactsReadout json={e.afterJson} />
              <EvidenceFiles
                files={e.afterFiles.files}
                restricted={e.afterFiles.restricted}
              />
            </section>
            <small>
              依据基线 V{e.baselineVersion} · 对象版本 {e.objectVersion}
            </small>
          </div>
        ),
      }}
    />
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无执行历史" />
  )
}
export function EvidenceFiles({
  files,
  restricted = 0,
}: {
  files: FileReference[]
  restricted?: number
}) {
  const [id, setId] = useState<string | null>(null)
  return (
    <>
      <Space orientation="vertical" size={4}>
        {files.map((f) => (
          <Button
            type="link"
            key={f.versionId}
            onClick={() => setId(f.documentId)}
          >
            {f.title} · V{f.versionNumber}
            {!f.current ? '（历史依据）' : ''}
          </Button>
        ))}
        {restricted > 0 && (
          <span className="execution-muted">
            {restricted} 项附件的查看权限受限
          </span>
        )}
      </Space>
      {id && <FileDetailDrawer id={id} onClose={() => setId(null)} />}
    </>
  )
}
export function CompletionProblems({ problems }: { problems: string[] }) {
  if (!problems.length) return <Tag color="green">当前关联条件已满足</Tag>
  return (
    <Collapse
      size="small"
      items={[
        {
          key: 'problems',
          label: `${problems.length} 项待完成条件`,
          children: (
            <ul className="execution-problems">
              {problems.map((p, i) => (
                <li key={`${i}-${p}`}>{p}</li>
              ))}
            </ul>
          ),
        },
      ]}
    />
  )
}
export function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="small" onClick={onClick}>
      执行历史
    </Button>
  )
}
