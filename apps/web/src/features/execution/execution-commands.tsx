import { Alert } from 'antd'
import type { Member } from '@/features/business/business-types'
import type { Command, Field } from '@/features/business/business-ui'
import {
  CompletionProblems,
  EvidenceFiles,
  ExecutionHistory,
  ExecutionHistoryList,
} from './execution-ui'
import {
  actualToday,
  executionLabel,
  executionTitle,
  quantityText,
  type ExecutionObject,
  type StageExecution,
  type ItemExecution,
  type MilestoneExecution,
  type ItemEvent,
  type ExecutionEvent,
} from './execution-types'

export function executionCommands(
  projectId: string,
  members: Member[],
  actorId: string,
  fileField: Field | undefined,
  open: (command: Command) => void,
) {
  const base = `/api/projects/${projectId}/execution`
  const note: Field = {
    name: 'note',
    label: '原因与说明',
    type: 'textarea',
    maxLength: 4000,
  }
  const date: Field = {
    name: 'occurredOn',
    label: '实际发生日期',
    type: 'date',
    hint: '可补录已发生的事实，不能填写未来日期。',
  }
  const reviewer = (ownerId: string | null): Field => ({
    name: 'verifierId',
    label: '指定独立验证人',
    type: 'select',
    options: members
      .filter(
        (m) => m.active && m.accountId !== ownerId && m.accountId !== actorId,
      )
      .map((m) => ({ value: m.accountId, label: m.name })),
    hint: '保存时核验所选人员的实际权限；负责人和提交人不能自行验证。',
  })
  const evidence: Field = {
    name: 'evidence',
    label: '完成或发生依据',
    type: 'textarea',
    maxLength: 4000,
  }
  return {
    recent: (events: ExecutionEvent[]) =>
      open({
        title: '最近 100 条执行记录',
        path: 'execution-recent',
        readOnly: true,
        fields: [],
        content: <ExecutionHistoryList events={events} />,
      }),
    history: (o: ExecutionObject) =>
      open({
        title: `执行历史 · ${executionTitle(o)}`,
        path: `execution-history:${o.id}`,
        readOnly: true,
        fields: [],
        content: <ExecutionHistory projectId={projectId} objectId={o.id} />,
      }),
    stage: (o: ExecutionObject, row: StageExecution, action: string) =>
      open({
        title: `${executionLabel(action)} · ${executionTitle(o)}`,
        path: `${base}/stages/${o.id}/actions`,
        values: {
          version: row.version,
          objectVersion: o.version,
          action,
          occurredOn: actualToday(),
          ...(action === 'PROGRESS' ? { progress: row.progress } : {}),
        },
        fields: [
          date,
          ...(action === 'PROGRESS'
            ? [
                {
                  name: 'progress',
                  label: '当前报告进度（%）',
                  type: 'number',
                  hint: '0–99；条件满足后由项目经理确认阶段完成。',
                } satisfies Field,
              ]
            : []),
          note,
        ],
        content: (
          <>
            <Alert
              type="info"
              showIcon
              title={o.content.stage?.completionCriteria ?? '按原批准范围执行'}
            />
            {['START', 'COMPLETE'].includes(action) && (
              <CompletionProblems problems={row.blockers} />
            )}
          </>
        ),
      }),
    profile: (o: ExecutionObject, row: ItemExecution) =>
      open({
        title: `执行环节与资料 · ${executionTitle(o)}`,
        path: `${base}/items/${o.id}/profile`,
        values: {
          version: row.profile?.version ?? -1,
          objectVersion: o.version,
          requiresReceipt:
            row.profile?.requiresReceipt ??
            o.content.item?.category !== 'DELIVERABLE',
          requiresInstallation:
            row.profile?.requiresInstallation ??
            o.content.item?.category === 'EQUIPMENT',
          brand: row.profile?.brand,
          model: row.profile?.model,
          supplier: row.profile?.supplier,
        },
        fields: [
          { name: 'requiresReceipt', label: '需要到货环节', type: 'switch' },
          {
            name: 'requiresInstallation',
            label: '需要安装环节',
            type: 'switch',
          },
          { name: 'brand', label: '品牌', required: false, maxLength: 160 },
          { name: 'model', label: '型号', required: false, maxLength: 160 },
          {
            name: 'supplier',
            label: '供应商',
            required: false,
            maxLength: 240,
          },
          {
            name: 'reason',
            label: '适用性依据与说明',
            type: 'textarea',
            maxLength: 2000,
          },
        ],
        description:
          '请明确本清单实际适用的环节；有有效执行记录后不能通过更改环节绕过数量关系。',
      }),
    item: (
      o: ExecutionObject,
      row: ItemExecution,
      kind: string,
      ownerId: string | null,
    ) =>
      open({
        title: `${executionLabel(kind)} · ${executionTitle(o)}`,
        path: `${base}/items/${o.id}/events`,
        values: {
          version: row.profile?.version ?? -1,
          objectVersion: o.version,
          kind,
          occurredOn: actualToday(),
          fileVersionIds: [],
        },
        fields: [
          date,
          {
            name: 'quantity',
            label: `本批数量（${o.content.item?.unit ?? '项'}）`,
            type: 'number',
          },
          evidence,
          ...(kind === 'ACCEPTED' ? [reviewer(ownerId)] : []),
          ...(fileField ? [fileField] : []),
        ],
        content: (
          <Alert
            type="info"
            showIcon
            title={`批准数量 ${quantityText(o.content.item?.quantity)} · 净到货 ${quantityText(row.totals.received)} · 净安装 ${quantityText(row.totals.installed)}`}
            description={`已验收 ${quantityText(row.totals.accepted)} · 待验收 ${quantityText(row.totals.pending)} · 需重核 ${quantityText(row.totals.needsReview)}。保存时按实际日期核验数量顺序。`}
          />
        ),
      }),
    itemDecision: (o: ExecutionObject, e: ItemEvent, action: string) =>
      open({
        title: `${executionLabel(action)} · ${executionTitle(o)}`,
        path: `${base}/events/${e.id}/actions`,
        values: { version: e.version, objectVersion: o.version, action },
        fields: [note],
        content: (
          <div className="business-stack">
            <Alert
              type={action === 'REVERSE' ? 'warning' : 'info'}
              showIcon
              title={`${e.occurredOn} · ${executionLabel(e.kind)} ${quantityText(e.quantity)} ${o.content.item?.unit ?? ''}`}
              description={
                action === 'REVERSE'
                  ? '将冲回整条记录并保留原事实。有下游记录时，需要先明确处理下游。'
                  : e.evidence
              }
            />
            <EvidenceFiles files={e.files} restricted={e.restrictedFileCount} />
          </div>
        ),
      }),
    milestone: (o: ExecutionObject, row: MilestoneExecution, action: string) =>
      open({
        title: `${executionLabel(action)} · ${executionTitle(o)}`,
        path: `${base}/milestones/${o.id}/${action === 'SUBMIT' ? 'submit' : 'actions'}`,
        values: {
          version: row.version,
          objectVersion: o.version,
          ...(action === 'SUBMIT'
            ? { occurredOn: actualToday(), fileVersionIds: [] }
            : { action }),
        },
        fields:
          action === 'SUBMIT'
            ? [
                date,
                evidence,
                reviewer(o.content.milestone?.ownerId ?? null),
                ...(fileField ? [fileField] : []),
              ]
            : [note],
        content: (
          <div className="business-stack">
            <Alert
              type="info"
              showIcon
              title={
                o.content.milestone?.acceptanceCriteria ?? '核对批准的验收条件'
              }
              description={row.evidence ?? undefined}
            />
            <CompletionProblems problems={row.blockers} />
            <EvidenceFiles
              files={row.files}
              restricted={row.restrictedFileCount}
            />
          </div>
        ),
      }),
  }
}
export type ExecutionActions = ReturnType<typeof executionCommands>
