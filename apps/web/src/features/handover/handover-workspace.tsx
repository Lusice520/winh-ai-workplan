import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Dropdown,
  Segmented,
  Space,
  Table,
  Tabs,
  Timeline,
} from 'antd'
import {
  ArrowUpRight,
  CheckCheck,
  ClipboardCheck,
  FileText,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useCurrentSession } from '@/features/auth/auth-session'
import {
  CommandDrawer,
  Facts,
  History,
  Panel,
  QueryState,
  Status,
  type Command,
  type Field,
} from '@/features/business/business-ui'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import type {
  ProjectDetail,
  PresalesWorkspace,
} from '@/features/business/business-types'
import type { FileWorkspace } from '@/features/files/file-types'
import { FileDetailDrawer } from '@/features/files/file-workspace'
import { handoverName, handoverOptions, today } from './handover-data'
import type {
  EarlyWorkspace,
  HandoverItem,
  HandoverReview,
  HandoverWorkspace,
  HandoverPackageDetail,
} from './handover-types'
import { EarlyStartBoard } from './early-start-board'
import './handover.css'

export function HandoverBoard({ detail }: { detail: ProjectDetail }) {
  const [params, setParams] = useSearchParams()
  const choices = [
    ...(detail.allowedActions.includes('HANDOVER_READ')
      ? [
          {
            key: 'dg01',
            label: 'DG-01 移交清单',
            children: <HandoverChecklist detail={detail} />,
          },
        ]
      : []),
    ...(detail.allowedActions.includes('EARLY_START_READ')
      ? [
          {
            key: 'early',
            label: '提前开工',
            children: <EarlyStartBoard detail={detail} />,
          },
        ]
      : []),
  ]
  return (
    <div className="handover-workspace">
      <Tabs
        activeKey={params.get('handover') ?? choices[0]?.key}
        onChange={(value) => {
          const next = new URLSearchParams(params)
          next.set('handover', value)
          setParams(next)
        }}
        items={choices}
      />
    </div>
  )
}

function HandoverChecklist({ detail }: { detail: ProjectDetail }) {
  const pid = detail.project.id,
    root = `/api/projects/${pid}/handover`
  const query = useBusinessQuery<HandoverWorkspace>(root),
    data = query.data,
    h = data?.handover
  const session = useCurrentSession()
  const [command, setCommand] = useState<Command | null>(null),
    [filter, setFilter] = useState('all')
  const [fileId, setFileId] = useState<string | null>(null),
    [packageId, setPackageId] = useState<string | null>(null)
  const can = (p: string) => data?.allowedActions.includes(p) ?? false
  const editable =
    can('HANDOVER_EDIT') && (!h || ['DRAFT', 'RETURNED'].includes(h.status))
  const files = useBusinessQuery<FileWorkspace>(
    can('FILE_READ') ? `/api/projects/${pid}/files` : undefined,
  )
  const presales = useBusinessQuery<PresalesWorkspace>(
    can('PRESALES_READ') ? `/api/projects/${pid}/presales` : undefined,
  )
  const early = useBusinessQuery<EarlyWorkspace>(
    can('EARLY_START_READ') ? `/api/projects/${pid}/early-start` : undefined,
  )
  const people = detail.members
    .filter((m) => m.active)
    .map((m) => ({ value: m.accountId, label: m.name }))
  const memberField = (name: string, text: string): Field => ({
    name,
    label: text,
    type: 'select',
    options: people,
  })
  const sourceOptions = [
    ...(files.data?.items ?? [])
      .filter((f) => f.currentVersionId)
      .map((f) => ({
        value: `FILE:${f.currentVersionId}`,
        label: `${f.title} · 当前发布版`,
      })),
    ...(presales.data?.actions.flatMap((a) => a.deliverables) ?? [])
      .filter((d) => d.status === 'APPROVED')
      .map((d) => ({
        value: `DELIVERABLE:${d.id}`,
        label: `${d.title} · v${d.versionNumber} · 已批准成果`,
      })),
  ]
  function initialize() {
    setCommand({
      title: '建立 DG-01 移交清单',
      path: root,
      description:
        '按项目类型保留模板快照，系统检查当前成果版本；通过 DG-01 后仍需独立完成交付立项。',
      values: { projectType: 'SYSTEM_INTEGRATION', dueDate: today() },
      fields: [
        {
          name: 'projectType',
          label: '项目类型',
          type: 'select',
          options: handoverOptions([
            'SYSTEM_INTEGRATION',
            'TECHNICAL_SERVICE',
            'EQUIPMENT',
          ]),
        },
        memberField('receiverId', '移交接收人'),
        { name: 'dueDate', label: '计划移交日期', type: 'date' },
      ],
    })
  }
  function editItem(i: HandoverItem) {
    const ordinary = !['BASE', 'COMMERCIAL'].includes(i.key)
    const selected = i.referenceId
      ? `${i.referenceKind}:${i.referenceId}`
      : undefined
    const options =
      selected && !sourceOptions.some((s) => s.value === selected)
        ? [
            {
              value: selected,
              label: i.referenceTitle ?? '原引用（需核对当前状态）',
            },
            ...sourceOptions,
          ]
        : sourceOptions
    setCommand({
      title: `维护清单 · ${i.name}`,
      path: `${root}/items/${i.id}`,
      method: 'PATCH',
      values: { ...i, source: selected },
      description:
        '负责人和期限会保留在移交包中。必需项不能仅以说明或勾选替代正式成果。',
      fields: [
        memberField('ownerId', '补齐负责人'),
        { name: 'dueDate', label: '补齐期限', type: 'date' },
        {
          name: 'applicable',
          label: '此项适用',
          type: 'switch',
          disabled:
            i.applicability === 'REQUIRED' ||
            (i.key === 'EQUIPMENT' && h?.projectType !== 'TECHNICAL_SERVICE') ||
            (i.key === 'COMMISSIONING' &&
              h?.projectType === 'SYSTEM_INTEGRATION'),
        },
        ...(ordinary
          ? [
              {
                name: 'source',
                label: '当前成果依据',
                type: 'select',
                options,
                required: false,
                wide: true,
              } satisfies Field,
            ]
          : []),
        {
          name: 'note',
          label: '适用性与移交说明',
          type: 'textarea',
          required: false,
          hint: '选择不适用时必须说明原因。',
        },
      ],
      transform: (values) => {
        const [referenceKind, referenceId] = String(values.source ?? '').split(
          ':',
        )
        return {
          ...values,
          referenceKind: referenceKind || null,
          referenceId: referenceId || null,
        }
      },
    })
  }
  function basis(kind: string) {
    const opts =
      kind === 'EARLY_START'
        ? early.data?.applications
            .filter((a) => a.effectiveStatus === 'ACTIVE')
            .map((a) => ({ value: a.id, label: a.request.title }))
        : files.data?.items
            .filter(
              (f) => f.classification === 'CONTRACT' && f.currentVersionId,
            )
            .map((f) => ({ value: f.currentVersionId!, label: f.title }))
    setCommand({
      title: `关联商务依据 · ${handoverName(kind)}`,
      path: `${root}/basis`,
      values: {
        version: h?.version,
        kind,
        referenceId: kind === h?.basisKind ? h.basisReferenceId : undefined,
        note: h?.basisNote,
      },
      description:
        kind === 'CONTRACT'
          ? '由系统核对本项目当前已归档主合同与签署件。'
          : '商务依据独立记录；中标通知、委托函和提前开工不会写成合同。',
      fields: [
        ...(kind === 'CONTRACT'
          ? []
          : [
              {
                name: 'referenceId',
                label: '有效依据',
                type: 'select',
                options: opts ?? [],
                wide: true,
              } satisfies Field,
            ]),
        { name: 'note', label: '依据与移交说明', type: 'textarea' },
      ],
    })
  }
  function review(r: HandoverReview, decision: string) {
    setCommand({
      title: decision === 'APPROVED' ? '确认 DG-01 可接收' : '退回 DG-01 补齐',
      path: `${root}/reviews/${r.id}`,
      values: { version: r.version, decision },
      description:
        '确认当前范围、成果版本与责任均可接收。本次结论不切换项目主阶段。',
      fields: [{ name: 'comment', label: '接收结论与意见', type: 'textarea' }],
    })
  }
  function openSource(i: HandoverItem) {
    const doc = files.data?.items.find(
      (f) =>
        f.currentVersionId === i.referenceId ||
        f.latestVersion.id === i.referenceId,
    )
    if (doc) setFileId(doc.id)
    else
      setCommand({
        title: `清单依据 · ${i.name}`,
        path: root,
        readOnly: true,
        fields: [],
        content: (
          <Descriptions
            column={1}
            items={[
              {
                key: 'source',
                label: '引用',
                children:
                  i.referenceTitle ?? '当前账号不可读取此依据，或资料已失效',
              },
              { key: 'note', label: '移交说明', children: i.note ?? '—' },
              {
                key: 'state',
                label: '当前校验',
                children: i.problem ?? handoverName(i.status),
              },
            ]}
          />
        ),
      })
  }
  const current = data?.packages.find((p) => p.current),
    pending = data?.reviews.find((r) => r.status === 'SUBMITTED')
  const rows = data?.items.filter(
    (i) =>
      filter === 'all' ||
      (filter === 'missing'
        ? i.applicable && ['MISSING', 'INVALID'].includes(i.status)
        : i.applicable && i.applicability !== 'OPTIONAL'),
  )
  return (
    <>
      <QueryState query={query}>
        {data && !h ? (
          <Panel
            title="建立交付移交清单"
            subtitle="沿用客户、商机、合同与项目资料，在同一空间确认交付可接收性。"
          >
            <div className="handover-onboarding">
              <ClipboardCheck size={38} />
              <div>
                <strong>
                  基础资料 · 商务依据 · 范围与技术 · 验收与计划 · 投入与风险
                </strong>
                <p>
                  选择类型、接收人与期限后，系统生成适用清单并逐项提示缺项。
                </p>
              </div>
              {can('HANDOVER_EDIT') && (
                <Button type="primary" onClick={initialize}>
                  建立移交清单
                </Button>
              )}
            </div>
          </Panel>
        ) : data && h ? (
          <>
            <Facts
              items={[
                {
                  label: '必需项齐备',
                  value: `${data.readyCount} / ${data.requiredCount}`,
                  note: `${data.missingCount} 项待补齐或核验`,
                },
                {
                  label: 'DG-01 状态',
                  value: <Status value={h.status} />,
                  note: current
                    ? `当前移交包 ${current.number}`
                    : '主阶段仍为售前',
                },
                {
                  label: '移交接收人',
                  value: h.receiverName,
                  note: `计划 ${h.dueDate}`,
                },
                {
                  label: '适用模板',
                  value: handoverName(h.projectType),
                  note: h.templateVersion,
                },
              ]}
            />
            <div className="business-split">
              <div className="business-stack">
                <Panel
                  title="移交清单"
                  subtitle="完成度由当前版本与评审状态计算"
                  className="business-panel--table handover-checklist"
                  extra={
                    <Space wrap>
                      {editable && (
                        <Dropdown
                          menu={{
                            items: handoverOptions([
                              'CONTRACT',
                              'AWARD',
                              'ENTRUSTMENT',
                              'EARLY_START',
                            ]).map((o) => ({ key: o.value, label: o.label })),
                            onClick: ({ key }) => basis(key),
                          }}
                        >
                          <Button size="small">商务依据</Button>
                        </Dropdown>
                      )}
                      {editable && (
                        <Button
                          size="small"
                          type="primary"
                          onClick={() =>
                            setCommand({
                              title: '提交 DG-01',
                              path: `${root}/submissions`,
                              values: { version: h.version },
                              description:
                                '系统会重检全部必需项和当前成果。接收人与提交人必须不同。',
                              fields: [
                                {
                                  name: 'note',
                                  label: '移交说明',
                                  type: 'textarea',
                                },
                              ],
                            })
                          }
                        >
                          提交 DG-01
                        </Button>
                      )}
                    </Space>
                  }
                >
                  <div className="handover-table-filter">
                    <Segmented
                      value={filter}
                      onChange={setFilter}
                      options={[
                        { value: 'all', label: `全部 ${data.items.length}` },
                        {
                          value: 'missing',
                          label: `待补齐 ${data.missingCount}`,
                        },
                        {
                          value: 'required',
                          label: `必需 ${data.requiredCount}`,
                        },
                      ]}
                    />
                  </div>
                  <Table<HandoverItem>
                    rowKey="id"
                    size="small"
                    dataSource={rows}
                    scroll={{ x: 820 }}
                    pagination={false}
                    columns={[
                      {
                        title: '清单项',
                        width: 155,
                        render: (_, i) => (
                          <>
                            <strong className="business-cell-title">
                              {i.name}
                            </strong>
                            <span className="business-cell-sub">
                              {handoverName(i.groupKey)}
                            </span>
                          </>
                        ),
                      },
                      {
                        title: '适用性',
                        width: 80,
                        render: (_, i) =>
                          i.applicable
                            ? handoverName(i.applicability)
                            : '不适用',
                      },
                      {
                        title: '负责人 / 期限',
                        width: 125,
                        render: (_, i) => (
                          <>
                            <span>{i.ownerName}</span>
                            <span
                              className={
                                i.overdue
                                  ? 'handover-overdue business-cell-sub'
                                  : 'business-cell-sub'
                              }
                            >
                              {i.dueDate}
                            </span>
                          </>
                        ),
                      },
                      {
                        title: '当前依据',
                        width: 210,
                        render: (_, i) => (
                          <div className="handover-source">
                            {i.referenceId ? (
                              <button
                                type="button"
                                className="business-link"
                                title={i.referenceTitle ?? undefined}
                                onClick={() => openSource(i)}
                              >
                                {i.referenceTitle ??
                                  (i.key === 'BASE'
                                    ? '原项目资料'
                                    : '查看受控引用')}
                              </button>
                            ) : (
                              (i.referenceTitle ?? (
                                <span className="business-muted">
                                  尚未关联或无查看权限
                                </span>
                              ))
                            )}
                            {i.problem && (
                              <span className="business-cell-sub">
                                {i.problem}
                              </span>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: '校验',
                        width: 82,
                        render: (_, i) => (
                          <Status
                            value={i.status}
                            text={handoverName(i.status)}
                          />
                        ),
                      },
                      {
                        title: '操作',
                        width: 76,
                        render: (_, i) => (
                          <Button
                            size="small"
                            onClick={() =>
                              editable ? editItem(i) : openSource(i)
                            }
                          >
                            {editable ? '维护' : '查看'}
                          </Button>
                        ),
                      },
                    ]}
                  />
                </Panel>
                <Panel title="移交记录">
                  <History events={data.history} limit={5} />
                </Panel>
              </div>
              <div className="business-stack">
                <Panel
                  title={
                    <Space>
                      <CheckCheck size={18} />
                      准入进度
                    </Space>
                  }
                >
                  <Timeline
                    items={[
                      {
                        color: h.basisKind ? 'green' : 'gray',
                        content: (
                          <>
                            <strong>商务依据</strong>
                            <p>{handoverName(h.basisKind)}</p>
                          </>
                        ),
                      },
                      {
                        color: current ? 'green' : 'orange',
                        content: (
                          <>
                            <strong>DG-01 交付移交</strong>
                            <p>
                              {current
                                ? '当前移交包有效'
                                : h.status === 'APPROVED'
                                  ? '源依据需重新核验'
                                  : `${data.missingCount} 项待补齐或核验`}
                            </p>
                          </>
                        ),
                      },
                      {
                        color: 'gray',
                        content: (
                          <>
                            <strong>DG-02 交付立项</strong>
                            <p>
                              {current
                                ? '移交已具备，接续团队与基线准备'
                                : '等待当前有效移交包'}
                            </p>
                          </>
                        ),
                      },
                    ]}
                  />
                  <Alert
                    showIcon
                    type="info"
                    title="DG-01 通过后，主阶段仍为售前。"
                  />
                </Panel>
                <Panel
                  title="待补齐责任"
                  extra={
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setFilter('missing')}
                    >
                      查看全部
                    </Button>
                  }
                >
                  {data.items
                    .filter(
                      (i) =>
                        i.applicable &&
                        ['MISSING', 'INVALID'].includes(i.status),
                    )
                    .slice(0, 3)
                    .map((i) => (
                      <div key={i.id} className="handover-missing">
                        <strong>{i.name}</strong>
                        <span>
                          {i.ownerName} · {i.dueDate}
                        </span>
                        <small>{i.problem}</small>
                        {editable && (
                          <Button size="small" onClick={() => editItem(i)}>
                            去补齐
                          </Button>
                        )}
                      </div>
                    ))}
                  {!data.missingCount && (
                    <p className="handover-ready">
                      <CheckCheck size={17} />
                      必需项已齐备
                    </p>
                  )}
                </Panel>
                <Panel title="最近评审">
                  {pending &&
                    can('HANDOVER_REVIEW') &&
                    session.data?.accountId !== pending.submittedBy && (
                      <Space wrap>
                        {h.receiverId === session.data?.accountId && (
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => review(pending, 'APPROVED')}
                          >
                            确认接收
                          </Button>
                        )}
                        <Button
                          size="small"
                          onClick={() => review(pending, 'RETURNED')}
                        >
                          退回补齐
                        </Button>
                      </Space>
                    )}
                  {data.reviews.slice(0, 3).map((r) => (
                    <div key={r.id} className="handover-review">
                      <div>
                        <Status value={r.status} />
                        <time>{dateTime(r.createdAt)}</time>
                      </div>
                      <p>{r.comment ?? r.submissionNote}</p>
                      <small>{r.reviewedByName ?? r.submittedByName}</small>
                    </div>
                  ))}
                  {!data.reviews.length && (
                    <p className="business-muted">尚未提交独立评审</p>
                  )}
                </Panel>
                <Panel title="移交包与责任">
                  {data.packages.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="handover-package business-link"
                      onClick={() => setPackageId(p.id)}
                    >
                      <FileText size={16} />
                      <span>
                        {p.number}
                        <small>
                          {p.current ? '当前有效' : '历史包 / 待重新核验'}
                        </small>
                      </span>
                    </button>
                  ))}
                  {!data.packages.length && (
                    <p className="business-muted">
                      独立接收通过后生成不可变移交包。
                    </p>
                  )}
                  <Space wrap>
                    {editable && (
                      <Button
                        size="small"
                        onClick={() =>
                          setCommand({
                            title: '调整移交接收责任',
                            method: 'PATCH',
                            path: root,
                            values: {
                              version: h.version,
                              receiverId: h.receiverId,
                              dueDate: h.dueDate,
                            },
                            fields: [
                              memberField('receiverId', '接收人'),
                              {
                                name: 'dueDate',
                                label: '计划移交日',
                                type: 'date',
                              },
                              {
                                name: 'reason',
                                label: '调整原因',
                                type: 'textarea',
                              },
                            ],
                          })
                        }
                      >
                        调整责任
                      </Button>
                    )}
                    {can('HANDOVER_EDIT') && h.status === 'APPROVED' && (
                      <Button
                        size="small"
                        onClick={() =>
                          setCommand({
                            title: '重开 DG-01',
                            path: `${root}/reopen`,
                            values: { version: h.version },
                            description:
                              '旧包继续保留。当前准入依据停止使用，修改后需重新独立接收。',
                            fields: [
                              {
                                name: 'reason',
                                label: '重开原因',
                                type: 'textarea',
                              },
                            ],
                          })
                        }
                      >
                        重开移交
                      </Button>
                    )}
                  </Space>
                  <p>
                    <Link to={`/projects/${pid}?tab=files`}>
                      项目资料 <ArrowUpRight size={13} className="inline" />
                    </Link>
                  </p>
                </Panel>
              </div>
            </div>
          </>
        ) : null}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
      {fileId && (
        <FileDetailDrawer id={fileId} onClose={() => setFileId(null)} />
      )}
      {packageId && (
        <PackageDrawer
          projectId={pid}
          id={packageId}
          onClose={() => setPackageId(null)}
        />
      )}
    </>
  )
}
function PackageDrawer({
  projectId,
  id,
  onClose,
}: {
  projectId: string
  id: string
  onClose: () => void
}) {
  const query = useBusinessQuery<HandoverPackageDetail>(
      `/api/projects/${projectId}/handover/packages/${id}`,
    ),
    d = query.data
  return (
    <Drawer
      open
      title="DG-01 移交包"
      size={840}
      onClose={onClose}
      className="business-drawer"
    >
      <QueryState query={query}>
        {d && (
          <>
            <Descriptions
              column={1}
              items={[
                {
                  key: 'id',
                  label: '移交包',
                  children: d.handoverPackage.number,
                },
                { key: 'project', label: '原项目', children: d.projectName },
                {
                  key: 'approved',
                  label: '批准',
                  children: `${d.handoverPackage.approvedByName} · ${dateTime(d.handoverPackage.approvedAt)}`,
                },
                {
                  key: 'status',
                  label: '当前有效性',
                  children: d.handoverPackage.current
                    ? '当前有效'
                    : '历史包保留，源依据或准备状态已变化',
                },
                {
                  key: 'hash',
                  label: '快照校验值',
                  children: (
                    <span className="handover-hash">
                      {d.handoverPackage.snapshotHash}
                    </span>
                  ),
                },
              ]}
            />
            <Alert
              type="info"
              showIcon
              title="下表保留审批时的责任、说明与引用；校验状态显示这些引用当前是否仍有效。"
            />
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 600 }}
              dataSource={d.items}
              columns={[
                { title: '清单项', dataIndex: 'name' },
                { title: '审批时移交说明', dataIndex: 'note' },
                { title: '负责人', dataIndex: 'ownerName' },
                {
                  title: '引用当前状态',
                  render: (_, i) => (
                    <Status value={i.status} text={handoverName(i.status)} />
                  ),
                },
              ]}
            />
          </>
        )}
      </QueryState>
    </Drawer>
  )
}
