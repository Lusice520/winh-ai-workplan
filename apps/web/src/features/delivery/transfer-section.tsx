import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import { useEffect } from 'react'
import { Link } from 'react-router'
import {
  Panel,
  QueryState,
  type Command,
} from '@/features/business/business-ui'
import {
  dateTime,
  label,
  options,
  useBusinessQuery,
} from '@/features/business/business-data'
import { DeliveryStatus } from './delivery-components'
import {
  deliveryLabel,
  objectName,
  objectTitle,
  personName,
  type DeliveryWorkspace,
} from './delivery-types'
import type {
  ResponsibilityTransfer,
  TransferMapping,
  TransferOverlaps,
  TransferPreview,
  TransferSignature,
} from './transfer-types'

const statusText: Record<string, string> = {
  PENDING: '待接收',
  ACCEPTED: '待生效',
  APPLIED: '已生效',
  RETURNED: '已退回',
  CANCELLED: '已撤销',
}
const roleOptions = options([
  'PROJECT_OWNER',
  'PROJECT_CONTRIBUTOR',
  'PROJECT_REVIEWER',
])
const root = (id: string) =>
  `/api/delivery-initiation/${id}/responsibility-transfers`
type SetCommand = (command: Command) => void

export function TransferSection({
  data,
  actorId,
  people,
  setCommand,
}: {
  data: DeliveryWorkspace
  actorId: string
  people: { value: string; label: string }[]
  setCommand: SetCommand
}) {
  const projectId = data.project.projectId
  const query = useBusinessQuery<ResponsibilityTransfer[]>(root(projectId))
  const manage = data.allowedActions.includes('TRANSFER_RESPONSIBILITY')
  const viewData: DeliveryWorkspace = {
    ...data,
    people: [
      ...new Map(
        [
          ...data.people,
          ...people.map((p) => ({ id: p.value, name: p.label })),
        ].map((p) => [p.id, p]),
      ).values(),
    ],
  }
  const decide = (t: ResponsibilityTransfer, action: string, title: string) =>
    setCommand({
      title,
      path: `${root(projectId)}/${t.id}/decision`,
      values: { version: t.version, action },
      description:
        action === 'APPLY'
          ? '确认后统一更新当前职责、资源和显式项目角色，记录实际生效时间；原批准快照保留。'
          : action === 'ACCEPT'
            ? '请核对本次接任的未结职责与角色清单。确认接收后，资源仍须由指定承诺人重签。'
            : '请说明原因，原有效责任和资源不会随此操作改变。',
      content: <TransferReadout data={viewData} transfer={t} />,
      fields: [
        {
          name: 'note',
          label:
            action === 'ACCEPT'
              ? '接收确认与交接依据'
              : action === 'APPLY'
                ? '生效确认与依据'
                : '处理说明',
          type: 'textarea',
          required: true,
        },
      ],
      submitLabel: title,
    })
  const sign = (t: ResponsibilityTransfer, resourceId: string) => {
    const old = t.signatures.find((s) => s.resourceId === resourceId)
    setCommand({
      title: '签认接任后的资源',
      path: `${root(projectId)}/${t.id}/resources/sign`,
      description:
        '以下包含本次交接后的全部重叠请求。结论提交后保留签认人和时间，最终生效时再次核验容量。',
      content: (
        <TransferOverlapReadout
          projectId={projectId}
          transferId={t.id}
          resourceId={resourceId}
        />
      ),
      values: {
        version: t.version,
        resourceId,
        decision: old?.status === 'CONFLICT' ? 'RESOLVED' : 'COMMITTED',
        ...old?.commitment,
      },
      fields: [
        {
          name: 'decision',
          label: '资源结论',
          type: 'select',
          options: [
            { value: 'COMMITTED', label: '承诺投入' },
            { value: 'CONFLICT', label: '存在冲突' },
            ...(old ? [{ value: 'RESOLVED', label: '已协调解决' }] : []),
          ],
        },
        {
          name: 'dailyCapacity',
          label: '每天可用容量（小时）',
          type: 'number',
        },
        { name: 'conclusion', label: '签认依据与安排', type: 'textarea' },
        {
          name: 'impact',
          label: '冲突影响与协调结果',
          type: 'textarea',
          required: false,
        },
        {
          name: 'escalationPath',
          label: '协调与升级路径',
          type: 'textarea',
          required: false,
        },
      ],
      transform: (v) => ({
        version: t.version,
        resourceId,
        decision: v.decision,
        commitment: {
          dailyCapacity: v.dailyCapacity,
          conclusion: v.conclusion,
          impact: v.impact ?? null,
          escalationPath: v.escalationPath ?? null,
        },
      }),
      submitLabel: '确认签认',
    })
  }
  return (
    <Panel
      title="批准后的责任交接"
      subtitle="先接收职责，再重签资源，最后统一生效；原批准责任与历史证据保留。"
      extra={
        manage && (
          <Button
            size="small"
            type="primary"
            onClick={() =>
              setCommand({
                title: '发起责任交接',
                path: root(projectId),
                description:
                  '一次交接一对原、新责任人。先选择人员，再核对未结事项与角色调整。',
                values: {
                  version: data.preparation?.version,
                  fromId: data.preparation?.header.projectManagerId,
                },
                fields: [
                  {
                    name: 'fromId',
                    label: '原责任人',
                    type: 'select',
                    options: people,
                  },
                  {
                    name: 'toId',
                    label: '新责任人',
                    type: 'select',
                    options: people,
                  },
                ],
                formExtra: (
                  <TransferCreateFields projectId={projectId} data={viewData} />
                ),
                submitLabel: '发起交接',
              })
            }
          >
            发起交接
          </Button>
        )
      }
    >
      <QueryState query={query}>
        {!query.data?.length ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无责任交接。人员变更时从这里核对并接续未结职责。"
          />
        ) : (
          <Table<ResponsibilityTransfer>
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={query.data}
            scroll={{ x: 830 }}
            columns={[
              {
                title: '人员与状态',
                width: 225,
                render: (_, t) => (
                  <>
                    <strong>
                      {t.fromName} → {t.toName}
                    </strong>
                    <span className="business-cell-sub">
                      <Tag
                        color={
                          t.status === 'APPLIED'
                            ? 'green'
                            : t.status === 'ACCEPTED'
                              ? 'blue'
                              : 'default'
                        }
                      >
                        {statusText[t.status] ?? t.status}
                      </Tag>
                    </span>
                  </>
                ),
              },
              {
                title: '接收与资源',
                width: 180,
                render: (_, t) => (
                  <>
                    {t.acceptedAt ? '新责任人已接收' : '等待新责任人接收'}
                    <span className="business-cell-sub">
                      资源重签{' '}
                      {
                        t.signatures.filter((s) =>
                          ['COMMITTED', 'RESOLVED'].includes(s.status),
                        ).length
                      }{' '}
                      / {t.mapping.resources.length}
                    </span>
                  </>
                ),
              },
              {
                title: '发起 / 生效',
                width: 160,
                render: (_, t) => (
                  <>
                    {dateTime(t.submittedAt)}
                    <span className="business-cell-sub">
                      {t.effectiveAt ? dateTime(t.effectiveAt) : '尚未生效'}
                    </span>
                  </>
                ),
              },
              {
                title: '操作',
                width: 250,
                render: (_, t) => (
                  <Space wrap>
                    <Button
                      size="small"
                      onClick={() =>
                        setCommand({
                          title: '查看责任交接',
                          path: `transfer:${t.id}`,
                          readOnly: true,
                          fields: [],
                          content: (
                            <TransferReadout
                              data={viewData}
                              transfer={t}
                              onSign={
                                t.status === 'ACCEPTED' &&
                                data.allowedActions.includes('RESOURCE_COMMIT')
                                  ? (id) => sign(t, id)
                                  : undefined
                              }
                              actorId={actorId}
                            />
                          ),
                        })
                      }
                    >
                      查看交接
                    </Button>
                    {t.toId === actorId && t.status === 'PENDING' && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => decide(t, 'ACCEPT', '确认接收')}
                      >
                        接收
                      </Button>
                    )}
                    {t.toId === actorId &&
                      ['PENDING', 'ACCEPTED'].includes(t.status) && (
                        <Button
                          size="small"
                          onClick={() => decide(t, 'RETURN', '退回交接')}
                        >
                          退回
                        </Button>
                      )}
                    {manage && t.status === 'ACCEPTED' && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => decide(t, 'APPLY', '确认生效')}
                      >
                        确认生效
                      </Button>
                    )}
                    {manage && ['PENDING', 'ACCEPTED'].includes(t.status) && (
                      <Button
                        size="small"
                        onClick={() => decide(t, 'CANCEL', '撤销交接')}
                      >
                        撤销
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        )}
      </QueryState>
    </Panel>
  )
}

function TransferCreateFields({
  projectId,
  data,
}: {
  projectId: string
  data: DeliveryWorkspace
}) {
  const form = Form.useFormInstance()
  const from = Form.useWatch<string>('fromId', form),
    to = Form.useWatch<string>('toId', form)
  const query = useBusinessQuery<TransferPreview>(
    from && to && from !== to
      ? `${root(projectId)}/preview?fromId=${encodeURIComponent(from)}&toId=${encodeURIComponent(to)}`
      : undefined,
  )
  const preview = query.data
  useEffect(() => {
    if (preview && !query.isFetching && !query.isError) {
      form.setFieldsValue({
        mappingHash: preview.hash,
        fromRoles: preview.mapping.from.roleCodes,
        toRoles: preview.mapping.to.roleCodes,
      })
    } else form.setFieldValue('mappingHash', undefined)
  }, [form, preview, query.isFetching, query.isError])
  return (
    <div className="business-stack">
      <Form.Item
        name="mappingHash"
        hidden
        rules={[
          { required: true, message: '请先选择不同人员并完成交接预览。' },
        ]}
      >
        <Input />
      </Form.Item>
      {!from || !to ? (
        <Alert
          type="info"
          showIcon
          title="选择原、新责任人后，会列出需要接续的职责。"
        />
      ) : from === to ? (
        <Alert
          type="warning"
          showIcon
          title="原责任人与新责任人须为不同人员。"
        />
      ) : (
        <QueryState query={query}>
          {preview && !query.isError && (
            <MappingReadout
              data={data}
              mapping={preview.mapping}
              showResources
            />
          )}
        </QueryState>
      )}
      {preview && !query.isError && (
        <>
          <Alert
            type="info"
            showIcon
            title="逐项核对项目角色"
            description={
              preview.mapping.from.originalOwner
                ? '原责任人仍承担商务/售前原责任，本次不能移除成员；保留的其他责任权限继续有效。'
                : '选择保留角色；清空原责任人的角色表示交接生效时移除成员。系统角色与其他项目权限不会由本次交接改写。'
            }
          />
          <Form.Item name="fromRoles" label="原责任人生效后的项目角色">
            <Select mode="multiple" options={roleOptions} allowClear />
          </Form.Item>
          <Form.Item
            name="toRoles"
            label="新责任人生效后的项目角色"
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: '接任成员至少保留一个项目角色。',
              },
            ]}
          >
            <Select mode="multiple" options={roleOptions} />
          </Form.Item>
          <Form.Item
            name="basis"
            label="交接依据与未结安排"
            rules={[
              {
                required: true,
                whitespace: true,
                message: '请说明交接依据和未结事项安排。',
              },
            ]}
          >
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
        </>
      )}
    </div>
  )
}

function MappingReadout({
  data,
  mapping,
  showResources = false,
}: {
  data: DeliveryWorkspace
  mapping: TransferMapping
  showResources?: boolean
}) {
  const rows: { key: string; title: string; role: string; href?: string }[] = []
  if (
    mapping.beforeHeader.projectManagerId !==
    mapping.afterHeader.projectManagerId
  )
    rows.push({ key: 'manager', title: '项目整体', role: '项目经理' })
  if (
    mapping.beforeHeader.technicalLeadId !== mapping.afterHeader.technicalLeadId
  )
    rows.push({ key: 'technical', title: '项目技术', role: '技术负责人' })
  mapping.objects.forEach((o) =>
    rows.push({
      key: o.before.id,
      title: objectTitle(o.before),
      role:
        o.before.kind === 'STAGE'
          ? '阶段负责人'
          : o.before.kind === 'MILESTONE'
            ? '里程碑负责人'
            : o.before.kind === 'WORK_PACKAGE'
              ? o.before.content.workPackage?.ownerId !==
                o.after.workPackage?.ownerId
                ? '工作包负责人'
                : '工作包验证人'
              : deliveryLabel(o.before.kind),
      href:
        o.before.kind === 'WORK_PACKAGE'
          ? `/work-items/${o.before.id}`
          : undefined,
    }),
  )
  mapping.related
    .filter((r) => !mapping.objects.some((o) => o.before.id === r.objectId))
    .forEach((r) =>
      rows.push({
        key: r.objectId,
        title: r.title,
        role: r.roles.join('、'),
        href: r.roles.includes('当前无查看权限')
          ? undefined
          : r.domain === 'WORK'
            ? `/work-items/${r.objectId}`
            : r.domain === 'INCOME'
              ? `/projects/${data.project.projectId}/income?income=${r.objectId}`
              : r.domain === 'REQUIREMENT'
                ? `/requirements/${r.objectId}`
                : undefined,
      }),
    )
  mapping.findings.forEach((f) =>
    rows.push({
      key: f.before.id,
      title: f.before.finding.title,
      role: '遗留责任 / 独立验证 / 升级',
    }),
  )
  return (
    <>
      <Descriptions
        size="small"
        column={1}
        items={[
          {
            key: 'count',
            label: '交接范围',
            children: `${rows.length} 项职责，涉及 ${mapping.resources.length} 项资源`,
          },
          {
            key: 'scope',
            label: '责任方向',
            children: `${personName(data, mapping.from.accountId)} → ${personName(data, mapping.to.accountId)}`,
          },
        ]}
      />
      <Table
        size="small"
        tableLayout="fixed"
        rowKey="key"
        pagination={false}
        dataSource={rows}
        columns={[
          {
            title: '交接对象',
            dataIndex: 'title',
            render: (v, r) => (r.href ? <Link to={r.href}>{v}</Link> : v),
          },
          { title: '交接职责', dataIndex: 'role', width: 120 },
        ]}
      />
      {showResources && mapping.resources.length > 0 && (
        <ResourceTransferList data={data} mapping={mapping} />
      )}
    </>
  )
}

function TransferReadout({
  data,
  transfer: t,
  onSign,
  actorId,
}: {
  data: DeliveryWorkspace
  transfer: ResponsibilityTransfer
  onSign?: (id: string) => void
  actorId?: string
}) {
  return (
    <div className="business-stack">
      <Alert
        type={t.status === 'APPLIED' ? 'success' : 'info'}
        showIcon
        title={`${t.fromName} → ${t.toName} · ${statusText[t.status] ?? t.status}`}
        description={t.basis}
      />
      <MappingReadout data={data} mapping={t.mapping} />
      <Descriptions
        title="权限调整与生效记录"
        size="small"
        column={1}
        items={[
          ...[t.mapping.from, t.mapping.to].map((m) => ({
            key: m.accountId,
            label: m.accountId === t.fromId ? '原责任人角色' : '新责任人角色',
            children: `${m.roleCodes.map(label).join('、')} → ${
              t.permissions
                .find((r) => r.accountId === m.accountId)
                ?.roleCodes.map(label)
                .join('、') || '移除项目成员'
            }`,
          })),
          {
            key: 'accept',
            label: '接收确认',
            children: t.acceptanceNote
              ? `${t.acceptanceNote} · ${dateTime(t.acceptedAt)}`
              : '等待新责任人确认',
          },
          {
            key: 'effective',
            label: '生效结论',
            children: t.decisionNote
              ? `${t.decisionNote}${t.effectiveAt ? ' · ' + dateTime(t.effectiveAt) : ''}`
              : '当前责任仍沿用交接前安排',
          },
        ]}
      />
      {t.mapping.resources.length > 0 && (
        <ResourceTransferList
          data={data}
          mapping={t.mapping}
          signatures={t.signatures}
          actorId={actorId}
          onSign={onSign}
        />
      )}
    </div>
  )
}

function ResourceTransferList({
  data,
  mapping,
  signatures = [],
  actorId,
  onSign,
}: {
  data: DeliveryWorkspace
  mapping: TransferMapping
  signatures?: TransferSignature[]
  actorId?: string
  onSign?: (id: string) => void
}) {
  return (
    <div className="delivery-transfer-resources">
      {mapping.resources.map((r) => {
        const signed = signatures.find((s) => s.resourceId === r.before.id)
        return (
          <article
            key={r.before.id}
            className="delivery-transfer-resource-card"
          >
            <header>
              <strong>{objectName(data, r.after.workPackageId)}</strong>
              {signed ? (
                <DeliveryStatus value={signed.status} />
              ) : (
                <Tag>待指定人员重签</Tag>
              )}
            </header>
            <p>
              {personName(data, r.before.request.personId)} →{' '}
              {personName(data, r.after.personId)}
            </p>
            <div className="business-cell-sub">
              {r.after.startsOn} 至 {r.after.endsOn} · 每天 {r.after.dailyHours}{' '}
              小时
            </div>
            <div className="business-cell-sub">
              指定承诺人：{personName(data, r.after.committerId)}
            </div>
            {signed && (
              <p className="business-muted">
                {signed.commitment.conclusion} · {dateTime(signed.signedAt)}
              </p>
            )}
            {onSign && actorId === r.after.committerId && (
              <Button size="small" onClick={() => onSign(r.before.id)}>
                签认资源
              </Button>
            )}
          </article>
        )
      })}
    </div>
  )
}

function TransferOverlapReadout({
  projectId,
  transferId,
  resourceId,
}: {
  projectId: string
  transferId: string
  resourceId: string
}) {
  const query = useBusinessQuery<TransferOverlaps>(
    `${root(projectId)}/${transferId}/resources/${resourceId}/overlaps`,
  )
  return (
    <QueryState query={query}>
      {query.data && !query.isError && (
        <div className="business-stack">
          <Alert
            type="info"
            showIcon
            title={`接任后的重叠峰值：每天 ${query.data.peakHours} 小时`}
            description="包含此项请求和本次交接的其他请求；请按实际可用容量签认。"
          />
          <Table
            size="small"
            tableLayout="fixed"
            pagination={false}
            rowKey="displayRowKey"
            dataSource={query.data.allocations.map((r, i) => ({
              ...r,
              displayRowKey: r.resourceId ?? `restricted-${i}`,
            }))}
            columns={[
              {
                title: '项目 / 安排',
                render: (_, r) => (
                  <>
                    {r.projectName}
                    <span className="business-cell-sub">
                      {r.proposed ? '本次拟交接' : '现有承诺'}
                    </span>
                  </>
                ),
              },
              {
                title: '窗口',
                render: (_, r) => (
                  <>
                    {r.startsOn}
                    <span className="business-cell-sub">至 {r.endsOn}</span>
                  </>
                ),
              },
              { title: '每天工时', dataIndex: 'dailyHours', width: 85 },
            ]}
          />
        </div>
      )}
    </QueryState>
  )
}
