import { Result, Spin, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import {
  KeyRound,
  ListTree,
  SearchCheck,
  ShieldCheck,
  UserRoundCog,
  UserRoundSearch,
} from 'lucide-react'
import { Navigate, NavLink, useLocation } from 'react-router'
import { getAccessControlCapabilities } from './access-control-api'

import { MenuResourceWorkspace } from '@/features/menu-permissions/menu-resource-workspace'
import { PermissionItemCatalog } from '@/features/menu-permissions/permission-item-catalog'
import { PermissionPreviewWorkspace } from '@/features/menu-permissions/permission-preview-workspace'
import { RoleCatalog } from '@/features/menu-permissions/role-catalog'
import { SystemRoleAssignmentWorkspace } from '@/features/menu-permissions/system-role-assignment-workspace'
import { TemporaryGrantWorkspace } from '@/features/menu-permissions/temporary-grant-workspace'

const sections = [
  {
    key: 'roles',
    permissions: ['IAM_ROLE_READ', 'IAM_PERMISSION_ITEM_READ'],
    label: '角色与矩阵',
    title: '角色与矩阵',
    description:
      '先维护权限项目和菜单资源，再向角色授权权限项与数据范围。菜单可见不等于服务端操作授权。',
    icon: <ShieldCheck className="size-4" />,
  },
  {
    key: 'menus',
    permissions: ['IAM_MENU_RESOURCE_READ'],
    label: '菜单资源',
    title: '受控资源目录',
    description:
      'routeKey、动作键和图标键只能从已发布注册表中选择；已引用资源可停用或调整，不能物理删除。',
    icon: <ListTree className="size-4" />,
  },
  {
    key: 'permission-items',
    permissions: ['IAM_PERMISSION_ITEM_READ'],
    label: '权限项目录',
    title: '权限项目录',
    description:
      '将可授权的服务端能力登记为权限项，并明确权限维度、风险等级与委派边界。',
    icon: <KeyRound className="size-4" />,
  },
  {
    key: 'assignments',
    permissions: [
      'IAM_SYSTEM_ROLE_ASSIGNMENT_READ',
      'IAM_USER_READ',
      'IAM_ROLE_READ',
    ],
    label: '系统角色授权',
    title: '系统角色授权',
    description:
      '为启用账号分配系统角色，并由服务端校验角色类型、状态与可下放层级。',
    icon: <UserRoundCog className="size-4" />,
  },
  {
    key: 'temporary-grants',
    permissions: ['IAM_TEMPORARY_GRANT_READ'],
    label: '临时授权',
    title: '临时授权',
    description:
      '临时授权具有明确有效期、调整原因与审计记录，不替代长期角色配置。',
    icon: <UserRoundSearch className="size-4" />,
  },
  {
    key: 'preview',
    permissions: [
      'IAM_PERMISSION_PREVIEW',
      'IAM_USER_READ',
      'IAM_PERMISSION_ITEM_READ',
    ],
    label: '有效权限预览',
    title: '有效权限预览',
    description:
      '核验账号在指定对象与时点的最终权限来源，不以菜单可见性替代服务端决策。',
    icon: <SearchCheck className="size-4" />,
  },
]

export function AccessControlWorkspace() {
  const location = useLocation()
  const capabilities = useQuery({
    queryKey: ['access-control', 'capabilities'],
    queryFn: ({ signal }) => getAccessControlCapabilities(signal),
  })
  const activeKey = readActiveKey(location.pathname)
  const visibleSections = sections.filter((s) =>
    s.permissions.every((p) => capabilities.data?.includes(p)),
  )
  const activeSection =
    sections.find((section) => section.key === activeKey) ?? sections[0]

  if (capabilities.isPending)
    return <Spin description="正在读取可用管理功能…" />
  if (capabilities.isError)
    return <Result status="error" title="无法读取当前管理权限" />
  if (!visibleSections.length)
    return <Result status="403" title="当前账号无可用的权限管理功能" />
  if (!visibleSections.some((s) => s.key === activeKey))
    return (
      <Navigate
        replace
        to={'/system/access-control/' + visibleSections[0].key}
      />
    )

  return (
    <div className="access-control-workspace">
      <header className="access-control-page-header">
        <Typography.Title
          level={2}
          className="access-control-page-title !mb-1 !text-[22px] !font-semibold !tracking-[-0.03em] !text-[#24324a]"
        >
          {activeSection.title}
        </Typography.Title>
        <Typography.Paragraph className="access-control-page-summary !mb-0 !max-w-4xl !text-sm !leading-6 !text-[#66758c]">
          {activeSection.description}
        </Typography.Paragraph>
      </header>

      <nav
        aria-label="菜单与权限功能区"
        className="access-control-section-navigation"
      >
        {visibleSections.map((section) => (
          <NavLink
            className={({ isActive }) =>
              'access-control-nav-link' +
              (section.key === 'assignments'
                ? ' access-control-nav-link--workflow-start'
                : '') +
              (isActive ? ' access-control-nav-link--active' : '')
            }
            key={section.key}
            to={'/system/access-control/' + section.key}
          >
            {section.icon}
            <span>{section.label}</span>
          </NavLink>
        ))}
      </nav>

      <section aria-label={activeSection.label}>
        {activeKey === 'roles' ? <RoleCatalog /> : null}
        {activeKey === 'menus' ? <MenuResourceWorkspace /> : null}
        {activeKey === 'permission-items' ? <PermissionItemCatalog /> : null}
        {activeKey === 'assignments' ? <SystemRoleAssignmentWorkspace /> : null}
        {activeKey === 'temporary-grants' ? <TemporaryGrantWorkspace /> : null}
        {activeKey === 'preview' ? <PermissionPreviewWorkspace /> : null}
      </section>
    </div>
  )
}

function readActiveKey(pathname: string) {
  const candidate = pathname.split('/').at(-1)
  return sections.some((section) => section.key === candidate)
    ? candidate
    : 'roles'
}
