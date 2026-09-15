import { useIncomeSearchParams } from './income-search-params'
import { useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Select,
  Popover,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd'
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { Link, useParams } from 'react-router'
import {
  BusinessPage,
  CommandDrawer,
  Facts,
  PageHeading,
  Panel,
  QueryState,
  RefreshButton,
  type Command,
} from '@/features/business/business-ui'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import type { ProjectDetail } from '@/features/business/business-types'
import type { FileWorkspace } from '@/features/files/file-types'
import { EvidenceFiles } from '@/features/execution/execution-ui'
import { actualToday } from '@/features/execution/execution-types'
import { ForecastEditor, IncomeEditor, PublishPreview } from './income-forms'
import {
  ForecastComparison,
  ForecastLines,
  IncomeHistory,
  IncomeSource,
  IncomeStatus,
} from './income-ui'
import {
  incomeLabel,
  matchesIncome,
  money,
  type ForecastRevision,
  type IncomeDetail,
  type IncomeEvent,
  type IncomeRow,
  type IncomeWorkspace,
} from './income-types'
import './income.css'
const currencies = [
  { value: 'CNY', label: '人民币 CNY' },
  { value: 'USD', label: '美元 USD' },
  { value: 'EUR', label: '欧元 EUR' },
  { value: 'HKD', label: '港币 HKD' },
  { value: 'JPY', label: '日元 JPY' },
  { value: 'GBP', label: '英镑 GBP' },
  { value: 'SGD', label: '新加坡元 SGD' },
  { value: 'AUD', label: '澳元 AUD' },
]
export function IncomeWorkspacePage() {
  const { projectId } = useParams(),
    [params, setParams] = useIncomeSearchParams(),
    period = params.get('period') ?? actualToday().slice(0, 7),
    currency = params.get('currency') ?? 'CNY',
    query = useBusinessQuery<IncomeWorkspace>(
      projectId
        ? `/api/projects/${projectId}/income-workspace?period=${encodeURIComponent(period)}&currency=${encodeURIComponent(currency)}`
        : undefined,
    ),
    project = useBusinessQuery<ProjectDetail>(
      projectId ? `/api/projects/${projectId}` : undefined,
    ),
    fileQuery = useBusinessQuery<FileWorkspace>(
      project.data?.allowedActions.includes('FILE_READ')
        ? `/api/projects/${projectId}/files`
        : undefined,
    ),
    [command, setCommand] = useState<Command | null>(null),
    [editor, setEditor] = useState<{
      row?: IncomeRow
      mode: 'CREATE' | 'EDIT' | 'REVERSE' | 'CORRECT'
    } | null>(null),
    [forecastEditor, setForecastEditor] = useState<{
      reference?: IncomeRow
    } | null>(null),
    data = query.data
  function update(key: string, value?: string) {
    setParams(
      (previous) => {
        const p = new URLSearchParams(previous)
        if (value) p.set(key, value)
        else p.delete(key)
        if (!['page', 'income', 'revision', 'history'].includes(key))
          p.delete('page')
        return p
      },
      { replace: true },
    )
  }
  function changeWindow(key: string, value: string) {
    setParams(
      (previous) => {
        const p = new URLSearchParams()
        p.set(
          'period',
          key === 'period' ? value : (previous.get('period') ?? period),
        )
        p.set(
          'currency',
          key === 'currency' ? value : (previous.get('currency') ?? currency),
        )
        return p
      },
      { replace: true },
    )
  }
  function openIncome(id: string) {
    update('income', id)
  }
  const rows = data?.incomes.filter((r) => matchesIncome(r, params)) ?? [],
    current = data?.book?.revisions.find(
      (r) => r.id === data.book?.currentRevisionId,
    ),
    draft = data?.book?.revisions.find(
      (r) => r.id === data.book?.draftRevisionId,
    ),
    mine =
      data?.incomes.filter((i) => i.allowedActions.includes('CONFIRM')) ?? [],
    pending = data?.incomes.filter((i) => i.status === 'SUBMITTED') ?? [],
    review = mine.length ? mine : pending,
    canForecast = data?.allowedActions.includes('FINANCE_FORECAST_EDIT'),
    canSubmit = data?.allowedActions.includes('FINANCE_INCOME_SUBMIT'),
    sources =
      data?.incomes.filter(
        (i) =>
          i.kind === 'INCOME' &&
          (i.status === 'SUBMITTED' ||
            current?.lines.some((line) => line.incomeReference?.id === i.id)),
      ) ?? [],
    selectedRevision = data?.book?.revisions.find(
      (r) => r.id === params.get('revision'),
    ),
    page = Math.max(1, Number(params.get('page')) || 1),
    size = [10, 20, 50].includes(Number(params.get('size')))
      ? Number(params.get('size'))
      : 10,
    filesLoading =
      project.isPending ||
      (project.data?.allowedActions.includes('FILE_READ')
        ? fileQuery.isPending || fileQuery.isError
        : false)
  function forecastAction(action: 'PUBLISH' | 'DISCARD') {
    if (!data?.book || !draft) return
    setCommand({
      title:
        action === 'PUBLISH'
          ? `发布 V${draft.number} 收入预测`
          : `放弃 V${draft.number} 草案`,
      path: `/api/projects/${projectId}/income-forecasts/${data.book.id}/commands`,
      values: {
        bookVersion: data.book.version,
        draftVersion: draft.version,
        action,
      },
      content:
        action === 'PUBLISH' ? (
          <PublishPreview draft={draft} previous={current} />
        ) : (
          <Alert
            type="warning"
            title="放弃后仍保留该草案历史，当前已发布预测继续有效。"
          />
        ),
      fields: [
        {
          name: 'reason',
          label: action === 'PUBLISH' ? '发布依据与调整原因' : '放弃原因',
          type: 'textarea',
        },
      ],
      submitLabel: incomeLabel(action),
    })
  }
  function incomeAction(row: IncomeRow, action: string) {
    if (['EDIT', 'REVERSE', 'CORRECT'].includes(action)) {
      setEditor({ row, mode: action as 'EDIT' | 'REVERSE' | 'CORRECT' })
      return
    }
    setCommand({
      title: `${incomeLabel(action)} · ${row.title}`,
      path: `/api/projects/${projectId}/incomes/${row.id}/commands`,
      values: { version: row.version, action },
      content: (
        <>
          <Alert
            type={action === 'CONFIRM' ? 'info' : 'warning'}
            showIcon
            title={`${row.kind === 'REVERSAL' ? '-' : ''}${money(row.amount)} ${row.currency} · ${row.occurredOn}`}
            description={
              action === 'CONFIRM'
                ? '请核对当轮来源、金额、日期和依据资料。确认后正文不能直接改写。'
                : '操作将保留当前轮次及其依据。'
            }
          />
          <IncomeSource source={row.source} />
          <EvidenceFiles {...row.files} />
        </>
      ),
      fields: [
        { name: 'reason', label: '本次处理依据与说明', type: 'textarea' },
      ],
      submitLabel: incomeLabel(action),
    })
  }
  return (
    <BusinessPage className="income-page">
      <QueryState query={query}>
        {data && (
          <>
            <PageHeading
              title="经营预测与收入"
              description={`${data.projectName} · 资金计划`}
              extra={
                <>
                  <RefreshButton onClick={query.refetch} />
                  {canForecast && (
                    <Button onClick={() => setForecastEditor({})}>
                      编辑预测
                    </Button>
                  )}
                  {canSubmit && (
                    <Button
                      type="primary"
                      icon={<Plus size={16} />}
                      onClick={() => setEditor({ mode: 'CREATE' })}
                    >
                      新增收入
                    </Button>
                  )}
                </>
              }
            />
            <div className="income-context-bar">
              <Input
                type="month"
                aria-label="预测月份"
                value={period}
                onChange={(e) => {
                  if (e.target.value) changeWindow('period', e.target.value)
                }}
              />
              <Select
                aria-label="收入币种"
                value={currency}
                options={currencies}
                onChange={(v) => changeWindow('currency', v)}
              />
              <Tag>项目管理口径</Tag>
              <Tag color={current ? 'green' : 'default'}>
                {current
                  ? `当前预测 V${current.number} · 已发布`
                  : '尚未发布预测'}
              </Tag>
              {draft && <Tag color="blue">V{draft.number} 草案未生效</Tag>}
              <Link to={`/projects/${projectId}?tab=budget`}>
                <ArrowLeft size={13} />
                项目资金入口
              </Link>
            </div>
            <div className="income-layout">
              <main className="income-main">
                <div className="income-facts">
                  <Facts
                    items={[
                      {
                        label: '已发布计划收入',
                        value: money(data.totals.planned),
                        note: `${currency} · 元`,
                      },
                      {
                        label: '已确认净收入',
                        value: money(data.totals.confirmedNet),
                        note: '含本月已确认冲销',
                      },
                      {
                        label: '待确认正向收入',
                        value: money(data.totals.pendingIncome),
                        note: '独立确认后计入',
                      },
                      {
                        label: '待冲销金额',
                        value: money(data.totals.pendingReversal),
                        note: '未从净收入扣减',
                      },
                    ]}
                  />
                </div>
                <Panel className="income-ledger-panel business-panel--table">
                  <Tabs
                    activeKey={params.get('view') ?? 'ledger'}
                    onChange={(v) => update('view', v)}
                    items={[
                      {
                        key: 'ledger',
                        label: `收入台账 · ${data.totals.count}`,
                        children: (
                          <>
                            <div className="income-filters">
                              <Input.Search
                                size="small"
                                aria-label="搜索收入事项或来源"
                                placeholder="搜索收入事项、来源、说明…"
                                value={params.get('q') ?? ''}
                                onChange={(e) => update('q', e.target.value)}
                                allowClear
                              />
                              <Select
                                size="small"
                                aria-label="收入状态"
                                allowClear
                                placeholder="全部状态"
                                value={params.get('status') ?? undefined}
                                options={[
                                  'DRAFT',
                                  'SUBMITTED',
                                  'RETURNED',
                                  'CONFIRMED',
                                  'CANCELLED',
                                ].map((value) => ({
                                  value,
                                  label: incomeLabel(value),
                                }))}
                                onChange={(v) => update('status', v)}
                              />
                              <Select
                                size="small"
                                aria-label="收入类型"
                                allowClear
                                placeholder="全部类型"
                                value={params.get('kind') ?? undefined}
                                options={['INCOME', 'REVERSAL'].map(
                                  (value) => ({
                                    value,
                                    label: incomeLabel(value),
                                  }),
                                )}
                                onChange={(v) => update('kind', v)}
                              />
                              <Popover
                                trigger="click"
                                title="实际日期范围（含起止日期）"
                                content={
                                  <Space wrap>
                                    <Input
                                      type="date"
                                      aria-label="实际开始日期"
                                      value={params.get('from') ?? ''}
                                      onChange={(e) =>
                                        update('from', e.target.value)
                                      }
                                    />
                                    <span>至</span>
                                    <Input
                                      type="date"
                                      aria-label="实际结束日期"
                                      value={params.get('to') ?? ''}
                                      onChange={(e) =>
                                        update('to', e.target.value)
                                      }
                                    />
                                  </Space>
                                }
                              >
                                <Button size="small">
                                  {params.has('from') || params.has('to')
                                    ? '日期已筛选'
                                    : '日期'}
                                </Button>
                              </Popover>
                              <Button
                                size="small"
                                onClick={() => setParams({ period, currency })}
                              >
                                重置
                              </Button>
                            </div>

                            <Table
                              size="small"
                              rowKey="id"
                              dataSource={rows}
                              scroll={{ x: 840 }}
                              pagination={{
                                size: 'small',
                                current: page,
                                pageSize: size,
                                total: rows.length,
                                showSizeChanger: true,
                                pageSizeOptions: [10, 20, 50],
                                showTotal: (total) => `共 ${total} 项`,
                                onChange: (p, s) =>
                                  setParams(
                                    (previous) => {
                                      const next = new URLSearchParams(previous)
                                      next.set('page', String(p))
                                      next.set('size', String(s))
                                      return next
                                    },
                                    { replace: true },
                                  ),
                              }}
                              locale={{
                                emptyText: (
                                  <Empty description="当前筛选范围暂无收入记录">
                                    <span>
                                      预测可先行建立；已发生收入填写依据后独立确认。
                                    </span>
                                  </Empty>
                                ),
                              }}
                              columns={[
                                {
                                  title: '收入事项',
                                  width: 190,
                                  render: (_, r) => (
                                    <>
                                      <Button
                                        type="link"
                                        className="income-title-link"
                                        onClick={() => openIncome(r.id)}
                                      >
                                        {r.title}
                                      </Button>
                                      <span className="business-cell-sub">
                                        {r.kind === 'REVERSAL'
                                          ? '整笔冲销 · '
                                          : ''}
                                        {r.forecast
                                          ? `原预测 V${r.forecast.revisionNumber} · ${r.forecast.title}`
                                          : r.sourceNote}
                                      </span>
                                    </>
                                  ),
                                },
                                {
                                  title: '来源说明',
                                  width: 180,
                                  render: (_, r) => (
                                    <>
                                      <IncomeSource source={r.source} />
                                      {r.originalIncomeId && (
                                        <Button
                                          type="link"
                                          size="small"
                                          onClick={() =>
                                            openIncome(r.originalIncomeId!)
                                          }
                                        >
                                          查看原收入
                                        </Button>
                                      )}
                                    </>
                                  ),
                                },
                                {
                                  title: '实际日期',
                                  dataIndex: 'occurredOn',
                                  width: 108,
                                },
                                {
                                  title: '金额（元）',
                                  width: 135,
                                  align: 'right',
                                  render: (_, r) => (
                                    <strong
                                      className={
                                        r.kind === 'REVERSAL'
                                          ? 'income-negative'
                                          : ''
                                      }
                                    >
                                      {r.kind === 'REVERSAL' ? '-' : ''}
                                      {money(r.amount)}
                                    </strong>
                                  ),
                                },
                                {
                                  title: '提交 / 确认',
                                  width: 124,
                                  render: (_, r) => (
                                    <>
                                      <span
                                        className="income-person"
                                        title={r.submitterName ?? r.ownerName}
                                      >
                                        {r.submitterName ?? r.ownerName}
                                      </span>
                                      <span
                                        className="business-cell-sub income-person"
                                        title={r.confirmerName}
                                      >
                                        {r.confirmerName}
                                      </span>
                                    </>
                                  ),
                                },
                                {
                                  title: '状态',
                                  width: 118,
                                  render: (_, r) => (
                                    <IncomeStatus
                                      status={r.status}
                                      reversed={r.reversed}
                                    />
                                  ),
                                },
                                {
                                  title: '操作',
                                  width: 65,
                                  render: (_, r) => (
                                    <Button
                                      type="link"
                                      size="small"
                                      onClick={() => openIncome(r.id)}
                                    >
                                      查看
                                    </Button>
                                  ),
                                },
                              ]}
                            />
                          </>
                        ),
                      },
                      {
                        key: 'forecast',
                        label: '预测与节点',
                        children: current ? (
                          <ForecastLines
                            lines={current.lines}
                            onIncome={openIncome}
                          />
                        ) : (
                          <Empty description="尚无已发布预测">
                            {canForecast && (
                              <Button onClick={() => setForecastEditor({})}>
                                建立首版预测
                              </Button>
                            )}
                          </Empty>
                        ),
                      },
                    ]}
                  />
                </Panel>
                <Panel
                  title="预测版本"
                  className="income-revisions-panel business-panel--table"
                  extra={
                    <Space>
                      {draft && canForecast && (
                        <>
                          <Button
                            size="small"
                            onClick={() => forecastAction('DISCARD')}
                          >
                            放弃草案
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => forecastAction('PUBLISH')}
                          >
                            发布 V{draft.number}
                          </Button>
                        </>
                      )}
                      <Button
                        type="link"
                        size="small"
                        disabled={!data.book}
                        onClick={() => update('history', 'forecast')}
                      >
                        完整版本历史 →
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: 730 }}
                    dataSource={data.book?.revisions ?? []}
                    columns={[
                      {
                        title: '版本',
                        width: 65,
                        render: (_, r) => (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => update('revision', r.id)}
                          >
                            V{r.number}
                          </Button>
                        ),
                      },
                      {
                        title: '计划收入（元）',
                        width: 145,
                        align: 'right',
                        render: (_, r) => money(r.total),
                      },
                      {
                        title: '更新时间',
                        width: 155,
                        render: (_, r) =>
                          dateTime(r.publishedAt ?? r.updatedAt),
                      },
                      {
                        title: '更新人',
                        width: 110,
                        render: (_, r) => r.publishedByName ?? r.editedByName,
                      },
                      { title: '调整原因', dataIndex: 'reason' },
                      {
                        title: '状态',
                        width: 112,
                        render: (_, r) => (
                          <Tag
                            color={
                              r.id === current?.id
                                ? 'green'
                                : r.status === 'DRAFT'
                                  ? 'blue'
                                  : undefined
                            }
                          >
                            {r.id === current?.id
                              ? '当前有效'
                              : r.status === 'PUBLISHED'
                                ? '历史版本'
                                : incomeLabel(r.status)}
                          </Tag>
                        ),
                      },
                      {
                        title: '操作',
                        width: 65,
                        render: (_, r) => (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => update('revision', r.id)}
                          >
                            查看
                          </Button>
                        ),
                      },
                    ]}
                  />
                </Panel>
              </main>
              <aside className="income-rail">
                <Panel
                  title={`${mine.length ? '本人待确认' : '待确认收入'}（${review.length}）`}
                  subtitle="确认后才进入已确认净收入"
                  className="income-review-panel"
                >
                  {review.length ? (
                    review.slice(0, 3).map((r) => (
                      <article className="income-review-card" key={r.id}>
                        <div className="income-card-title">
                          <Button type="link" onClick={() => openIncome(r.id)}>
                            {r.title}
                          </Button>
                          <strong>
                            {r.kind === 'REVERSAL' ? '-' : ''}
                            {money(r.amount)}
                            <small> 元</small>
                          </strong>
                        </div>
                        <p>
                          <ShieldCheck size={14} />
                          指定确认 · {r.confirmerName}
                        </p>
                        <p>
                          <FileText size={14} />
                          {r.submitterName}
                          <time>{r.occurredOn}</time>
                        </p>
                        <IncomeSource source={r.source} />
                        <Button
                          block
                          size="small"
                          type={
                            r.allowedActions.includes('CONFIRM')
                              ? 'primary'
                              : 'default'
                          }
                          onClick={() => openIncome(r.id)}
                        >
                          {r.allowedActions.includes('CONFIRM')
                            ? '核对依据并处理'
                            : '查看当轮依据'}{' '}
                          <ArrowUpRight size={13} />
                        </Button>
                      </article>
                    ))
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="本月暂无待确认记录"
                    />
                  )}
                  {review.length > 3 && (
                    <Button
                      block
                      type="link"
                      onClick={() => update('status', 'SUBMITTED')}
                    >
                      查看全部 {review.length} 项待确认
                    </Button>
                  )}
                </Panel>
                <Panel
                  title="计划更新来源"
                  subtitle="待确认收入可供财务修订预测时参考"
                  className="income-source-panel"
                >
                  {sources.length ? (
                    sources.slice(0, 3).map((r) => (
                      <article className="income-source-card" key={r.id}>
                        <FileText size={20} />
                        <div>
                          <Button type="link" onClick={() => openIncome(r.id)}>
                            {r.title}
                          </Button>
                          <span>
                            {money(r.amount)} {currency} ·{' '}
                            {incomeLabel(r.status)}
                          </span>
                          {!canForecast && (
                            <small>
                              {current?.lines.some(
                                (l) => l.incomeReference?.id === r.id,
                              )
                                ? '当前已发布预测已引用'
                                : '尚未纳入当前已发布预测'}
                            </small>
                          )}
                          {canForecast && (
                            <Button
                              type="link"
                              size="small"
                              onClick={() =>
                                setForecastEditor({ reference: r })
                              }
                            >
                              {current?.lines.some(
                                (l) => l.incomeReference?.id === r.id,
                              )
                                ? '已引用 · 更新预测依据'
                                : '作为预测更新依据'}{' '}
                              →
                            </Button>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="income-muted">
                      先填写并提交实际收入，财务岗位可据此人工核对本月计划。
                    </p>
                  )}
                  <Alert
                    type="info"
                    showIcon
                    title="引用仅作为参考，编辑并发布后才更新计划收入。"
                  />
                </Panel>
              </aside>
            </div>
            <p className="income-footnote">
              项目管理口径，未经财务系统核对。不同币种分别汇总；此处不表示现金回款或开票事实。
            </p>
            {params.get('income') && (
              <IncomeDetailDrawer
                projectId={data.projectId}
                id={params.get('income')!}
                onClose={() => update('income')}
                onAction={incomeAction}
                onIncome={openIncome}
                onForecast={(f) => {
                  setParams({
                    period: f.lines[0]?.plannedOn.slice(0, 7) ?? period,
                    currency,
                    revision: f.id,
                  })
                }}
                onReference={
                  canForecast
                    ? (r) => setForecastEditor({ reference: r })
                    : undefined
                }
                onForecastReference={(r) =>
                  setParams({
                    period: r.forecast!.plannedOn.slice(0, 7),
                    currency: r.currency,
                    revision: r.forecast!.revisionId,
                  })
                }
              />
            )}
            {selectedRevision && (
              <Drawer
                open
                size={1040}
                className="income-editor"
                title={`预测 V${selectedRevision.number} · ${period} · ${currency}`}
                onClose={() => update('revision')}
              >
                <p>{selectedRevision.reason}</p>
                <ForecastLines
                  lines={selectedRevision.lines}
                  onIncome={openIncome}
                />
                <ForecastComparison
                  revision={selectedRevision}
                  previous={
                    data.book?.revisions
                      .filter(
                        (r) =>
                          r.status === 'PUBLISHED' &&
                          r.number < selectedRevision.number,
                      )
                      .sort((a, b) => b.number - a.number)[0]
                  }
                />
              </Drawer>
            )}
            {params.get('history') === 'forecast' && data.book && (
              <ForecastHistoryDrawer
                projectId={data.projectId}
                bookId={data.book.id}
                onClose={() => update('history')}
              />
            )}
            {editor && (
              <IncomeEditor
                key={`${editor.mode}:${editor.row?.id ?? 'new'}`}
                data={data}
                files={fileQuery.data}
                filesLoading={!!filesLoading}
                {...editor}
                onClose={() => setEditor(null)}
                onSaved={(r) =>
                  setParams({
                    period: r.occurredOn.slice(0, 7),
                    currency: r.currency,
                    income: r.id,
                  })
                }
              />
            )}
            {forecastEditor && (
              <ForecastEditor
                key={forecastEditor.reference?.id ?? 'forecast'}
                data={data}
                files={fileQuery.data}
                filesLoading={!!filesLoading}
                reference={forecastEditor.reference}
                onClose={() => setForecastEditor(null)}
              />
            )}
          </>
        )}
      </QueryState>
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </BusinessPage>
  )
}
function IncomeDetailDrawer({
  projectId,
  id,
  onClose,
  onAction,
  onIncome,
  onReference,
  onForecastReference,
}: {
  projectId: string
  id: string
  onClose: () => void
  onAction: (row: IncomeRow, action: string) => void
  onIncome: (id: string) => void
  onReference?: (row: IncomeRow) => void
  onForecastReference: (row: IncomeRow) => void
  onForecast?: (r: ForecastRevision) => void
}) {
  const query = useBusinessQuery<IncomeDetail>(
      `/api/projects/${projectId}/incomes/${id}`,
    ),
    r = query.data?.income
  return (
    <Drawer
      open
      size={940}
      className="income-detail income-editor"
      title={r?.title ?? '收入详情'}
      onClose={onClose}
      footer={
        r && (
          <Space wrap>
            {r.allowedActions.map((action) => (
              <Button
                key={action}
                type={
                  action === 'CONFIRM' || action === 'SUBMIT'
                    ? 'primary'
                    : 'default'
                }
                danger={action === 'CANCEL'}
                onClick={() => onAction(r, action)}
              >
                {incomeLabel(action)}
              </Button>
            ))}
          </Space>
        )
      }
    >
      <QueryState query={query}>
        {r && (
          <>
            <div className="income-detail-facts">
              <strong>
                {r.kind === 'REVERSAL' ? '-' : ''}
                {money(r.amount)} <small>{r.currency} · 元</small>
              </strong>
              <IncomeStatus status={r.status} reversed={r.reversed} />
            </div>
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              items={[
                { key: 'date', label: '实际发生', children: r.occurredOn },
                { key: 'owner', label: '当前填报', children: r.ownerName },
                {
                  key: 'submitter',
                  label: '当轮提交人',
                  children: r.submitterName ?? '尚未提交',
                },
                {
                  key: 'confirmer',
                  label: '指定确认人',
                  children: r.confirmerName,
                },
                {
                  key: 'source',
                  label: '来源合同',
                  children: <IncomeSource source={r.source} />,
                  span: 'filled',
                },
                {
                  key: 'note',
                  label: '实际依据',
                  children: r.sourceNote,
                  span: 'filled',
                },
                {
                  key: 'forecast',
                  label: '原预测版本',
                  children: r.forecast ? (
                    <Button type="link" onClick={() => onForecastReference(r)}>
                      V{r.forecast.revisionNumber} · {r.forecast.title} ·{' '}
                      {money(r.forecast.amount)}
                    </Button>
                  ) : (
                    r.unplannedReason
                  ),
                  span: 'filled',
                },
                {
                  key: 'original',
                  label: r.kind === 'REVERSAL' ? '冲销原收入' : '关联原收入',
                  children: r.originalIncomeId ? (
                    <Button
                      type="link"
                      onClick={() => onIncome(r.originalIncomeId!)}
                    >
                      查看原收入记录
                    </Button>
                  ) : (
                    '—'
                  ),
                },
                {
                  key: 'confirmed',
                  label: '实际确认',
                  children: r.confirmedAt
                    ? `${r.confirmedByName} · ${dateTime(r.confirmedAt)}`
                    : '尚未确认',
                },
              ]}
            />
            <section className="income-detail-section">
              <h3>当轮依据资料</h3>
              <EvidenceFiles {...r.files} />
              {!r.files.files.length && !r.files.restricted && (
                <p className="income-muted">本轮使用已填写的文字依据。</p>
              )}
            </section>
            {onReference &&
              r.kind === 'INCOME' &&
              ['SUBMITTED', 'CONFIRMED'].includes(r.status) && (
                <Button onClick={() => onReference(r)}>作为预测更新依据</Button>
              )}
            <section className="income-detail-section">
              <h3>处理历史与原始依据</h3>
              <IncomeHistory events={query.data?.history ?? []} />
            </section>
          </>
        )}
      </QueryState>
    </Drawer>
  )
}
function ForecastHistoryDrawer({
  projectId,
  bookId,
  onClose,
}: {
  projectId: string
  bookId: string
  onClose: () => void
}) {
  const query = useBusinessQuery<IncomeEvent[]>(
    `/api/projects/${projectId}/income-forecasts/${bookId}/history`,
  )
  return (
    <Drawer
      open
      size={1120}
      title="预测完整版本历史"
      className="income-editor"
      onClose={onClose}
    >
      <QueryState query={query}>
        <IncomeHistory events={query.data ?? []} />
      </QueryState>
    </Drawer>
  )
}
