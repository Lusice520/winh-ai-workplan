import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { Panel } from '@/features/business/business-ui'
import type { ProjectDetail } from '@/features/business/business-types'
import { DeliveryProjectSection } from '@/features/delivery/delivery-workspace'
import './income.css'
export function ProjectFundsSection({ project }: { project: ProjectDetail }) {
  return (
    <>
      {project.allowedActions.includes('FINANCE_READ') && (
        <Panel
          title="经营预测与收入"
          subtitle="按月维护预测、独立确认实际收入，保留版本及原始依据。"
          className="income-funds-entry"
        >
          <p>
            计划、已确认、待确认与冲销分别统计。
            <br />
            不同币种独立展示，预算继续沿用批准基线。
          </p>
          <Link to={`/projects/${project.project.id}/income`}>
            进入经营预测与收入 <ArrowUpRight size={14} className="inline" />
          </Link>
        </Panel>
      )}
      {project.allowedActions.includes('DELIVERY_BUDGET_READ') && (
        <DeliveryProjectSection
          projectId={project.project.id}
          section="budget"
          project={project}
        />
      )}
    </>
  )
}
