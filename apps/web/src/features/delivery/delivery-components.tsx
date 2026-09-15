import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Table,
  Tag,
} from 'antd'
import { CheckCircle2, CircleAlert, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router'
import { QueryState } from '@/features/business/business-ui'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import {
  activeObjects,
  budgetCents,
  cents,
  formatCents,
  contentKey,
  deliveryLabel,
  objectName,
  objectTitle,
  personName,
  type DeliveryWorkspace,
  type DeliveryObject,
  type DeliverySnapshot,
  type DeliveryBudget,
  type ResourceOverlap,
} from './delivery-types'

export function DeliveryStatus({
  value,
  children,
}: {
  value: string
  children?: React.ReactNode
}) {
  const good = [
    'PASS',
    'APPROVED',
    'COMMITTED',
    'RESOLVED',
    'AGREED',
    'CLOSED',
    'BASELINED',
  ].includes(value)
  const bad = ['BLOCKED', 'CONFLICT', 'RETURNED', 'HIGH'].includes(value)
  const limited = value === 'RESTRICTED'
  return (
    <Tag
      className="delivery-status"
      color={good ? 'green' : bad ? 'orange' : limited ? undefined : 'blue'}
    >
      {value === 'PASS' ? (
        <CheckCircle2 size={13} />
      ) : limited ? (
        <LockKeyhole size={12} />
      ) : bad ? (
        <CircleAlert size={13} />
      ) : null}
      {children ?? deliveryLabel(value)}
    </Tag>
  )
}

const day = (date: string) => Date.parse(date + 'T00:00:00Z') / 86400000
export function StageTimeline({
  data,
  onOpen,
}: {
  data: { objects: DeliveryObject[] }
  onOpen?: (o: DeliveryObject) => void
}) {
  const stages = activeObjects(data, 'STAGE').filter(
    (o) => o.content.stage?.applicable,
  )
  const dates = stages
    .flatMap((o) => [o.content.stage?.startsOn, o.content.stage?.endsOn])
    .filter((d): d is string => !!d)
    .sort()
  const first = dates[0],
    last = dates.at(-1),
    start = first ? day(first) : 0,
    duration = first && last ? Math.max(1, day(last) - start + 1) : 1
  return stages.length ? (
    <div className="delivery-timeline-scroll">
      <table className="delivery-grid-table delivery-timeline">
        <caption className="sr-only">适用阶段与计划时间窗口</caption>
        <thead>
          <tr>
            <th>阶段</th>
            <th>开始日期</th>
            <th>结束日期</th>
            <th className="delivery-timeline-scale">
              <span>{first?.slice(5) ?? '开始待定'}</span>
              <span>{last?.slice(5) ?? '结束待定'}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {stages.map((o, i) => {
            const s = o.content.stage!
            const offset = s.startsOn
              ? Math.max(0, ((day(s.startsOn) - start) / duration) * 100)
              : 0
            const width =
              s.startsOn && s.endsOn
                ? Math.max(
                    1,
                    ((day(s.endsOn) - day(s.startsOn) + 1) / duration) * 100,
                  )
                : 0
            return (
              <tr key={o.id}>
                <th>
                  {onOpen ? (
                    <button
                      className="delivery-text-button"
                      onClick={() => onOpen(o)}
                    >
                      {s.title}
                    </button>
                  ) : (
                    s.title
                  )}
                  {s.focus && (
                    <small className="delivery-focus-dot" title="当前交付重点">
                      ●
                    </small>
                  )}
                </th>
                <td>{s.startsOn ?? '待明确'}</td>
                <td>{s.endsOn ?? '待明确'}</td>
                <td className="delivery-timeline-track">
                  <div
                    className={`delivery-timeline-bar delivery-timeline-bar-${i % 3}`}
                    style={{ marginLeft: `${offset}%`, width: `${width}%` }}
                    title={`${s.title}：${s.startsOn ?? '待定'} 至 ${s.endsOn ?? '待定'}`}
                  >
                    {width >= 22 ? s.title : ''}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="选择阶段模板并补齐适用阶段后，在这里查看时间窗口。"
    />
  )
}

export function BudgetComposition({
  budget,
  readable = true,
}: {
  budget?: DeliveryBudget | null
  readable?: boolean
}) {
  if (!readable)
    return (
      <Alert
        type="info"
        showIcon
        icon={<LockKeyhole size={16} />}
        title="预算明细受限"
        description="当前账号可查看其他立项内容；预算由有权人员核验。"
      />
    )
  if (!budget)
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="尚未建立实施预算"
      />
    )
  const total = budgetCents(budget)
  const categories = [
    'PROCUREMENT',
    'SUBCONTRACT',
    'PERSONNEL',
    'TRAVEL',
    'OTHER',
  ].map((category) => ({
    category,
    amount: budget.lines
      .filter((line) => line.category === category)
      .reduce((sum, line) => sum + cents(line.amount), 0n),
  }))
  return (
    <table className="delivery-grid-table delivery-budget-table">
      <caption className="sr-only">
        实施预算费用构成，总额 {formatCents(total)}
      </caption>
      <thead>
        <tr>
          <th>费用项</th>
          <th>构成</th>
          <th className="delivery-numeric">金额</th>
          <th className="delivery-numeric">占比</th>
        </tr>
      </thead>
      <tbody>
        {categories.map(({ category, amount }) => {
          const ratio =
            total > 0n ? Number((amount * 1000n + total / 2n) / total) / 10 : 0
          return (
            <tr key={category}>
              <th>{deliveryLabel(category)}</th>
              <td>
                <span className="delivery-budget-track">
                  <span style={{ width: `${ratio}%` }} />
                </span>
              </td>
              <td className="delivery-numeric">{formatCents(amount)}</td>
              <td className="delivery-numeric">{ratio.toFixed(1)}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function ObjectReadout({
  data,
  object,
}: {
  data: DeliveryWorkspace
  object: DeliveryObject
}) {
  const labels: Record<string, string> = {
    title: '名称',
    templateCode: '模板来源',
    applicable: '本项目适用',
    applicabilityReason: '适用说明',
    differenceReason: '差异理由',
    ownerId: '负责人',
    verifierId: '独立验证人',
    startsOn: '计划开始',
    endsOn: '计划结束',
    predecessorIds: '前置阶段',
    parallelIds: '并行阶段',
    focus: '当前交付重点',
    actions: '阶段动作',
    deliverables: '交付物',
    completionCriteria: '完成条件',
    kind: '类别',
    dueDate: '计划日期',
    stageId: '所属阶段',
    contractNodeId: '合同节点',
    sourceNote: '日期依据',
    acceptanceCriteria: '验收条件',
    category: '类别',
    specification: '规格内容',
    quantity: '数量',
    unit: '单位',
    acceptanceScope: '验收范围',
    workPackageId: '专业工作包',
    milestoneId: '里程碑',
    procurementNeeded: '需要采购',
    procurementNote: '采购依据',
    scope: '范围',
    resourceNotes: '资源约束',
    itemIds: '关联清单',
    milestoneIds: '关联里程碑',
    deliveryWindowStart: '交付窗口开始',
    deliveryWindowEnd: '交付窗口结束',
    dependsOnIds: '前置计划',
    resourceConstraints: '资源与排期约束',
    mode: '授权方式',
    authorizedStageIds: '授权阶段',
    authorizedCap: '授权上限',
    expiresOn: '授权有效期',
    nextCompletionOn: '剩余预算补齐日期',
    remainingScope: '剩余未授权范围',
  }
  const value = object.content[contentKey[object.kind]]
  const render = (key: string, value: unknown): React.ReactNode => {
    if (value == null || value === '') return '待明确'
    if (typeof value === 'boolean') return value ? '是' : '否'
    if (['ownerId', 'verifierId'].includes(key))
      return personName(data, String(value))
    if (key === 'contractNodeId')
      return (
        <Link to={`/projects/${data.project.projectId}?tab=contracts`}>
          查看已引用的合同节点
        </Link>
      )
    if (key === 'templateCode')
      return (
        data.preparation?.template?.template?.stages.find(
          (s) => s.code === value,
        )?.name ?? '项目新增阶段'
      )
    if (key.endsWith('Id')) return objectName(data, String(value))
    if (Array.isArray(value))
      return value.length ? (
        <ul className="delivery-readout-list">
          {value.map((v) => (
            <li key={String(v)}>
              {key.endsWith('Ids') ? objectName(data, String(v)) : String(v)}
            </li>
          ))}
        </ul>
      ) : (
        '无'
      )
    if (key === 'authorizedCap')
      return formatCents(cents(value as string | number))
    if (['kind', 'category', 'mode'].includes(key))
      return deliveryLabel(String(value))
    return String(value)
  }
  return (
    <>
      <Descriptions
        size="small"
        column={1}
        bordered
        items={Object.entries(value ?? {})
          .filter(([key]) => key !== 'lines')
          .map(([key, value]) => ({
            key,
            label: labels[key] ?? key,
            children: (
              <span className="delivery-preserve-text">
                {render(key, value)}
              </span>
            ),
          }))}
      />
      {object.content.budget && (
        <>
          <div className="delivery-inline-total">
            预算合计{' '}
            <strong>{formatCents(budgetCents(object.content.budget))}</strong>
          </div>
          <BudgetLinesReadout data={data} budget={object.content.budget} />
        </>
      )}
    </>
  )
}

export function BudgetLinesReadout({
  data,
  budget,
}: {
  data: DeliveryWorkspace
  budget: DeliveryBudget
}) {
  return (
    <Table
      size="small"
      rowKey="displayRowKey"
      pagination={false}
      scroll={{ x: 740 }}
      dataSource={budget.lines.map((line, index) => ({
        ...line,
        displayRowKey: `budget-line-${index}`,
      }))}
      columns={[
        {
          title: '费用与测算依据',
          width: 240,
          render: (_, line) => (
            <>
              <strong>{line.title}</strong>
              <span className="business-cell-sub">
                {line.basis ?? '依据待补齐'}
              </span>
            </>
          ),
        },
        {
          title: '类别',
          dataIndex: 'category',
          render: deliveryLabel,
          width: 110,
        },
        {
          title: '金额',
          dataIndex: 'amount',
          align: 'right',
          width: 140,
          render: (value) => formatCents(cents(value)),
        },
        {
          title: '关联范围',
          render: (_, line) => (
            <>
              {[line.stageId, line.workPackageId, line.itemId]
                .filter(Boolean)
                .map((id) => (
                  <span className="business-cell-sub" key={id}>
                    {objectName(data, id)}
                  </span>
                ))}
              {line.resourceRequestId && (
                <span className="business-cell-sub">
                  资源：
                  {personName(
                    data,
                    data.resources.find((r) => r.id === line.resourceRequestId)
                      ?.request.personId,
                  )}
                </span>
              )}
            </>
          ),
        },
      ]}
    />
  )
}

export function ResourceOverlapReadout({
  projectId,
  resourceId,
}: {
  projectId: string
  resourceId: string
}) {
  const query = useBusinessQuery<ResourceOverlap[]>(
    `/api/delivery-initiation/${projectId}/resources/${resourceId}/overlaps`,
  )
  return (
    <QueryState query={query}>
      <Table
        size="small"
        rowKey="displayRowKey"
        pagination={false}
        dataSource={query.data?.map((row, index) => ({
          ...row,
          displayRowKey: row.resourceId ?? `restricted-resource-${index}`,
        }))}
        locale={{ emptyText: '此申请没有与其他已承诺资源重叠。' }}
        columns={[
          { title: '项目', dataIndex: 'projectName' },
          {
            title: '时间窗口',
            render: (_, r) => `${r.startsOn} 至 ${r.endsOn}`,
          },
          { title: '每天工时', dataIndex: 'dailyHours' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (v) => <DeliveryStatus value={v} />,
          },
        ]}
      />
    </QueryState>
  )
}

export type SnapshotTarget = {
  id: string
  kind: 'rounds' | 'baselines'
  title: string
}
export function SnapshotDrawer({
  data,
  target,
  onClose,
}: {
  data: DeliveryWorkspace
  target: SnapshotTarget | null
  onClose: () => void
}) {
  const query = useBusinessQuery<DeliverySnapshot>(
    target
      ? `/api/delivery-initiation/${data.project.projectId}/${target.kind}/${target.id}`
      : undefined,
  )
  const snapshot = query.data
  const frozen = snapshot
    ? {
        ...data,
        objects: snapshot.objects,
        resources: snapshot.resources,
        findings: snapshot.findings,
      }
    : data
  return (
    <Drawer
      open={!!target}
      title={target?.title}
      size={900}
      onClose={onClose}
      destroyOnHidden
    >
      <QueryState query={query}>
        {snapshot && (
          <>
            <Alert
              type="info"
              showIcon
              title="本次留存内容只读"
              description="阶段、范围、预算与责任安排均为当次快照，后续修订不会覆盖这里的记录。"
            />
            <Descriptions
              className="delivery-snapshot-header"
              size="small"
              column={1}
              items={[
                {
                  key: 'manager',
                  label: '项目经理',
                  children: personName(data, snapshot.header.projectManagerId),
                },
                {
                  key: 'scope',
                  label: '商务范围',
                  children: snapshot.header.scopeAcceptance,
                },
                {
                  key: 'acceptance',
                  label: '验收边界',
                  children: snapshot.header.acceptanceCriteria,
                },
                {
                  key: 'time',
                  label: '时间约束',
                  children: snapshot.header.timeConstraints,
                },
                {
                  key: 'followups',
                  label: '移交遗留',
                  children: snapshot.header.handoverFollowups,
                },
                {
                  key: 'template',
                  label: '阶段模板',
                  children: snapshot.template
                    ? `${snapshot.template.name} V${snapshot.template.edition}`
                    : '未选择',
                },
                {
                  key: 'policy',
                  label: '评审规则',
                  children: snapshot.policy
                    ? `${snapshot.policy.name} V${snapshot.policy.edition}`
                    : '未选择',
                },
              ]}
            />
            <Collapse
              items={snapshot.objects
                .filter((o) => !o.archived)
                .map((o) => ({
                  key: o.id,
                  label: `${deliveryLabel(o.kind)} · ${objectTitle(o)}`,
                  children: <ObjectReadout data={frozen} object={o} />,
                }))}
            />
            <h3 className="delivery-subheading">资源承诺</h3>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={snapshot.resources}
              columns={[
                {
                  title: '人员与窗口',
                  render: (_, r) => (
                    <>
                      {personName(data, r.request.personId)}
                      <span className="business-cell-sub">
                        {r.request.startsOn} 至 {r.request.endsOn}
                      </span>
                    </>
                  ),
                },
                {
                  title: '安排',
                  render: (_, r) => `${r.request.dailyHours} 小时/天`,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (v) => <DeliveryStatus value={v} />,
                },
                {
                  title: '签认依据',
                  render: (_, r) => (
                    <>
                      {r.commitment?.conclusion ?? '未签认'}
                      <span className="business-cell-sub">
                        {personName(data, r.committedBy)} ·{' '}
                        {dateTime(r.committedAt)}
                      </span>
                    </>
                  ),
                },
              ]}
            />
            <h3 className="delivery-subheading">遗留与风险</h3>
            {snapshot.findings.length ? (
              <Collapse
                items={snapshot.findings.map((f) => ({
                  key: f.id,
                  label: `${f.finding.title} · ${deliveryLabel(f.status)}`,
                  children: (
                    <Descriptions
                      column={1}
                      items={[
                        {
                          key: 'impact',
                          label: '影响',
                          children: `${deliveryLabel(f.finding.impactCategory)} · ${f.finding.impactScope}`,
                        },
                        {
                          key: 'owner',
                          label: '责任人 / 验证人',
                          children: `${personName(data, f.finding.ownerId)} / ${personName(data, f.finding.verifierId)}`,
                        },
                        {
                          key: 'due',
                          label: '期限',
                          children: f.finding.dueDate,
                        },
                        {
                          key: 'criteria',
                          label: '关闭条件',
                          children: f.finding.closingCriteria,
                        },
                        {
                          key: 'evidence',
                          label: '完成证据',
                          children: f.evidence ?? '尚未提交',
                        },
                        {
                          key: 'result',
                          label: '验证意见',
                          children: f.verification ?? '尚未验证',
                        },
                      ]}
                    />
                  ),
                }))}
              />
            ) : (
              <p>本次快照没有登记遗留事项。</p>
            )}
          </>
        )}
      </QueryState>
      <Button className="delivery-snapshot-close" onClick={onClose}>
        关闭
      </Button>
    </Drawer>
  )
}
