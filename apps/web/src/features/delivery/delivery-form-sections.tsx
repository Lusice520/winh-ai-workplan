import { Button, Form, Input, InputNumber, Select } from 'antd'
import { Minus, Plus } from 'lucide-react'
import {
  deliveryOptions,
  objectOptions,
  personName,
  type DeliveryWorkspace,
  type WorkPackageCandidate,
} from './delivery-types'
type Option = { value: string; label: string }

export function WorkPackageSource({
  candidates,
}: {
  candidates: WorkPackageCandidate[]
}) {
  const form = Form.useFormInstance()
  return (
    <Form.Item
      name="existingWorkItemId"
      label="接纳已有工作包"
      extra="选择后保留原记录和需求来源；工作范围与交付要求仍需确认。也可留空新建。"
    >
      <Select
        allowClear
        showSearch={{ optionFilterProp: 'label' }}
        options={candidates.map((w) => ({
          value: w.id,
          label: `${w.title}${w.sourceRequirementId ? ' · 来自需求池' : ''}`,
        }))}
        onChange={(id) => {
          const w = candidates.find((c) => c.id === id)
          if (w)
            form.setFieldsValue({
              title: w.title,
              ownerId: w.ownerId,
              verifierId: w.verifierId,
              endsOn: w.dueDate,
            })
        }}
      />
    </Form.Item>
  )
}

export function BudgetLines({ data }: { data: DeliveryWorkspace }) {
  const refs: { name: string; label: string; options: Option[] }[] = [
    {
      name: 'stageId',
      label: '所属阶段',
      options: objectOptions(data, 'STAGE'),
    },
    {
      name: 'workPackageId',
      label: '工作包',
      options: objectOptions(data, 'WORK_PACKAGE'),
    },
    {
      name: 'resourceRequestId',
      label: '资源申请',
      options: data.resources
        .filter((r) => r.status !== 'REVOKED')
        .map((r) => ({
          value: r.id,
          label: `${personName(data, r.request.personId)} · ${r.request.startsOn} · ${r.request.dailyHours} 小时/天`,
        })),
    },
    { name: 'itemId', label: '清单项', options: objectOptions(data, 'ITEM') },
  ]
  return (
    <div className="delivery-budget-editor">
      <h3>费用明细</h3>
      <p className="business-text-small">
        人员成本关联资源申请；采购与分包费用关联清单。金额单位为元。
      </p>
      <Form.List name="lines">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name }) => (
              <div className="delivery-budget-line-form" key={key}>
                <div className="delivery-budget-line-heading">
                  <strong>费用 {name + 1}</strong>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<Minus size={14} />}
                    onClick={() => remove(name)}
                  >
                    移除本行
                  </Button>
                </div>
                <div className="business-form-grid">
                  <Form.Item
                    name={[name, 'title']}
                    label="费用名称"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: '请填写费用名称',
                      },
                    ]}
                  >
                    <Input maxLength={160} />
                  </Form.Item>
                  <Form.Item
                    name={[name, 'category']}
                    label="费用类别"
                    rules={[{ required: true, message: '请选择费用类别' }]}
                  >
                    <Select
                      options={deliveryOptions([
                        'PERSONNEL',
                        'PROCUREMENT',
                        'SUBCONTRACT',
                        'TRAVEL',
                        'OTHER',
                      ])}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[name, 'amount']}
                    label="金额（元）"
                    rules={[{ required: true, message: '请填写金额' }]}
                  >
                    <InputNumber
                      stringMode
                      min="0"
                      max="999999999999.99"
                      precision={2}
                      className="!w-full"
                    />
                  </Form.Item>
                  {refs.map((ref) => (
                    <Form.Item
                      key={ref.name}
                      name={[name, ref.name]}
                      label={ref.label}
                    >
                      <Select
                        allowClear
                        showSearch={{ optionFilterProp: 'label' }}
                        options={ref.options}
                      />
                    </Form.Item>
                  ))}
                  <Form.Item
                    className="business-field-wide"
                    name={[name, 'basis']}
                    label="测算依据"
                  >
                    <Input.TextArea rows={2} maxLength={2000} />
                  </Form.Item>
                </div>
              </div>
            ))}
            <Button
              type="dashed"
              block
              icon={<Plus size={15} />}
              onClick={() =>
                add({
                  category: 'OTHER',
                  amount: '0.00',
                  stageId: null,
                  workPackageId: null,
                  resourceRequestId: null,
                  itemId: null,
                  basis: null,
                })
              }
            >
              添加费用明细
            </Button>
          </>
        )}
      </Form.List>
    </div>
  )
}
