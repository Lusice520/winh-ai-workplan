import {
  App as AntdApp,
  Avatar,
  Breadcrumb,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  Tooltip,
  Typography,
  type MenuProps,
} from 'antd'
import {
  Blocks,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  Menu as MenuIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { getProblemMessage } from '@/api/client/http'
import { BusinessSearch } from '@/features/business/business-search'
import { useCurrentSession, useLogout } from '@/features/auth/auth-session'
import { getNavigation } from '@/features/menu-permissions/access-control-api'
import {
  menuItemsFromNavigation,
  navigationOpenKeys,
  navigationKeyForPath,
  pageContextForPath,
} from '@/features/menu-permissions/access-control-navigation'

const { Header, Sider, Content } = Layout

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 ${collapsed ? 'justify-center px-1' : 'px-2'}`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#eef4ff] text-[#2167f3]">
        <Blocks className="size-[21px]" aria-hidden="true" />
      </span>
      {!collapsed ? (
        <div className="min-w-0">
          <Typography.Text className="!block !truncate !text-[17px] !font-semibold !tracking-[-0.02em] !text-[#25334f]">
            项目工作台
          </Typography.Text>
          <Typography.Text className="!block !text-[10px] !tracking-[0.1em] !text-[#94a0b4] uppercase">
            Project workspace
          </Typography.Text>
        </div>
      ) : null}
    </div>
  )
}

function Navigation({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationQuery = useQuery({
    queryKey: ['access-control', 'navigation'],
    queryFn: ({ signal }) => getNavigation(signal),
    retry: false,
  })
  const items = useMemo<MenuProps['items']>(
    () => menuItemsFromNavigation(navigationQuery.data ?? []),
    [navigationQuery.data],
  )
  const defaultOpenKeys = useMemo(
    () => navigationOpenKeys(navigationQuery.data ?? []),
    [navigationQuery.data],
  )
  const selectedKey = navigationKeyForPath(location.pathname)

  if (navigationQuery.isPending) {
    return (
      <div className="px-3 py-5 text-sm text-[#7a879b]" role="status">
        正在读取已授权导航…
      </div>
    )
  }

  if (navigationQuery.isError) {
    return (
      <div className="px-3 py-5 text-sm leading-6 text-[#8a4b4b]">
        导航暂时不可用：
        {getProblemMessage(navigationQuery.error, '请刷新后重试。')}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="px-3 py-5 text-sm leading-6 text-[#7a879b]">
        当前账号没有可用导航。
      </div>
    )
  }

  return (
    <Menu
      className="workspace-navigation"
      mode="inline"
      inlineCollapsed={collapsed}
      defaultOpenKeys={defaultOpenKeys}
      selectedKeys={[selectedKey]}
      items={items}
      onClick={({ key }) => {
        if (typeof key === 'string' && key.startsWith('/')) {
          navigate(key)
          onNavigate?.()
        }
      }}
    />
  )
}

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <Brand collapsed={collapsed} />
      <div className="mx-2 mt-5 h-px bg-[#edf0f5]" />
      <Navigation collapsed={collapsed} onNavigate={onNavigate} />
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const currentSessionQuery = useCurrentSession()
  const logoutMutation = useLogout()
  const pageContext = pageContextForPath(location.pathname)

  const currentSession = currentSessionQuery.data

  async function signOut() {
    try {
      await logoutMutation.mutateAsync()
      message.success('已退出登录。')
      navigate('/login', { replace: true })
    } catch (error) {
      message.error(getProblemMessage(error, '退出登录未完成，请重试。'))
    }
  }

  function closeMobileNavigation() {
    setMobileOpen(false)
    window.requestAnimationFrame(() => mobileTriggerRef.current?.focus())
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <Layout className="min-h-dvh bg-[#f5f7fb]">
        <Sider
          width={236}
          collapsedWidth={76}
          collapsed={collapsed}
          trigger={null}
          className="workspace-sider !fixed inset-y-0 left-0 z-30 !hidden !border-r !border-[#e9edf4] !bg-white lg:!block"
        >
          <SidebarContent collapsed={collapsed} />
        </Sider>

        <Drawer
          title={<Brand />}
          placement="left"
          size={286}
          open={mobileOpen}
          destroyOnHidden
          keyboard
          closable
          onClose={closeMobileNavigation}
          className="workspace-mobile-navigation"
          styles={{
            header: {
              borderBottom: '1px solid #edf0f5',
              background: '#ffffff',
              padding: '16px 18px',
            },
            body: { background: '#ffffff', padding: 0 },
          }}
        >
          <SidebarContent
            collapsed={false}
            onNavigate={closeMobileNavigation}
          />
        </Drawer>

        <Layout
          className={`workspace-main-layout min-h-dvh ${collapsed ? 'workspace-main-layout--collapsed' : ''}`}
        >
          <Header className="workspace-header !sticky !top-0 !z-20 !flex !h-[58px] !items-center !border-b !border-[#e9edf4] !bg-white !px-3 sm:!px-5">
            <Button
              className="!mr-2 !hidden lg:!inline-flex"
              type="text"
              icon={
                collapsed ? (
                  <PanelLeftOpen className="size-[18px]" />
                ) : (
                  <PanelLeftClose className="size-[18px]" />
                )
              }
              aria-label={collapsed ? '展开导航' : '收起导航'}
              onClick={() => setCollapsed((value) => !value)}
            />
            <Button
              ref={mobileTriggerRef}
              className="!mr-2 lg:!hidden"
              type="text"
              icon={<MenuIcon className="size-[18px]" />}
              aria-label="打开导航"
              onClick={() => setMobileOpen(true)}
            />
            <Breadcrumb
              items={pageContext.map((title) => ({ title }))}
              className="!min-w-0 !text-sm [&_.ant-breadcrumb-link]:!font-medium [&_.ant-breadcrumb-link]:!text-[#33425d] [&_.ant-breadcrumb-separator]:!text-[#a3adbd]"
            />
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <BusinessSearch />
              <Tooltip title="帮助">
                <Button
                  type="text"
                  icon={<CircleHelp className="size-[18px]" />}
                  aria-label="帮助"
                  onClick={() => setHelpOpen(true)}
                />
              </Tooltip>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'current-account',
                      disabled: true,
                      label: (
                        <div className="py-1">
                          <div className="font-semibold text-[#25334f]">
                            {currentSession?.displayName ?? '本地账号'}
                          </div>
                          <div className="mt-0.5 text-xs text-[#8491a7]">
                            {currentSession?.loginName ?? '会话加载中'}
                          </div>
                        </div>
                      ),
                    },
                    { type: 'divider' },
                    { key: 'password', label: '修改密码' },
                    {
                      key: 'logout',
                      icon: <LogOut className="size-4" />,
                      label: '退出登录',
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'password') navigate('/password/change')
                    if (key === 'logout') {
                      void signOut()
                    }
                  },
                }}
                placement="bottomRight"
                trigger={['click']}
              >
                <Button
                  className="!ml-1 !flex !items-center !gap-1 !px-1.5"
                  loading={logoutMutation.isPending}
                  type="text"
                  aria-label="账户菜单"
                >
                  <Avatar
                    size={30}
                    className="!border !border-[#e6ebf3] !bg-[#eef4ff] !text-[#3157d5]"
                    icon={<CircleUserRound className="size-[17px]" />}
                  >
                    {currentSession?.displayName.slice(-1)}
                  </Avatar>
                  <ChevronDown className="size-3.5 text-[#8a96ab]" />
                </Button>
              </Dropdown>
            </div>
          </Header>

          <Content
            id="main-content"
            tabIndex={-1}
            className="workspace-content min-w-0 px-3 py-3 sm:px-5 sm:py-4 lg:px-6"
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
      <Drawer
        title="工作台使用指引"
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        size={520}
      >
        <div className="business-stack">
          <p className="business-text">
            从客户档案登记商机，明确下一步跟进行动；需要跨角色协作时，在商机中创建项目空间。
          </p>
          <p className="business-text">
            售前空间内可并行推进七类动作，提交成果版本，申请立项与报价评审，并记录批准范围内的承诺和实际投入。
          </p>
          <p className="business-text">
            新增诉求先登记需求池，完成影响分析后人工确认处理路径；处理完成后由独立人员验证。涉及原范围、合同或验收基线时，走正式变更流程。
          </p>
          <p className="business-muted">
            可见菜单与操作随授权变化。需要人员加入协作时，请由项目负责人调整项目成员。
          </p>
        </div>
      </Drawer>
    </>
  )
}
