import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { getJson } from '@/api/client/http'
import type { Page, Person } from './business-types'
import type { Field } from './business-ui'

export const labels: Record<string, string> = {
  CONTRACT: '合同敏感',
  COST: '成本敏感',
  PUBLISHED: '已发布',
  VOID: '已作废',
  SIGNED: '已签署',
  EFFECTIVE: '已生效',
  ARCHIVED: '已归档',
  PLANNED: '待完成',
  PAYMENT: '付款约定',
  ACCEPTANCE: '验收节点',
  ACTIVE: '有效',
  INACTIVE: '停用',
  MERGED: '已合并',
  PROSPECT: '潜在客户',
  CUSTOMER: '客户',
  LEAD: '线索识别',
  QUALIFIED: '需求确认',
  SOLUTION: '方案设计',
  QUOTATION: '报价准备',
  NEGOTIATION: '商务谈判',
  TENDER: '招投标',
  DIRECT: '直接处理',
  SUCCESS: '成功',
  FAILURE: '失败',
  CUSTOMER_CANCELLED: '客户取消',
  TERMINATED: '终止',
  PENDING: '待定',
  CLOSED: '已关闭',
  CANCELLED: '已取消',
  NEEDS_REVIEW: '需重新核验',
  ON_TRACK: '正常跟进',
  OVERDUE: '行动逾期',
  STALE: '长期未跟进',
  MISSING_ACTION: '待补下一步',
  PRESALES: '售前阶段',
  PENDING_INITIATION: '待售前立项',
  NOT_SET: '待明确',
  SURVEY: '现场调研',
  REQUIREMENTS: '需求梳理',
  ESTIMATE: '估算',
  BIDDING: '招投标',
  HANDOVER: '技术交底',
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  BLOCKED: '有阻塞',
  COMPLETED: '已完成',
  SKIPPED: '不适用',
  DRAFT: '草稿',
  SUBMITTED: '待评审',
  APPROVED: '已批准',
  RETURNED: '已退回',
  IN_REVIEW: '评审中',
  SUPERSEDED: '历史版本',
  OTHER: '其他',
  COMMITTED: '已承诺投入',
  ACTUAL: '实际投入',
  REVERSAL: '冲销记录',
  NEW: '待澄清',
  ASSESSED: '待分流',
  ON_HOLD: '暂缓',
  REJECTED: '已拒绝',
  PENDING_VERIFICATION: '待验证',
  LOW: '低',
  NORMAL: '中',
  HIGH: '高',
  URGENT: '紧急',
  SALES: '营销',
  DELIVERY: '交付',
  INTERNAL: '内部',
  HOLD: '暂缓观察',
  REJECT: '拒绝受理',
  TASK: '任务',
  ISSUE: '问题',
  WORK_PACKAGE: '工作包',
  CHANGE: '正式变更',
  OPEN: '待处理',
  DONE: '已验证完成',
  PROJECT_OWNER: '项目负责人',
  PROJECT_CONTRIBUTOR: '项目协作人',
  PROJECT_REVIEWER: '项目评审人',
  PRICE: '价格因素',
  TECHNICAL: '技术因素',
  TIMING: '时间因素',
}
export const label = (value?: string | null) =>
  value ? (labels[value] ?? value) : '—'
export const options = (values: string[]) =>
  values.map((value) => ({ value, label: label(value) }))
export const money = (value?: number | null) =>
  value == null
    ? '未填写'
    : new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        maximumFractionDigits: 2,
      }).format(value)
export const dateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '—'
export function useBusinessQuery<T>(path: string | undefined) {
  return useQuery({
    queryKey: ['business', path],
    queryFn: ({ signal }) => getJson<T>(path!, { signal }),
    enabled: !!path,
    retry: false,
  })
}
export function usePeople() {
  return useBusinessQuery<Person[]>('/api/business/people')
}
export function useCapabilities() {
  return useBusinessQuery<string[]>('/api/business/capabilities')
}
export function useListFilters() {
  const [params, setParams] = useSearchParams()
  const update = (key: string, value?: string | number) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set(key, String(value))
        else next.delete(key)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = [10, 20, 50].includes(Number(params.get('pageSize')))
    ? Number(params.get('pageSize'))
    : 10
  return { params, update, page, pageSize, query: params.toString() }
}
export function pager(
  data: Page<unknown> | undefined,
  onChange: (page: number, size: number) => void,
) {
  return {
    current: data?.page ?? 1,
    pageSize: data?.pageSize ?? 10,
    total: data?.total ?? 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50],
    showTotal: (total: number) => `共 ${total} 条`,
    onChange,
  }
}
export const reasonField: Field = {
  name: 'reason',
  label: '原因与说明',
  type: 'textarea',
}
export const personField = (
  name: string,
  title: string,
  people: Person[],
): Field => ({
  name,
  label: title,
  type: 'select',
  options: people.map((p) => ({ value: p.id, label: p.name })),
})

export function resultLabel(result: string, procurementMethod: string) {
  if (result === 'SUCCESS')
    return procurementMethod === 'TENDER' ? '中标' : '成交'
  if (result === 'FAILURE')
    return procurementMethod === 'TENDER' ? '未中标' : '未成交'
  return label(result)
}
