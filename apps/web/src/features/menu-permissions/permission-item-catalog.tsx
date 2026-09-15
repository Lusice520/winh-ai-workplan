import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Input,
  Result,
  Select,
  Spin,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd'
import { BookKey, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { getProblemMessage } from '@/api/client/http'
import { getPermissionItems } from '@/features/menu-permissions/access-control-api'
import {
  RiskTag,
  StatusTag,
} from '@/features/menu-permissions/access-control-display'
import { labelForDimension } from '@/features/menu-permissions/access-control-options'
import type {
  PermissionDimension,
  PermissionItem,
  PermissionItemStatus,
} from '@/features/menu-permissions/access-control-types'
import { tablePagination, tableScroll } from '@/shared/ui/table-pagination'

const emptyPermissionItems: PermissionItem[] = []

export function PermissionItemCatalog() {
  const [keyword, setKeyword] = useState('')
  const [dimension, setDimension] = useState<PermissionDimension>()
  const permissionItemsQuery = useQuery({
    queryKey: ['access-control', 'permission-items'],
    queryFn: ({ signal }) => getPermissionItems(signal),
  })
  const permissionItems = permissionItemsQuery.data ?? emptyPermissionItems

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase()
    return permissionItems.filter(
      (item) =>
        (!dimension || item.dimension === dimension) &&
        (!normalized ||
          [item.code, item.name, item.actionKey, item.menuResourceCode]
            .filter(Boolean)
            .some((value) => value!.toLocaleLowerCase().includes(normalized))),
    )
  }, [dimension, keyword, permissionItems])

  const columns: TableColumnsType<PermissionItem> = [
    {
      title: '权限项',
      dataIndex: 'name',
      width: 210,
      render: (name: string, item) => (
        <div>
          <div className="font-medium text-[#35455f]">{name}</div>
          <Typography.Text code className="!text-xs">
            {item.code}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '资源来源',
      dataIndex: 'menuResourceCode',
      width: 180,
      render: (value: string | null) => value ?? '独立系统权限',
    },
    {
      title: '动作键',
      dataIndex: 'actionKey',
      width: 220,
      render: (value: string) => (
        <Typography.Text className="!text-xs !text-[#61728a]">
          {value}
        </Typography.Text>
      ),
    },
    {
      title: '维度',
      dataIndex: 'dimension',
      width: 120,
      render: (value: PermissionDimension) => labelForDimension(value),
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      width: 90,
      render: (_, item) => <RiskTag riskLevel={item.riskLevel} />,
    },
    {
      title: '可下放',
      dataIndex: 'canDelegate',
      width: 90,
      render: (value: boolean) => (value ? '允许' : '不可下放'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: PermissionItemStatus) => <StatusTag status={value} />,
    },
  ]

  if (permissionItemsQuery.isPending) {
    return (
      <Card className="access-control-surface">
        <div className="grid min-h-[300px] place-items-center">
          <Spin description="正在读取权限项目录…" />
        </div>
      </Card>
    )
  }

  if (permissionItemsQuery.isError) {
    return (
      <Result
        status="error"
        title="无法读取权限项目录"
        subTitle={getProblemMessage(
          permissionItemsQuery.error,
          '请确认当前账号具有权限项目录查看权限。',
        )}
        extra={
          <Button onClick={() => void permissionItemsQuery.refetch()}>
            重新加载
          </Button>
        }
      />
    )
  }

  return (
    <Card
      className="access-control-surface access-control-surface--catalog access-control-surface--table"
      styles={{ body: { padding: 0 } }}
    >
      <div className="access-control-section-header access-control-section-header--catalog">
        <div>
          <Typography.Text className="access-control-section-title">
            <BookKey className="size-4 text-[#4171d8]" />
            已注册权限项目录
          </Typography.Text>
          <Typography.Paragraph className="access-control-section-description">
            业务模块注册来源只读。菜单可见、业务动作、数据范围与敏感资源分别授权，不会互相隐式放行。
          </Typography.Paragraph>
        </div>
        <div className="access-control-catalog-toolbar">
          <Select
            allowClear
            className="access-control-catalog-toolbar__select"
            placeholder="全部维度"
            value={dimension}
            options={[
              'MENU',
              'ACTION',
              'DATA_SCOPE',
              'SENSITIVE_FIELD',
              'FILE_ACTION',
              'SYSTEM_CONFIGURATION',
            ].map((value) => ({
              value,
              label: labelForDimension(value as PermissionDimension),
            }))}
            onChange={setDimension}
          />
          <Input
            allowClear
            className="access-control-catalog-toolbar__search"
            prefix={<Search className="size-4 text-[#90a0b7]" />}
            placeholder="搜索权限编码、名称或动作键"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredItems}
        scroll={tableScroll(1_000)}
        pagination={tablePagination()}
      />
    </Card>
  )
}
