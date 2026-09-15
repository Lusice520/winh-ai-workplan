import { App as AntdApp, Button, Card, Form, Input, Typography } from 'antd'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router'

import { getProblemMessage } from '@/api/client/http'
import {
  useChangePassword,
  useCurrentSession,
} from '@/features/auth/auth-session'

type PasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmation: string
}

export function ChangePasswordPage() {
  const { message } = AntdApp.useApp()
  const navigate = useNavigate()
  const sessionQuery = useCurrentSession()
  const changePasswordMutation = useChangePassword()
  const [form] = Form.useForm<PasswordFormValues>()

  async function submit(values: PasswordFormValues) {
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success('密码已更新，请继续使用工作台。')
      navigate('/system/organization-users', { replace: true })
    } catch (error) {
      form.setFields([
        {
          name: 'currentPassword',
          errors: [getProblemMessage(error, '密码更新未完成，请稍后重试。')],
        },
      ])
    }
  }

  return (
    <main className="login-page-shell">
      <section className="login-page-intro" aria-hidden="true">
        <div className="login-page-intro__mark">
          <span className="grid size-11 place-items-center rounded-[14px] bg-white/14 text-white shadow-sm">
            <ShieldCheck className="size-6" />
          </span>
          <span>项目工作台</span>
        </div>
        <div>
          <p className="login-page-intro__eyebrow">ACCOUNT SECURITY</p>
          <h1>
            先更新密码，
            <br />
            再进入工作台。
          </h1>
          <p>临时密码只能用于本次初始验证，不会在后续页面中明文展示。</p>
        </div>
      </section>

      <section className="login-page-form-region">
        <Card className="login-page-card !border-[#e2e8f2] !shadow-none">
          <div className="mb-8">
            <div className="mb-4 grid size-11 place-items-center rounded-xl bg-[#eef4ff] text-[#3157d5]">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </div>
            <Typography.Title level={2} className="!mb-2 !text-[#1f2d48]">
              更新初始密码
            </Typography.Title>
            <Typography.Paragraph className="!mb-0 !text-sm !leading-6 !text-[#73819a]">
              {sessionQuery.data?.displayName
                ? `${sessionQuery.data.displayName}，请设置一个只由你掌握的新密码。`
                : '请设置一个只由你掌握的新密码。'}
            </Typography.Paragraph>
          </div>

          <Form<PasswordFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            scrollToFirstError={{
              behavior: 'smooth',
              block: 'center',
              focus: true,
            }}
            onFinish={(values) => void submit(values)}
          >
            <Form.Item
              label="当前临时密码"
              name="currentPassword"
              rules={[{ required: true, message: '请输入当前临时密码' }]}
            >
              <Input.Password
                autoComplete="current-password"
                name="currentPassword"
                size="large"
              />
            </Form.Item>
            <Form.Item
              label="新密码"
              name="newPassword"
              extra="至少 12 位，且包含字母、数字与符号。"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 12, message: '新密码至少需要 12 位' },
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                name="newPassword"
                size="large"
              />
            </Form.Item>
            <Form.Item
              label="确认新密码"
              name="confirmation"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请再次输入新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    return !value || getFieldValue('newPassword') === value
                      ? Promise.resolve()
                      : Promise.reject(new Error('两次输入的密码不一致'))
                  },
                }),
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                name="confirmation"
                size="large"
              />
            </Form.Item>
            <Button
              block
              className="!mt-2"
              htmlType="submit"
              loading={changePasswordMutation.isPending}
              size="large"
              type="primary"
            >
              保存并进入工作台
            </Button>
          </Form>
        </Card>
      </section>
    </main>
  )
}
