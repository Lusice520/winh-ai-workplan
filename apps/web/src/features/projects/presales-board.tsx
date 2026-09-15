import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Progress,
  Select,
  Space,
  Table,
} from 'antd'
import { FileText, Flag, MessageSquare, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useCurrentSession } from '@/features/auth/auth-session'
import {
  CommandDrawer,
  History,
  Panel,
  QueryState,
  Status,
  type Command,
  type Field,
} from '@/features/business/business-ui'
import {
  dateTime,
  label,
  money,
  options,
  personField,
  useBusinessQuery,
} from '@/features/business/business-data'
import type {
  Deliverable,
  Initiation,
  Investment,
  PresalesAction,
  PresalesWorkspace,
  ProjectDetail,
  Quote,
} from '@/features/business/business-types'

const initiationFields: Field[] = [
  { name: 'purpose', label: '立项目的', type: 'textarea' },
  { name: 'scope', label: '售前工作范围', type: 'textarea' },
  { name: 'expectedOutputs', label: '预期成果', type: 'textarea' },
  { name: 'exitConditions', label: '退出条件', type: 'textarea' },
  { name: 'requestedHours', label: '累计申请工时（小时）', type: 'number' },
  { name: 'requestedCost', label: '累计申请费用（元）', type: 'number' },
  { name: 'startsOn', label: '开始日期', type: 'date' },
  { name: 'endsOn', label: '截止日期', type: 'date' },
]
const quoteFields: Field[] = [
  { name: 'feasibility', label: '技术可行性', type: 'textarea' },
  { name: 'scope', label: '范围与边界', type: 'textarea' },
  { name: 'estimate', label: '工程量 / 采购估算', type: 'textarea' },
  { name: 'priceAuthorization', label: '价格与授权依据', type: 'textarea' },
  { name: 'constraints', label: '约束条件', type: 'textarea' },
  { name: 'assumptionsRisks', label: '假设与风险', type: 'textarea' },
  { name: 'finalVersion', label: '最终对外版本说明', type: 'textarea' },
]
const reviewFields: Field[] = [
  {
    name: 'decision',
    label: '评审结论',
    type: 'select',
    options: options(['APPROVED', 'RETURNED']),
    wide: true,
  },
  { name: 'comment', label: '评审意见', type: 'textarea' },
]
const today = () => new Date().toLocaleDateString('en-CA')

export function PresalesBoard({ detail }: { detail: ProjectDetail }) {
  const project = detail.project,
    base = `/api/projects/${project.id}/presales`
  const query = useBusinessQuery<PresalesWorkspace>(base),
    session = useCurrentSession()
  const [command, setCommand] = useState<Command | null>(null),
    [action, setAction] = useState<PresalesAction | null>(null),
    [output, setOutput] = useState<Deliverable | null>(null),
    [gate, setGate] = useState<'SG01' | 'SG02' | null>(null),
    [ledger, setLedger] = useState(false)
  const [investmentKind, setInvestmentKind] = useState<string>(),
    [investmentDay, setInvestmentDay] = useState('')
  const data = query.data,
    canEdit = data?.allowedActions.includes('PRESALES_EDIT'),
    canInvest =
      data?.investmentDetailsVisible &&
      data?.allowedActions.includes('PRESALES_INVESTMENT_EDIT'),
    canReview = data?.allowedActions.includes('PRESALES_REVIEW')
  const people = detail.members
    .filter((m) => m.active)
    .map((m) => ({ id: m.accountId, name: m.name, organizationUnitId: '' }))
  const latest = data?.initiations[0],
    approved = data?.initiations.find((i) => i.status === 'APPROVED'),
    quote = data?.quoteReviews[0]
  const pending = data?.initiations.find((i) =>
    ['DRAFT', 'RETURNED', 'SUBMITTED'].includes(i.status),
  )
  const deliverables = data?.actions.flatMap((a) => a.deliverables) ?? [],
    currentOutputs = deliverables.filter((d) => d.status !== 'SUPERSEDED')
  const ready =
    data?.actions.filter((a) => ['COMPLETED', 'SKIPPED'].includes(a.status))
      .length ?? 0
  const currentAction = action
    ? (data?.actions.find((a) => a.id === action.id) ?? action)
    : null
  function initiationCommand(row?: Initiation): Command {
    return {
      title: row ? '编辑售前立项' : '申请售前立项',
      path: `${base}/initiations${row ? `/${row.id}` : ''}`,
      method: row ? 'PATCH' : 'POST',
      values: row
        ? { ...row }
        : {
            startsOn: today(),
            requestedHours: data?.actualHours ?? 0,
            requestedCost: data?.actualCost ?? 0,
          },
      description:
        '说明本次工作边界。额度为项目累计上限，追加申请需包含已使用及已承诺的投入。',
      fields: initiationFields,
      submitLabel: '保存立项草稿',
    }
  }
  function editAction(row: PresalesAction): Command {
    return {
      title: `更新 · ${row.name}`,
      path: `${base}/actions/${row.id}`,
      method: 'PATCH',
      values: {
        ...row,
        ownerAccountId: row.ownerAccountId ?? project.presalesOwnerId,
      },
      fields: [
        personField('ownerAccountId', '动作负责人', people),
        {
          name: 'dueDate',
          label: '计划完成日期',
          type: 'date',
          required: false,
        },
        {
          name: 'status',
          label: '推进状态',
          type: 'select',
          options: options([
            'NOT_STARTED',
            'IN_PROGRESS',
            'BLOCKED',
            'COMPLETED',
            'SKIPPED',
          ]),
          wide: true,
        },
        {
          name: 'note',
          label: '进展与说明',
          type: 'textarea',
          required: false,
          hint: '完成、阻塞、不适用或重开均需说明。无需成果即可完成时，写明“无需成果”及原因。',
        },
      ],
    }
  }
  function deliver(row: PresalesAction): Command {
    return {
      title: `提交成果 · ${row.name}`,
      path: `${base}/actions/${row.id}/deliverables`,
      values: { version: row.version, kind: row.actionKey, status: 'DRAFT' },
      description:
        '每次提交创建新版本，原版本继续保留。请填入本次可评审的成果内容。',
      fields: [
        { name: 'title', label: '成果名称', wide: true },
        {
          name: 'kind',
          label: '成果类型',
          type: 'select',
          options: options([
            'SURVEY',
            'REQUIREMENTS',
            'SOLUTION',
            'ESTIMATE',
            'QUOTATION',
            'BIDDING',
            'HANDOVER',
            'OTHER',
          ]),
        },
        {
          name: 'status',
          label: '提交状态',
          type: 'select',
          options: options(['DRAFT', 'IN_REVIEW']),
        },
        { name: 'scope', label: '适用范围', type: 'textarea' },
        {
          name: 'content',
          label: '成果正文 / 交付说明',
          type: 'textarea',
          maxLength: 12000,
        },
        { name: 'changeNote', label: '本版变化说明', type: 'textarea' },
      ],
    }
  }
  function reviewInitiation(row: Initiation): Command {
    return {
      title: 'SG01 售前立项评审',
      path: `${base}/initiations/${row.id}/review`,
      values: {
        version: row.version,
        decision: 'APPROVED',
        approvedHours: row.requestedHours,
        approvedCost: row.requestedCost,
      },
      description:
        '须由另一名有权评审的项目成员作出结论。批准额度不得超过申请额度或低于已发生投入。',
      fields: [
        ...reviewFields,
        {
          name: 'approvedHours',
          label: '批准累计工时（小时）',
          type: 'number',
          required: false,
        },
        {
          name: 'approvedCost',
          label: '批准累计费用（元）',
          type: 'number',
          required: false,
        },
      ],
      submitLabel: '提交评审结论',
    }
  }
  function reviewQuote(row: Quote): Command {
    return {
      title: 'SG02 方案与报价评审',
      path: `${base}/quote-reviews/${row.id}/review`,
      values: { version: row.version, decision: 'APPROVED' },
      description:
        '按提交时的动作和成果版本评审；内容变更后，原申请须重新确认。',
      fields: reviewFields,
      submitLabel: '提交评审结论',
    }
  }
  function invest(row?: Investment): Command {
    return row
      ? {
          title: '冲销投入记录',
          path: `${base}/investments`,
          values: { kind: 'REVERSAL', reversesId: row.id, occurredOn: today() },
          description: `冲销 ${label(row.kind)}：${row.hours} 小时 / ${money(row.cost)}。原记录与冲销原因保留。`,
          fields: [
            { name: 'occurredOn', label: '冲销日期', type: 'date' },
            { name: 'description', label: '冲销原因', type: 'textarea' },
          ],
        }
      : {
          title: '记录售前投入',
          path: `${base}/investments`,
          values: { kind: 'ACTUAL', occurredOn: today(), hours: 0, cost: 0 },
          description:
            '已承诺投入与实际投入分别记录；实际兑现承诺时请选择原承诺，避免重复占用额度。',
          fields: [
            {
              name: 'kind',
              label: '投入类型',
              type: 'select',
              options: options(['COMMITTED', 'ACTUAL']),
            },
            { name: 'occurredOn', label: '发生日期', type: 'date' },
            { name: 'hours', label: '工时（小时）', type: 'number' },
            { name: 'cost', label: '费用（元）', type: 'number' },
            {
              name: 'commitmentId',
              label: '对应承诺（实际兑现时选择）',
              type: 'select',
              wide: true,
              required: false,
              options: data?.investments
                .filter((i) => i.kind === 'COMMITTED' && !i.reversed)
                .map((i) => ({
                  value: i.id,
                  label: `${i.occurredOn} · ${i.description} · ${i.hours} 小时`,
                })),
            },
            { name: 'description', label: '投入用途与依据', type: 'textarea' },
          ],
        }
  }
  function submitQuote(): Command {
    return {
      title: '提交 SG02 方案与报价评审',
      path: `${base}/quote-reviews`,
      description:
        '明确七项评审依据，选择本次对外使用的成果版本。提交时保存动作与成果快照。',
      fields: [
        ...quoteFields,
        {
          name: 'deliverableIds',
          label: '本次评审的成果版本',
          type: 'multiple',
          wide: true,
          options: currentOutputs.map((d) => ({
            value: d.id,
            label: `${d.title} · V${d.versionNumber}`,
          })),
        },
      ],
      submitLabel: '提交评审',
    }
  }
  return (
    <>
      <QueryState query={query}>
        {data && (
          <div className="business-stack presales-workspace">
            {!approved && (
              <div className="business-warning-strip">
                售前立项尚未批准。可先完善动作与成果；登记投入、提交报价评审前需要有效的
                SG01 批准记录。
              </div>
            )}
            <div className="business-split">
              <div className="business-stack">
                <Panel
                  title={
                    <Space>
                      <Flag size={16} color="#477bda" />
                      售前动作
                    </Space>
                  }
                  subtitle="七类动作并行推进，按项目实际安排负责人、成果与完成时间。"
                  className="business-panel--table"
                  extra={
                    <span className="business-muted">
                      {ready} / 7 已完成或不适用
                    </span>
                  }
                >
                  <Table<PresalesAction>
                    className="presales-action-table"
                    rowKey="id"
                    size="small"
                    dataSource={data.actions}
                    pagination={false}
                    scroll={{ x: 710 }}
                    columns={[
                      {
                        title: '工作动作',
                        width: 165,
                        render: (_, a, index) => (
                          <span className="business-person">
                            <span className="business-avatar">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <button
                              className="business-link"
                              onClick={() => setAction(a)}
                            >
                              {a.name}
                            </button>
                          </span>
                        ),
                      },
                      {
                        title: '负责人',
                        dataIndex: 'ownerName',
                        width: 105,
                        ellipsis: true,
                        render: (v) =>
                          v ?? <span className="business-muted">待指定</span>,
                      },
                      {
                        title: '计划完成',
                        dataIndex: 'dueDate',
                        width: 107,
                        render: (v) => v ?? '—',
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        width: 94,
                        render: (v) => <Status value={v} />,
                      },
                      {
                        title: '最新成果',
                        width: 155,
                        render: (_, a) => {
                          const d = a.deliverables.find(
                            (x) => x.status !== 'SUPERSEDED',
                          )
                          return d ? (
                            <button
                              className="business-link presales-output-link"
                              title={`${d.title} · V${d.versionNumber} · ${label(d.status)}`}
                              onClick={() => setOutput(d)}
                            >
                              {d.title} · V{d.versionNumber}
                            </button>
                          ) : (
                            <span className="business-muted">待提交</span>
                          )
                        },
                      },
                      {
                        title: '操作',
                        width: 96,
                        render: (_, a) => (
                          <Space size={10}>
                            <button
                              className="business-link"
                              onClick={() => setAction(a)}
                            >
                              详情
                            </button>
                            {canEdit && (
                              <button
                                className="business-link"
                                onClick={() => setCommand(editAction(a))}
                              >
                                更新
                              </button>
                            )}
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Panel>
                <div className="business-two-col">
                  <Panel
                    title={
                      <Space>
                        <FileText size={16} color="#5579bd" />
                        最新成果
                      </Space>
                    }
                    extra={
                      <span className="business-muted">
                        共 {deliverables.length} 个版本
                      </span>
                    }
                  >
                    {currentOutputs.length ? (
                      <div>
                        {currentOutputs.slice(0, 5).map((d) => (
                          <div key={d.id} className="business-output-row">
                            <span className="business-output-icon">
                              <FileText size={17} />
                            </span>
                            <div className="business-output-info">
                              <button
                                className="business-link"
                                onClick={() => setOutput(d)}
                              >
                                {d.title}
                              </button>
                              <span className="business-cell-sub">
                                V{d.versionNumber} · {d.createdByName} ·{' '}
                                {dateTime(d.createdAt)}
                              </span>
                            </div>
                            <Status value={d.status} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <div className="business-empty-copy">
                            <p>
                              调研纪要、需求清单、方案和报价可从对应动作提交，形成版本记录。
                            </p>
                          </div>
                        }
                      />
                    )}
                  </Panel>
                  <Panel
                    title={
                      <Space>
                        <MessageSquare size={16} color="#5579bd" />
                        近期动态
                      </Space>
                    }
                    extra={
                      <Link to={`/projects/${project.id}?tab=history`}>
                        全部
                      </Link>
                    }
                  >
                    <History events={detail.history} limit={5} />
                  </Panel>
                </div>
                <Panel title="当前协作提醒">
                  <div className="business-two-col">
                    <div>
                      <strong style={{ fontSize: 13 }}>待解决阻塞</strong>
                      {data.actions.some((a) => a.status === 'BLOCKED') ? (
                        data.actions
                          .filter((a) => a.status === 'BLOCKED')
                          .map((a) => (
                            <p
                              key={a.id}
                              className="business-text business-text-small"
                              style={{ marginTop: 6 }}
                            >
                              <button
                                className="business-link"
                                onClick={() => setAction(a)}
                              >
                                {a.name}
                              </button>{' '}
                              · {a.note}
                            </p>
                          ))
                      ) : (
                        <p
                          className="business-text business-text-small"
                          style={{ marginTop: 6 }}
                        >
                          暂未标记阻塞。遇到范围、工期或客户新诉求时，可进入需求池登记。
                        </p>
                      )}
                    </div>
                    <div>
                      <strong style={{ fontSize: 13 }}>客户与范围变化</strong>
                      <p
                        className="business-text business-text-small"
                        style={{ marginTop: 6 }}
                      >
                        保留原始诉求，先澄清影响，再确认处理路径。
                        <Link to={`/projects/${project.id}?tab=requirements`}>
                          进入项目需求池
                        </Link>
                      </p>
                    </div>
                  </div>
                </Panel>
              </div>
              <aside className="business-stack business-rail">
                <Panel
                  title={
                    <Space>
                      <ShieldCheck size={16} color="#5076ba" />
                      关键评审
                    </Space>
                  }
                >
                  <div className="business-gate">
                    <div className="business-gate-title">
                      SG01 · 售前立项
                      <Status
                        value={
                          pending?.status ?? latest?.status ?? 'NOT_STARTED'
                        }
                      />
                    </div>
                    <p>
                      {latest
                        ? `${latest.purpose} · ${latest.endsOn} 截止`
                        : '明确售前边界、预期成果、退出条件与投入额度。'}
                    </p>
                    <Space size={8} wrap>
                      <Button size="small" onClick={() => setGate('SG01')}>
                        查看记录
                      </Button>
                      {canEdit &&
                        (!pending || pending.status !== 'SUBMITTED') && (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() =>
                              setCommand(initiationCommand(pending))
                            }
                          >
                            {pending
                              ? '完善申请'
                              : approved
                                ? '追加申请'
                                : '发起申请'}
                          </Button>
                        )}
                      {canReview &&
                        pending?.status === 'SUBMITTED' &&
                        pending.submittedBy !== session.data?.accountId && (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() =>
                              setCommand(reviewInitiation(pending))
                            }
                          >
                            评审
                          </Button>
                        )}
                    </Space>
                  </div>
                  <div className="business-gate">
                    <div className="business-gate-title">
                      SG02 · 方案与报价
                      <Status value={quote?.status ?? 'NOT_STARTED'} />
                    </div>
                    <p>
                      {quote
                        ? quote.current
                          ? '本次评审对应当前动作与成果版本。'
                          : '动作或成果已更新，原评审不代表当前版本。'
                        : '提交技术可行性、范围、估算、价格授权等七项评审依据。'}
                    </p>
                    <Space size={8} wrap>
                      <Button size="small" onClick={() => setGate('SG02')}>
                        查看记录
                      </Button>
                      {canEdit && quote?.status !== 'SUBMITTED' && (
                        <Button
                          size="small"
                          onClick={() => setCommand(submitQuote())}
                        >
                          提交评审
                        </Button>
                      )}
                      {canReview &&
                        quote?.status === 'SUBMITTED' &&
                        quote.submittedBy !== session.data?.accountId && (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => setCommand(reviewQuote(quote))}
                          >
                            评审
                          </Button>
                        )}
                    </Space>
                  </div>
                </Panel>
                <Panel
                  title="售前投入"
                  extra={
                    data.investmentDetailsVisible && (
                      <button
                        className="business-link business-muted"
                        onClick={() => setLedger(true)}
                      >
                        明细
                      </button>
                    )
                  }
                >
                  <div className="business-amount-line">
                    <span>实际工时</span>
                    <strong>
                      {data.actualHours} / {approved?.approvedHours ?? '—'} h
                    </strong>
                  </div>
                  <Progress
                    percent={
                      approved?.approvedHours
                        ? Math.min(
                            100,
                            Math.round(
                              (data.actualHours / approved.approvedHours) * 100,
                            ),
                          )
                        : 0
                    }
                    showInfo={false}
                    size="small"
                    strokeColor="#5485e2"
                  />
                  <div className="business-amount-line">
                    <span>待兑现承诺</span>
                    <strong>{data.committedHours} h</strong>
                  </div>
                  <div className="business-amount-line">
                    <span>实际费用</span>
                    <strong>{money(data.actualCost)}</strong>
                  </div>
                  <div className="business-amount-line">
                    <span>承诺费用</span>
                    <strong>{money(data.committedCost)}</strong>
                  </div>
                  <div className="business-amount-line">
                    <span>批准费用上限</span>
                    <strong>{money(approved?.approvedCost)}</strong>
                  </div>
                  {approved && (
                    <p className="business-muted">
                      有效期 {approved.startsOn} 至 {approved.endsOn}
                    </p>
                  )}
                  {canInvest && (
                    <Button
                      block
                      icon={<Plus size={14} />}
                      onClick={() => setCommand(invest())}
                    >
                      记录投入
                    </Button>
                  )}
                </Panel>
                <Panel title="项目协作成员">
                  {detail.members
                    .filter((m) => m.active)
                    .slice(0, 5)
                    .map((m) => (
                      <div className="business-member-row" key={m.id}>
                        <span className="business-person">
                          <span className="business-avatar">
                            {m.name.slice(-2)}
                          </span>
                          {m.name}
                        </span>
                        <span className="business-muted">
                          {m.salesOwner
                            ? '营销负责人'
                            : m.presalesOwner
                              ? '售前负责人'
                              : m.roleCodes.includes('PROJECT_REVIEWER')
                                ? '评审人'
                                : '协作成员'}
                        </span>
                      </div>
                    ))}
                  <Link
                    className="business-cell-sub"
                    to={`/projects/${project.id}?tab=members`}
                  >
                    查看成员与权限
                  </Link>
                </Panel>
              </aside>
            </div>
          </div>
        )}
      </QueryState>
      <Drawer
        className="business-detail-drawer"
        title={currentAction?.name ?? '动作详情'}
        open={!!currentAction}
        size={750}
        onClose={() => setAction(null)}
        destroyOnHidden
      >
        {currentAction && (
          <div className="business-stack">
            <Panel
              title="动作进展"
              extra={<Status value={currentAction.status} />}
            >
              <Descriptions
                size="small"
                column={2}
                items={[
                  {
                    key: 'owner',
                    label: '负责人',
                    children: currentAction.ownerName ?? '待指定',
                  },
                  {
                    key: 'date',
                    label: '计划完成',
                    children: currentAction.dueDate ?? '—',
                  },
                ]}
              />
              <p
                className="business-text business-text-small"
                style={{ marginTop: 12 }}
              >
                {currentAction.note ?? '尚未记录进展说明'}
              </p>
              {canEdit && (
                <Space style={{ marginTop: 14 }}>
                  <Button onClick={() => setCommand(editAction(currentAction))}>
                    更新进展
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => setCommand(deliver(currentAction))}
                  >
                    提交新版本
                  </Button>
                </Space>
              )}
            </Panel>
            <Panel title={`成果版本 · ${currentAction.deliverables.length}`}>
              {currentAction.deliverables.length ? (
                currentAction.deliverables.map((d) => (
                  <div key={d.id} className="business-output-row">
                    <FileText size={18} />
                    <div className="business-output-info">
                      <button
                        className="business-link"
                        onClick={() => setOutput(d)}
                      >
                        {d.title} · V{d.versionNumber}
                      </button>
                      <p className="business-cell-sub">{d.changeNote}</p>
                      <span className="business-cell-sub">
                        {d.createdByName} · {dateTime(d.createdAt)}
                      </span>
                    </div>
                    <Status value={d.status} />
                  </div>
                ))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无成果版本"
                />
              )}
            </Panel>
          </div>
        )}
      </Drawer>
      <Drawer
        title={
          output ? `${output.title} · V${output.versionNumber}` : '成果正文'
        }
        open={!!output}
        size={780}
        onClose={() => setOutput(null)}
        destroyOnHidden
      >
        {output && (
          <div className="business-stack">
            <Space>
              <Status value={output.status} />
              <span className="business-muted">
                {output.createdByName} · {dateTime(output.createdAt)}
              </span>
            </Space>
            <Panel title="适用范围">
              <p className="business-text">{output.scope}</p>
            </Panel>
            <Panel title="成果正文">
              <p className="business-text">{output.content}</p>
            </Panel>
            <Panel title="版本变化">
              <p className="business-text">{output.changeNote}</p>
            </Panel>
          </div>
        )}
      </Drawer>
      <Drawer
        className="business-detail-drawer"
        title={
          gate === 'SG01' ? 'SG01 · 售前立项记录' : 'SG02 · 方案与报价记录'
        }
        open={!!gate}
        size={780}
        onClose={() => setGate(null)}
        destroyOnHidden
      >
        <div className="business-stack">
          {gate === 'SG01' ? (
            data?.initiations.length ? (
              data.initiations.map((i) => (
                <Panel
                  key={i.id}
                  title={i.purpose}
                  extra={<Status value={i.status} />}
                >
                  <Descriptions
                    size="small"
                    column={2}
                    items={[
                      {
                        key: 'dates',
                        label: '有效期',
                        children: `${i.startsOn} 至 ${i.endsOn}`,
                        span: 2,
                      },
                      {
                        key: 'hours',
                        label: '申请工时',
                        children: `${i.requestedHours} h`,
                      },
                      {
                        key: 'cost',
                        label: '申请费用',
                        children: money(i.requestedCost),
                      },
                      {
                        key: 'approved',
                        label: '批准额度',
                        children: `${i.approvedHours ?? '—'} h / ${money(i.approvedCost)}`,
                        span: 2,
                      },
                    ]}
                  />
                  <dl className="business-assessment" style={{ marginTop: 14 }}>
                    <dt>范围</dt>
                    <dd>{i.scope}</dd>
                    <dt>预期成果</dt>
                    <dd>{i.expectedOutputs}</dd>
                    <dt>退出条件</dt>
                    <dd>{i.exitConditions}</dd>
                    <dt>评审意见</dt>
                    <dd>
                      {i.reviewComment ?? '待评审'}
                      {i.reviewedByName && ` · ${i.reviewedByName}`}
                    </dd>
                  </dl>
                  <Space wrap>
                    {canEdit && ['DRAFT', 'RETURNED'].includes(i.status) && (
                      <>
                        <Button
                          onClick={() => setCommand(initiationCommand(i))}
                        >
                          编辑申请
                        </Button>
                        <Button
                          type="primary"
                          onClick={() =>
                            setCommand({
                              title: '提交售前立项',
                              path: `${base}/initiations/${i.id}/submit`,
                              values: { version: i.version },
                              fields: [],
                              description: `提交「${i.purpose}」，累计申请 ${i.requestedHours} 小时 / ${money(i.requestedCost)}，有效期 ${i.startsOn} 至 ${i.endsOn}。`,
                              submitLabel: '确认提交',
                            })
                          }
                        >
                          提交评审
                        </Button>
                      </>
                    )}
                    {canReview &&
                      i.status === 'SUBMITTED' &&
                      i.submittedBy !== session.data?.accountId && (
                        <Button
                          type="primary"
                          onClick={() => setCommand(reviewInitiation(i))}
                        >
                          评审申请
                        </Button>
                      )}
                  </Space>
                </Panel>
              ))
            ) : (
              <Empty description="暂无立项记录" />
            )
          ) : data?.quoteReviews.length ? (
            data.quoteReviews.map((q) => (
              <Panel
                key={q.id}
                title={`方案与报价 · ${dateTime(q.createdAt)}`}
                extra={<Status value={q.status} />}
              >
                <Alert
                  type={q.current ? 'info' : 'warning'}
                  title={
                    q.current
                      ? '对应当前动作和成果版本'
                      : '动作或成果已更新，本次评审版本已过期'
                  }
                />
                <dl className="business-assessment" style={{ marginTop: 14 }}>
                  {quoteFields.map((f) => (
                    <div key={f.name} style={{ display: 'contents' }}>
                      <dt>{f.label}</dt>
                      <dd>{q[f.name as keyof Quote] as string}</dd>
                    </div>
                  ))}
                </dl>
                <Space wrap>
                  {q.deliverableIds.map((id) => {
                    const d = deliverables.find((d) => d.id === id)
                    return d ? (
                      <Button
                        size="small"
                        key={id}
                        onClick={() => setOutput(d)}
                      >
                        {d.title} · V{d.versionNumber}
                      </Button>
                    ) : null
                  })}
                </Space>
                <p
                  className="business-text business-text-small"
                  style={{ margin: '12px 0' }}
                >
                  {q.reviewComment ?? '待评审'}
                  {q.reviewedByName && ` · ${q.reviewedByName}`}
                </p>
                {canReview &&
                  q.status === 'SUBMITTED' &&
                  q.submittedBy !== session.data?.accountId && (
                    <Button
                      type="primary"
                      onClick={() => setCommand(reviewQuote(q))}
                    >
                      提交评审结论
                    </Button>
                  )}
              </Panel>
            ))
          ) : (
            <Empty description="暂无报价评审记录" />
          )}
        </div>
      </Drawer>
      <Drawer
        className="business-detail-drawer"
        title="售前投入明细"
        open={ledger}
        size={850}
        onClose={() => setLedger(false)}
        destroyOnHidden
      >
        <Panel
          title="承诺、实际与冲销"
          className="business-panel--table"
          extra={
            canInvest && (
              <Button
                type="primary"
                size="small"
                onClick={() => setCommand(invest())}
              >
                记录投入
              </Button>
            )
          }
        >
          <div className="business-panel-body business-toolbar">
            <Select
              aria-label="投入类型筛选"
              placeholder="全部投入类型"
              allowClear
              value={investmentKind}
              options={options(['COMMITTED', 'ACTUAL', 'REVERSAL'])}
              onChange={setInvestmentKind}
            />
            <Input
              aria-label="投入发生日期筛选"
              type="date"
              style={{ width: 180 }}
              value={investmentDay}
              onChange={(e) => setInvestmentDay(e.target.value)}
            />
            <Button
              onClick={() => {
                setInvestmentKind(undefined)
                setInvestmentDay('')
              }}
            >
              重置
            </Button>
          </div>
          <Table<Investment>
            rowKey="id"
            size="small"
            dataSource={data?.investments.filter(
              (i) =>
                (!investmentKind || i.kind === investmentKind) &&
                (!investmentDay || i.occurredOn === investmentDay),
            )}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 700 }}
            columns={[
              {
                title: '类型',
                render: (_, i) => (
                  <>
                    {label(i.kind)}
                    {i.reversed && (
                      <span className="business-cell-sub">已冲销</span>
                    )}
                  </>
                ),
              },
              { title: '日期', dataIndex: 'occurredOn' },
              { title: '用途与依据', dataIndex: 'description', width: 230 },
              { title: '工时', dataIndex: 'hours' },
              { title: '费用', dataIndex: 'cost', render: money },
              { title: '记录人', dataIndex: 'createdByName' },
              {
                title: '操作',
                render: (_, i) =>
                  canInvest &&
                  !i.reversed &&
                  i.kind !== 'REVERSAL' && (
                    <button
                      className="business-link"
                      onClick={() => setCommand(invest(i))}
                    >
                      冲销
                    </button>
                  ),
              },
            ]}
          />
        </Panel>
      </Drawer>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </>
  )
}
