import { App as AntdApp, Button, Card, Form, Input, Typography } from 'antd'
import { KeyRound, LockKeyhole, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { getProblemMessage } from '@/api/client/http'
import { useLogin } from '@/features/auth/auth-session'

type LoginFormValues = {
  loginName: string
  password: string
}

function safeRedirect(value: unknown) {
  return typeof value === 'string' && value.startsWith('/')
    ? value
    : '/system/organization-users'
}

export function LoginPage() {
  const { message } = AntdApp.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const loginMutation = useLogin()
  const [form] = Form.useForm<LoginFormValues>()
  const [submitError, setSubmitError] = useState<string>()

  async function submit(values: LoginFormValues) {
    setSubmitError(undefined)
    try {
      const session = await loginMutation.mutateAsync({
        loginName: values.loginName.trim(),
        password: values.password,
      })
      message.success(`欢迎回来，${session.displayName}`)
      navigate(
        session.mustChangePassword
          ? '/password/change'
          : safeRedirect((location.state as { from?: unknown } | null)?.from),
        { replace: true },
      )
    } catch (error) {
      setSubmitError(getProblemMessage(error, '登录未完成，请稍后重试。'))
    }
  }

  return (
    <main className="login-page-shell">
      <section className="login-page-intro" aria-hidden="true">
        <div className="login-page-intro__mark">
          <span className="grid size-11 place-items-center rounded-[14px] bg-white/14 text-white shadow-sm">
            <KeyRound className="size-6" />
          </span>
          <span>项目工作台</span>
        </div>
        <div>
          <p className="login-page-intro__eyebrow">LOCAL WORKSPACE</p>
          <h1>
            让项目协作，
            <br />
            从可信的身份开始。
          </h1>
          <p>
            本地会话由服务端签发并受空闲超时保护；首次创建或重置密码的账号，需要先完成密码更新。
          </p>
        </div>
      </section>

      <section className="login-page-form-region">
        <Card className="login-page-card !border-[#e2e8f2] !shadow-none">
          <div className="mb-8">
            <div className="mb-4 grid size-11 place-items-center rounded-xl bg-[#eef4ff] text-[#3157d5]">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </div>
            <Typography.Title level={2} className="!mb-2 !text-[#1f2d48]">
              登录工作台
            </Typography.Title>
            <Typography.Paragraph className="!mb-0 !text-sm !leading-6 !text-[#73819a]">
              使用管理员为你创建的本地账号登录。
            </Typography.Paragraph>
          </div>

          <Form<LoginFormValues>
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
              label="登录账号"
              name="loginName"
              rules={[{ required: true, message: '请输入登录账号' }]}
            >
              <Input
                autoComplete="username"
                name="loginName"
                prefix={<UserRound className="size-4 text-[#8996ab]" />}
                placeholder="例如：admin…"
                size="large"
                spellCheck={false}
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                autoComplete="current-password"
                name="password"
                prefix={<LockKeyhole className="size-4 text-[#8996ab]" />}
                placeholder="输入你的密码…"
                size="large"
              />
            </Form.Item>
            {submitError ? (
              <div
                className="login-page-error"
                role="status"
                aria-live="polite"
              >
                {submitError}
              </div>
            ) : null}
            <Button
              block
              className="!mt-2"
              htmlType="submit"
              loading={loginMutation.isPending}
              size="large"
              type="primary"
            >
              登录
            </Button>
          </Form>
          <Typography.Paragraph className="!mt-6 !mb-0 !text-xs !leading-5 !text-[#8996ab]">
            连续五次登录失败会暂时锁定账号 15
            分钟。忘记密码请联系系统管理员重置。
          </Typography.Paragraph>
        </Card>
      </section>
    </main>
  )
}
