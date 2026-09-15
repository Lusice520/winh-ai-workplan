import { Button, Input, Select } from 'antd'
import type { ExecutionFilters } from './execution-filter-model'

type FilterField = {
  key: string
  label: string
  options?: { value: string; label: string }[]
  type?: 'date'
}
export function ExecutionFilterBar({
  label,
  fields,
  value,
  onChange,
}: {
  label: string
  fields: FilterField[]
  value: ExecutionFilters
  onChange: (next: ExecutionFilters) => void
}) {
  const count = Object.values(value).filter(Boolean).length
  return (
    <details className="execution-filters">
      <summary>
        {label}
        {count ? ` · ${count} 项条件` : ''}
      </summary>
      <div className="execution-filter-fields">
        {fields.map((field) =>
          field.options ? (
            <Select
              key={field.key}
              size="small"
              allowClear
              placeholder={field.label}
              aria-label={field.label}
              value={value[field.key] || undefined}
              options={field.options}
              onChange={(next: string | undefined) =>
                onChange({ ...value, [field.key]: next ?? '' })
              }
            />
          ) : (
            <label key={field.key}>
              {field.label}
              <Input
                size="small"
                type={field.type}
                aria-label={field.label}
                value={value[field.key] ?? ''}
                onChange={(e) =>
                  onChange({ ...value, [field.key]: e.target.value })
                }
              />
            </label>
          ),
        )}
        <Button size="small" onClick={() => onChange({})}>
          清除筛选
        </Button>
      </div>
    </details>
  )
}
