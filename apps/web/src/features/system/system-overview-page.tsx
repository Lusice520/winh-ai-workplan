import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import {
  ArrowRight,
  Check,
  Database,
  FlaskConical,
  KeyRound,
  Server,
} from 'lucide-react'
import { useNavigate } from 'react-router'

import { getSystemStatus } from '@/features/system/system-api'

const stages = [
  {
    color: 'green',
    content: (
      <div>
        <strong>目录、契约与数据库迁移</strong>
        <p className="mt-1 text-xs text-[#8b95a7]">
          已固化 IAM SPEC、Flyway 迁移与本地 PostgreSQL 基线
        </p>
      </div>
    ),
  },
  {
    color: 'green',
    content: (
      <div>
        <strong>登录与用户管理</strong>
        <p className="mt-1 text-xs text-[#8b95a7]">
          已接入真实会话、组织目录与用户生命周期
        </p>
      </div>
    ),
  },
  {
    color: 'blue',
    content: (
      <div>
        <strong>菜单与权限管理</strong>
        <p className="mt-1 text-xs text-[#8b95a7]">
          当前阶段：统一鉴权、动态导航、角色、范围与临时授权
        </p>
      </div>
    ),
  },
  {
    color: 'gray',
    content: (
      <div>
        <strong>后续业务模块</strong>
        <p className="mt-1 text-xs text-[#8b95a7]">
          项目空间、商机等功能将逐一建立在 IAM 基线上
        </p>
      </div>
    ),
  },
]

export function SystemOverviewPage() {
  const navigate = useNavigate()
  const statusQuery = useQuery({
    queryKey: ['system-status'],
    queryFn: ({ signal }) => getSystemStatus(signal),
  })
  const backendConnected = statusQuery.data?.status === 'UP'

  return (
    <div className="space-y-6">
      <Card
        className="overflow-hidden !border-[#dfe4ee]"
        styles={{ body: { padding: 0 } }}
      >
        <div className="grid xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="relative overflow-hidden px-6 py-8 sm:px-9 sm:py-10">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-[#3157d5]" />
            <Space size={8} wrap>
              <Tag color="geekblue" variant="filled">
                LOCAL BUILD / IAM-02
              </Tag>
              <Tag color="success" variant="filled">
                正式开发基线
              </Tag>
            </Space>
            <Typography.Title
              level={1}
              className="!mt-5 !max-w-3xl !text-[clamp(2rem,4vw,3.8rem)] !leading-[1.02] !tracking-[-0.05em]"
            >
              用真实会话与数据验证页面，
              <span className="text-[#3157d5]">再逐步扩展业务功能。</span>
            </Typography.Title>
            <Typography.Paragraph className="!mt-5 !max-w-2xl !text-sm !leading-7 !text-[#667085] sm:!text-[15px]">
              登录、组织与用户管理，以及菜单、权限、角色与数据范围均采用本地
              PostgreSQL、Flyway 迁移和服务端决策。页面不再读取前端 Mock 数据。
            </Typography.Paragraph>
            <Flex gap={12} wrap="wrap" className="mt-6">
              {import.meta.env.DEV ? (
                <Button
                  type="primary"
                  icon={<FlaskConical className="size-4" />}
                  onClick={() =>
                    navigate('/component-lab?variant=A&scene=list')
                  }
                >
                  打开组件验证页
                </Button>
              ) : (
                <Tag color="default">视觉原型仅在本地开发环境提供</Tag>
              )}
              <Button onClick={() => statusQuery.refetch()}>
                重新检查后端
              </Button>
            </Flex>
          </div>
          <div className="border-t border-[#e7eaf1] bg-[#f8f9fc] p-6 xl:border-t-0 xl:border-l">
            <Typography.Text className="!text-xs !font-semibold !tracking-[0.12em] !text-[#8b95a7] uppercase">
              推进顺序
            </Typography.Text>
            <Timeline className="!mt-6" items={stages} />
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="h-full !border-[#dfe4ee]">
            <Statistic
              title="前端组件基线"
              value="Ant Design v6"
              prefix={<FlaskConical className="size-5 text-[#3157d5]" />}
            />
            <Progress percent={70} showInfo={false} className="!mt-4" />
            <Typography.Paragraph className="!mt-3 !mb-0 !text-xs !leading-5 !text-[#667085]">
              表格、树、抽屉表单和会话态均遵循统一 Token 与交互规范。
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="h-full !border-[#dfe4ee]">
            <Statistic
              title="后端最小服务"
              value={
                statusQuery.isPending
                  ? '检查中'
                  : backendConnected
                    ? '已连接'
                    : '未连接'
              }
              prefix={<Server className="size-5 text-[#188b79]" />}
            />
            <Typography.Paragraph className="!mt-4 !mb-0 !text-xs !leading-5 !text-[#667085]">
              {backendConnected && statusQuery.data
                ? `${statusQuery.data.service} · ${statusQuery.data.version}`
                : '待本地 Spring Boot 服务启动后自动连通。'}
            </Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="h-full !border-[#dfe4ee]">
            <Statistic
              title="权限工作台"
              value="正式接入中"
              prefix={<KeyRound className="size-5 text-[#d27632]" />}
            />
            <Typography.Paragraph className="!mt-4 !mb-0 !text-xs !leading-5 !text-[#667085]">
              菜单资源、权限点、角色、数据范围、系统角色授权与临时授权均从独立工作台进入。
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Alert
            className="h-full"
            type="info"
            showIcon
            icon={<Database className="size-4" />}
            title="当前独立边界"
            description="权限工作台通过服务端统一鉴权和动态导航接入；前端仅展示后端已授权且已注册的资源。"
          />
        </Col>
        <Col xs={24} lg={12}>
          <Alert
            className="h-full"
            type="success"
            showIcon
            icon={<Check className="size-4" />}
            title="当前验证标准"
            description="真实数据库迁移可启动；会话、鉴权、动态导航和权限管理关键路径自动化验证通过；前端类型、测试、格式和生产构建通过。"
            action={
              import.meta.env.DEV ? (
                <Button
                  type="link"
                  icon={<ArrowRight className="size-4" />}
                  onClick={() =>
                    navigate('/component-lab?variant=A&scene=login')
                  }
                >
                  查看本地页面
                </Button>
              ) : undefined
            }
          />
        </Col>
      </Row>
    </div>
  )
}
