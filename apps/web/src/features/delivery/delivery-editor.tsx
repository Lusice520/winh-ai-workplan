import { Alert } from 'antd'
import { BudgetLines, WorkPackageSource } from './delivery-form-sections'
import { ResourceOverlapReadout } from './delivery-components'
import type { Command, Field } from '@/features/business/business-ui'
import { reasonField } from '@/features/business/business-data'
import { configurationLabel, projectTypeOptions } from './configuration-types'
import {
  objectOptions,
  objectTitle,
  contentKey,
  deliveryLabel,
  deliveryOptions,
  personName,
  type DeliveryWorkspace,
  type DeliveryObject,
  type DeliveryKind,
  type DeliveryResource,
  type DeliveryFinding,
  type PublishedDeliveryConfiguration,
  type WorkPackageCandidate,
  type ContractNodeCandidate,
  type DeliveryContent,
} from './delivery-types'

type Option = { value: string; label: string }
export type DeliveryEditorContext = {
  data: DeliveryWorkspace
  people: Option[]
  candidates: WorkPackageCandidate[]
  contractNodes: ContractNodeCandidate[]
  actorId: string
}
const text = (name: string, label: string, required = true): Field => ({
  name,
  label,
  required,
})
const area = (name: string, label: string, required = false): Field => ({
  name,
  label,
  required,
  type: 'textarea',
})
const pick = (
  name: string,
  label: string,
  options: Option[],
  required = false,
  multiple = false,
): Field => ({
  name,
  label,
  options,
  required,
  type: multiple ? 'multiple' : 'select',
})
const date = (name: string, label: string, required = false): Field => ({
  name,
  label,
  required,
  type: 'date',
})
const lines = (value: unknown) =>
  String(value ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
const root = (data: DeliveryWorkspace) =>
  `/api/delivery-initiation/${data.project.projectId}`
export function headerCommand(ctx: DeliveryEditorContext): Command {
  const current = ctx.data.preparation
  return {
    title: current ? '接收范围与项目分工' : '开始交付立项准备',
    description:
      '沿用原项目、已接收的移交包和已有工作记录。项目经理确认商务范围、验收边界与遗留安排后组织申报。',
    path: root(ctx.data) + (current ? '/header' : '/initialize'),
    method: current ? 'PATCH' : 'POST',
    values: {
      ...(current?.header ?? {
        projectManagerId: ctx.actorId,
        riskLevel: 'LOW',
      }),
      version: current?.version,
    },
    fields: [
      {
        ...pick('projectManagerId', '项目经理', ctx.people, true),
        disabled: !current,
      },
      pick('technicalLeadId', '技术负责人', ctx.people),
      {
        ...pick('projectType', '项目类型', projectTypeOptions, true),
        disabled: !!current,
      },
      pick(
        'riskLevel',
        '项目风险等级',
        deliveryOptions(['LOW', 'MEDIUM', 'HIGH']),
        true,
      ),
      area('scopeAcceptance', '接收的商务范围'),
      area('acceptanceCriteria', '验收边界'),
      area('timeConstraints', '关键时间约束'),
      area('handoverFollowups', '移交遗留及处理方式'),
      ...(current ? [reasonField] : []),
    ],
    transform: (v) => ({
      ...(current ? { version: v.version, reason: v.reason } : {}),
      header: Object.fromEntries(
        [
          'projectManagerId',
          'technicalLeadId',
          'projectType',
          'riskLevel',
          'scopeAcceptance',
          'acceptanceCriteria',
          'timeConstraints',
          'handoverFollowups',
        ].map((key) => [key, v[key] ?? null]),
      ),
    }),
  }
}

export function configurationCommand(
  data: DeliveryWorkspace,
  kind: 'STAGE_TEMPLATE' | 'REVIEW_POLICY',
  configurations: PublishedDeliveryConfiguration[],
): Command {
  const name = kind === 'STAGE_TEMPLATE' ? '阶段模板' : '评审规则'
  return {
    title: `选择${name}`,
    path: root(data) + '/configuration',
    description:
      kind === 'STAGE_TEMPLATE'
        ? '明确选择已发布版本，生成本项目阶段草案；后续在原阶段上补齐责任、日期和差异说明。'
        : '申报沿用所选规则快照，发布新版本不会改写当前项目的指定会签与最终批准人。',
    values: { version: data.preparation?.version, kind },
    fields: [
      pick(
        'editionId',
        `已发布${name}`,
        configurations.map((c) => ({
          value: c.id,
          label: `${c.name} · V${c.edition}`,
        })),
        true,
      ),
      reasonField,
    ],
    content: configurations.length ? undefined : (
      <Alert
        type="info"
        showIcon
        title="没有可选择的发布版本，请先在交付模板与规则中完成发布。"
      />
    ),
  }
}

export function objectCommand(
  ctx: DeliveryEditorContext,
  kind: DeliveryKind,
  object?: DeliveryObject,
): Command {
  const { data, people } = ctx,
    approved = data.preparation?.status === 'APPROVED'
  const stage = objectOptions(data, 'STAGE', object?.id),
    work = objectOptions(data, 'WORK_PACKAGE', object?.id)
  const person = (name: string, label: string, required = false) =>
    pick(name, label, people, required)
  const stageField = pick('stageId', '所属阶段', stage)
  const windowFields = [
    date('startsOn', '计划开始'),
    date('endsOn', '计划结束'),
  ]
  const original = object?.content[contentKey[kind]]
  const values: Record<string, unknown> = {
    ...(kind === 'STAGE'
      ? {
          applicable: true,
          focus: false,
          predecessorIds: [],
          parallelIds: [],
          actions: '',
          deliverables: '',
        }
      : {}),
    ...(kind === 'MILESTONE' ? { kind: 'DELIVERY' } : {}),
    ...(kind === 'ITEM'
      ? { category: 'DELIVERABLE', procurementNeeded: false }
      : {}),
    ...(kind === 'WORK_PACKAGE' ? { itemIds: [], milestoneIds: [] } : {}),
    ...(kind === 'PLAN' ? { kind: 'MASTER', dependsOnIds: [] } : {}),
    ...(kind === 'BUDGET'
      ? { mode: 'FULL', authorizedStageIds: [], lines: [] }
      : {}),
    ...original,
  }
  if (kind === 'STAGE' && original) {
    values.actions = object?.content.stage?.actions.join('\n') ?? ''
    values.deliverables = object?.content.stage?.deliverables.join('\n') ?? ''
  }
  const fields: Record<DeliveryKind, Field[]> = {
    STAGE: [
      text('title', '阶段名称'),
      person('ownerId', '阶段负责人'),
      { name: 'applicable', label: '本项目适用', type: 'switch' },
      { name: 'focus', label: '当前交付重点', type: 'switch' },
      ...windowFields,
      pick('predecessorIds', '前置阶段', stage, false, true),
      pick('parallelIds', '可并行阶段', stage, false, true),
      area('applicabilityReason', '适用性说明'),
      area(
        'differenceReason',
        '与模板的差异理由',
        !object?.content.stage?.templateCode,
      ),
      { ...area('actions', '阶段动作'), hint: '每行一个动作。' },
      { ...area('deliverables', '阶段交付物'), hint: '每行一个交付物。' },
      area('completionCriteria', '阶段完成条件'),
    ],
    MILESTONE: [
      text('title', '里程碑名称'),
      pick(
        'kind',
        '节点类型',
        deliveryOptions(['DELIVERY', 'ACCEPTANCE', 'CONTRACT']),
        true,
      ),
      date('dueDate', '计划日期'),
      person('ownerId', '里程碑负责人'),
      stageField,
      {
        ...pick(
          'contractNodeId',
          '关联合同节点',
          ctx.contractNodes.map((n) => ({
            value: n.id,
            label: `${n.title} · ${n.dueDate ?? '日期待定'}`,
          })),
        ),
        hint: '合同类里程碑需要当前项目已归档合同中的有效节点。',
      },
      area('sourceNote', '日期依据'),
      area('acceptanceCriteria', '完成与验收条件'),
    ],
    ITEM: [
      text('title', '清单项名称'),
      pick(
        'category',
        '清单类别',
        deliveryOptions(['EQUIPMENT', 'MATERIAL', 'DELIVERABLE', 'OTHER']),
        true,
      ),
      text('specification', '规格与内容', false),
      { name: 'quantity', label: '数量', type: 'number', required: false },
      text('unit', '单位', false),
      stageField,
      pick('workPackageId', '专业工作包', work),
      pick('milestoneId', '交付里程碑', objectOptions(data, 'MILESTONE')),
      { name: 'procurementNeeded', label: '需要采购', type: 'switch' },
      area('procurementNote', '采购需求与依据'),
      area('acceptanceScope', '验收范围'),
    ],
    WORK_PACKAGE: [
      text('title', '工作包名称'),
      stageField,
      person('ownerId', '工作包负责人', true),
      person('verifierId', '独立验证人', true),
      ...windowFields,
      area('scope', '工作范围', true),
      area('deliverables', '专业交付物'),
      area('acceptanceCriteria', '验收条件'),
      pick('itemIds', '关联项目清单', objectOptions(data, 'ITEM'), false, true),
      pick(
        'milestoneIds',
        '关联里程碑',
        objectOptions(data, 'MILESTONE'),
        false,
        true,
      ),
      area('resourceNotes', '资源约束'),
    ],
    PLAN: [
      text('title', '计划名称'),
      pick(
        'kind',
        '计划类别',
        deliveryOptions(['MASTER', 'WORK_PACKAGE']),
        true,
      ),
      stageField,
      pick('workPackageId', '对应工作包', work),
      ...windowFields,
      date('deliveryWindowStart', '交付窗口开始'),
      date('deliveryWindowEnd', '交付窗口结束'),
      pick(
        'dependsOnIds',
        '前置计划',
        objectOptions(data, 'PLAN', object?.id),
        false,
        true,
      ),
      area('resourceConstraints', '资源与排期约束'),
    ],
    BUDGET: [
      pick('mode', '预算授权方式', deliveryOptions(['FULL', 'PHASED']), true),
      area('scope', '预算覆盖范围'),
      pick('authorizedStageIds', '分阶段授权范围', stage, false, true),
      {
        name: 'authorizedCap',
        label: '分阶段授权上限（元）',
        type: 'number',
        required: false,
      },
      date('expiresOn', '分阶段授权有效期'),
      date('nextCompletionOn', '剩余预算补齐日期'),
      area('remainingScope', '剩余未授权范围'),
    ],
  }
  const names = fields[kind].map((f) => f.name)
  return {
    title: `${object ? (approved && !['MILESTONE', 'BUDGET'].includes(kind) ? '提出范围变更 · ' : '编辑') : '新增'}${deliveryLabel(kind)}`,
    description: approved
      ? ['MILESTONE', 'BUDGET'].includes(kind)
        ? '有权项目经理填写调整原因、影响与依据，核验通过后直接形成新版本。原批准版本继续保留。'
        : '保留原批准版本。填写变更原因、影响与依据；范围调整由指定的独立授权人确认后生效。'
      : '可以分次补齐准备内容。提交评审前，系统会核验对象之间的范围、责任和日期关系。',
    path: root(data) + '/objects' + (object ? `/${object.id}` : ''),
    method: object ? 'PATCH' : 'POST',
    values,
    fields: [
      ...fields[kind],
      reasonField,
      ...(approved
        ? [
            area('impact', '对范围、日期、资源及预算的影响', true),
            area('basis', '调整依据', true),
          ]
        : []),
    ],
    formExtra:
      kind === 'BUDGET' ? (
        <BudgetLines data={data} />
      ) : kind === 'WORK_PACKAGE' && !object ? (
        <WorkPackageSource
          candidates={ctx.candidates.filter(
            (w) => !data.objects.some((o) => o.id === w.id),
          )}
        />
      ) : undefined,
    transform: (v) => {
      const body: Record<string, unknown> = Object.fromEntries(
        names.map((name) => [name, v[name] ?? null]),
      )
      if (kind === 'STAGE')
        Object.assign(body, {
          templateCode: object?.content.stage?.templateCode ?? null,
          actions: lines(v.actions),
          deliverables: lines(v.deliverables),
          predecessorIds: v.predecessorIds ?? [],
          parallelIds: v.parallelIds ?? [],
        })
      if (kind === 'WORK_PACKAGE')
        Object.assign(body, {
          itemIds: v.itemIds ?? [],
          milestoneIds: v.milestoneIds ?? [],
        })
      if (kind === 'PLAN') body.dependsOnIds = v.dependsOnIds ?? []
      if (kind === 'BUDGET')
        Object.assign(body, {
          lines: v.lines ?? [],
          authorizedStageIds: v.authorizedStageIds ?? [],
        })
      return {
        version: data.preparation?.version,
        objectVersion: object?.version ?? null,
        existingWorkItemId:
          kind === 'WORK_PACKAGE' && !object
            ? (v.existingWorkItemId ?? null)
            : null,
        content: {
          stage: null,
          milestone: null,
          item: null,
          workPackage: null,
          plan: null,
          budget: null,
          [contentKey[kind]]: body,
        },
        reason: v.reason,
        impact: v.impact ?? null,
        basis: v.basis ?? null,
      }
    },
  }
}

export function resourceCommand(
  ctx: DeliveryEditorContext,
  resource?: DeliveryResource,
): Command {
  const { data, people } = ctx
  return {
    title: resource ? '调整资源申请' : '申请专业资源',
    path: root(data) + '/resources' + (resource ? `/${resource.id}` : ''),
    method: resource ? 'PATCH' : 'POST',
    description:
      '由工作包负责人提出需求，由指定的同部门资源责任人承诺。修改申请后需要重新签认。',
    values: { ...resource?.request },
    fields: [
      {
        ...pick(
          'workPackageId',
          '所属工作包',
          objectOptions(data, 'WORK_PACKAGE'),
          true,
        ),
        disabled: !!resource,
      },
      pick('personId', '资源人员', people, true),
      pick('committerId', '部门资源承诺人', people, true),
      date('startsOn', '开始日期', true),
      date('endsOn', '结束日期', true),
      {
        name: 'dailyHours',
        label: '每天需求工时',
        type: 'number',
        hint: '0 至 24 小时，系统同时核验重叠项目的已承诺投入。',
      },
      area('requestNote', '工作安排与资源要求', true),
      reasonField,
    ],
    transform: (v) => ({
      version: data.preparation?.version,
      resourceVersion: resource?.version ?? null,
      reason: v.reason,
      request: Object.fromEntries(
        [
          'workPackageId',
          'personId',
          'committerId',
          'startsOn',
          'endsOn',
          'dailyHours',
          'requestNote',
        ].map((k) => [k, v[k] ?? null]),
      ),
    }),
  }
}

export function commitmentCommand(
  data: DeliveryWorkspace,
  resource: DeliveryResource,
): Command {
  return {
    title: '签认部门资源承诺',
    path: root(data) + `/resources/${resource.id}/commit`,
    content: (
      <ResourceOverlapReadout
        projectId={data.project.projectId}
        resourceId={resource.id}
      />
    ),
    description: `${personName(data, resource.request.personId)} · ${resource.request.startsOn} 至 ${resource.request.endsOn} · 每天 ${resource.request.dailyHours} 小时。签认前请核对其他项目的重叠安排。`,
    values: {
      decision: resource.status === 'CONFLICT' ? 'RESOLVED' : 'COMMITTED',
      ...resource.commitment,
    },
    fields: [
      pick(
        'decision',
        '资源结论',
        deliveryOptions([
          'COMMITTED',
          'CONFLICT',
          ...(resource.status !== 'REQUESTED' ? ['RESOLVED'] : []),
          'REVOKED',
        ]),
        true,
      ),
      {
        name: 'dailyCapacity',
        label: '每天可用容量（小时）',
        type: 'number',
        required: false,
      },
      area('conclusion', '签认依据与安排'),
      area('impact', '冲突影响及协调结果'),
      area('escalationPath', '协调与升级路径'),
      reasonField,
    ],
    transform: (v) => ({
      version: data.preparation?.version,
      resourceVersion: resource.version,
      decision: v.decision,
      reason: v.reason,
      commitment:
        v.decision === 'REVOKED'
          ? null
          : {
              dailyCapacity: v.dailyCapacity,
              conclusion: v.conclusion,
              impact: v.impact ?? null,
              escalationPath: v.escalationPath ?? null,
            },
    }),
  }
}

export function findingCommand(
  ctx: DeliveryEditorContext,
  finding?: DeliveryFinding,
): Command {
  return {
    title: finding ? '调整遗留事项' : '登记风险与遗留',
    path: root(ctx.data) + '/findings' + (finding ? `/${finding.id}` : ''),
    method: finding ? 'PATCH' : 'POST',
    description:
      '法律开工条件、范围验收、关键责任、首段资源和关键日期属于阻断事项，必须独立验证关闭后才能提交。',
    values: {
      kind: 'GAP',
      riskLevel: 'LOW',
      impactCategory: 'DETAIL',
      ...finding?.finding,
    },
    fields: [
      text('title', '事项名称'),
      pick(
        'kind',
        '事项类型',
        deliveryOptions(['RISK', 'GAP', 'DEPENDENCY']),
        true,
      ),
      pick(
        'impactCategory',
        '影响类别',
        deliveryOptions([
          'LEGAL',
          'SCOPE',
          'RESPONSIBILITY',
          'INITIAL_RESOURCE',
          'KEY_DATE',
          'DETAIL',
        ]),
        true,
      ),
      pick(
        'riskLevel',
        '风险等级',
        deliveryOptions(['LOW', 'MEDIUM', 'HIGH']),
        true,
      ),
      pick('ownerId', '处理责任人', ctx.people, true),
      pick('verifierId', '独立验证人', ctx.people, true),
      date('dueDate', '计划关闭日期', true),
      pick('escalationOwnerId', '升级责任人', ctx.people, true),
      area('closingCriteria', '关闭条件', true),
      area('impactScope', '影响范围', true),
      area('escalationPath', '升级处理路径', true),
      reasonField,
    ],
    transform: (v) => ({
      version: ctx.data.preparation?.version,
      findingVersion: finding?.version ?? null,
      reason: v.reason,
      finding: Object.fromEntries(
        [
          'title',
          'kind',
          'impactCategory',
          'riskLevel',
          'ownerId',
          'verifierId',
          'dueDate',
          'closingCriteria',
          'impactScope',
          'escalationOwnerId',
          'escalationPath',
        ].map((key) => [key, v[key]]),
      ),
    }),
  }
}

export function resolveFindingCommand(
  data: DeliveryWorkspace,
  finding: DeliveryFinding,
  action: 'SUBMIT_EVIDENCE' | 'VERIFY' | 'RETURN',
): Command {
  return {
    title: `${action === 'SUBMIT_EVIDENCE' ? '提交完成证据' : action === 'VERIFY' ? '独立验证关闭' : '退回继续处理'} · ${finding.finding.title}`,
    path: root(data) + `/findings/${finding.id}/resolve`,
    values: {
      version: data.preparation?.version,
      findingVersion: finding.version,
      action,
    },
    description: `关闭条件：${finding.finding.closingCriteria}`,
    content: finding.evidence ? (
      <Alert
        type="info"
        title="责任人提交的证据"
        description={finding.evidence}
      />
    ) : undefined,
    fields: [
      area(
        'evidence',
        action === 'SUBMIT_EVIDENCE' ? '完成证据与结果' : '核验结果与依据',
        true,
      ),
    ],
  }
}

export function archiveObjectCommand(
  data: DeliveryWorkspace,
  object: DeliveryObject,
): Command {
  return {
    title: `停用${deliveryLabel(object.kind)} · ${objectTitle(object)}`,
    path: root(data) + `/objects/${object.id}/archive`,
    description:
      '记录仍保留；已批准范围的停用申请需要独立授权确认，关联范围必须保持完整。',
    values: {
      version: data.preparation?.version,
      objectVersion: object.version,
    },
    fields: [
      reasonField,
      ...(data.preparation?.status === 'APPROVED'
        ? [area('impact', '影响范围', true), area('basis', '停用依据', true)]
        : []),
    ],
  }
}

export function reviewCommand(
  data: DeliveryWorkspace,
  action: 'submit' | 'review' | 'decision' | 'withdraw',
): Command {
  const round = data.rounds[0],
    isSubmit = action === 'submit'
  return {
    title: {
      submit: '提交交付立项评审',
      review: '提交专业会签意见',
      decision: '交付立项最终决定',
      withdraw: '撤回本轮申报',
    }[action],
    description: isSubmit
      ? '提交时再次检查九项立项条件，并冻结本轮内容。所有必要会签完成后，由指定的公司授权人独立批准。'
      : '本轮冻结内容与既有意见保留。退回或撤回后，项目经理可补齐内容再发起新一轮评审。',
    path: root(data) + (isSubmit ? '/submit' : `/rounds/${round.id}/${action}`),
    values: {
      version: data.preparation?.version,
      ...(isSubmit ? {} : { roundVersion: round.version }),
    },
    fields: [
      ...(action === 'review' || action === 'decision'
        ? [
            pick(
              'decision',
              '处理结论',
              deliveryOptions(
                action === 'review'
                  ? ['AGREED', 'RETURNED']
                  : ['APPROVED', 'RETURNED'],
              ),
              true,
            ),
          ]
        : []),
      area(
        isSubmit ? 'note' : 'comment',
        isSubmit
          ? '申报说明'
          : action === 'withdraw'
            ? '撤回原因'
            : '意见与依据',
        true,
      ),
    ],
    submitLabel: isSubmit ? '确认提交评审' : '确认提交',
  }
}

export function contentSummary(content: DeliveryContent): string {
  if (content.stage)
    return `${content.stage.title} · ${content.stage.startsOn ?? '日期待定'} 至 ${content.stage.endsOn ?? '日期待定'}`
  if (content.workPackage) return content.workPackage.scope
  if (content.item) return content.item.acceptanceScope ?? content.item.title
  if (content.plan)
    return `${content.plan.title} · ${configurationLabel(content.plan.kind)}`
  if (content.milestone)
    return content.milestone.acceptanceCriteria ?? content.milestone.title
  return content.budget?.scope ?? '预算范围待补齐'
}
