import { useRef, useState, type ReactNode } from 'react'
import { Alert, App, Button, Drawer, Form, Input, Select, Space } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import {
  getProblemMessage,
  HttpError,
  patchJson,
  postJson,
} from '@/api/client/http'
import { actualToday } from '@/features/execution/execution-types'
import type { FileWorkspace } from '@/features/files/file-types'
import { ForecastComparison } from './income-ui'
import {
  money,
  type ForecastLine,
  type ForecastRevision,
  type IncomeDetail,
  type IncomeRow,
  type IncomeWorkspace,
} from './income-types'

const required = [{ required: true, message: '请填写此项' }]
const moneyRules = [
  ...required,
  {
    pattern: /^\d+(\.\d{1,2})?$/,
    message: '请输入大于零、最多两位小数的金额；不会自动舍入。',
  },
]
const key = (
  id: string | null | undefined,
  version: number | null | undefined,
) => (id ? `${id}:${version}` : undefined)
function parseKey(value?: string) {
  if (!value) return null
  const [id, version] = value.split(':')
  return { id, version: Number(version) }
}
function sourcePayload(contractKey?: string, nodeKey?: string) {
  const c = parseKey(contractKey),
    n = parseKey(nodeKey)
  return c
    ? {
        contractId: c.id,
        contractVersion: c.version,
        nodeId: n?.id ?? null,
        nodeVersion: n?.version ?? null,
      }
    : null
}
function useSave(
  path: string,
  method: 'POST' | 'PATCH',
  onClose: () => void,
  onSuccess?: (result: unknown) => void,
) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<unknown>(),
    intent = useRef({ id: crypto.randomUUID(), body: '' }),
    cache = useQueryClient(),
    { message } = App.useApp()
  async function save(payload: object) {
    setSaving(true)
    setError(undefined)
    const body = JSON.stringify(payload)
    if (intent.current.body && intent.current.body !== body)
      intent.current.id = crypto.randomUUID()
    intent.current.body = body
    try {
      const result = await (method === 'PATCH' ? patchJson : postJson)(
        path,
        { ...payload, requestId: intent.current.id },
        { headers: { 'Idempotency-Key': intent.current.id } },
      )
      await cache.invalidateQueries({ queryKey: ['business'] })
      message.success('已保存')
      onSuccess?.(result)
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }
  return { save, saving, error }
}
function SaveError({ error }: { error: unknown }) {
  return error ? (
    <Alert
      type="error"
      showIcon
      title={getProblemMessage(error)}
      description={
        error instanceof HttpError && error.status === 409
          ? '输入已保留。请重新打开最新版本核对后办理，不会覆盖其他人的修改。'
          : undefined
      }
    />
  ) : null
}
function EditorFrame({
  title,
  onClose,
  saving,
  onSubmit,
  blocked,
  children,
}: {
  title: string
  onClose: () => void
  saving: boolean
  onSubmit: () => void
  blocked: boolean
  children: ReactNode
}) {
  return (
    <Drawer
      open
      size={940}
      title={title}
      className="income-editor business-drawer"
      maskClosable={false}
      onClose={() => {
        if (!saving) onClose()
      }}
      footer={
        <div className="business-drawer-footer">
          <span>保存草案后仍需单独提交或发布</span>
          <Space>
            <Button disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button
              type="primary"
              disabled={blocked}
              loading={saving}
              onClick={onSubmit}
            >
              保存草案
            </Button>
          </Space>
        </div>
      }
    >
      {children}
    </Drawer>
  )
}
function SourceFields({
  data,
  prefix = [],
  old,
}: {
  data: IncomeWorkspace
  prefix?: (string | number)[]
  old?: ForecastLine['source']
}) {
  const form = Form.useFormInstance(),
    contractKey = Form.useWatch([...prefix, 'contractKey'], form) as
      string | undefined,
    selected = parseKey(contractKey),
    prior = old?.value
  const contracts = data.contracts.map((c) => ({
    value: key(c.id, c.version)!,
    label: `${c.number} · ${c.title} · 版本 ${c.version}`,
  }))
  if (
    prior &&
    !contracts.some(
      (c) => c.value === key(prior.contractId, prior.contractVersion),
    )
  )
    contracts.push({
      value: key(prior.contractId, prior.contractVersion)!,
      label: `${prior.contractNumber} · 原版本 ${prior.contractVersion}（请核对当前版本）`,
    })
  const nodes = data.contractNodes
    .filter((n) => n.contractId === selected?.id)
    .map((n) => ({
      value: key(n.id, n.version)!,
      label: `${n.title} · 版本 ${n.version}`,
    }))
  if (
    prior?.nodeId &&
    !nodes.some((n) => n.value === key(prior.nodeId, prior.nodeVersion))
  )
    nodes.push({
      value: key(prior.nodeId, prior.nodeVersion)!,
      label: `${prior.nodeTitle} · 原节点版本 ${prior.nodeVersion}（请核对）`,
    })
  return (
    <>
      <Form.Item
        name={[...prefix, 'contractKey']}
        label="来源合同"
        extra="选择同项目已归档合同；保留所选版本。"
      >
        <Select
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          options={contracts}
          placeholder="无合同则填写明确的其他依据"
          onChange={() => form.setFieldValue([...prefix, 'nodeKey'], undefined)}
        />
      </Form.Item>
      <Form.Item name={[...prefix, 'nodeKey']} label="合同经营节点">
        <Select
          allowClear
          disabled={!selected}
          showSearch={{ optionFilterProp: 'label' }}
          options={nodes}
          placeholder="按实际来源选择"
        />
      </Form.Item>
    </>
  )
}
function FileField({
  data,
  prefix = [],
  existing = [],
}: {
  data?: FileWorkspace
  prefix?: (string | number)[]
  existing?: IncomeRow['files']['files']
}) {
  const options = (data?.items ?? [])
    .filter(
      (d) =>
        d.latestVersion.status === 'PUBLISHED' &&
        d.currentVersionId === d.latestVersion.id,
    )
    .map((d) => ({
      value: d.latestVersion.id,
      label: `${d.title} · V${d.latestVersion.versionNumber}`,
    }))
  for (const f of existing)
    if (!options.some((o) => o.value === f.versionId))
      options.push({
        value: f.versionId,
        label: `${f.title} · 原依据 V${f.versionNumber}`,
      })
  return (
    <Form.Item
      name={[...prefix, 'fileVersionIds']}
      label="已发布依据资料"
      className="income-wide"
      extra="最多20项；保留原文件版本。新资料在项目资料入口上传并发布。"
    >
      <Select
        mode="multiple"
        allowClear
        showSearch={{ optionFilterProp: 'label' }}
        options={options}
        placeholder={
          options.length
            ? '选择已发布资料'
            : '暂无可选的已发布资料，可填写文字依据'
        }
      />
    </Form.Item>
  )
}
type IncomeValues = {
  title: string
  amount: string
  occurredOn: string
  sourceNote: string
  contractKey?: string
  nodeKey?: string
  forecastKey?: string
  unplannedReason?: string
  confirmerId: string
  fileVersionIds: string[]
  reason: string
}
export function IncomeEditor({
  data,
  files,
  filesLoading,
  row,
  mode = 'CREATE',
  onClose,
  onSaved,
}: {
  data: IncomeWorkspace
  files?: FileWorkspace
  filesLoading: boolean
  row?: IncomeRow
  mode?: 'CREATE' | 'EDIT' | 'REVERSE' | 'CORRECT'
  onClose: () => void
  onSaved: (row: IncomeRow) => void
}) {
  const edit = mode === 'EDIT',
    reversal = mode === 'REVERSE' || (edit && row?.kind === 'REVERSAL'),
    [form] = Form.useForm<IncomeValues>(),
    mutation = useSave(
      `/api/projects/${data.projectId}/incomes${edit ? `/${row!.id}` : ''}`,
      edit ? 'PATCH' : 'POST',
      onClose,
      (r) => onSaved((r as IncomeDetail).income),
    ),
    forecastKey = Form.useWatch('forecastKey', form),
    blocked =
      filesLoading ||
      (edit && !!row && (row.source.restricted || row.files.restricted > 0)),
    forecastOptions = (data.book?.revisions ?? [])
      .filter((r) => r.status === 'PUBLISHED')
      .flatMap((r) =>
        r.lines.map((l) => ({
          value: `${r.id}:${l.id}`,
          label: `V${r.number} · ${l.title} · ${money(l.amount)}`,
        })),
      )
  if (
    edit &&
    row?.forecast &&
    !forecastOptions.some(
      (o) => o.value === `${row.forecast!.revisionId}:${row.forecast!.lineId}`,
    )
  )
    forecastOptions.push({
      value: `${row.forecast.revisionId}:${row.forecast.lineId}`,
      label: `原预测 V${row.forecast.revisionNumber} · ${row.forecast.title}`,
    })
  const confirmerOptions = data.confirmers.map((p) => ({
    value: p.id,
    label: p.name,
  }))
  if (edit && row && !confirmerOptions.some((p) => p.value === row.confirmerId))
    confirmerOptions.push({
      value: row.confirmerId,
      label: `${row.confirmerName}（提交时重新核对资格）`,
    })
  async function save(v: IncomeValues) {
    const [forecastRevisionId, forecastLineId] = v.forecastKey?.split(':') ?? []
    await mutation.save({
      version: edit ? row!.version : null,
      kind: reversal ? 'REVERSAL' : 'INCOME',
      title: v.title,
      amount: v.amount,
      currency: edit || reversal ? row!.currency : data.currency,
      occurredOn: v.occurredOn,
      sourceNote: v.sourceNote,
      source: sourcePayload(v.contractKey, v.nodeKey),
      forecastRevisionId: forecastRevisionId ?? null,
      forecastLineId: forecastLineId ?? null,
      unplannedReason: v.unplannedReason,
      originalIncomeId: edit
        ? row!.originalIncomeId
        : mode === 'REVERSE' || mode === 'CORRECT'
          ? row!.id
          : null,
      confirmerId: v.confirmerId,
      fileVersionIds: v.fileVersionIds,
      reason: v.reason,
    })
  }
  return (
    <EditorFrame
      title={
        edit
          ? '修改收入草案'
          : reversal
            ? '申请整笔冲销'
            : mode === 'CORRECT'
              ? '新增更正收入'
              : '新增实际收入'
      }
      onClose={onClose}
      saving={mutation.saving}
      onSubmit={() => form.submit()}
      blocked={blocked}
    >
      <Alert
        type={reversal ? 'warning' : 'info'}
        showIcon
        title={
          reversal
            ? `整笔冲销 ${row!.title} · ${money(row!.amount)} ${row!.currency}`
            : '保存后提交指定营销人员独立确认'
        }
        description={
          reversal
            ? '原收入及原确认记录保留；本申请确认后，按冲销实际月份计算负向金额。'
            : '此处记录已发生的收入；预测发布、文件上传均不会自动确认。'
        }
      />
      {blocked && (
        <Alert
          type="warning"
          title={
            filesLoading
              ? '正在读取可选依据资料…'
              : '部分原依据受限，请取得查看权限后再修改，以免丢失原引用。'
          }
        />
      )}
      <SaveError error={mutation.error} />
      <Form
        form={form}
        layout="vertical"
        disabled={mutation.saving}
        requiredMark="optional"
        onFinish={save}
        initialValues={{
          title: edit
            ? row?.title
            : reversal
              ? `冲销 · ${row?.title}`
              : mode === 'CORRECT'
                ? `更正 · ${row?.title}`
                : undefined,
          amount: edit || reversal ? row?.amount : undefined,
          occurredOn: edit ? row?.occurredOn : actualToday(),
          sourceNote: edit ? row?.sourceNote : undefined,
          contractKey: edit
            ? key(
                row?.source.value?.contractId,
                row?.source.value?.contractVersion,
              )
            : undefined,
          nodeKey: edit
            ? key(row?.source.value?.nodeId, row?.source.value?.nodeVersion)
            : undefined,
          forecastKey:
            edit && row?.forecast
              ? `${row.forecast.revisionId}:${row.forecast.lineId}`
              : undefined,
          unplannedReason: edit ? row?.unplannedReason : undefined,
          confirmerId: row?.confirmerId,
          fileVersionIds: edit ? row?.files.files.map((f) => f.versionId) : [],
        }}
      >
        <div className="income-form-grid">
          <Form.Item
            name="title"
            label="收入事项"
            rules={required}
            className="income-wide"
          >
            <Input maxLength={160} />
          </Form.Item>
          <Form.Item
            name="amount"
            label={`金额（${edit || reversal ? row!.currency : data.currency} · 元）`}
            rules={moneyRules}
          >
            <Input inputMode="decimal" disabled={reversal} maxLength={15} />
          </Form.Item>
          <Form.Item name="occurredOn" label="实际发生日期" rules={required}>
            <Input type="date" max={actualToday()} />
          </Form.Item>
          <SourceFields data={data} old={edit ? row?.source : undefined} />
          <Form.Item
            name="sourceNote"
            label="实际收入依据"
            rules={required}
            className="income-wide"
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              maxLength={4000}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="forecastKey"
            label="引用已发布预测节点"
            className="income-wide"
          >
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              options={forecastOptions}
              placeholder="可引用当前月份的已发布版本，或说明未按预测的原因"
            />
          </Form.Item>
          <Form.Item
            name="unplannedReason"
            label="未按预测填报的说明"
            rules={forecastKey ? [] : required}
            className="income-wide"
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 5 }}
              maxLength={4000}
            />
          </Form.Item>
          <Form.Item
            name="confirmerId"
            label="指定营销确认人"
            rules={required}
            className="income-wide"
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              options={confirmerOptions}
              placeholder="选择与本轮提交人不同的有权限成员"
            />
          </Form.Item>
          <FileField data={files} existing={edit ? row?.files.files : []} />
          <Form.Item
            name="reason"
            label="本次填报 / 修改原因"
            rules={required}
            className="income-wide"
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={4000}
            />
          </Form.Item>
        </div>
      </Form>
    </EditorFrame>
  )
}
type LineValues = {
  id: string
  title: string
  amount: string
  plannedOn: string
  contractKey?: string
  nodeKey?: string
  sourceNote: string
  incomeKey?: string
  fileVersionIds: string[]
}
function lineValues(l: ForecastLine): LineValues {
  return {
    id: l.id,
    title: l.title,
    amount: l.amount,
    plannedOn: l.plannedOn,
    contractKey: key(
      l.source.value?.contractId,
      l.source.value?.contractVersion,
    ),
    nodeKey: key(l.source.value?.nodeId, l.source.value?.nodeVersion),
    sourceNote: l.sourceNote,
    incomeKey: key(l.incomeReference?.id, l.incomeReference?.version),
    fileVersionIds: l.files.files.map((f) => f.versionId),
  }
}
function newLine(period: string): LineValues {
  return {
    id: crypto.randomUUID(),
    title: '',
    amount: '',
    plannedOn: period + '-01',
    sourceNote: '',
    fileVersionIds: [],
  }
}
export function ForecastEditor({
  data,
  files,
  filesLoading,
  reference,
  onClose,
}: {
  data: IncomeWorkspace
  files?: FileWorkspace
  filesLoading: boolean
  reference?: IncomeRow
  onClose: () => void
}) {
  const [form] = Form.useForm<{ lines: LineValues[]; reason: string }>(),
    book = data.book,
    draft = book?.revisions.find((r) => r.id === book.draftRevisionId),
    published = book?.revisions.find((r) => r.id === book.currentRevisionId),
    base = draft ?? published,
    initial =
      base?.lines.map(lineValues) ?? (reference ? [] : [newLine(data.period)]),
    mutation = useSave(
      `/api/projects/${data.projectId}/income-forecasts`,
      'POST',
      onClose,
    ),
    blocked =
      filesLoading ||
      !!base?.lines.some((l) => l.source.restricted || l.files.restricted > 0)
  if (reference) {
    const existing = initial.find((l) =>
      l.incomeKey?.startsWith(reference.id + ':'),
    )
    if (existing) existing.incomeKey = key(reference.id, reference.version)
    else
      initial.push({
        ...newLine(data.period),
        title: reference.title,
        sourceNote: `参考待确认收入：${reference.title}`,
        incomeKey: key(reference.id, reference.version),
      })
  }
  const references = data.incomes
    .filter(
      (i) =>
        i.kind === 'INCOME' && ['SUBMITTED', 'CONFIRMED'].includes(i.status),
    )
    .map((i) => ({
      value: key(i.id, i.version)!,
      label: `${i.title} · ${money(i.amount)} · ${i.status === 'SUBMITTED' ? '待确认' : '已确认'}`,
    }))
  for (const l of base?.lines ?? [])
    if (
      l.incomeReference &&
      !references.some(
        (r) =>
          r.value === key(l.incomeReference!.id, l.incomeReference!.version),
      )
    )
      references.push({
        value: key(l.incomeReference.id, l.incomeReference.version)!,
        label: `${l.incomeReference.title} · 原收入版本 ${l.incomeReference.version}（请核对）`,
      })
  async function save(v: { lines: LineValues[]; reason: string }) {
    await mutation.save({
      period: data.period,
      currency: data.currency,
      bookVersion: book?.version ?? null,
      draftVersion: draft?.version ?? null,
      reason: v.reason,
      lines: v.lines.map((l) => ({
        id: l.id,
        title: l.title,
        amount: l.amount,
        plannedOn: l.plannedOn,
        sourceType: l.contractKey ? 'CONTRACT' : 'PROJECT',
        source: sourcePayload(l.contractKey, l.nodeKey),
        sourceNote: l.sourceNote,
        incomeReference: parseKey(l.incomeKey),
        fileVersionIds: l.fileVersionIds,
      })),
    })
  }
  return (
    <EditorFrame
      title={`编辑 ${data.period} 收入预测 · ${data.currency}`}
      onClose={onClose}
      saving={mutation.saving}
      onSubmit={() => form.submit()}
      blocked={blocked}
    >
      <Alert
        type="info"
        showIcon
        title={
          draft
            ? `继续编辑 V${draft.number} 草案`
            : `建立 V${(book?.revisions[0]?.number ?? 0) + 1} 草案`
        }
        description={
          published
            ? `当前汇总继续使用已发布 V${published.number}，草案发布前不会改变计划收入。`
            : '首次预测保存后，需单独发布才进入经营汇总。'
        }
      />
      {reference && (
        <Alert
          type="info"
          title="已预填来源引用，请人工填写计划金额"
          description="引用不会自动带入金额或发布；请确认本月计划与实际情况。"
        />
      )}
      {blocked && (
        <Alert
          type="warning"
          title={
            filesLoading
              ? '正在读取依据资料…'
              : '原预测含受限依据，请取得权限后再编辑。'
          }
        />
      )}
      <SaveError error={mutation.error} />
      <Form
        form={form}
        layout="vertical"
        disabled={mutation.saving}
        requiredMark="optional"
        initialValues={{ lines: initial }}
        onFinish={save}
      >
        <Form.List
          name="lines"
          rules={[
            {
              validator: async (_, v) => {
                if (!v?.length) throw new Error('至少保留一个预测节点')
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map((field, index) => (
                <section className="income-line-editor" key={field.key}>
                  <div className="income-line-heading">
                    <strong>预测节点 {index + 1}</strong>
                    <Button
                      danger
                      type="text"
                      disabled={fields.length === 1}
                      onClick={() => remove(field.name)}
                    >
                      移除节点
                    </Button>
                  </div>
                  <Form.Item name={[field.name, 'id']} hidden>
                    <Input />
                  </Form.Item>
                  <div className="income-form-grid">
                    <Form.Item
                      name={[field.name, 'title']}
                      label="经营节点名称"
                      rules={required}
                      className="income-wide"
                    >
                      <Input maxLength={160} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'amount']}
                      label={`计划金额（${data.currency} · 元）`}
                      rules={moneyRules}
                    >
                      <Input inputMode="decimal" maxLength={15} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'plannedOn']}
                      label="计划确认日期"
                      rules={required}
                    >
                      <Input type="date" min={data.period + '-01'} />
                    </Form.Item>
                    <SourceFields
                      data={data}
                      prefix={['lines', field.name]}
                      old={
                        base?.lines.find(
                          (l) =>
                            l.id ===
                            form.getFieldValue(['lines', field.name, 'id']),
                        )?.source
                      }
                    />
                    <Form.Item
                      name={[field.name, 'sourceNote']}
                      label="计划来源与说明"
                      rules={required}
                      className="income-wide"
                    >
                      <Input.TextArea
                        autoSize={{ minRows: 2, maxRows: 5 }}
                        maxLength={4000}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'incomeKey']}
                      label="收入参考（不自动带入金额）"
                      className="income-wide"
                    >
                      <Select
                        allowClear
                        showSearch={{ optionFilterProp: 'label' }}
                        options={references}
                      />
                    </Form.Item>
                    <FileField
                      data={files}
                      prefix={['lines', field.name]}
                      existing={
                        base?.lines.find(
                          (l) =>
                            l.id ===
                            form.getFieldValue(['lines', field.name, 'id']),
                        )?.files.files
                      }
                    />
                  </div>
                </section>
              ))}
              <Form.ErrorList errors={errors} />
              <Button
                block
                type="dashed"
                disabled={fields.length >= 100}
                onClick={() => add(newLine(data.period))}
              >
                添加预测节点
              </Button>
            </>
          )}
        </Form.List>
        <Form.Item name="reason" label="预测修订原因" rules={required}>
          <Input.TextArea
            maxLength={4000}
            autoSize={{ minRows: 2, maxRows: 5 }}
          />
        </Form.Item>
      </Form>
    </EditorFrame>
  )
}
export function PublishPreview({
  draft,
  previous,
}: {
  draft: ForecastRevision
  previous?: ForecastRevision
}) {
  return (
    <>
      <Alert
        showIcon
        type="info"
        title={`发布后计划收入变为 ${money(draft.total)} 元`}
        description="本次仅切换有效预测版本，不自动确认实际收入。"
      />
      <ForecastComparison revision={draft} previous={previous} />
    </>
  )
}
