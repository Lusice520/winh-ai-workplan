import { AdoptPreview } from './adopt-preview'
import { Alert } from 'antd'
import type { Member } from '@/features/business/business-types'
import type { Command, Field } from '@/features/business/business-ui'
import {
  actualToday,
  executionTitle,
} from '@/features/execution/execution-types'
import { EvidenceFiles } from '@/features/execution/execution-ui'
import { taskLabel, type TaskDetail, type TaskWorkspace } from './task-types'

export function taskPlanCommand(
  data: TaskWorkspace | TaskDetail,
  members: Member[],
  mode: 'CREATE' | 'ADOPT' | 'EDIT',
  onSuccess?: (result: unknown) => void,
): Command {
  const row = 'task' in data ? data.task : undefined,
    wp = data.workPackage.content.workPackage,
    options = members
      .filter((m) => m.active)
      .map((m) => ({ value: m.accountId, label: m.name })),
    existing = 'availableTasks' in data ? data.availableTasks : []
  return {
    title: taskLabel(mode),
    path:
      mode === 'EDIT'
        ? `/api/projects/${data.projectId}/tasks/${row!.id}`
        : `/api/projects/${data.projectId}/work-packages/${data.workPackage.id}/tasks`,
    method: mode === 'EDIT' ? 'PATCH' : 'POST',
    description:
      '计划在原工作包窗口内安排。预计人天可留空；实际投入后续单独记录。人员换任使用项目责任交接。',
    values: {
      parentVersion: data.workPackage.version,
      version: row?.version,
      workVersion: row?.workVersion,
      title: row?.title,
      description: 'description' in data ? data.description : undefined,
      acceptanceCriteria:
        'acceptanceCriteria' in data ? data.acceptanceCriteria : undefined,
      ownerId: row?.ownerId ?? wp?.ownerId,
      verifierId: row?.verifierId ?? wp?.verifierId,
      startsOn: row?.startsOn ?? wp?.startsOn,
      dueDate: row?.dueDate ?? wp?.endsOn,
      estimatedDays: row?.estimatedDays,
      itemIds: 'itemIds' in data ? data.itemIds : [],
    },
    fields: [
      ...(mode === 'ADOPT'
        ? [
            {
              name: 'existingTaskId',
              label: '接纳原任务',
              type: 'select',
              wide: true,
              options: existing.map((t) => ({ value: t.id, label: t.title })),
            } satisfies Field,
          ]
        : []),
      { name: 'title', label: '任务名称', wide: true, maxLength: 160 },
      {
        name: 'description',
        label: '任务内容与范围',
        type: 'textarea',
        maxLength: 8000,
      },
      {
        name: 'acceptanceCriteria',
        label: '完成标准',
        type: 'textarea',
        maxLength: 4000,
      },
      {
        name: 'ownerId',
        label: '任务负责人',
        type: 'select',
        options,
        disabled: mode === 'EDIT',
      },
      {
        name: 'verifierId',
        label: '指定独立验证人',
        type: 'select',
        options,
        disabled: mode === 'EDIT',
        hint: '与负责人不同，保存时核对其实际验证权限。',
      },
      { name: 'startsOn', label: '计划开始', type: 'date' },
      { name: 'dueDate', label: '计划完成', type: 'date' },
      {
        name: 'estimatedDays',
        label: '预计投入（人天）',
        type: 'number',
        required: false,
        precision: 1,
        step: 0.5,
        min: 0.5,
        max: 9999999.5,
        hint: '以半天为单位，不作为实际工时。',
      },
      {
        name: 'itemIds',
        label: '关联本包清单',
        type: 'multiple',
        required: false,
        options: data.items.map((o) => ({
          value: o.id,
          label: executionTitle(o),
        })),
      },
      {
        name: 'reason',
        label: '安排依据与原因',
        type: 'textarea',
        maxLength: 4000,
      },
    ],
    transform: (v) => ({
      ...v,
      ...(mode === 'ADOPT'
        ? {
            sourceVersion: existing.find((t) => t.id === v.existingTaskId)
              ?.version,
          }
        : {}),
    }),
    formExtra: mode === 'ADOPT' ? <AdoptPreview /> : undefined,
    onSuccess,
  }
}
export function taskActionCommand(
  data: TaskDetail,
  action: string,
  fileField?: Field,
): Command {
  const t = data.task,
    actual = ['PROGRESS', 'COMPLETE'].includes(action)
  return {
    title: `${taskLabel(action)} · ${t.title}`,
    path: `/api/projects/${data.projectId}/tasks/${t.id}/commands`,
    values: {
      version: t.version,
      workVersion: t.workVersion,
      action,
      ...(actual ? { occurredOn: actualToday() } : {}),
      ...(action === 'PROGRESS' ? { progress: Math.min(99, t.progress) } : {}),
      fileVersionIds: [],
    },
    fields: [
      ...(actual
        ? [
            {
              name: 'occurredOn',
              label: '实际发生日期',
              type: 'date',
              hint: '只填已发生的日期；计划与实际分别保留。',
            } satisfies Field,
          ]
        : []),
      ...(action === 'PROGRESS'
        ? [
            {
              name: 'progress',
              label: '本人报告进度（%）',
              type: 'number',
              min: 0,
              max: 99,
              precision: 0,
              hint: '0–99；完成后另行提交指定人员验证。',
            } satisfies Field,
          ]
        : []),
      {
        name: 'note',
        label:
          action === 'COMPLETE'
            ? '完成成果与依据'
            : action === 'PROGRESS'
              ? '本次进展与说明'
              : '核对结论与原因',
        type: 'textarea',
        maxLength: 4000,
      },
      ...(action === 'COMPLETE' && fileField ? [fileField] : []),
    ],
    content: (
      <div className="business-stack">
        <Alert
          showIcon
          type={['CANCEL', 'REOPEN'].includes(action) ? 'warning' : 'info'}
          title={data.acceptanceCriteria}
          description={
            action === 'REOPEN'
              ? '本轮记录保留，新一轮须重新提交成果并由其他人核验。'
              : action === 'CANCEL'
                ? '原任务与已发生的记录保留，取消项不计入完成率。'
                : (data.evidence ??
                  '提交完成不等于文件已发布、清单已验收或工作包已完成。')
          }
        />
        {['VERIFY', 'RETURN'].includes(action) && (
          <EvidenceFiles
            files={data.files.files}
            restricted={data.files.restricted}
          />
        )}
      </div>
    ),
    submitLabel: action === 'COMPLETE' ? '提交独立验证' : '确认提交',
  }
}
