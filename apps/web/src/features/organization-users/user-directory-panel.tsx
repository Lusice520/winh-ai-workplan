import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  type MenuProps,
  type TableColumnsType,
} from 'antd'
import {
  Info,
  MoreHorizontal,
  MoveRight,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'

import { getProblemMessage } from '@/api/client/http'
import {
  accountStatusMeta,
  avatarColor,
  formatTime,
  getInitials,
} from '@/features/organization-users/organization-user-helpers'
import type { AccountAction } from '@/features/organization-users/organization-user-ui'
import type {
  AccountStatus,
  PageResponse,
  UserAccount,
} from '@/features/organization-users/organization-user-types'
import { tablePagination, tableScroll } from '@/shared/ui/table-pagination'

type UserDirectoryPanelProps = {
  canManageOrganizations: boolean
  canManageUsers: boolean
  users?: PageResponse<UserAccount>
  isLoading: boolean
  error: unknown
  counts: Record<'ALL' | AccountStatus, number>
  selectedStatus: 'ALL' | AccountStatus
  keyword: string
  page: number
  pageSize: number
  onSelectedStatusChange: (status: 'ALL' | AccountStatus) => void
  onKeywordChange: (keyword: string) => void
  onPaginationChange: (page: number, pageSize: number) => void
  onCreateOrganization: () => void
  onCreateUser: () => void
  onViewUser: (userId: string) => void
  onEditUser: (user: UserAccount) => void
  onAccountAction: (action: AccountAction, user: UserAccount) => void
}

export function UserDirectoryPanel({
  canManageOrganizations,
  canManageUsers,
  users,
  isLoading,
  error,
  counts,
  selectedStatus,
  keyword,
  page,
  pageSize,
  onSelectedStatusChange,
  onKeywordChange,
  onPaginationChange,
  onCreateOrganization,
  onCreateUser,
  onViewUser,
  onEditUser,
  onAccountAction,
}: UserDirectoryPanelProps) {
  const userColumns: TableColumnsType<UserAccount> = [
    {
      title: '用户',
      key: 'user',
      width: 184,
      render: (_, user) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            size={32}
            style={{
              backgroundColor: avatarColor(user.displayName),
              color: '#3157d5',
            }}
            className="!shrink-0 !text-xs !font-semibold"
          >
            {getInitials(user.displayName)}
          </Avatar>
          <div className="min-w-0">
            <Typography.Text className="!block !truncate !font-medium !text-[#2a3650]">
              {user.displayName}
            </Typography.Text>
            <Typography.Text className="!block !truncate !text-[11px] !text-[#8a96ab]">
              {user.employeeCode ?? '未设置内部标识'}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: '登录账号',
      dataIndex: 'loginName',
      width: 168,
      render: (loginName: string, user) => (
        <div className="min-w-0">
          <Typography.Text className="!block !truncate !text-[#425273]">
            {loginName}
          </Typography.Text>
          <Typography.Text className="!block !truncate !text-[11px] !text-[#8a96ab]">
            {user.workEmail ?? '未设置邮箱'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '部门',
      dataIndex: ['organizationUnit', 'name'],
      width: 138,
      render: (name: string) => <Typography.Text>{name}</Typography.Text>,
    },
    {
      title: '账号状态',
      dataIndex: 'accountStatus',
      width: 104,
      render: (status: AccountStatus) => (
        <Tag
          className={`account-status-tag ${accountStatusMeta[status].className}`}
        >
          {accountStatusMeta[status].label}
        </Tag>
      ),
    },
    {
      title: '最近登录',
      dataIndex: 'lastSuccessfulLoginAt',
      width: 118,
      render: (value: string | null) => (
        <Typography.Text className="!text-xs !text-[#71809a]">
          {formatTime(value)}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 68,
      fixed: 'right',
      align: 'center',
      render: (_, user) => {
        const items: MenuProps['items'] = [
          {
            key: 'view',
            label: '查看详情',
            icon: <Info className="size-4" />,
          },
          {
            key: 'edit',
            label: '编辑资料',
            icon: <PencilLine className="size-4" />,
          },
          {
            key: 'move',
            label: '调整部门',
            icon: <MoveRight className="size-4" />,
          },
          { type: 'divider' },
          {
            key: 'status',
            label: '调整账号状态',
            icon: <ShieldCheck className="size-4" />,
          },
          {
            key: 'reset-password',
            label: '重置临时密码',
            icon: <RefreshCw className="size-4" />,
          },
        ]

        return (
          <Dropdown
            menu={{
              items: canManageUsers ? items : items.slice(0, 1),
              onClick: ({ key, domEvent }) => {
                // The operation menu lives inside a clickable table row. Keep
                // its intent isolated so "编辑资料" does not also open detail.
                domEvent.stopPropagation()

                if (key === 'view') {
                  onViewUser(user.id)
                } else if (key === 'edit') {
                  onEditUser(user)
                } else if (
                  key === 'move' ||
                  key === 'status' ||
                  key === 'reset-password'
                ) {
                  onAccountAction(key, user)
                }
              },
            }}
            trigger={['click']}
          >
            <Button
              type="text"
              size="small"
              aria-label={`${user.displayName} 的操作`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-[18px]" />
            </Button>
          </Dropdown>
        )
      },
    },
  ]

  return (
    <Card
      className="user-directory-card min-w-0 !border-[#e4eaf3] !shadow-none"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f5] px-4 py-3.5">
        <div>
          <Typography.Title
            level={2}
            className="!m-0 !text-[16px] !text-[#2c3b57]"
          >
            用户目录
          </Typography.Title>
          <Typography.Text className="!mt-1 !block !text-xs !text-[#8a96ab]">
            当前组织及下级组织范围内的真实账号数据
          </Typography.Text>
        </div>
        <Space wrap>
          {canManageUsers && <Button disabled>批量导入（后续）</Button>}
          {canManageOrganizations && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={onCreateOrganization}
            >
              新建部门
            </Button>
          )}
          {canManageUsers && (
            <Button
              type="primary"
              icon={<UserPlus className="size-4" />}
              onClick={onCreateUser}
            >
              新建用户
            </Button>
          )}
        </Space>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <Segmented
          value={selectedStatus}
          aria-label="账号状态筛选"
          options={[
            { label: `全部 ${counts.ALL}`, value: 'ALL' },
            { label: `启用 ${counts.ENABLED}`, value: 'ENABLED' },
            { label: `停用 ${counts.DISABLED}`, value: 'DISABLED' },
            { label: `锁定 ${counts.LOCKED}`, value: 'LOCKED' },
            { label: `已终止 ${counts.TERMINATED}`, value: 'TERMINATED' },
          ]}
          onChange={(value) =>
            onSelectedStatusChange(value as 'ALL' | AccountStatus)
          }
        />
        <Input
          autoComplete="off"
          className="w-full sm:!w-[248px]"
          name="userSearch"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          prefix={<Search className="size-4 text-[#8491a7]" />}
          placeholder="搜索姓名、账号、邮箱…"
          aria-label="搜索用户"
          allowClear
          spellCheck={false}
        />
      </div>

      <Table<UserAccount>
        rowKey="id"
        columns={userColumns}
        dataSource={users?.items ?? []}
        loading={isLoading}
        scroll={tableScroll(860)}
        pagination={tablePagination({
          current: users?.page ?? page,
          pageSize: users?.pageSize ?? pageSize,
          total: users?.total ?? 0,
          onChange: onPaginationChange,
        })}
        locale={{
          emptyText: error ? (
            <Empty description={getProblemMessage(error, '用户目录暂不可用')} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="当前条件下没有用户"
            />
          ),
        }}
        onRow={(user) => ({
          onClick: () => onViewUser(user.id),
          className: 'cursor-pointer',
        })}
      />
    </Card>
  )
}
