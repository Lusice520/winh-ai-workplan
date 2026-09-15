import { Button, Collapse, Descriptions, Empty, Space, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { EvidenceFiles } from '@/features/execution/execution-ui'
import { dateTime } from '@/features/business/business-data'
import {
  incomeLabel,
  money,
  compareLines,
  type SourceView,
  type ForecastLine,
  type ForecastRevision,
  type IncomeEvent,
  type IncomeSnapshot,
} from './income-types'
export function IncomeStatus({
  status,
  reversed = false,
}: {
  status: string
  reversed?: boolean
}) {
  return (
    <Tag
      color={
        status === 'CONFIRMED' || status === 'PUBLISHED'
          ? 'green'
          : status === 'SUBMITTED'
            ? 'orange'
            : status === 'DRAFT'
              ? 'blue'
              : undefined
      }
    >
      {reversed ? '已确认 · 已冲销' : incomeLabel(status)}
    </Tag>
  )
}
export function IncomeSource({ source }: { source: SourceView | undefined }) {
  return source?.restricted ? (
    <span className="income-muted">合同依据查看受限</span>
  ) : source?.value ? (
    <>
      <Link to={`/contracts/${source.value.contractId}`}>
        {source.value.contractNumber} · 原版 {source.value.contractVersion}
      </Link>
      {source.value.nodeTitle && (
        <span className="business-cell-sub">
          {source.value.nodeTitle} · 节点版本 {source.value.nodeVersion}
        </span>
      )}
    </>
  ) : (
    <span className="income-muted">项目 / 其他收入依据</span>
  )
}
export function ForecastLines({
  lines,
  onIncome,
}: {
  lines: ForecastLine[]
  onIncome?: (id: string) => void
}) {
  return (
    <Table
      size="small"
      rowKey="id"
      dataSource={lines}
      pagination={false}
      scroll={{ x: 720 }}
      columns={[
        {
          title: '经营节点',
          render: (_, l) => (
            <>
              <strong>{l.title}</strong>
              <span className="business-cell-sub">{l.sourceNote}</span>
            </>
          ),
        },
        { title: '计划日期', dataIndex: 'plannedOn', width: 112 },
        {
          title: '计划金额（元）',
          width: 150,
          align: 'right',
          render: (_, l) => money(l.amount),
        },
        {
          title: '原版来源与资料',
          width: 260,
          render: (_, l) => (
            <Space orientation="vertical" size={3}>
              <IncomeSource source={l.source} />
              {l.incomeReference && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => onIncome?.(l.incomeReference!.id)}
                >
                  收入参考：{l.incomeReference.title}
                </Button>
              )}
              <EvidenceFiles {...l.files} />
            </Space>
          ),
        },
      ]}
    />
  )
}
export function ForecastComparison({
  revision,
  previous,
}: {
  revision: ForecastRevision
  previous?: ForecastRevision
}) {
  const changes = compareLines(revision.lines, previous?.lines ?? [])
  return (
    <section className="income-comparison">
      <h3>{previous ? `相对 V${previous.number} 的变化` : '首次建立预测'}</h3>
      {changes.length ? (
        <ul>
          {changes.map((c) => (
            <li key={c.id}>
              <strong>{c.title}</strong>
              <span>{c.change}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="income-muted">节点、日期、金额及依据均未变化。</p>
      )}
    </section>
  )
}
function Snapshot({ value }: { value: IncomeSnapshot | null }) {
  if (!value) return <span className="income-muted">此前尚无记录</span>
  if (value.revisions)
    return (
      <Collapse
        size="small"
        items={value.revisions.map((r) => ({
          key: r.id,
          label: `V${r.number} · ${incomeLabel(r.status)} · ${r.reason}`,
          children: <ForecastLines lines={r.lines} />,
        }))}
      />
    )
  return (
    <>
      <Descriptions
        size="small"
        column={1}
        items={[
          { key: 'title', label: '收入事项', children: value.title },
          {
            key: 'status',
            label: '状态',
            children: value.status ? incomeLabel(value.status) : '—',
          },
          {
            key: 'amount',
            label: '金额与日期',
            children: `${money(value.amount)} ${value.currency ?? ''} · ${value.occurredOn ?? '—'}`,
          },
          {
            key: 'source',
            label: '当时来源',
            children: (
              <>
                <IncomeSource source={value.source} />
                <p>{value.sourceNote}</p>
              </>
            ),
          },
          {
            key: 'people',
            label: '当轮责任',
            children: (
              <>
                {value.submitterName ?? value.ownerName ?? '尚未提交'} →{' '}
                {value.confirmerName}
                {value.confirmedByName && (
                  <p>已由 {value.confirmedByName} 确认</p>
                )}
              </>
            ),
          },
          {
            key: 'forecast',
            label: '原预测',
            children: value.forecast
              ? `V${value.forecast.revisionNumber} · ${value.forecast.title} · ${money(value.forecast.amount)}`
              : (value.unplannedReason ?? '未引用预测'),
          },
        ]}
      />
      {value.files && <EvidenceFiles {...value.files} />}
    </>
  )
}
export function IncomeHistory({ events }: { events: IncomeEvent[] }) {
  return events.length ? (
    <Table
      size="small"
      rowKey="id"
      dataSource={events}
      pagination={false}
      scroll={{ x: 580 }}
      columns={[
        {
          title: '处理时间 / 人员',
          width: 185,
          render: (_, e) => (
            <>
              {dateTime(e.at)}
              <span className="business-cell-sub">{e.actorName}</span>
            </>
          ),
        },
        { title: '动作', width: 120, render: (_, e) => incomeLabel(e.action) },
        { title: '当轮说明', dataIndex: 'reason' },
      ]}
      expandable={{
        expandedRowRender: (e) => (
          <div className="income-history-compare">
            <section>
              <h4>处理前</h4>
              <Snapshot value={e.before} />
            </section>
            <section>
              <h4>处理后</h4>
              <Snapshot value={e.after} />
            </section>
          </div>
        ),
      }}
    />
  ) : (
    <Empty description="暂无处理历史" />
  )
}
