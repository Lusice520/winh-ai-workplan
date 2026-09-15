import {
  Alert,
  App,
  Button,
  ConfigProvider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Timeline,
} from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import {
  getProblemMessage,
  HttpError,
  patchJson,
  postJson,
} from '@/api/client/http'
import type { Event } from './business-types'
import { label, dateTime } from './business-data'
import './business.css'

export function Status({
  value,
  text,
}: {
  value?: string | null
  text?: string
}) {
  const color = [
    'READY',
    'REGULARIZED',
    'PUBLISHED',
    'EFFECTIVE',
    'ARCHIVED',
    'APPROVED',
    'COMPLETED',
    'DONE',
    'SUCCESS',
    'ACTIVE',
    'ON_TRACK',
  ].includes(value ?? '')
    ? 'green'
    : [
          'BLOCKED',
          'OVERDUE',
          'URGENT',
          'FAILURE',
          'REJECTED',
          'OVER_LIMIT',
          'INVALID',
        ].includes(value ?? '')
      ? 'red'
      : [
            'SUBMITTED',
            'PENDING_VERIFICATION',
            'HIGH',
            'MISSING_ACTION',
            'STALE',
            'MISSING',
            'EXPIRED',
            'ON_HOLD',
          ].includes(value ?? '')
        ? 'orange'
        : ['IN_PROGRESS', 'ASSESSED', 'IN_REVIEW'].includes(value ?? '')
          ? 'blue'
          : undefined
  return (
    <Tag color={color} className="business-status">
      {text ?? label(value)}
    </Tag>
  )
}
export function BusinessPage({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ConfigProvider
      componentSize="middle"
      theme={{
        components: {
          Table: {
            cellPaddingBlock: 10,
            cellPaddingBlockSM: 9,
            headerBg: '#f8fafc',
          },
          Form: { itemMarginBottom: 16 },
        },
      }}
    >
      <div className={`business-page ${className}`}>{children}</div>
    </ConfigProvider>
  )
}
export function PageHeading({
  title,
  description,
  extra,
}: {
  title: string
  description?: string
  extra?: ReactNode
}) {
  return (
    <header className="business-page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <Space wrap>{extra}</Space>
    </header>
  )
}
export function Panel({
  title,
  subtitle,
  extra,
  children,
  className = '',
}: {
  title?: ReactNode
  subtitle?: string
  extra?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`business-panel ${className}`}>
      {title && (
        <div className="business-panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {extra}
        </div>
      )}
      <div className="business-panel-body">{children}</div>
    </section>
  )
}
export function Facts({
  items,
}: {
  items: { label: string; value: ReactNode; note?: ReactNode }[]
}) {
  return (
    <div className="business-facts">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </div>
  )
}
export function QueryState({
  query,
  children,
}: {
  query: {
    isPending: boolean
    isError: boolean
    error: unknown
    refetch: () => unknown
  }
  children: ReactNode
}) {
  if (query.isPending)
    return (
      <Panel>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Panel>
    )
  if (query.isError)
    return (
      <Alert
        type="error"
        showIcon
        title={getProblemMessage(query.error, '读取失败，请重试。')}
        action={<Button onClick={() => void query.refetch()}>重新加载</Button>}
      />
    )
  return <>{children}</>
}
export function History({
  events,
  limit,
}: {
  events: Event[]
  limit?: number
}) {
  return events.length ? (
    <Timeline
      className="business-history"
      items={events.slice(0, limit).map((e) => ({
        key: e.id,
        content: (
          <>
            <div className="business-history-meta">
              {e.actorName}
              <time>{dateTime(e.createdAt)}</time>
            </div>
            <p>{e.description}</p>
          </>
        ),
      }))}
    />
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
  )
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button type="primary" icon={<Plus size={16} />} onClick={onClick}>
      {children}
    </Button>
  )
}
export function RefreshButton({ onClick }: { onClick: () => unknown }) {
  return (
    <Button
      icon={<RefreshCw size={15} />}
      onClick={() => void onClick()}
      aria-label="刷新数据"
      title="刷新数据"
    />
  )
}

export type Field = {
  name: string
  label: string
  type?:
    'text' | 'textarea' | 'select' | 'multiple' | 'number' | 'date' | 'switch'
  required?: boolean
  options?: { value: string; label: string }[]
  hint?: string
  wide?: boolean
  disabled?: boolean
  maxLength?: number
  min?: number
  max?: number
  step?: number
  precision?: number
}
export type Command = {
  readOnly?: boolean
  title: string
  description?: string
  path: string
  method?: 'POST' | 'PATCH'
  values?: Record<string, unknown>
  fields: Field[]
  content?: ReactNode
  formExtra?: ReactNode
  submitLabel?: string
  transform?: (values: Record<string, unknown>) => Record<string, unknown>
  onSuccess?: (result: unknown) => void
}
export function CommandDrawer({
  command,
  onClose,
}: {
  command: Command | null
  onClose: () => void
}) {
  return command ? (
    <CommandForm
      key={command.path + command.title}
      command={command}
      onClose={onClose}
    />
  ) : null
}
function CommandForm({
  command,
  onClose,
}: {
  command: Command
  onClose: () => void
}) {
  const [form] = Form.useForm<Record<string, unknown>>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>()
  const intent = useRef({ id: crypto.randomUUID(), body: '' })
  const cache = useQueryClient()
  const { message } = App.useApp()
  async function save(values: Record<string, unknown>) {
    if (command.readOnly) return
    setSaving(true)
    setError(undefined)
    const merged = { ...command.values, ...values }
    const payload = command.transform ? command.transform(merged) : merged
    const fingerprint = JSON.stringify(payload)
    if (intent.current.body && intent.current.body !== fingerprint)
      intent.current.id = crypto.randomUUID()
    intent.current.body = fingerprint
    try {
      const result = await (command.method === 'PATCH' ? patchJson : postJson)(
        command.path,
        { ...payload, requestId: intent.current.id },
        { headers: { 'Idempotency-Key': intent.current.id } },
      )
      await cache.invalidateQueries({ queryKey: ['business'] })
      message.success('已保存')
      command.onSuccess?.(result)
      onClose()
    } catch (err) {
      setError(err)
      if (err instanceof HttpError && err.problem?.fieldErrors)
        form.setFields(
          err.problem.fieldErrors.map((f) => ({
            name: f.field,
            errors: [f.message],
          })),
        )
    } finally {
      setSaving(false)
    }
  }
  return (
    <Drawer
      open
      title={command.title}
      size={660}
      onClose={() => {
        if (!saving) onClose()
      }}
      maskClosable={false}
      destroyOnHidden
      className="business-drawer"
      footer={
        <div className="business-drawer-footer">
          <span>{command.readOnly ? '只读查看' : '保存后保留操作记录'}</span>
          <Space>
            <Button disabled={saving} onClick={onClose}>
              {command.readOnly ? '关闭' : '取消'}
            </Button>
            {!command.readOnly && (
              <Button
                type="primary"
                loading={saving}
                onClick={() => form.submit()}
              >
                {command.submitLabel ?? '保存'}
              </Button>
            )}
          </Space>
        </div>
      }
    >
      {command.description && (
        <p className="business-form-intro">{command.description}</p>
      )}
      {command.content}
      {!!error && (
        <Alert
          className="business-form-error"
          type="error"
          showIcon
          title={getProblemMessage(error)}
          description={
            error instanceof HttpError && error.status === 409
              ? '填写内容已保留。请关闭表单并刷新记录，核对最新状态后再提交。'
              : undefined
          }
        />
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={command.values}
        onFinish={save}
        requiredMark="optional"
        disabled={saving}
      >
        <div className="business-form-grid">
          {command.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              extra={field.hint}
              className={
                field.wide || field.type === 'textarea'
                  ? 'business-field-wide'
                  : undefined
              }
              valuePropName={field.type === 'switch' ? 'checked' : 'value'}
              rules={
                field.required === false || field.type === 'switch'
                  ? []
                  : [
                      {
                        required: true,
                        ...(field.type === 'number'
                          ? { type: 'number' as const }
                          : field.type === 'multiple'
                            ? { type: 'array' as const }
                            : { type: 'string' as const, whitespace: true }),
                        message: `请填写${field.label}`,
                      },
                    ]
              }
            >
              {field.type === 'textarea' ? (
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  maxLength={field.maxLength ?? 4000}
                  showCount
                  disabled={field.disabled}
                />
              ) : field.type === 'select' || field.type === 'multiple' ? (
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  mode={field.type === 'multiple' ? 'multiple' : undefined}
                  allowClear={field.required === false}
                  options={field.options}
                  placeholder={`请选择${field.label}`}
                  disabled={field.disabled}
                />
              ) : field.type === 'number' ? (
                <InputNumber
                  min={field.min ?? 0}
                  max={field.max ?? 999999999999.99}
                  step={field.step ?? 1}
                  precision={field.precision ?? 2}
                  className="!w-full"
                  disabled={field.disabled}
                />
              ) : field.type === 'switch' ? (
                <Switch disabled={field.disabled} />
              ) : (
                <Input
                  type={field.type === 'date' ? 'date' : 'text'}
                  maxLength={field.maxLength ?? 160}
                  disabled={field.disabled}
                />
              )}
            </Form.Item>
          ))}
        </div>
        {command.formExtra}
      </Form>
    </Drawer>
  )
}
