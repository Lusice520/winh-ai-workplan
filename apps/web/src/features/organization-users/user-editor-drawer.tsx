import { Button, Drawer, Form, Input, TreeSelect } from 'antd'
import {
  Building2,
  ChevronDown,
  FileKey2,
  LockKeyhole,
  MoveRight,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { useEffect } from 'react'

import {
  DrawerTitle,
  FormSection,
  type OrganizationTreeOption,
  type UserDrawerState,
  type UserFormValues,
} from '@/features/organization-users/organization-user-ui'
import { useUnsavedFormGuard } from '@/features/organization-users/form-guard'

type UserEditorDrawerProps = {
  state: UserDrawerState
  defaultOrganizationUnitId?: string
  organizationOptions: OrganizationTreeOption[]
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: UserFormValues) => void
}

export function UserEditorDrawer({
  state,
  defaultOrganizationUnitId,
  organizationOptions,
  isSubmitting,
  onClose,
  onSubmit,
}: UserEditorDrawerProps) {
  const [form] = Form.useForm<UserFormValues>()
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
        loginName: state.user.loginName,
        displayName: state.user.displayName,
        employeeCode: state.user.employeeCode ?? undefined,
        workEmail: state.user.workEmail ?? undefined,
        mobilePhone: state.user.mobilePhone ?? undefined,
        organizationUnitId: state.user.organizationUnit.id,
      })
      return
    }

    form.setFieldsValue({ organizationUnitId: defaultOrganizationUnitId })
  }, [defaultOrganizationUnitId, form, state])

  return (
    <Drawer
      title={
        <DrawerTitle
          icon={<UserPlus className="size-5" />}
          title={state?.mode === 'edit' ? '编辑用户' : '新建用户'}
          subtitle="组织与用户 / 用户目录"
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
            {state?.mode === 'edit' ? '保存资料' : '创建用户'}
          </Button>
        </div>
      }
    >
      <Form<UserFormValues>
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
        <FormSection icon={<UsersRound className="size-4" />} title="基础信息">
          <Form.Item
            label="姓名"
            name="displayName"
            rules={[
              { required: true, message: '请输入姓名' },
              { max: 100, message: '姓名不能超过 100 个字符' },
            ]}
          >
            <Input
              autoComplete="name"
              maxLength={100}
              name="displayName"
              placeholder="例如：陈子安…"
            />
          </Form.Item>
          <Form.Item
            label="登录账号"
            name="loginName"
            rules={[
              { required: true, message: '请输入登录账号' },
              { max: 100, message: '登录账号不能超过 100 个字符' },
            ]}
          >
            <Input
              autoComplete="username"
              disabled={state?.mode === 'edit'}
              maxLength={100}
              name="loginName"
              placeholder="例如：chen.ya…"
              spellCheck={false}
            />
          </Form.Item>
          <Form.Item
            label="内部标识"
            name="employeeCode"
            rules={[{ max: 100, message: '内部标识不能超过 100 个字符' }]}
          >
            <Input
              autoComplete="off"
              maxLength={100}
              name="employeeCode"
              placeholder="可选，例如：HN00124…"
              spellCheck={false}
            />
          </Form.Item>
          <Form.Item
            label="工作邮箱"
            name="workEmail"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input
              autoComplete="email"
              maxLength={254}
              name="workEmail"
              placeholder="例如：name@example.com…"
              spellCheck={false}
              type="email"
            />
          </Form.Item>
          <Form.Item
            label="手机号"
            name="mobilePhone"
            rules={[{ max: 32, message: '手机号不能超过 32 个字符' }]}
          >
            <Input
              autoComplete="tel"
              inputMode="tel"
              maxLength={32}
              name="mobilePhone"
              placeholder="可选，例如：138****5678…"
              spellCheck={false}
              type="tel"
            />
          </Form.Item>
        </FormSection>
        <FormSection
          icon={<Building2 className="size-4" />}
          tone="violet"
          title="组织归属"
        >
          <Form.Item
            label="公司 / 部门"
            name="organizationUnitId"
            rules={
              state?.mode === 'create'
                ? [{ required: true, message: '请选择公司或部门' }]
                : []
            }
          >
            <TreeSelect
              treeData={organizationOptions}
              treeDefaultExpandAll
              disabled={state?.mode === 'edit'}
              placeholder="请选择公司或部门"
              suffixIcon={<ChevronDown className="size-4" />}
            />
          </Form.Item>
          {state?.mode === 'edit' ? (
            <div className="form-security-note">
              <MoveRight className="size-4 shrink-0" />
              组织归属需使用“调整部门”操作完成，以确保调动原因和组织历史被记录。
            </div>
          ) : null}
        </FormSection>
        {state?.mode === 'create' ? (
          <FormSection
            icon={<FileKey2 className="size-4" />}
            tone="amber"
            title="初始凭证"
          >
            <Form.Item
              label="临时密码"
              name="temporaryPassword"
              extra="至少 12 位，且包含字母、数字与符号；首次登录后必须更新。"
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
            <div className="form-security-note">
              <LockKeyhole className="size-4 shrink-0" />
              密码仅用于本次创建请求，界面不会在用户详情或审计记录中回显。
            </div>
          </FormSection>
        ) : null}
      </Form>
    </Drawer>
  )
}
