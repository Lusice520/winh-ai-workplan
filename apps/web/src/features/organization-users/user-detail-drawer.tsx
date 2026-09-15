import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Space,
  Spin,
  Tag,
} from 'antd'
import {
  MoveRight,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'

import { getProblemMessage } from '@/api/client/http'
import {
  accountStatusMeta,
  formatTime,
} from '@/features/organization-users/organization-user-helpers'
import {
  DrawerTitle,
  type AccountAction,
} from '@/features/organization-users/organization-user-ui'
import type { UserAccount } from '@/features/organization-users/organization-user-types'

type UserDetailDrawerProps = {
  canManage: boolean
  userId?: string
  user?: UserAccount
  isLoading: boolean
  error: unknown
  onClose: () => void
  onEditUser: (user: UserAccount) => void
  onAccountAction: (action: AccountAction, user: UserAccount) => void
}

export function UserDetailDrawer({
  canManage,
  userId,
  user,
  isLoading,
  error,
  onClose,
  onEditUser,
  onAccountAction,
}: UserDetailDrawerProps) {
  return (
    <Drawer
      title={
        user ? (
          <DrawerTitle
            icon={<UsersRound className="size-5" />}
            title={user.displayName}
            subtitle={`用户详情 / ${user.loginName}`}
          />
        ) : (
          '用户详情'
        )
      }
      placement="right"
      size={540}
      open={Boolean(userId)}
      destroyOnHidden
      className="user-detail-drawer"
      onClose={onClose}
    >
      {isLoading ? (
        <div className="grid min-h-60 place-items-center">
          <Spin />
        </div>
      ) : user ? (
        <div className="space-y-4">
          <Card
            className="!border-[#e6ebf3] !shadow-none"
            size="small"
            title="账号信息"
          >
            <Descriptions
              column={1}
              size="small"
              styles={{ label: { width: 112, color: '#8491a7' } }}
            >
              <Descriptions.Item label="登录账号">
                {user.loginName}
              </Descriptions.Item>
              <Descriptions.Item label="工作邮箱">
                {user.workEmail ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="手机号码">
                {user.mobilePhone ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="内部标识">
                {user.employeeCode ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="账号状态">
                <Tag
                  className={`account-status-tag ${accountStatusMeta[user.accountStatus].className}`}
                >
                  {accountStatusMeta[user.accountStatus].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最近登录">
                {formatTime(user.lastSuccessfulLoginAt)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          <Card
            className="!border-[#e6ebf3] !shadow-none"
            size="small"
            title="组织与安全"
          >
            <Descriptions
              column={1}
              size="small"
              styles={{ label: { width: 112, color: '#8491a7' } }}
            >
              <Descriptions.Item label="所属组织">
                {user.organizationUnit.name}
              </Descriptions.Item>
              <Descriptions.Item label="首次密码更新">
                {user.mustChangePassword ? '待完成' : '已完成'}
              </Descriptions.Item>
              <Descriptions.Item label="初始化管理员保护">
                {user.bootstrapSystemAdministrator ? '是' : '否'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          {canManage && (
            <Space wrap>
              <Button
                icon={<PencilLine className="size-4" />}
                onClick={() => onEditUser(user)}
              >
                编辑资料
              </Button>
              <Button
                icon={<MoveRight className="size-4" />}
                onClick={() => onAccountAction('move', user)}
              >
                调整部门
              </Button>
              <Button
                icon={<ShieldCheck className="size-4" />}
                onClick={() => onAccountAction('status', user)}
              >
                调整状态
              </Button>
              <Button
                icon={<RefreshCw className="size-4" />}
                onClick={() => onAccountAction('reset-password', user)}
              >
                重置密码
              </Button>
            </Space>
          )}
        </div>
      ) : (
        <Empty description={getProblemMessage(error, '未找到该用户')} />
      )}
    </Drawer>
  )
}
