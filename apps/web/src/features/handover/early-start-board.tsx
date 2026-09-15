import { Alert, Button, Descriptions, Select, Space, Table, Tabs } from 'antd'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
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
import {
  dateTime,
  money,
  useBusinessQuery,
} from '@/features/business/business-data'
import type { ProjectDetail } from '@/features/business/business-types'
import { handoverName, handoverOptions, today } from './handover-data'
import type {
  EarlyApplication,
  EarlyAllowance,
  EarlyFacts,
  EarlyLedger,
  EarlyReview,
  EarlyWorkspace,
  HandoverWorkspace,
} from './handover-types'

export function EarlyStartBoard({ detail }: { detail: ProjectDetail }) {
  const pid = detail.project.id,
    root = `/api/projects/${pid}/early-start`
  const query = useBusinessQuery<EarlyWorkspace>(root),
    d = query.data,
    session = useCurrentSession()
  const hg = useBusinessQuery<HandoverWorkspace>(
    detail.allowedActions.includes('HANDOVER_READ')
      ? `/api/projects/${pid}/handover`
      : undefined,
  )
  const [selected, setSelected] = useState<string>(),
    [command, setCommand] = useState<Command | null>(null)
  const a =
    d?.applications.find((a) => a.id === selected) ??
    d?.applications.find((a) => a.status === 'APPROVED') ??
    d?.applications[0]
  const can = (p: string) => d?.allowedActions.includes(p) ?? false
  const people = detail.members
    .filter((m) => m.active)
    .map((m) => ({ value: m.accountId, label: m.name }))
  const memberField = (name: string, text: string): Field => ({
    name,
    label: text,
    type: 'select',
    options: people,
  })
  const currentReview = d?.reviews.find(
    (r) => r.applicationId === a?.id && r.status === 'SUBMITTED',
  )
  const normalPack =
    hg.data?.packages.some((p) => p.current) &&
    hg.data.handover?.basisKind !== 'EARLY_START'
  function application(existing?: EarlyApplication) {
    setCommand({
      title: existing ? '维护提前开工申请' : '申请提前开工',
      path: existing ? `${root}/${existing.id}` : root,
      method: existing ? 'PATCH' : 'POST',
      description:
        '逐项写明可做的范围、上限、期限、风险责任和停止条件。批准后不能直接扩大范围。',
      values: existing
        ? {
            ...existing.request,
            scopeItems: existing.request.scopeItems.join('\n'),
            version: existing.version,
          }
        : {
            startsOn: today(),
            riskOwnerId: detail.project.presalesOwnerId,
            requestedHours: 0,
            requestedCost: 0,
          },
      fields: [
        { name: 'title', label: '申请名称', wide: true },
        { name: 'scope', label: '临时工作范围', type: 'textarea' },
        {
          name: 'scopeItems',
          label: '允许开展的范围条目',
          type: 'textarea',
          hint: '每行一个具体条目，后续承诺必须选自这里，最多 20 项。',
        },
        { name: 'requestedHours', label: '申请人时上限', type: 'number' },
        { name: 'requestedCost', label: '申请费用上限（元）', type: 'number' },
        { name: 'startsOn', label: '开始日期', type: 'date' },
        { name: 'endsOn', label: '停止日期', type: 'date' },
        memberField('riskOwnerId', '风险承担人'),
        { name: 'stopConditions', label: '停止条件', type: 'textarea' },
        {
          name: 'missingItems',
          label: '尚未齐备的条件与资料',
          type: 'textarea',
        },
        {
          name: 'regularizationPlan',
          label: '补齐与转正计划',
          type: 'textarea',
        },
      ],
      transform: (v) => ({
        ...v,
        scopeItems: String(v.scopeItems ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
      onSuccess: (result) => {
        const next = result as EarlyWorkspace
        const found = existing?.id ?? next.applications[0]?.id
        if (found) setSelected(found)
      },
    })
  }
  function submit(app: EarlyApplication) {
    setCommand({
      title: '提交提前开工审批',
      path: `${root}/${app.id}/submissions`,
      values: { version: app.version },
      fields: [],
      description:
        '本轮范围、申请额度、期限、风险承担人与停止条件会形成评审快照，请另一名授权成员复核。',
      content: <FactsPreview facts={app.request} />,
    })
  }
  function review(r: EarlyReview, decision: string) {
    setCommand({
      title: decision === 'APPROVED' ? '独立批准提前开工' : '退回提前开工申请',
      path: `${root}/${r.applicationId}/reviews/${r.id}`,
      values: {
        version: r.version,
        decision,
        approvedHours: r.snapshot.requestedHours,
        approvedCost: r.snapshot.requestedCost,
      },
      description:
        '批准范围与期限沿用本轮申请；批准额度不得高于申请额。此操作不通过 DG-01 或 DG-02。',
      content: <FactsPreview facts={r.snapshot} />,
      fields: [
        ...(decision === 'APPROVED'
          ? ([
              { name: 'approvedHours', label: '批准人时', type: 'number' },
              { name: 'approvedCost', label: '批准费用（元）', type: 'number' },
            ] satisfies Field[])
          : []),
        { name: 'comment', label: '授权结论与意见', type: 'textarea' },
      ],
    })
  }
  function record(
    app: EarlyApplication,
    kind: string,
    commitment?: EarlyLedger,
    allowance?: EarlyAllowance,
  ) {
    const actual = kind === 'ACTUAL'
    setCommand({
      title: commitment
        ? '登记实际并核销承诺'
        : actual
          ? '登记实际发生'
          : allowance
            ? '登记安全收尾承诺'
            : '登记范围内承诺',
      path: `${root}/${app.id}/ledger`,
      description: actual
        ? '实际发生独立留账；核销承诺时只减少未核销余额。已发生超额实际需说明原因，新增承诺继续冻结。'
        : '当前日期、发生日期、范围、人时与费用均需在有效授权内。并发请求会重新核验可用额度。',
      values: {
        kind,
        commitmentId: commitment?.id,
        allowanceId: allowance?.id ?? commitment?.allowanceId,
        commitmentType: commitment?.commitmentType ?? 'LABOR',
        scopeItem: commitment?.scopeItem ?? allowance?.scopeItem,
        ownerId: commitment?.ownerId ?? detail.project.presalesOwnerId,
        occurredOn: today(),
        hours: 0,
        cost: 0,
      },
      fields: [
        {
          name: 'commitmentType',
          label: '承诺类型',
          type: 'select',
          options: handoverOptions([
            'LABOR',
            'PROCUREMENT',
            'SUBCONTRACT',
            'OTHER',
          ]),
          disabled: !!commitment,
        },
        {
          name: 'scopeItem',
          label: '批准范围',
          type: 'select',
          options: app.request.scopeItems.map((s) => ({ value: s, label: s })),
          disabled: !!commitment || !!allowance,
        },
        memberField('ownerId', '记录责任人'),
        { name: 'occurredOn', label: '发生日期', type: 'date' },
        { name: 'hours', label: '人时', type: 'number' },
        { name: 'cost', label: '费用（元）', type: 'number' },
        { name: 'evidence', label: '用途、发生事实与依据', type: 'textarea' },
        ...(actual
          ? [
              {
                name: 'overrunReason',
                label: '超限原因（实际发生超额时必填）',
                type: 'textarea',
                required: false,
              } satisfies Field,
            ]
          : []),
      ],
    })
  }
  function reverse(row: EarlyLedger) {
    setCommand({
      title: '冲正台账记录',
      path: `${root}/${row.applicationId}/ledger`,
      values: { kind: 'REVERSAL', reversesId: row.id },
      description:
        '原记录及冲正原因永久保留。已有实际核销的承诺，须先处理实际冲正。',
      content: (
        <Descriptions
          column={1}
          items={[
            {
              key: 'source',
              label: '原记录',
              children: `${handoverName(row.kind)} · ${row.scopeItem}`,
            },
            {
              key: 'amount',
              label: '原数值',
              children: `${row.hours} 人时 / ${money(row.cost)}`,
            },
          ]}
        />
      ),
      fields: [{ name: 'evidence', label: '冲正原因与依据', type: 'textarea' }],
    })
  }
  function allowance(app: EarlyApplication) {
    setCommand({
      title: '授权安全止损与收尾',
      path: `${root}/${app.id}/closure-allowances`,
      values: { version: app.version, startsOn: today(), hours: 0, cost: 0 },
      description:
        '仅限原批准范围内的安全止损与收尾；独立限额，最长 30 天，不延长普通开工授权。',
      fields: [
        {
          name: 'scopeItem',
          label: '收尾范围',
          type: 'select',
          options: app.request.scopeItems.map((s) => ({ value: s, label: s })),
        },
        { name: 'hours', label: '收尾人时上限', type: 'number' },
        { name: 'cost', label: '收尾费用上限（元）', type: 'number' },
        { name: 'startsOn', label: '开始日期', type: 'date' },
        { name: 'endsOn', label: '结束日期', type: 'date' },
        { name: 'reason', label: '安全收尾必要性与批准依据', type: 'textarea' },
      ],
    })
  }
  const approved = !!a?.approvedByName
  const scopeAllowances =
    d?.allowances.filter((x) => x.applicationId === a?.id) ?? []
  const ledger = d?.ledger.filter((x) => x.applicationId === a?.id) ?? []
  return (
    <>
      <QueryState query={query}>
        {d && (
          <>
            <div className="early-toolbar">
              <div>
                <h3>提前开工授权与承诺</h3>
                <p>范围、预算、期限和实际发生在同一处追溯</p>
              </div>
              <Space wrap>
                {d.applications.length > 0 && (
                  <Select
                    aria-label="选择提前开工申请"
                    className="early-application-select"
                    value={a?.id}
                    options={d.applications.map((x) => ({
                      value: x.id,
                      label: `${x.request.title} · ${handoverName(x.status)}`,
                    }))}
                    onChange={setSelected}
                  />
                )}
                {can('EARLY_START_EDIT') && (
                  <Button type="primary" onClick={() => application()}>
                    申请提前开工
                  </Button>
                )}
              </Space>
            </div>
            {!a ? (
              <Panel>
                <div className="handover-onboarding">
                  <ShieldCheck size={38} />
                  <div>
                    <strong>先明确例外边界，再记录逐笔承诺</strong>
                    <p>
                      申请需范围条目、费用与人时上限、有效期、风险负责人、停止条件与转正计划。
                    </p>
                  </div>
                </div>
              </Panel>
            ) : (
              <>
                <Facts
                  items={[
                    {
                      label: '授权状态',
                      value: (
                        <Status
                          value={a.effectiveStatus}
                          text={handoverName(a.effectiveStatus)}
                        />
                      ),
                      note: `申请：${handoverName(a.status)}`,
                    },
                    {
                      label: '普通额度占用',
                      value: money(a.totals.usedCost),
                      note: `批准 ${money(a.approvedCost)} · 实际 ${money(a.totals.actualCost)}`,
                    },
                    {
                      label: '普通人时占用',
                      value: `${a.totals.usedHours} 人时`,
                      note: `批准 ${a.approvedHours ?? '—'} · 未核销 ${a.totals.outstandingHours}`,
                    },
                    {
                      label: '批准期限',
                      value: a.request.endsOn,
                      note: `开始 ${a.request.startsOn} · ${a.riskOwnerName}`,
                    },
                  ]}
                />
                {[
                  'EXPIRED',
                  'OVER_LIMIT',
                  'STOPPED',
                  'NOT_YET_ACTIVE',
                  'REGULARIZED',
                ].includes(a.effectiveStatus) &&
                  approved && (
                    <Alert
                      type={
                        a.effectiveStatus === 'OVER_LIMIT' ? 'warning' : 'info'
                      }
                      showIcon
                      title={`${handoverName(a.effectiveStatus)}：停止新增普通承诺，保留已发生事实与历史。`}
                    />
                  )}
                <div className="business-split">
                  <div className="business-stack">
                    <Panel
                      title={a.request.title}
                      subtitle="批准范围与停止条件"
                      extra={
                        <Space wrap>
                          {can('EARLY_START_EDIT') &&
                            ['DRAFT', 'RETURNED'].includes(a.status) && (
                              <>
                                <Button
                                  size="small"
                                  onClick={() => application(a)}
                                >
                                  维护申请
                                </Button>
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => submit(a)}
                                >
                                  提交审批
                                </Button>
                              </>
                            )}
                        </Space>
                      }
                    >
                      <FactsPreview facts={a.request} />
                    </Panel>
                    <Panel
                      title="最小承诺台账"
                      subtitle="普通授权占用＝未核销承诺＋累计实际；安全收尾另计额度"
                      className="business-panel--table"
                      extra={
                        can('EARLY_LEDGER_EDIT') &&
                        d.ledgerVisible &&
                        approved && (
                          <Space wrap>
                            {a.effectiveStatus === 'ACTIVE' && (
                              <Button
                                size="small"
                                type="primary"
                                onClick={() => record(a, 'COMMITTED')}
                              >
                                新增承诺
                              </Button>
                            )}
                            <Button
                              size="small"
                              onClick={() => record(a, 'ACTUAL')}
                            >
                              记录实际
                            </Button>
                          </Space>
                        )
                      }
                    >
                      {d.ledgerVisible ? (
                        <Table<EarlyLedger>
                          rowKey="id"
                          size="small"
                          dataSource={ledger}
                          scroll={{ x: 840 }}
                          pagination={{
                            pageSize: 8,
                            showSizeChanger: false,
                            hideOnSinglePage: true,
                          }}
                          columns={[
                            {
                              title: '类型 / 范围',
                              width: 165,
                              render: (_, r) => (
                                <>
                                  <strong className="business-cell-title">
                                    {handoverName(r.kind)}
                                    {r.allowanceId ? ' · 收尾' : ''}
                                    {r.reversed ? ' · 已冲正' : ''}
                                  </strong>
                                  <span className="business-cell-sub">
                                    {r.scopeItem} ·{' '}
                                    {handoverName(r.commitmentType)}
                                  </span>
                                </>
                              ),
                            },
                            {
                              title: '责任 / 日期',
                              width: 135,
                              render: (_, r) => (
                                <>
                                  {r.ownerName}
                                  <span className="business-cell-sub">
                                    {r.occurredOn}
                                  </span>
                                </>
                              ),
                            },
                            {
                              title: '人时',
                              dataIndex: 'hours',
                              width: 65,
                              align: 'right',
                            },
                            {
                              title: '费用（元）',
                              width: 105,
                              align: 'right',
                              render: (_, r) => money(r.cost),
                            },
                            {
                              title: '发生依据',
                              dataIndex: 'evidence',
                              width: 185,
                              ellipsis: true,
                            },
                            {
                              title: '操作',
                              width: 160,
                              render: (_, r) => (
                                <Space size={4}>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      setCommand({
                                        title: '台账记录与依据',
                                        path: root,
                                        readOnly: true,
                                        fields: [],
                                        content: (
                                          <Descriptions
                                            column={1}
                                            items={[
                                              {
                                                key: 'source',
                                                label: '类型',
                                                children: handoverName(r.kind),
                                              },
                                              {
                                                key: 'scope',
                                                label: '范围',
                                                children: r.scopeItem,
                                              },
                                              {
                                                key: 'evidence',
                                                label: '发生依据',
                                                children: (
                                                  <p className="handover-long-text">
                                                    {r.evidence}
                                                  </p>
                                                ),
                                              },
                                              {
                                                key: 'who',
                                                label: '录入人',
                                                children: r.recordedByName,
                                              },
                                              {
                                                key: 'parent',
                                                label: '关联',
                                                children: r.commitmentId
                                                  ? '核销原承诺'
                                                  : r.reversesId
                                                    ? '冲正原记录'
                                                    : '独立发生',
                                              },
                                            ]}
                                          />
                                        ),
                                      })
                                    }
                                  >
                                    查看
                                  </Button>
                                  {can('EARLY_LEDGER_EDIT') &&
                                    !r.reversed &&
                                    r.kind !== 'REVERSAL' && (
                                      <>
                                        {r.kind === 'COMMITTED' && (
                                          <Button
                                            size="small"
                                            onClick={() =>
                                              record(a, 'ACTUAL', r)
                                            }
                                          >
                                            核销
                                          </Button>
                                        )}
                                        <Button
                                          size="small"
                                          onClick={() => reverse(r)}
                                        >
                                          冲正
                                        </Button>
                                      </>
                                    )}
                                </Space>
                              ),
                            },
                          ]}
                        />
                      ) : (
                        <Alert
                          showIcon
                          type="info"
                          title="逐笔台账与费用依据需要独立读取权限。"
                        />
                      )}
                    </Panel>
                    <Panel title="评审与授权历史">
                      <Tabs
                        items={[
                          {
                            key: 'reviews',
                            label: `评审轮次 ${d.reviews.filter((r) => r.applicationId === a.id).length}`,
                            children: (
                              <Table<EarlyReview>
                                rowKey="id"
                                size="small"
                                scroll={{ x: 620 }}
                                pagination={false}
                                dataSource={d.reviews.filter(
                                  (r) => r.applicationId === a.id,
                                )}
                                columns={[
                                  {
                                    title: '时间',
                                    dataIndex: 'createdAt',
                                    render: dateTime,
                                  },
                                  {
                                    title: '提交人',
                                    dataIndex: 'submittedByName',
                                  },
                                  {
                                    title: '状态',
                                    render: (_, r) => (
                                      <Status value={r.status} />
                                    ),
                                  },
                                  { title: '意见', dataIndex: 'comment' },
                                  {
                                    title: '申请快照',
                                    render: (_, r) => (
                                      <Button
                                        size="small"
                                        onClick={() =>
                                          setCommand({
                                            title: '本轮申请快照',
                                            path: root,
                                            readOnly: true,
                                            fields: [],
                                            content: (
                                              <FactsPreview
                                                facts={r.snapshot}
                                              />
                                            ),
                                          })
                                        }
                                      >
                                        查看快照
                                      </Button>
                                    ),
                                  },
                                ]}
                              />
                            ),
                          },
                          {
                            key: 'history',
                            label: '操作记录',
                            children: <History events={d.history} limit={8} />,
                          },
                        ]}
                      />
                    </Panel>
                  </div>
                  <div className="business-stack">
                    <Panel title="独立复核">
                      {currentReview &&
                      can('EARLY_START_REVIEW') &&
                      currentReview.submittedBy !== session.data?.accountId ? (
                        <Space wrap>
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => review(currentReview, 'APPROVED')}
                          >
                            批准范围内开工
                          </Button>
                          <Button
                            size="small"
                            onClick={() => review(currentReview, 'RETURNED')}
                          >
                            退回申请
                          </Button>
                        </Space>
                      ) : (
                        <p>
                          {a.approvedByName
                            ? `授权人：${a.approvedByName}`
                            : a.status === 'SUBMITTED'
                              ? '已提交，等待另一名授权成员复核'
                              : '保存申请后提交独立审批'}
                        </p>
                      )}
                      <p className="business-muted">
                        {a.approvedAt
                          ? dateTime(a.approvedAt)
                          : '审批不自动通过 DG-01 / DG-02'}
                      </p>
                      {can('EARLY_START_REVIEW') &&
                        a.submittedBy !== session.data?.accountId &&
                        ['APPROVED', 'DRAFT', 'RETURNED'].includes(
                          a.status,
                        ) && (
                          <Button
                            size="small"
                            onClick={() =>
                              setCommand({
                                title: '停止提前开工授权',
                                path: `${root}/${a.id}/close`,
                                values: { version: a.version },
                                description:
                                  '停止新增普通承诺，原承诺与实际继续保留。必要的安全收尾须独立授权。',
                                fields: [
                                  {
                                    name: 'reason',
                                    label: '停止原因',
                                    type: 'textarea',
                                  },
                                ],
                              })
                            }
                          >
                            停止普通授权
                          </Button>
                        )}
                    </Panel>
                    <Panel
                      title="安全止损与收尾"
                      extra={
                        can('EARLY_START_REVIEW') &&
                        approved &&
                        ['APPROVED', 'CLOSED'].includes(a.status) &&
                        a.submittedBy !== session.data?.accountId && (
                          <Button size="small" onClick={() => allowance(a)}>
                            新增授权
                          </Button>
                        )
                      }
                    >
                      {scopeAllowances.length ? (
                        scopeAllowances.map((x) => (
                          <div className="early-allowance" key={x.id}>
                            <strong>{x.scopeItem}</strong>
                            <p>
                              {x.startsOn} ～ {x.endsOn}
                            </p>
                            <div>
                              费用 {money(x.totals.usedCost)} / {money(x.cost)}
                            </div>
                            <div>
                              人时 {x.totals.usedHours} / {x.hours}
                            </div>
                            <p>{x.reason}</p>
                            <small>批准：{x.approvedByName}</small>
                            {can('EARLY_LEDGER_EDIT') &&
                              d.ledgerVisible &&
                              a.status !== 'REGULARIZED' &&
                              today() >= x.startsOn &&
                              today() <= x.endsOn && (
                                <Button
                                  size="small"
                                  onClick={() =>
                                    record(a, 'COMMITTED', undefined, x)
                                  }
                                >
                                  登记收尾承诺
                                </Button>
                              )}
                          </div>
                        ))
                      ) : (
                        <p className="business-muted">
                          需要在原范围内安全止损时，另行明确限额、期限和授权人。
                        </p>
                      )}
                    </Panel>
                    <Panel title="补齐与转正">
                      <h4>尚未齐备</h4>
                      <p className="handover-long-text">
                        {a.request.missingItems}
                      </p>
                      <h4>补齐计划</h4>
                      <p className="handover-long-text">
                        {a.request.regularizationPlan}
                      </p>
                      {a.finishReason && (
                        <Alert type="info" title={a.finishReason} />
                      )}
                      <p>
                        <Link
                          to={`/projects/${pid}?tab=handover&handover=dg01`}
                        >
                          查看 DG-01 清单{' '}
                          <ArrowUpRight size={13} className="inline" />
                        </Link>
                      </p>
                      {can('EARLY_START_EDIT') &&
                        approved &&
                        ['APPROVED', 'CLOSED'].includes(a.status) && (
                          <Button
                            size="small"
                            disabled={!normalPack}
                            onClick={() =>
                              setCommand({
                                title: '记录提前开工转正',
                                path: `/api/projects/${pid}/handover/early-start/${a.id}/regularize`,
                                values: { version: a.version },
                                description:
                                  '核验正常商务依据和当前有效 DG-01 包后，停止临时新增承诺。DG-02 仍独立准备及批准。',
                                fields: [
                                  {
                                    name: 'reason',
                                    label: '转正依据与说明',
                                    type: 'textarea',
                                  },
                                ],
                              })
                            }
                          >
                            关联有效移交包转正
                          </Button>
                        )}
                      {!normalPack && (
                        <p className="business-muted">
                          转正需正常商务依据及当前有效 DG-01 包。
                        </p>
                      )}
                    </Panel>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </>
  )
}

function FactsPreview({ facts }: { facts: EarlyFacts }) {
  return (
    <div className="early-facts">
      <p className="handover-long-text">{facts.scope}</p>
      <div className="early-scope-items">
        {facts.scopeItems.map((s, i) => (
          <span key={s}>
            <b>{String(i + 1).padStart(2, '0')}</b>
            {s}
          </span>
        ))}
      </div>
      <Descriptions
        size="small"
        column={2}
        items={[
          {
            key: 'cost',
            label: '申请费用',
            children: money(facts.requestedCost),
          },
          { key: 'hours', label: '申请人时', children: facts.requestedHours },
          { key: 'from', label: '开始', children: facts.startsOn },
          { key: 'to', label: '停止', children: facts.endsOn },
        ]}
      />
      <div className="early-stop">
        <strong>停止条件</strong>
        <p className="handover-long-text">{facts.stopConditions}</p>
      </div>
    </div>
  )
}
