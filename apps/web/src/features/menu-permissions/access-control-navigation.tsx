import type { MenuProps } from 'antd'
import {
  Folder,
  Gauge,
  Layers,
  Settings,
  ShieldCheck,
  ShieldCog,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import type { NavigationItem } from '@/features/menu-permissions/access-control-types'

type RouteDefinition = {
  path: string
  contextPath?: string
  breadcrumb: string[]
}

const routeDefinitions: Record<string, RouteDefinition> = {
  'crm.customers': {
    path: '/crm/customers',
    breadcrumb: ['客户与商机', '客户管理'],
  },
  'crm.opportunities': {
    path: '/crm/opportunities',
    breadcrumb: ['客户与商机', '商机管理'],
  },
  'business.contracts': {
    path: '/contracts',
    breadcrumb: ['项目中心', '合同台账'],
  },
  'business.projects': {
    path: '/projects',
    breadcrumb: ['项目中心', '项目空间'],
  },
  'business.presales': {
    path: '/presales',
    breadcrumb: ['项目中心', '售前工作台'],
  },
  'business.delivery-initiation': {
    path: '/delivery-initiation',
    breadcrumb: ['项目中心', '交付立项'],
  },
  'business.requirements': {
    path: '/requirements',
    breadcrumb: ['项目中心', '需求池'],
  },
  'system.overview': {
    path: '/system/overview',
    breadcrumb: ['系统管理', '工作台'],
  },
  'system.delivery-configuration': {
    path: '/system/delivery-configuration',
    breadcrumb: ['系统管理', '交付模板与规则'],
  },
  'system.organization-users': {
    path: '/system/organization-users',
    breadcrumb: ['系统管理', '组织与用户'],
  },
  'system.access-control': {
    path: '/system/access-control/roles',
    contextPath: '/system/access-control',
    breadcrumb: ['系统管理', '菜单与权限'],
  },
}

const iconDefinitions: Record<string, LucideIcon> = {
  settings: Settings,
  gauge: Gauge,
  layers: Layers,
  users: UsersRound,
  'shield-check': ShieldCheck,
  'shield-cog': ShieldCog,
  'users-cog': UsersRound,
}

export function menuItemsFromNavigation(
  navigation: NavigationItem[],
): MenuProps['items'] {
  return navigation.flatMap((item) => toMenuItem(item))
}

export function navigationOpenKeys(navigation: NavigationItem[]) {
  return navigation
    .filter((item) => item.children.length > 0)
    .map((item) => item.code)
}

export function pageContextForPath(pathname: string) {
  const matched = Object.values(routeDefinitions)
    .filter((definition) =>
      pathname.startsWith(definition.contextPath ?? definition.path),
    )
    .sort(
      (first, second) =>
        (second.contextPath ?? second.path).length -
        (first.contextPath ?? first.path).length,
    )[0]
  return matched?.breadcrumb ?? ['工作台']
}

export function navigationKeyForPath(pathname: string) {
  return (
    Object.values(routeDefinitions)
      .filter(
        (d) =>
          pathname === d.path ||
          pathname.startsWith((d.contextPath ?? d.path) + '/'),
      )
      .sort((a, b) => b.path.length - a.path.length)[0]?.path ?? pathname
  )
}

function toMenuItem(
  item: NavigationItem,
): NonNullable<MenuProps['items']>[number][] {
  const Icon = item.iconKey ? (iconDefinitions[item.iconKey] ?? Folder) : Folder
  if (item.routeKey) {
    const route = routeDefinitions[item.routeKey]
    if (!route) {
      return []
    }
    return [
      {
        key: route.path,
        icon: <Icon className="size-[17px]" aria-hidden="true" />,
        label: item.name,
      },
    ]
  }

  const children = item.children.flatMap((child) => toMenuItem(child))
  if (children.length === 0) {
    return []
  }
  return [
    {
      key: item.code,
      icon: <Icon className="size-[17px]" aria-hidden="true" />,
      label: item.name,
      children,
    },
  ]
}
