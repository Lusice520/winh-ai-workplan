import { Button, Drawer, Form, Input, Select, TreeSelect } from 'antd'
import {
  ChevronDown,
  FileText,
  MoveRight,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useEffect } from 'react'

import { accountStatusMeta } from '@/features/organization-users/organization-user-helpers'
import {
  DrawerTitle,
  FormSection,
  type AccountActionFormValues,
  type AccountActionState,
  type OrganizationTreeOption,
} from '@/features/organization-users/organization-user-ui'
import { useUnsavedFormGuard } from '@/features/organization-users/form-guard'

type UserAccountActionDrawerProps = {
  state?: AccountActionState
  organizationOptions: OrganizationTreeOption[]
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: AccountActionFormValues) => void
}

export function UserAccountActionDrawer({
  state,
  organizationOptions,
  isSubmitting,
  onClose,
  onSubmit,
}: UserAccountActionDrawerProps) {
  const [form] = Form.useForm<AccountActionFormValues>()
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
    if (state.action === 'move') {
      form.setFieldsValue({
        targetOrganizationUnitId: state.user.organizationUnit.id,
      })
    }
    if (state.action === 'status') {
      form.setFieldsValue({
        targetStatus:
          state.user.accountStatus === 'ENABLED' ? 'DISABLED' : 'ENABLED',
      })
    }
  }, [form, state])

  const actionIcon =
    state?.action === 'move' ? (
      <MoveRight className="size-5" />
    ) : state?.action === 'status' ? (
      <ShieldCheck className="size-5" />
    ) : (
      <RefreshCw className="size-5" />
    )
  const title =
    state?.action === 'move'
      ? '调整用户部门'
      : state?.action === 'status'
        ? '调整账号状态'
        : '重置临时密码'

  return (
    <Drawer
      title={
        <DrawerTitle
          icon={actionIcon}
          title={title}
          subtitle={
            state
              ? `${state.user.displayName} / ${state.user.loginName}`
              : '用户管理'
          }
        />
      }
      placement="right"
      size={500}
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
            确认提交
          </Button>
        </div>
      }
    >
      <Form<AccountActionFormValues>
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
        <FormSection icon={<ShieldCheck className="size-4" />} title="操作内容">
          {state?.action === 'move' ? (
            <Form.Item
              label="目标部门"
              name="targetOrganizationUnitId"
              rules={[{ required: true, message: '请选择目标部门' }]}
            >
              <TreeSelect
                treeData={organizationOptions}
                treeDefaultExpandAll
                placeholder="请选择目标部门"
                suffixIcon={<ChevronDown className="size-4" />}
              />
            </Form.Item>
          ) : null}
          {state?.action === 'status' ? (
            <Form.Item
              label="目标状态"
              name="targetStatus"
              rules={[{ required: true, message: '请选择目标状态' }]}
            >
              <Select
                options={Object.entries(accountStatusMeta).map(
                  ([value, meta]) => ({ value, label: meta.label }),
                )}
              />
            </Form.Item>
          ) : null}
          {state?.action === 'reset-password' ? (
            <Form.Item
              label="临时密码"
              name="temporaryPassword"
              extra="该用户下次登录必须修改密码。"
              rules={[
                { required: true, message: '请设置临时密码' },
                { min: 12, message: '临时密码至少需要 12 位' },
                {
                  pattern: /(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d])/,
                  message: '密码需包含字母、数字和符号',
                },
              ]}
            >
              <Input.Password
                placeholder="输入临时密码…"
                autoComplete="new-password"
                name="temporaryPassword"
              />
            </Form.Item>
          ) : null}
        </FormSection>
        <FormSection
          icon={<FileText className="size-4" />}
          tone="violet"
          title="变更说明"
        >
          <Form.Item
            label="操作原因"
            name="reason"
            labelCol={{ span: 24 }}
            wrapperCol={{ span: 24 }}
            className="form-item--stacked"
            rules={[{ required: true, message: '请填写操作原因' }]}
          >
            <Input.TextArea
              autoComplete="off"
              name="reason"
              rows={4}
              maxLength={500}
              showCount
              placeholder="说明本次操作原因，便于审计与后续追溯。"
            />
          </Form.Item>
        </FormSection>
      </Form>
    </Drawer>
  )
}
