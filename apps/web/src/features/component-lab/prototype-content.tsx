import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Flex,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tag,
  Timeline,
  TreeSelect,
  Typography,
  Upload,
  type TableColumnsType,
} from 'antd'
import {
  Bell,
  CheckCircle2,
  FileUp,
  FolderTree,
  KeyRound,
  ListChecks,
  MoreHorizontal,
  PanelRightOpen,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'

export type VisualDirection = 'A' | 'B' | 'C'

type WorkPlanRow = {
  key: string
  title: string
  project: string
  owner: string
  department: string
  stage: string
  status: '进行中' | '待确认' | '有风险' | '已完成'
  dueDate: string
  progress: number
}

const workPlans: WorkPlanRow[] = [
  {
    key: 'WP-0268',
    title: '确认现场网络和设备清单',
    project: '华东数据中心扩容',
    owner: '王宁',
    department: '交付一组',
    stage: '方案确认',
    status: '进行中',
    dueDate: '08-28',
    progress: 68,
  },
  {
    key: 'WP-0267',
    title: '补充 DG-02 评审材料',
    project: '制造园区数字化',
    owner: '陈晨',
    department: '项目管理部',
    stage: '立项评审',
    status: '待确认',
    dueDate: '08-29',
    progress: 42,
  },
  {
    key: 'WP-0264',
    title: '闭环第三方接口字段差异',
    project: '海外渠道平台',
    owner: '刘洋',
    department: '研发中心',
    stage: '需求澄清',
    status: '有风险',
    dueDate: '08-27',
    progress: 31,
  },
  {
    key: 'WP-0259',
    title: '整理试点用户反馈',
    project: '华南试点项目',
    owner: '赵琪',
    department: '客户成功部',
    stage: '上线准备',
    status: '已完成',
    dueDate: '08-25',
    progress: 100,
  },
  {
    key: 'WP-0254',
    title: '完成采购到货计划核对',
    project: '华东数据中心扩容',
    owner: '周言',
    department: '供应链组',
    stage: '计划编制',
    status: '进行中',
    dueDate: '09-02',
    progress: 55,
  },
]

const statusColor: Record<WorkPlanRow['status'], string> = {
  进行中: 'processing',
  待确认: 'default',
  有风险: 'warning',
  已完成: 'success',
}

function UserLabel({ name, department }: { name: string; department: string }) {
  return (
    <Flex gap={9} align="center">
      <Avatar size={28} className="!bg-[#e8ecf8] !text-xs !text-[#3157d5]">
        {name.slice(0, 1)}
      </Avatar>
      <div className="min-w-0">
        <Typography.Text className="!block !text-xs !font-semibold">
          {name}
        </Typography.Text>
        <Typography.Text className="!block !truncate !text-[10px] !text-[#8b95a7]">
          {department}
        </Typography.Text>
      </div>
    </Flex>
  )
}

function useWorkPlanColumns(direction: VisualDirection) {
  return useMemo<TableColumnsType<WorkPlanRow>>(
    () => [
      {
        title: '工作计划',
        dataIndex: 'title',
        width: direction === 'C' ? 260 : 300,
        fixed: 'left',
        render: (title: string, row) => (
          <div>
            <Typography.Text className="!block !text-xs !font-semibold">
              {title}
            </Typography.Text>
            <Typography.Text className="!mt-1 !block !text-[10px] !text-[#8b95a7]">
              {row.key} · {row.project}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: '负责人',
        dataIndex: 'owner',
        width: 150,
        render: (owner: string, row) => (
          <UserLabel name={owner} department={row.department} />
        ),
      },
      {
        title: '阶段',
        dataIndex: 'stage',
        width: 120,
        render: (stage: string) => <Tag variant="filled">{stage}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (status: WorkPlanRow['status']) => (
          <Tag color={statusColor[status]} variant="filled">
            {status}
          </Tag>
        ),
      },
      {
        title: '完成度',
        dataIndex: 'progress',
        width: 145,
        render: (progress: number) => (
          <Progress
            percent={progress}
            size="small"
            strokeColor={progress === 100 ? '#188b79' : undefined}
          />
        ),
      },
      {
        title: '计划完成',
        dataIndex: 'dueDate',
        width: 100,
        align: 'right',
      },
      {
        title: '',
        key: 'actions',
        fixed: 'right',
        width: 54,
        render: () => (
          <Dropdown
            menu={{
              items: [
                { key: 'view', label: '查看详情' },
                { key: 'edit', label: '编辑计划' },
                { type: 'divider' },
                { key: 'archive', label: '归档', danger: true },
              ],
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<MoreHorizontal className="size-4" />}
              aria-label="更多操作"
            />
          </Dropdown>
        ),
      },
    ],
    [direction],
  )
}

function CredentialForm({ compact = false }: { compact?: boolean }) {
  const { message } = App.useApp()

  return (
    <Form
      layout="vertical"
      requiredMark={false}
      size={compact ? 'small' : 'middle'}
      onFinish={() => message.success('原型登录校验通过；未发送任何请求')}
    >
      <Form.Item
        label="员工账号"
        name="username"
        rules={[{ required: true, message: '请输入员工账号' }]}
      >
        <Input
          prefix={<Users className="size-4 text-[#8b95a7]" />}
          placeholder="姓名拼音或工号"
          autoComplete="username"
        />
      </Form.Item>
      <Form.Item
        label="登录密码"
        name="password"
        rules={[{ required: true, message: '请输入登录密码' }]}
      >
        <Input.Password
          prefix={<KeyRound className="size-4 text-[#8b95a7]" />}
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </Form.Item>
      <Flex justify="space-between" align="center" className="mb-5">
        <Form.Item name="remember" valuePropName="checked" noStyle>
          <Checkbox>保持登录状态</Checkbox>
        </Form.Item>
        <Button type="link" size="small">
          忘记密码
        </Button>
      </Flex>
      <Button type="primary" htmlType="submit" block>
        登录项目工作台
      </Button>
      <Typography.Paragraph className="!mt-4 !mb-0 !text-center !text-[11px] !leading-5 !text-[#8b95a7]">
        原型页面，不会校验账号或保存密码
      </Typography.Paragraph>
    </Form>
  )
}

export function LoginScene({ direction }: { direction: VisualDirection }) {
  if (direction === 'B') {
    return (
      <div className="mx-auto grid min-h-[640px] max-w-[1120px] place-items-center rounded-[28px] border border-[#dce7df] bg-[#eaf1eb] p-5 sm:p-10">
        <div className="w-full max-w-[460px]">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[#116c5b] text-white shadow-lg">
              <Sparkles className="size-6" />
            </div>
            <Typography.Title level={2} className="!mb-2 !tracking-[-0.04em]">
              欢迎回到项目空间
            </Typography.Title>
            <Typography.Text type="secondary">
              今天有 6 条工作计划等待你确认
            </Typography.Text>
          </div>
          <Card className="!border-white/70 !shadow-[0_26px_70px_rgba(25,63,48,0.12)]">
            <CredentialForm />
          </Card>
          <Flex
            justify="center"
            gap={18}
            className="mt-5 text-xs text-[#6e7d75]"
          >
            <span>VPN 安全访问</span>
            <span>·</span>
            <span>系统自建账号</span>
          </Flex>
        </div>
      </div>
    )
  }

  if (direction === 'C') {
    return (
      <div className="grid min-h-[560px] overflow-hidden rounded-lg border border-[#ccc8c2] bg-[#efede9] lg:grid-cols-[1.25fr_420px]">
        <div className="prototype-grid relative hidden border-r border-[#ccc8c2] p-8 lg:block">
          <Tag color="volcano" variant="filled">
            SECURE ACCESS / 01
          </Tag>
          <Typography.Title className="!mt-16 !max-w-xl !text-[3.5rem] !leading-[0.98] !tracking-[-0.055em]">
            项目事实，
            <br />
            从一次可信登录开始。
          </Typography.Title>
          <div className="absolute right-8 bottom-8 left-8 grid grid-cols-3 gap-px overflow-hidden border border-[#cbc6bf] bg-[#cbc6bf]">
            {[
              ['VPN', '内网访问'],
              ['60—100', '预计员工'],
              ['LONG TERM', '数据保留'],
            ].map(([value, label]) => (
              <div key={label} className="bg-[#f5f3f0] p-4">
                <p className="font-mono text-sm font-bold">{value}</p>
                <p className="mt-1 text-[10px] text-[#77716a]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center bg-white p-6 sm:p-9">
          <div className="mb-7 flex items-center gap-3 border-b border-[#ddd9d3] pb-5">
            <div className="grid size-9 place-items-center bg-[#d95d39] text-white">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-sm font-bold">身份验证</p>
              <p className="font-mono text-[9px] tracking-widest text-[#8a837b]">
                WINH / AUTH GATE
              </p>
            </div>
          </div>
          <CredentialForm compact />
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-[600px] overflow-hidden rounded-2xl border border-[#dfe4ee] bg-white shadow-[0_22px_70px_rgba(24,34,53,0.08)] lg:grid-cols-[0.9fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-[#151d2d] p-9 text-white lg:flex lg:flex-col">
        <div className="absolute -top-24 -right-20 size-80 rounded-full bg-[#3157d5]/35 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-white/10">
            <ListChecks className="size-5" />
          </div>
          <div>
            <p className="font-semibold">项目全生命周期管理</p>
            <p className="mt-1 text-[10px] tracking-widest text-white/45 uppercase">
              Internal workspace
            </p>
          </div>
        </div>
        <div className="relative my-auto">
          <Typography.Title className="!max-w-lg !text-[3.2rem] !leading-[1.03] !tracking-[-0.05em] !text-white">
            让每一次推进，
            <span className="text-[#8ea8ff]">都有事实可追溯。</span>
          </Typography.Title>
          <Typography.Paragraph className="!mt-5 !max-w-md !leading-7 !text-white/60">
            工作计划、阶段门、文件和待办在同一项目空间中持续演进。
          </Typography.Paragraph>
        </div>
        <div className="relative flex items-center gap-3 text-xs text-white/55">
          <ShieldCheck className="size-4 text-[#68d4b7]" />
          公司 VPN 内访问 · 系统自建员工账号
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          <Tag color="geekblue" variant="filled">
            员工入口
          </Tag>
          <Typography.Title
            level={2}
            className="!mt-4 !mb-2 !tracking-[-0.04em]"
          >
            登录项目工作台
          </Typography.Title>
          <Typography.Paragraph className="!mb-7 !text-[#667085]">
            使用公司分配的系统账号继续访问。
          </Typography.Paragraph>
          <CredentialForm />
        </div>
      </div>
    </div>
  )
}

function WorkPlanTable({ direction }: { direction: VisualDirection }) {
  const columns = useWorkPlanColumns(direction)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  return (
    <Table<WorkPlanRow>
      rowSelection={{
        selectedRowKeys,
        onChange: setSelectedRowKeys,
      }}
      columns={columns}
      dataSource={workPlans}
      size={direction === 'C' ? 'small' : 'middle'}
      bordered={direction === 'C'}
      scroll={{ x: 980 }}
      pagination={{
        pageSize: 5,
        showSizeChanger: false,
        showTotal: (total) => `共 ${total} 条`,
      }}
    />
  )
}

function ListToolbar({ direction }: { direction: VisualDirection }) {
  const { message } = App.useApp()

  return (
    <Flex gap={10} wrap="wrap" justify="space-between">
      <Flex gap={8} wrap="wrap" className="min-w-0 flex-1">
        <Input
          className="max-w-[280px]"
          prefix={<Search className="size-4 text-[#8b95a7]" />}
          placeholder="搜索计划、项目或负责人"
          allowClear
          size={direction === 'C' ? 'small' : 'middle'}
        />
        <Select
          className="min-w-[130px]"
          defaultValue="all"
          size={direction === 'C' ? 'small' : 'middle'}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'active', label: '进行中' },
            { value: 'risk', label: '有风险' },
          ]}
        />
      </Flex>
      <Flex gap={8}>
        <Button onClick={() => message.info('原型筛选已重置')}>重置</Button>
        <Button type="primary">新建计划</Button>
      </Flex>
    </Flex>
  )
}

export function WorkPlanListScene({
  direction,
}: {
  direction: VisualDirection
}) {
  if (direction === 'B') {
    return (
      <div className="space-y-5">
        <div className="rounded-[24px] bg-[#143d34] px-6 py-7 text-white sm:px-8">
          <Flex justify="space-between" align="flex-end" gap={20} wrap="wrap">
            <div>
              <p className="text-xs tracking-[0.12em] text-white/50 uppercase">
                Monday / 26 Aug
              </p>
              <Typography.Title level={2} className="!mt-3 !mb-1 !text-white">
                今天优先完成什么？
              </Typography.Title>
              <p className="text-sm text-white/60">
                5 条进行中，1 条风险计划需要关注
              </p>
            </div>
            <Button ghost>查看团队负载</Button>
          </Flex>
        </div>
        <Row gutter={[12, 12]}>
          {[
            ['本周计划', 18, '#116c5b'],
            ['待我确认', 6, '#3157d5'],
            ['风险项', 2, '#d27632'],
            ['完成率', '76%', '#188b79'],
          ].map(([label, value, color]) => (
            <Col xs={12} lg={6} key={label}>
              <Card className="!border-[#dce7df]">
                <Statistic
                  title={label}
                  value={value}
                  styles={{
                    content: { color: String(color), fontSize: 25 },
                  }}
                />
              </Card>
            </Col>
          ))}
        </Row>
        <Card className="!border-[#dce7df]" styles={{ body: { padding: 0 } }}>
          <div className="border-b border-[#e2e9e3] p-4 sm:p-5">
            <ListToolbar direction={direction} />
          </div>
          <WorkPlanTable direction={direction} />
        </Card>
      </div>
    )
  }

  if (direction === 'C') {
    return (
      <div className="overflow-hidden rounded-lg border border-[#cbc7c1] bg-white">
        <div className="grid grid-cols-2 gap-px border-b border-[#cbc7c1] bg-[#cbc7c1] md:grid-cols-4">
          {[
            ['ACTIVE', '05'],
            ['DUE TODAY', '02'],
            ['AT RISK', '01'],
            ['DONE / WEEK', '12'],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#f5f3f0] px-4 py-3">
              <p className="font-mono text-[9px] tracking-widest text-[#817a72]">
                {label}
              </p>
              <p className="mt-1 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="border-b border-[#d8d4ce] bg-[#fbfaf8] p-3">
          <ListToolbar direction={direction} />
        </div>
        <WorkPlanTable direction={direction} />
      </div>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Card className="!border-[#dfe4ee]">
          <Typography.Text className="!text-xs !font-semibold !text-[#667085]">
            本周完成率
          </Typography.Text>
          <Progress type="circle" percent={76} size={118} className="!mt-5" />
        </Card>
        <Card className="!border-[#dfe4ee]">
          <Statistic title="待我确认" value={6} suffix="条" />
          <Button type="link" className="!mt-2 !-ml-3">
            只看待确认
          </Button>
        </Card>
      </aside>
      <Card
        className="min-w-0 !border-[#dfe4ee]"
        styles={{ body: { padding: 0 } }}
      >
        <div className="border-b border-[#e7eaf1] p-5">
          <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
            <div>
              <Typography.Title level={3} className="!mb-1">
                工作计划
              </Typography.Title>
              <Typography.Text type="secondary">
                统一查看跨项目计划、责任人和完成状态
              </Typography.Text>
            </div>
            <Tag color="geekblue" variant="filled">
              最近更新 10:24
            </Tag>
          </Flex>
          <div className="mt-5">
            <ListToolbar direction={direction} />
          </div>
        </div>
        <WorkPlanTable direction={direction} />
      </Card>
    </div>
  )
}

const projectTree = [
  {
    title: '交付项目',
    value: 'delivery',
    selectable: false,
    children: [
      { title: '华东数据中心扩容', value: 'east-dc' },
      { title: '制造园区数字化', value: 'factory-digital' },
    ],
  },
  {
    title: '内部建设',
    value: 'internal',
    selectable: false,
    children: [{ title: '项目管理系统', value: 'workplan-system' }],
  },
]

function PlanFormFields({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <Row gutter={[16, 0]}>
        <Col xs={24} lg={16}>
          <Form.Item
            label="计划标题"
            name="title"
            rules={[
              { required: true, message: '请输入计划标题' },
              { min: 4, message: '标题至少需要 4 个字' },
            ]}
          >
            <Input placeholder="例如：确认现场网络和设备清单" />
          </Form.Item>
        </Col>
        <Col xs={24} lg={8}>
          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'high', label: '高' },
                { value: 'medium', label: '中' },
                { value: 'low', label: '低' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={[16, 0]}>
        <Col xs={24} lg={12}>
          <Form.Item
            label="所属项目"
            name="project"
            rules={[{ required: true, message: '请选择所属项目' }]}
          >
            <TreeSelect
              treeData={projectTree}
              treeDefaultExpandAll
              showSearch
              placeholder="从项目树中选择"
            />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item
            label="负责人"
            name="owner"
            rules={[{ required: true, message: '请选择负责人' }]}
          >
            <Select
              showSearch
              placeholder="选择负责人"
              options={[
                { value: '王宁', label: '王宁 · 交付一组' },
                { value: '陈晨', label: '陈晨 · 项目管理部' },
                { value: '刘洋', label: '刘洋 · 研发中心' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="计划周期" name="period">
        <DatePicker.RangePicker className="w-full" />
      </Form.Item>
      <Form.Item label="计划说明" name="description">
        <Input.TextArea
          rows={compact ? 3 : 4}
          showCount
          maxLength={300}
          placeholder="记录目标、交付物、依赖和完成口径"
        />
      </Form.Item>
      <Form.Item label="相关文件">
        <Upload.Dragger beforeUpload={() => false} maxCount={3}>
          <FileUp className="mx-auto size-6 text-[#667085]" />
          <p className="mt-2 text-sm font-semibold">拖入文件，或点击选择</p>
          <p className="mt-1 text-xs text-[#8b95a7]">
            原型只保留本地文件名，不上传、不保存
          </p>
        </Upload.Dragger>
      </Form.Item>
      <Form.Item name="notify" valuePropName="checked" label="提醒设置">
        <Switch checkedChildren="开启" unCheckedChildren="关闭" />
      </Form.Item>
    </>
  )
}

const reviewTimeline = [
  { color: 'green', content: '需求范围已确认 · 08-25 16:20' },
  { color: 'blue', content: '工作计划编辑中 · 当前' },
  { color: 'gray', content: '等待负责人确认' },
]

function PlanProgress() {
  return (
    <div className="space-y-5">
      <Steps
        orientation="vertical"
        size="small"
        current={1}
        items={[
          { title: '基本信息', content: '目标和责任人' },
          { title: '计划安排', content: '周期与依赖' },
          { title: '确认发布', content: '通知相关人员' },
        ]}
      />
      <div className="border-t border-[#e7eaf1] pt-5">
        <Typography.Text className="!text-xs !font-semibold">
          最近活动
        </Typography.Text>
        <Timeline className="!mt-4" items={reviewTimeline} />
      </div>
    </div>
  )
}

export function WorkPlanFormScene({
  direction,
}: {
  direction: VisualDirection
}) {
  const [form] = Form.useForm()
  const { message } = App.useApp()

  function handleFinish(values: { title?: string }) {
    if (values.title?.includes('冲突')) {
      form.setFields([
        {
          name: 'title',
          errors: ['服务端模拟：已有同名计划，请调整标题'],
        },
      ])
      return
    }
    message.success('原型表单已通过校验；未保存任何数据')
  }

  const formActions = (
    <Flex gap={10} justify="flex-end" wrap="wrap">
      <Button onClick={() => form.resetFields()}>清空</Button>
      <Button type="primary" htmlType="submit">
        保存工作计划
      </Button>
    </Flex>
  )

  if (direction === 'B') {
    return (
      <div className="space-y-5">
        <Card className="!border-[#dce7df]">
          <Steps
            current={1}
            responsive
            items={[
              { title: '基本信息' },
              { title: '计划安排' },
              { title: '确认发布' },
            ]}
          />
        </Card>
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{ priority: 'medium', notify: true }}
          onFinish={handleFinish}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card
              title="编辑工作计划"
              extra={<Tag color="success">草稿自动保留：关闭</Tag>}
              className="!border-[#dce7df]"
            >
              <PlanFormFields />
              {formActions}
            </Card>
            <Card title="提交前检查" className="!border-[#dce7df]">
              <Space orientation="vertical" size={14} className="w-full">
                {['负责人已选择', '计划周期待填写', '附件不是必填项'].map(
                  (item, index) => (
                    <Flex key={item} gap={10} align="center">
                      <CheckCircle2
                        className={`size-4 ${index === 1 ? 'text-[#d27632]' : 'text-[#188b79]'}`}
                      />
                      <Typography.Text>{item}</Typography.Text>
                    </Flex>
                  ),
                )}
              </Space>
              <div className="mt-6 border-t border-[#e2e9e3] pt-5">
                <Timeline items={reviewTimeline} />
              </div>
            </Card>
          </div>
        </Form>
      </div>
    )
  }

  if (direction === 'C') {
    return (
      <div className="grid gap-0 overflow-hidden rounded-lg border border-[#cbc7c1] bg-white lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-b border-[#cbc7c1] bg-[#efede9] p-5 lg:border-r lg:border-b-0">
          <p className="font-mono text-[9px] tracking-[0.14em] text-[#817a72]">
            PLAN EDITOR / WP-NEW
          </p>
          <Typography.Title level={4} className="!mt-3">
            创建工作计划
          </Typography.Title>
          <div className="mt-6">
            <PlanProgress />
          </div>
        </aside>
        <Form
          form={form}
          layout="vertical"
          size="small"
          requiredMark="optional"
          initialValues={{ priority: 'medium', notify: true }}
          onFinish={handleFinish}
          className="p-5 sm:p-6"
        >
          <PlanFormFields compact />
          <div className="border-t border-[#d8d4ce] pt-4">{formActions}</div>
        </Form>
      </div>
    )
  }

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark="optional"
      initialValues={{ priority: 'medium', notify: true }}
      onFinish={handleFinish}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card
          title="编辑工作计划"
          extra={<Tag color="geekblue">原型数据</Tag>}
          className="!border-[#dfe4ee]"
        >
          <PlanFormFields />
          <div className="border-t border-[#e7eaf1] pt-5">{formActions}</div>
        </Card>
        <Card title="发布进度" className="h-fit !border-[#dfe4ee]">
          <PlanProgress />
        </Card>
      </div>
    </Form>
  )
}

export function ComponentCoverageActions({
  compact = false,
}: {
  compact?: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { message, notification } = App.useApp()

  return (
    <>
      <Flex gap={8} wrap="wrap">
        <Button
          size={compact ? 'small' : 'middle'}
          icon={<FolderTree className="size-4" />}
          onClick={() => setModalOpen(true)}
        >
          组件覆盖
        </Button>
        <Button
          size={compact ? 'small' : 'middle'}
          icon={<PanelRightOpen className="size-4" />}
          onClick={() => setDrawerOpen(true)}
        >
          流程抽屉
        </Button>
        <Button
          size={compact ? 'small' : 'middle'}
          icon={<Bell className="size-4" />}
          aria-label="验证通知反馈"
          onClick={() => {
            message.success('Message 反馈正常')
            notification.success({
              title: '工作计划已更新',
              description: 'Notification、Message 和主题上下文使用同一入口。',
            })
          }}
        >
          {!compact ? '验证反馈' : null}
        </Button>
      </Flex>

      <Modal
        title="免费核心组件覆盖"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => setModalOpen(false)}
        okText="验证通过"
        cancelText="继续查看"
      >
        <Descriptions
          column={1}
          size="small"
          items={[
            {
              key: 'form',
              label: '数据录入',
              children: 'Form / Upload / TreeSelect / DatePicker',
            },
            {
              key: 'data',
              label: '数据展示',
              children: 'Table / Timeline / Statistic / Tag',
            },
            {
              key: 'feedback',
              label: '反馈浮层',
              children: 'Modal / Drawer / Message / Notification',
            },
            {
              key: 'cost',
              label: '商业费用',
              children: '本轮使用项均来自 antd 免费 MIT 核心包',
            },
          ]}
        />
      </Modal>

      <Drawer
        title="阶段门与最近活动"
        open={drawerOpen}
        size={420}
        onClose={() => setDrawerOpen(false)}
      >
        <Steps
          orientation="vertical"
          current={1}
          items={[
            { title: '需求确认', content: '范围和责任人已确认' },
            { title: '计划编制', content: '当前验证页面' },
            { title: '评审发布', content: '等待正式 SPEC' },
          ]}
        />
        <Typography.Title level={5} className="!mt-8">
          活动时间线
        </Typography.Title>
        <Timeline className="!mt-5" items={reviewTimeline} />
      </Drawer>
    </>
  )
}
