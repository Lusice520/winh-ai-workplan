import { Button, Descriptions, Empty, Space, Table } from 'antd'
import { Link } from 'react-router'
import {
  Panel,
  QueryState,
  type Command,
} from '@/features/business/business-ui'
import { useBusinessQuery } from '@/features/business/business-data'
import { DeliveryStatus, ObjectReadout } from './delivery-components'
import { WorkExecutionContext } from '@/features/execution/work-execution-context'
import {
  deliveryLabel,
  objectName,
  objectTitle,
  personName,
  type DeliveryObject,
  type DeliveryWorkspace,
} from './delivery-types'

export function WorkPackageContext({
  projectId,
  workItemId,
  onOpen,
}: {
  projectId: string
  workItemId: string
  onOpen: (command: Command) => void
}) {
  const query = useBusinessQuery<DeliveryWorkspace>(
    `/api/delivery-initiation/${projectId}`,
  )
  const data = query.data,
    object = data?.objects.find((o) => o.id === workItemId),
    wp = object?.content.workPackage
  const show = (o: DeliveryObject) =>
    data &&
    onOpen({
      title: deliveryLabel(o.kind) + ' · ' + objectTitle(o),
      path: `work-context:${o.id}`,
      fields: [],
      readOnly: true,
      content: <ObjectReadout data={data} object={o} />,
    })
  return (
    <Panel
      title="成果、计划与资源依据"
      subtitle="原工作包的当前有效安排；批准版本与责任交接历史分别保留。"
      extra={
        <Link to={`/delivery-initiation/${projectId}?section=packages`}>
          查看交付基线
        </Link>
      }
    >
      <QueryState query={query}>
        {data && wp && !query.isError ? (
          <div className="business-stack">
            {data.allowedActions.includes('VIEW_EXECUTION') && (
              <Link
                to={`/projects/${projectId}/work-packages/${workItemId}/tasks`}
              >
                任务执行与成果 →
              </Link>
            )}
            {data.allowedActions.includes('VIEW_EXECUTION') && (
              <WorkExecutionContext
                projectId={projectId}
                workItemId={workItemId}
              />
            )}
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'stage',
                  label: '所属阶段',
                  children: objectName(data, wp.stageId),
                },
                {
                  key: 'window',
                  label: '计划窗口',
                  children: `${wp.startsOn ?? '待定'} 至 ${wp.endsOn ?? '待定'}`,
                },
                {
                  key: 'deliverables',
                  label: '交付成果',
                  children: wp.deliverables ?? '待明确',
                },
                {
                  key: 'acceptance',
                  label: '独立验收依据',
                  children: wp.acceptanceCriteria ?? '待明确',
                },
                {
                  key: 'resources',
                  label: '资源要求',
                  children: wp.resourceNotes ?? '待明确',
                },
              ]}
            />
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              tableLayout="fixed"
              dataSource={data.objects.filter(
                (o) =>
                  !o.archived &&
                  (o.content.plan?.workPackageId === workItemId ||
                    wp.itemIds.includes(o.id) ||
                    wp.milestoneIds.includes(o.id)),
              )}
              columns={[
                {
                  title: '关联执行依据',
                  render: (_, o) => (
                    <Button
                      size="small"
                      type="link"
                      onClick={() => show(o)}
                      style={{
                        whiteSpace: 'normal',
                        height: 'auto',
                        textAlign: 'left',
                        paddingInline: 0,
                      }}
                    >
                      {objectTitle(o)}
                    </Button>
                  ),
                },
                {
                  title: '类型',
                  dataIndex: 'kind',
                  width: 100,
                  render: deliveryLabel,
                },
                {
                  title: '时间 / 数量',
                  width: 140,
                  render: (_, o) =>
                    o.content.plan ? (
                      <>
                        {o.content.plan.startsOn}
                        <span className="business-cell-sub">
                          至 {o.content.plan.endsOn}
                        </span>
                      </>
                    ) : (
                      (o.content.milestone?.dueDate ??
                      (o.content.item
                        ? `${o.content.item.quantity ?? '—'} ${o.content.item.unit ?? ''}`
                        : '—'))
                    ),
                },
              ]}
            />
            {data.resources
              .filter((r) => r.request.workPackageId === workItemId)
              .map((r) => (
                <div key={r.id}>
                  <Space wrap>
                    <strong>{personName(data, r.request.personId)}</strong>
                    <DeliveryStatus value={r.status} />
                    <span>每天 {r.request.dailyHours} 小时</span>
                  </Space>
                  <p className="business-cell-sub">
                    {r.request.startsOn} 至 {r.request.endsOn} · 指定承诺人：
                    {personName(data, r.request.committerId)}
                  </p>
                  <p className="business-muted">
                    {r.commitment?.conclusion ?? r.request.requestNote}
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="尚未建立可读取的工作包基线正文。"
          />
        )}
      </QueryState>
    </Panel>
  )
}
