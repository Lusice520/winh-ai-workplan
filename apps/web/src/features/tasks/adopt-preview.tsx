import { Alert, Form } from 'antd'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import type { WorkDetail } from '@/features/business/business-types'
import { useBusinessQuery } from '@/features/business/business-data'

export function AdoptPreview() {
  const populated = useRef<Record<string, unknown>>({})
  const form = Form.useFormInstance(),
    selected: string | undefined = Form.useWatch('existingTaskId', form),
    query = useBusinessQuery<WorkDetail>(
      selected ? `/api/work-items/${selected}` : undefined,
    )
  useEffect(() => {
    if (!query.data) return
    const w = query.data,
      original: Record<string, unknown> = {
        title: w.title,
        description: w.description,
        ownerId: w.ownerAccountId,
        verifierId: w.verifierAccountId,
      }
    const next = Object.fromEntries(
      Object.entries(original).filter(
        ([key]) =>
          !form.isFieldTouched(key) ||
          form.getFieldValue(key) === populated.current[key],
      ),
    )
    form.setFieldsValue(next)
    populated.current = { ...populated.current, ...next }
  }, [form, query.data])
  return selected ? (
    <Alert
      type={query.isError ? 'warning' : 'info'}
      showIcon
      title={query.data?.title ?? '原任务'}
      description={
        <>
          <Link to={`/work-items/${selected}`} target="_blank">
            查看原任务与来源
          </Link>
          <p>
            接纳后沿用原记录，保持来源与历史；请核对内容、负责人和本包完成标准。
          </p>
        </>
      }
    />
  ) : null
}
