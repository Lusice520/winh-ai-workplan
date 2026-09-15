import { Button, Progress, Space, Table } from 'antd'
import { useState } from 'react'
import { ExecutionFilterBar } from './execution-filters'
import {
  matchesItemFilters,
  withinDates,
  type ExecutionFilters,
} from './execution-filter-model'
import type { ExecutionActions } from './execution-commands'
import {
  executionLabel,
  executionTitle,
  quantityText,
  type ExecutionObject,
  type ItemExecution,
  type MilestoneExecution,
} from './execution-types'
import { ExecutionStatus } from './execution-ui'

export function ItemExecutionTable({
  objects,
  items,
  onOpen,
  references = objects,
}: {
  objects: ExecutionObject[]
  items: ItemExecution[]
  onOpen: (id: string) => void
  references?: ExecutionObject[]
}) {
  const [filters, setFilters] = useState<ExecutionFilters>({})
  const rows = objects
    .filter((o) => o.kind === 'ITEM' && !o.archived)
    .map((object) => ({ object, item: items.find((s) => s.id === object.id)! }))
    .filter(({ object, item }) => matchesItemFilters(object, item, filters))
  return (
    <>
      <ExecutionFilterBar
        label="筛选清单"
        value={filters}
        onChange={setFilters}
        fields={[
          {
            key: 'category',
            label: '清单类别',
            options: [
              { value: 'EQUIPMENT', label: '设备' },
              { value: 'MATERIAL', label: '物料' },
              { value: 'DELIVERABLE', label: '交付成果' },
            ],
          },
          {
            key: 'stage',
            label: '所属阶段',
            options: references
              .filter((o) => o.kind === 'STAGE' && !o.archived)
              .map((o) => ({ value: o.id, label: executionTitle(o) })),
          },
          {
            key: 'work',
            label: '所属工作包',
            options: references
              .filter((o) => o.kind === 'WORK_PACKAGE' && !o.archived)
              .map((o) => ({ value: o.id, label: executionTitle(o) })),
          },
          {
            key: 'state',
            label: '清单执行状态',
            options: [
              { value: 'PROFILE', label: '待明确环节' },
              { value: 'RECEIPT', label: '待补齐到货' },
              { value: 'INSTALL', label: '待补齐安装' },
              { value: 'PENDING', label: '有待核验' },
              { value: 'NEEDS_REVIEW', label: '需重新核验' },
              { value: 'VERIFIED', label: '已全部验收' },
            ],
          },
        ]}
      />
      <Table
        size="small"
        tableLayout="fixed"
        rowKey={(r) => r.object.id}
        dataSource={rows}
        scroll={{ x: 760 }}
        pagination={
          rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false
        }
        columns={[
          {
            title: '清单 / 规格',
            width: 180,
            render: (_, r) => (
              <>
                <Button
                  type="link"
                  size="small"
                  className="execution-title-button"
                  onClick={() => onOpen(r.object.id)}
                >
                  {executionTitle(r.object)}
                </Button>
                <span className="business-cell-sub">
                  {r.object.content.item?.specification}
                </span>
              </>
            ),
          },
          {
            title: '批准数量',
            width: 96,
            render: (_, r) =>
              `${quantityText(r.object.content.item?.quantity)} ${r.object.content.item?.unit ?? ''}`,
          },
          {
            title: '净到货',
            width: 70,
            render: (_, r) =>
              r.item.profile
                ? r.item.profile.requiresReceipt
                  ? quantityText(r.item.totals.received)
                  : '不适用'
                : '待明确',
          },
          {
            title: '净安装',
            width: 70,
            render: (_, r) =>
              r.item.profile
                ? r.item.profile.requiresInstallation
                  ? quantityText(r.item.totals.installed)
                  : '不适用'
                : '待明确',
          },
          {
            title: '已验收',
            width: 70,
            render: (_, r) => quantityText(r.item.totals.accepted),
          },
          {
            title: '待核验',
            width: 80,
            render: (_, r) => (
              <span
                className={
                  r.item.totals.pending || r.item.totals.needsReview
                    ? 'execution-attention'
                    : ''
                }
              >
                {quantityText(r.item.totals.pending)}
                {r.item.totals.needsReview > 0 && (
                  <small className="business-cell-sub">
                    重核 {quantityText(r.item.totals.needsReview)}
                  </small>
                )}
              </span>
            ),
          },
          {
            title: '验收比例',
            width: 94,
            render: (_, r) => (
              <Progress
                size="small"
                percent={Math.round(
                  (r.item.totals.accepted /
                    Math.max(0.01, r.object.content.item?.quantity ?? 0)) *
                    100,
                )}
              />
            ),
          },
          {
            title: '操作',
            width: 100,
            render: (_, r) => (
              <Button size="small" onClick={() => onOpen(r.object.id)}>
                查看记录
              </Button>
            ),
          },
        ]}
      />
    </>
  )
}
export function MilestoneExecutionTable({
  objects,
  milestones,
  actions,
  names,
}: {
  objects: ExecutionObject[]
  milestones: MilestoneExecution[]
  actions: ExecutionActions
  names: Map<string, string>
}) {
  const [filters, setFilters] = useState<ExecutionFilters>({})
  const rows = objects
    .filter((o) => o.kind === 'MILESTONE' && !o.archived)
    .map((object) => ({
      object,
      actual: milestones.find((m) => m.id === object.id)!,
    }))
    .filter(
      (r) =>
        (!filters.owner ||
          r.object.content.milestone?.ownerId === filters.owner) &&
        (!filters.status || r.actual.status === filters.status) &&
        withinDates(
          r.object.content.milestone!.dueDate,
          filters.from,
          filters.to,
        ),
    )
  return (
    <>
      <ExecutionFilterBar
        label="筛选里程碑"
        value={filters}
        onChange={setFilters}
        fields={[
          {
            key: 'owner',
            label: '里程碑负责人',
            options: [
              ...new Set(
                objects.flatMap((o) =>
                  o.content.milestone?.ownerId
                    ? [o.content.milestone.ownerId]
                    : [],
                ),
              ),
            ].map((id) => ({
              value: id,
              label: names.get(id) ?? '历史负责人',
            })),
          },
          {
            key: 'status',
            label: '里程碑核验状态',
            options: ['OPEN', 'PENDING', 'VERIFIED', 'NEEDS_REVIEW'].map(
              (value) => ({ value, label: executionLabel(value) }),
            ),
          },
          { key: 'from', label: '计划日期自', type: 'date' },
          { key: 'to', label: '计划日期至', type: 'date' },
        ]}
      />
      <Table
        size="small"
        tableLayout="fixed"
        rowKey={(r) => r.object.id}
        dataSource={rows}
        scroll={{ x: 760 }}
        pagination={
          rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false
        }
        columns={[
          {
            title: '里程碑与责任',
            width: 200,
            render: (_, r) => (
              <>
                <strong>{executionTitle(r.object)}</strong>
                <span className="business-cell-sub">
                  {names.get(r.object.content.milestone?.ownerId ?? '') ??
                    '历史责任人'}
                </span>
              </>
            ),
          },
          {
            title: '当前计划 / 实际',
            width: 148,
            render: (_, r) => (
              <>
                {r.object.content.milestone?.dueDate}
                <span className="business-cell-sub">
                  {r.actual.occurredOn ?? '尚未发生'}
                </span>
              </>
            ),
          },
          {
            title: '核验状态',
            width: 116,
            render: (_, r) => <ExecutionStatus value={r.actual.status} />,
          },
          {
            title: '指定验证 / 当前依据',
            render: (_, r) => (
              <>
                {r.actual.verifierName ?? '提交时明确'}
                <span className="business-cell-sub">
                  {r.actual.evidence ??
                    r.object.content.milestone?.acceptanceCriteria}
                </span>
              </>
            ),
          },
          {
            title: '操作',
            width: 148,
            render: (_, r) => (
              <Space wrap size={4}>
                {r.actual.allowedActions.map((a) => (
                  <Button
                    size="small"
                    key={a}
                    onClick={() => actions.milestone(r.object, r.actual, a)}
                  >
                    {executionLabel(a)}
                  </Button>
                ))}
                <Button size="small" onClick={() => actions.history(r.object)}>
                  历史与依据
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </>
  )
}
