import { label } from '@/features/business/business-data'
export const handoverName = (value?: string | null) =>
  value
    ? ((
        {
          SYSTEM_INTEGRATION: '系统集成',
          TECHNICAL_SERVICE: '技术服务',
          EQUIPMENT: '设备供货',
          REQUIRED: '必需',
          CONDITIONAL: '条件必需',
          OPTIONAL: '可选',
          READY: '已齐备',
          MISSING: '待补齐',
          INVALID: '需处理',
          NOT_APPLICABLE: '不适用',
          BASE: '项目基础',
          COMMERCIAL: '商务依据',
          TECHNICAL: '范围与技术',
          PLAN: '验收与计划',
          RISK: '投入与风险',
          AWARD: '中标通知',
          ENTRUSTMENT: '委托函',
          CONTRACT: '归档主合同',
          EARLY_START: '提前开工批准',
          FILE: '项目资料',
          DELIVERABLE: '售前成果',
          NOT_YET_ACTIVE: '尚未开始',
          EXPIRED: '已到期',
          OVER_LIMIT: '已超上限',
          STOPPED: '已停止',
          REGULARIZED: '已转正',
          LABOR: '人时投入',
          PROCUREMENT: '采购承诺',
          SUBCONTRACT: '分包承诺',
          OTHER: '其他投入',
        } as Record<string, string>
      )[value] ?? label(value))
    : '—'
export const handoverOptions = (values: string[]) =>
  values.map((value) => ({ value, label: handoverName(value) }))
export const today = () => new Date().toLocaleDateString('en-CA')
