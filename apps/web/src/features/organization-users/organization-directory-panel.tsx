import { Button, Card, Input, Space, Tree, Typography } from 'antd'
import { Folder, PencilLine, Plus, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import type { OrganizationUnit } from '@/features/organization-users/organization-user-types'

type WorkspaceTreeData = {
  key: string
  title: ReactNode
  children?: WorkspaceTreeData[]
}

type OrganizationDirectoryPanelProps = {
  canManage: boolean
  organizationTree: OrganizationUnit[]
  selectedOrganizationId?: string
  selectedOrganization?: OrganizationUnit
  onSelectOrganization: (organizationId: string) => void
  onCreateOrganization: () => void
  onEditOrganization: (organization: OrganizationUnit) => void
}

export function OrganizationDirectoryPanel({
  canManage,
  organizationTree,
  selectedOrganizationId,
  selectedOrganization,
  onSelectOrganization,
  onCreateOrganization,
  onEditOrganization,
}: OrganizationDirectoryPanelProps) {
  const [organizationSearch, setOrganizationSearch] = useState('')

  const treeData = useMemo<WorkspaceTreeData[]>(() => {
    const normalizedSearch = organizationSearch.trim().toLowerCase()
    function mapUnit(unit: OrganizationUnit): WorkspaceTreeData | undefined {
      const childNodes = unit.children
        .map(mapUnit)
        .filter((node): node is WorkspaceTreeData => Boolean(node))
      const matched =
        !normalizedSearch ||
        `${unit.name} ${unit.code}`.toLowerCase().includes(normalizedSearch)
      if (!matched && childNodes.length === 0) {
        return undefined
      }

      return {
        key: unit.id,
        title: (
          <span className="flex min-w-0 items-center gap-2">
            <Folder className="size-4 shrink-0 text-[#6b7c9d]" />
            <span className="truncate">{unit.name}</span>
            {unit.status === 'DISABLED' ? (
              <span className="text-[10px] text-[#98a3b5]">停用</span>
            ) : null}
          </span>
        ),
        children: childNodes,
      }
    }

    return organizationTree
      .map(mapUnit)
      .filter((node): node is WorkspaceTreeData => Boolean(node))
  }, [organizationSearch, organizationTree])

  function editSelectedOrganization() {
    if (selectedOrganization) {
      onEditOrganization(selectedOrganization)
    }
  }

  return (
    <Card
      className="organization-directory-card !border-[#e4eaf3] !shadow-none"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex items-center justify-between border-b border-[#edf0f5] px-4 py-3.5">
        <Typography.Title
          level={2}
          className="!m-0 !text-[16px] !text-[#2c3b57]"
        >
          组织架构
        </Typography.Title>
        {canManage && (
          <Space size={2}>
            <Button
              type="text"
              size="small"
              icon={<Plus className="size-4" />}
              aria-label="新建部门"
              onClick={onCreateOrganization}
            />
            <Button
              type="text"
              size="small"
              icon={<PencilLine className="size-4" />}
              aria-label="编辑当前部门"
              disabled={!selectedOrganization}
              onClick={editSelectedOrganization}
            />
          </Space>
        )}
      </div>
      <div className="p-3">
        <Input
          autoComplete="off"
          name="organizationSearch"
          value={organizationSearch}
          onChange={(event) => setOrganizationSearch(event.target.value)}
          prefix={<Search className="size-4 text-[#8491a7]" />}
          placeholder="搜索组织名称或编码…"
          aria-label="搜索组织"
          allowClear
          spellCheck={false}
        />
      </div>
      <div className="min-h-[450px] px-2 pb-4">
        <Tree
          blockNode
          defaultExpandAll
          selectedKeys={selectedOrganizationId ? [selectedOrganizationId] : []}
          treeData={treeData}
          className="organization-tree"
          onSelect={(keys) => {
            const key = keys[0]
            if (typeof key === 'string') {
              onSelectOrganization(key)
            }
          }}
        />
      </div>
      {canManage && (
        <div className="border-t border-[#edf0f5] p-3">
          <Button
            className="w-full !justify-start"
            disabled={!selectedOrganization}
            icon={<PencilLine className="size-4" />}
            onClick={editSelectedOrganization}
          >
            编辑当前组织
          </Button>
        </div>
      )}
    </Card>
  )
}
