import { Alert, Button, Descriptions, Drawer, Space, Table, Tabs } from 'antd'
import { Link } from 'react-router'
import { useState } from 'react'
import { ExecutionFilterBar } from './execution-filters'
import { withinDates, type ExecutionFilters } from './execution-filter-model'
import { Facts, QueryState } from '@/features/business/business-ui'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import type { ExecutionActions } from './execution-commands'
import {
  executionLabel,
  executionTitle,
  quantityText,
  type ItemExecutionDetail,
} from './execution-types'
import {
  EvidenceFiles,
  ExecutionHistoryList,
  ExecutionStatus,
} from './execution-ui'

export function ItemExecutionDrawer({
  projectId,
  id,
  ownerId,
  actions,
  onClose,
}: {
  projectId: string
  id: string
  ownerId: string | null
  actions: ExecutionActions
  onClose: () => void
}) {
  const [filters, setFilters] = useState<ExecutionFilters>({})
  const query = useBusinessQuery<ItemExecutionDetail>(
      `/api/projects/${projectId}/execution/items/${id}`,
    ),
    data = query.data
  return (
    <Drawer
      open
      title={data ? `清单执行 · ${executionTitle(data.object)}` : '清单执行'}
      size={1040}
      onClose={onClose}
      className="execution-drawer"
      destroyOnHidden
      footer={
        <div className="business-drawer-footer">
          <span>计划、分批实际与原验收关系持续保留</span>
          <Button onClick={onClose}>关闭</Button>
        </div>
      }
    >
      <QueryState query={query}>
        {data && (
          <div className="business-stack">
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2, lg: 3 }}
              items={[
                {
                  key: 'spec',
                  label: '批准规格',
                  children: data.object.content.item?.specification,
                },
                {
                  key: 'scope',
                  label: '批准范围',
                  children: `${quantityText(data.object.content.item?.quantity)} ${data.object.content.item?.unit ?? ''} · V${data.object.baselineVersion}`,
                },
                {
                  key: 'work',
                  label: '原工作包',
                  children: (
                    <Link
                      to={`/work-items/${data.object.content.item?.workPackageId}`}
                    >
                      查看原工作包
                    </Link>
                  ),
                },
                {
                  key: 'brand',
                  label: '品牌 / 型号',
                  children: data.item.profile
                    ? `${data.item.profile.brand ?? '未填写'} / ${data.item.profile.model ?? '未填写'}`
                    : '待明确',
                },
                {
                  key: 'supplier',
                  label: '供应商',
                  children: data.item.profile?.supplier ?? '未填写',
                },
                {
                  key: 'steps',
                  label: '适用环节',
                  children: data.item.profile
                    ? `${data.item.profile.requiresReceipt ? '到货' : '不要求到货'} · ${data.item.profile.requiresInstallation ? '安装' : '不要求安装'} · 独立验收`
                    : '由项目经理明确',
                },
              ]}
            />
            <Facts
              items={[
                {
                  label: '净到货',
                  value: quantityText(data.item.totals.received),
                },
                {
                  label: '净安装',
                  value: quantityText(data.item.totals.installed),
                },
                {
                  label: '已验收',
                  value: quantityText(data.item.totals.accepted),
                },
                {
                  label: '待核验 / 重核',
                  value: `${quantityText(data.item.totals.pending)} / ${quantityText(data.item.totals.needsReview)}`,
                },
              ]}
            />
            <Alert
              type="info"
              showIcon
              title={
                data.object.content.item?.acceptanceScope ??
                '按当前批准范围逐项核验'
              }
            />
            <Space wrap>
              {data.item.allowedActions.map((a) => (
                <Button
                  key={a}
                  type={a === 'ACCEPTED' ? 'primary' : 'default'}
                  onClick={() =>
                    a === 'PROFILE'
                      ? actions.profile(data.object, data.item)
                      : actions.item(data.object, data.item, a, ownerId)
                  }
                >
                  {executionLabel(a)}
                </Button>
              ))}
            </Space>
            <Tabs
              items={[
                {
                  key: 'events',
                  label: `分批执行 ${data.events.length}`,
                  children: (
                    <>
                      <ExecutionFilterBar
                        label="筛选分批记录"
                        value={filters}
                        onChange={setFilters}
                        fields={[
                          {
                            key: 'kind',
                            label: '实际记录类型',
                            options: [
                              'RECEIVED',
                              'INSTALLED',
                              'ACCEPTED',
                              'REVERSAL',
                            ].map((value) => ({
                              value,
                              label: executionLabel(value),
                            })),
                          },
                          {
                            key: 'status',
                            label: '分批记录状态',
                            options: [
                              'RECORDED',
                              'PENDING',
                              'VERIFIED',
                              'RETURNED',
                              'REVERSED',
                              'NEEDS_REVIEW',
                            ].map((value) => ({
                              value,
                              label: executionLabel(value),
                            })),
                          },
                          { key: 'from', label: '实际日期自', type: 'date' },
                          { key: 'to', label: '实际日期至', type: 'date' },
                        ]}
                      />
                      <Table
                        size="small"
                        rowKey="id"
                        tableLayout="fixed"
                        dataSource={data.events.filter(
                          (e) =>
                            (!filters.kind || filters.kind === e.kind) &&
                            (!filters.status || filters.status === e.status) &&
                            withinDates(e.occurredOn, filters.from, filters.to),
                        )}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                        scroll={{ x: 760 }}
                        columns={[
                          {
                            title: '发生日期 / 责任',
                            width: 152,
                            render: (_, e) => (
                              <>
                                {e.occurredOn}
                                <span className="business-cell-sub">
                                  {e.submitterName}
                                </span>
                              </>
                            ),
                          },
                          {
                            title: '实际记录',
                            width: 124,
                            render: (_, e) => (
                              <>
                                {executionLabel(e.kind)}
                                <strong className="business-cell-sub">
                                  {quantityText(e.quantity)}{' '}
                                  {data.object.content.item?.unit}
                                </strong>
                              </>
                            ),
                          },
                          {
                            title: '状态',
                            width: 116,
                            render: (_, e) => (
                              <ExecutionStatus value={e.status} />
                            ),
                          },
                          {
                            title: '证据 / 验证人',
                            render: (_, e) => (
                              <>
                                {e.evidence}
                                <span className="business-cell-sub">
                                  {e.verifierName ?? '直接记录'} · 依据 V
                                  {e.baselineVersion}
                                </span>
                              </>
                            ),
                          },
                          {
                            title: '操作',
                            width: 136,
                            render: (_, e) => (
                              <Space wrap size={4}>
                                {e.allowedActions.map((a) => (
                                  <Button
                                    size="small"
                                    key={a}
                                    onClick={() =>
                                      actions.itemDecision(data.object, e, a)
                                    }
                                  >
                                    {executionLabel(a)}
                                  </Button>
                                ))}
                              </Space>
                            ),
                          },
                        ]}
                        expandable={{
                          expandedRowRender: (e) => (
                            <div className="business-stack">
                              <p className="business-text">{e.evidence}</p>
                              {e.decision && (
                                <p>
                                  {e.decisionName} · {dateTime(e.decidedAt)}：
                                  {e.decision}
                                </p>
                              )}
                              {e.reversalOfId && (
                                <p>
                                  冲回原记录：
                                  {
                                    data.events.find(
                                      (x) => x.id === e.reversalOfId,
                                    )?.occurredOn
                                  }{' '}
                                  ·{' '}
                                  {executionLabel(
                                    data.events.find(
                                      (x) => x.id === e.reversalOfId,
                                    )?.kind ?? '',
                                  )}
                                  ，原记录保留。
                                </p>
                              )}
                              <EvidenceFiles
                                files={e.files}
                                restricted={e.restrictedFileCount}
                              />
                            </div>
                          ),
                        }}
                      />
                    </>
                  ),
                },
                {
                  key: 'history',
                  label: '维护与更正历史',
                  children: <ExecutionHistoryList events={data.history} />,
                },
              ]}
            />
          </div>
        )}
      </QueryState>
    </Drawer>
  )
}
