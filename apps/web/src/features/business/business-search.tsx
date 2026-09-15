import { Button, Drawer, Empty, Input, Spin, Tabs } from 'antd'
import { Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { getProblemMessage } from '@/api/client/http'
import type { ContractMaster } from '@/features/contracts/contract-types'
import { useBusinessQuery } from './business-data'
import type {
  Customer,
  Opportunity,
  Page,
  Project,
  Requirement,
} from './business-types'

export function BusinessSearch() {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState('')
  const q = useDeferredValue(value.trim()),
    suffix = `?q=${encodeURIComponent(q)}&pageSize=10`
  const customers = useBusinessQuery<Page<Customer>>(
    open && q ? '/api/crm/customers' + suffix : undefined,
  )
  const opportunities = useBusinessQuery<Page<Opportunity>>(
    open && q ? '/api/crm/opportunities' + suffix : undefined,
  )
  const projects = useBusinessQuery<Page<Project>>(
    open && q ? '/api/projects' + suffix : undefined,
  )
  const requirements = useBusinessQuery<Page<Requirement>>(
    open && q ? '/api/requirements' + suffix : undefined,
  )
  const contracts = useBusinessQuery<Page<ContractMaster>>(
    open && q ? '/api/contracts' + suffix : undefined,
  )
  const groups = [
    {
      key: 'contracts',
      label: '合同',
      query: contracts,
      items: contracts.data?.items.map((x) => ({
        id: x.id,
        title: x.title,
        description: x.number + ' · ' + x.customerName,
        url: '/contracts/' + x.id,
      })),
    },
    {
      key: 'projects',
      label: '项目',
      query: projects,
      items: projects.data?.items.map((x) => ({
        id: x.id,
        title: x.name,
        description: x.customerName,
        url: `/projects/${x.id}`,
      })),
    },
    {
      key: 'opportunities',
      label: '商机',
      query: opportunities,
      items: opportunities.data?.items.map((x) => ({
        id: x.id,
        title: x.title,
        description: x.customerName,
        url: `/crm/opportunities/${x.id}`,
      })),
    },
    {
      key: 'customers',
      label: '客户',
      query: customers,
      items: customers.data?.items.map((x) => ({
        id: x.id,
        title: x.name,
        description: x.ownerName,
        url: `/crm/customers/${x.id}`,
      })),
    },
    {
      key: 'requirements',
      label: '需求',
      query: requirements,
      items: requirements.data?.items.map((x) => ({
        id: x.id,
        title: x.title,
        description: x.projectName,
        url: `/requirements/${x.id}`,
      })),
    },
  ]
  return (
    <>
      <Button
        className="workspace-global-search"
        type="text"
        icon={<Search size={16} />}
        aria-label="搜索业务记录"
        onClick={() => setOpen(true)}
      >
        <span className="hidden md:inline">搜索项目、客户、商机…</span>
      </Button>
      <Drawer
        title="搜索业务记录"
        open={open}
        onClose={() => setOpen(false)}
        size={660}
        destroyOnHidden
      >
        <Input.Search
          autoFocus
          aria-label="搜索关键词"
          placeholder="输入名称、编号或关键字"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          allowClear
        />
        {q ? (
          <Tabs
            style={{ marginTop: 16 }}
            items={groups.map((g) => ({
              key: g.key,
              label: `${g.label} ${g.query.data?.total ?? ''}`,
              children: g.query.isPending ? (
                <Spin />
              ) : g.query.isError ? (
                <p role="alert">{getProblemMessage(g.query.error)}</p>
              ) : g.items?.length ? (
                <div>
                  {g.items.map((x) => (
                    <div key={x.id} className="business-output-row">
                      <div className="business-output-info">
                        <Link to={x.url} onClick={() => setOpen(false)}>
                          {x.title}
                        </Link>
                        <span className="business-cell-sub">
                          {x.description}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(g.query.data?.total ?? 0) > 10 && (
                    <p className="business-muted">
                      当前显示前 10 条，请增加关键词以缩小范围。
                    </p>
                  )}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="没有符合条件的可见记录"
                />
              ),
            }))}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="搜索当前有权查看的业务记录"
          />
        )}
      </Drawer>
    </>
  )
}
