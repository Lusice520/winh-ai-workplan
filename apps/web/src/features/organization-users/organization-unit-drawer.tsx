import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  TreeSelect,
} from 'antd'
import {
  Building2,
  ChevronDown,
  CircleAlert,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { useEffect } from 'react'

import {
  DrawerTitle,
  FormSection,
  type DepartmentDrawerState,
  type DepartmentFormValues,
  type OrganizationTreeOption,
} from '@/features/organization-users/organization-user-ui'
import { useUnsavedFormGuard } from '@/features/organization-users/form-guard'

type OrganizationUnitDrawerProps = {
  state: DepartmentDrawerState
  defaultParentId?: string
  organizationOptions: OrganizationTreeOption[]
  managerOptions: Array<{ value: string; label: string }>
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: DepartmentFormValues) => void
}

export function OrganizationUnitDrawer({
  state,
  defaultParentId,
  organizationOptions,
  managerOptions,
  isSubmitting,
  onClose,
  onSubmit,
}: OrganizationUnitDrawerProps) {
  const [form] = Form.useForm<DepartmentFormValues>()
  const requestClose = useUnsavedFormGuard({
    form,
    enabled: Boolean(state),
    isSubmitting,
    onDiscard: onClose,
  })

  useEffect(() => {
    if (!state) {
      return
    }

    form.resetFields()
    if (state.mode === 'edit') {
      form.setFieldsValue({
        name: state.unit.name,
        code: state.unit.code,
        parentId: state.unit.parentId ?? undefined,
        managerAccountId: state.unit.managerAccountId ?? undefined,
        status: state.unit.status,
        sortOrder: state.unit.sortOrder,
        reason: '',
      })
      return
    }

    form.setFieldsValue({
      parentId: defaultParentId,
      status: 'ENABLED',
      sortOrder: 50,
    })
  }, [defaultParentId, form, state])

  const isRootOrganization =
    state?.mode === 'edit' && state.unit.unitType === 'COMPANY'

  return (
    <Drawer
      title={
        <DrawerTitle
          icon={<Building2 className="size-5" />}
          title={state?.mode === 'edit' ? '编辑组织' : '新建部门'}
          subtitle="组织与用户 / 组织维护"
        />
      }
      placement="right"
      size={520}
      open={Boolean(state)}
      destroyOnHidden
      className="management-form-drawer"
      closable={!isSubmitting}
      onClose={requestClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button disabled={isSubmitting} onClick={requestClose}>
            取消
          </Button>
          <Button
            type="primary"
            loading={isSubmitting}
            onClick={() => form.submit()}
          >
            {state?.mode === 'edit' ? '保存变更' : '创建部门'}
          </Button>
        </div>
      }
    >
      <div className="form-drawer-stack">
        {state?.mode === 'edit' ? (
          <div className="form-impact-notice">
            <CircleAlert className="size-4 shrink-0" />
            停用前需先处理启用中的下级组织与直属启用账号；历史关联和审计记录会被保留。
          </div>
        ) : null}
        <Form<DepartmentFormValues>
          form={form}
          layout="horizontal"
          labelAlign="left"
          labelCol={{ flex: '126px' }}
          wrapperCol={{ flex: 'auto' }}
          requiredMark
          colon={false}
          className="form-section-stack"
          scrollToFirstError={{
            behavior: 'smooth',
            block: 'center',
            focus: true,
          }}
          onFinish={onSubmit}
        >
          <FormSection icon={<Building2 className="size-4" />} title="基础信息">
            <Form.Item
              label="组织名称"
              name="name"
              rules={[
                { required: true, message: '请输入组织名称' },
                { max: 100, message: '组织名称不能超过 100 个字符' },
              ]}
            >
              <Input
                autoComplete="off"
                maxLength={100}
                name="organizationName"
                placeholder="例如：华东业务部…"
              />
            </Form.Item>
            <Form.Item
              label="组织编码"
              name="code"
              rules={[
                { required: true, message: '请输入组织编码' },
                { max: 64, message: '组织编码不能超过 64 个字符' },
              ]}
            >
              <Input
                autoComplete="off"
                maxLength={64}
                name="organizationCode"
                placeholder="例如：EAST-BIZ…"
                spellCheck={false}
              />
            </Form.Item>
            <Form.Item
              label="上级组织"
              name="parentId"
              rules={
                isRootOrganization
                  ? []
                  : [{ required: true, message: '请选择上级组织' }]
              }
            >
              <TreeSelect
                treeData={organizationOptions}
                treeDefaultExpandAll
                disabled={isRootOrganization}
                placeholder={
                  isRootOrganization ? '根组织不设置上级组织' : '请选择上级组织'
                }
                suffixIcon={<ChevronDown className="size-4" />}
              />
            </Form.Item>
            <Form.Item label="组织负责人" name="managerAccountId">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="可选：从当前目录选择负责人"
                options={managerOptions}
              />
            </Form.Item>
          </FormSection>
          <FormSection
            icon={<ShieldCheck className="size-4" />}
            tone="amber"
            title="状态与排序"
          >
            <Form.Item
              label="组织状态"
              name="status"
              rules={[{ required: true, message: '请选择组织状态' }]}
            >
              <Radio.Group>
                <Radio value="ENABLED">启用</Radio>
                <Radio value="DISABLED">停用</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label="排序"
              name="sortOrder"
              rules={[{ required: true, message: '请输入排序值' }]}
            >
              <InputNumber
                className="!w-full"
                min={0}
                max={9999}
                placeholder="默认值为 50"
              />
            </Form.Item>
          </FormSection>
          <FormSection
            icon={<FileText className="size-4" />}
            tone="violet"
            title="变更说明"
          >
            <Form.Item
              label="变更原因"
              name="reason"
              labelCol={{ span: 24 }}
              wrapperCol={{ span: 24 }}
              className="form-item--stacked"
              rules={
                state?.mode === 'edit'
                  ? [{ required: true, message: '请说明本次变更原因' }]
                  : []
              }
            >
              <Input.TextArea
                autoComplete="off"
                name="changeReason"
                rows={4}
                maxLength={500}
                showCount
                placeholder="说明本次组织调整的原因，便于后续审计追溯。"
              />
            </Form.Item>
          </FormSection>
        </Form>
      </div>
    </Drawer>
  )
}
