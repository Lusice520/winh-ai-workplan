import { Button, Collapse, Form, Input, Select, Space } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CommandDrawer, type Field } from '@/features/business/business-ui'
import { useBusinessQuery } from '@/features/business/business-data'
import {
  configurationOptions,
  projectTypeOptions,
  type ConfigurationDetail,
  type ConfigurationKind,
  type StageDefinition,
} from './configuration-types'

type StageForm = Omit<
  StageDefinition,
  'milestones' | 'actions' | 'deliverables'
> & {
  milestones: string
  actions: string
  deliverables: string
}

const lines = (value: unknown): string[] =>
  typeof value === 'string'
    ? value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : []

export function ConfigurationEditor({
  kind,
  detail,
  onClose,
  onSaved,
}: {
  kind: ConfigurationKind
  detail?: ConfigurationDetail
  onClose: () => void
  onSaved: (detail: ConfigurationDetail) => void
}) {
  const template = kind === 'STAGE_TEMPLATE'
  const people = useBusinessQuery<{ id: string; name: string }[]>(
    template ? undefined : '/api/business/people',
  )
  const candidates = [
    ...new Map(
      [...(detail?.people ?? []), ...(people.data ?? [])].map((person) => [
        person.id,
        person,
      ]),
    ).values(),
  ].map((person) => ({
    ...person,
    disabled:
      people.isSuccess &&
      !people.data.some((active) => active.id === person.id),
  }))
  const fields: Field[] = [
    { name: 'name', label: '配置名称', type: 'text', wide: true },
    {
      name: 'versionNote',
      label: '版本说明',
      type: 'textarea',
      maxLength: 2000,
    },
    {
      name: 'projectTypes',
      label: '适用项目类型',
      type: 'multiple',
      options: projectTypeOptions,
      required: false,
      wide: true,
    },
    ...(!template
      ? ([
          {
            name: 'minimumBudget',
            label: '预算最低金额（元，含）',
            type: 'number',
            required: false,
          },
          {
            name: 'maximumBudget',
            label: '预算最高金额（元，含）',
            type: 'number',
            required: false,
            hint: '留空表示未设置上限。',
          },
          {
            name: 'riskLevels',
            label: '适用风险级别',
            type: 'multiple',
            options: configurationOptions(['LOW', 'MEDIUM', 'HIGH']),
            required: false,
            wide: true,
          },
          {
            name: 'finalApproverId',
            label: '最终批准人',
            type: 'select',
            options: candidates.map((p) => ({
              value: p.id,
              label: p.name,
              disabled: p.disabled,
            })),
            required: false,
            wide: true,
          },
          {
            name: 'authorityBasis',
            label: '公司授权与适用依据',
            type: 'textarea',
            required: false,
          },
        ] satisfies Field[])
      : []),
  ]
  const stages: StageForm[] =
    detail?.template?.stages.map((stage) => ({
      ...stage,
      milestones: stage.milestones.join('\n'),
      actions: stage.actions.join('\n'),
      deliverables: stage.deliverables.join('\n'),
    })) ?? []
  return (
    <CommandDrawer
      onClose={onClose}
      command={{
        title: `${detail ? '维护' : '新建'}${template ? '阶段模板' : 'DG-02 评审规则'}`,
        description: template
          ? '先保存草稿，再逐项检查发布条件。项目选用后保留该版本的阶段、责任与完成要求。'
          : '配置适用条件和必要评审分工。发布须公司授权，人员参与项目时仍需实际具备评审权限。',
        path: `/api/delivery-configurations${detail ? '/' + detail.configuration.id : ''}`,
        method: detail ? 'PATCH' : 'POST',
        submitLabel: '保存草稿',
        fields,
        values: {
          name: detail?.configuration.name,
          versionNote: detail?.versionNote,
          projectTypes:
            detail?.template?.projectTypes ??
            detail?.policy?.projectTypes ??
            [],
          stages,
          minimumBudget: detail?.policy?.minimumBudget ?? 0,
          maximumBudget: detail?.policy?.maximumBudget,
          riskLevels: detail?.policy?.riskLevels ?? [],
          finalApproverId: detail?.policy?.finalApproverId,
          authorityBasis: detail?.policy?.authorityBasis,
          reviewers: detail?.policy?.reviewers ?? [],
        },
        formExtra: template ? (
          <TemplateFields />
        ) : (
          <ReviewerFields people={candidates} />
        ),
        transform: (values) => ({
          ...(detail ? { version: detail.configuration.version } : { kind }),
          name: values.name,
          versionNote: values.versionNote,
          template: template
            ? {
                projectTypes: values.projectTypes ?? [],
                stages: ((values.stages ?? []) as StageForm[]).map((stage) => ({
                  code: stage.code,
                  name: stage.name,
                  applicability: stage.applicability,
                  condition: stage.condition || null,
                  ownerRoleHint: stage.ownerRoleHint || null,
                  predecessorCodes: stage.predecessorCodes ?? [],
                  parallelCodes: stage.parallelCodes ?? [],
                  milestones: lines(stage.milestones),
                  actions: lines(stage.actions),
                  deliverables: lines(stage.deliverables),
                  completionCriteria: stage.completionCriteria || null,
                })),
              }
            : null,
          policy: !template
            ? {
                projectTypes: values.projectTypes ?? [],
                minimumBudget: values.minimumBudget ?? 0,
                maximumBudget: values.maximumBudget ?? null,
                riskLevels: values.riskLevels ?? [],
                finalApproverId: values.finalApproverId ?? null,
                authorityBasis: values.authorityBasis || null,
                reviewers: values.reviewers ?? [],
              }
            : null,
        }),
        onSuccess: (result) => onSaved(result as ConfigurationDetail),
      }}
    />
  )
}

function TemplateFields() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const form = Form.useFormInstance()
  const stages = Form.useWatch<StageForm[]>('stages', form) ?? []
  const stageOptions = stages
    .filter((s) => s?.code)
    .map((s) => ({ value: s.code, label: `${s.code} · ${s.name || '待命名'}` }))
  return (
    <Form.List name="stages">
      {(fields, { add, remove }) => (
        <div className="delivery-config-stage-editor">
          <div className="delivery-config-editor-heading">
            <strong>阶段定义 · {fields.length} 项</strong>
            <Button
              size="small"
              icon={<Plus size={14} />}
              disabled={fields.length >= 30}
              onClick={() => {
                setOpenIndex(fields.length)
                add({
                  applicability: 'REQUIRED',
                  predecessorCodes: [],
                  parallelCodes: [],
                })
              }}
            >
              添加阶段
            </Button>
          </div>
          {!fields.length && (
            <p className="business-muted">
              添加适用阶段，再补齐责任、依赖、成果与完成条件。
            </p>
          )}
          <Collapse
            accordion
            activeKey={
              openIndex == null ? [] : String(fields[openIndex]?.key ?? '')
            }
            onChange={(keys) => {
              const key = Array.isArray(keys) ? keys[0] : keys
              const index = fields.findIndex(
                (field) => String(field.key) === String(key),
              )
              setOpenIndex(index < 0 ? null : index)
            }}
            items={fields.map((field, index) => ({
              key: field.key,
              label: `${index + 1}. ${stages[index]?.name || '新阶段'}${stages[index]?.code ? ' · ' + stages[index].code : ''}`,
              forceRender: true,
              extra: (
                <Button
                  type="text"
                  size="small"
                  aria-label={`移除阶段 ${index + 1}`}
                  icon={<Trash2 size={14} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(field.name)
                    setOpenIndex(null)
                  }}
                />
              ),
              children: (
                <div className="business-form-grid">
                  <Form.Item
                    name={[field.name, 'code']}
                    label="阶段代码"
                    rules={[
                      {
                        required: true,
                        pattern: /^[A-Z][A-Z0-9_]{0,39}$/,
                        message: '使用大写字母开头的代码。',
                      },
                    ]}
                  >
                    <Input maxLength={40} placeholder="例如 DESIGN" />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'name']}
                    label="阶段名称"
                    rules={[{ required: true, whitespace: true }]}
                  >
                    <Input maxLength={80} />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'applicability']}
                    label="适用方式"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={configurationOptions([
                        'REQUIRED',
                        'OPTIONAL',
                        'CONDITIONAL',
                      ])}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'ownerRoleHint']}
                    label="责任角色提示"
                  >
                    <Input maxLength={160} placeholder="例如专业负责人" />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'condition']}
                    label="适用条件"
                    className="business-field-wide"
                  >
                    <Input.TextArea
                      rows={2}
                      maxLength={2000}
                      placeholder="条件适用阶段在发布前必填。"
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'predecessorCodes']}
                    label="前置阶段"
                  >
                    <Select
                      mode="multiple"
                      options={stageOptions.filter(
                        (s) => s.value !== stages[index]?.code,
                      )}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'parallelCodes']}
                    label="可并行阶段"
                  >
                    <Select
                      mode="multiple"
                      options={stageOptions.filter(
                        (s) => s.value !== stages[index]?.code,
                      )}
                    />
                  </Form.Item>
                  {(
                    [
                      ['milestones', '关键里程碑'],
                      ['actions', '规定动作'],
                      ['deliverables', '交付成果'],
                    ] as const
                  ).map(([name, title]) => (
                    <Form.Item
                      key={name}
                      name={[field.name, name]}
                      label={title}
                      className="business-field-wide"
                      extra="每行一项，最多 30 项，每项 300 字。"
                    >
                      <Input.TextArea rows={2} maxLength={9029} />
                    </Form.Item>
                  ))}
                  <Form.Item
                    name={[field.name, 'completionCriteria']}
                    label="完成条件"
                    className="business-field-wide"
                  >
                    <Input.TextArea rows={2} maxLength={2000} />
                  </Form.Item>
                </div>
              ),
            }))}
          />
        </div>
      )}
    </Form.List>
  )
}

function ReviewerFields({
  people,
}: {
  people: { id: string; name: string; disabled?: boolean }[]
}) {
  return (
    <Form.List name="reviewers">
      {(fields, { add, remove }) => (
        <div className="delivery-config-stage-editor">
          <div className="delivery-config-editor-heading">
            <strong>必要会签 · {fields.length} 人</strong>
            <Button
              size="small"
              icon={<Plus size={14} />}
              disabled={fields.length >= 12}
              onClick={() => add({ scope: 'TECHNICAL' })}
            >
              添加会签人
            </Button>
          </div>
          {fields.map((field, index) => (
            <div className="delivery-config-reviewer-editor" key={field.key}>
              <Form.Item
                name={[field.name, 'accountId']}
                label={`会签人 ${index + 1}`}
                rules={[{ required: true, message: '请选择会签人。' }]}
              >
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  options={people.map((p) => ({
                    value: p.id,
                    label: p.name,
                    disabled: p.disabled,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name={[field.name, 'scope']}
                label="会签范围"
                rules={[{ required: true }]}
              >
                <Select
                  options={configurationOptions([
                    'TECHNICAL',
                    'COMMERCIAL',
                    'FINANCIAL',
                    'SAFETY',
                    'QUALITY',
                  ])}
                />
              </Form.Item>
              <Space>
                <Button
                  type="text"
                  aria-label={`移除会签人 ${index + 1}`}
                  icon={<Trash2 size={16} />}
                  onClick={() => remove(field.name)}
                />
              </Space>
            </div>
          ))}
          {!fields.length && (
            <p className="business-muted">
              至少配置一名必要会签人；最终批准人单独填写。
            </p>
          )}
        </div>
      )}
    </Form.List>
  )
}
