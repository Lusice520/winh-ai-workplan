import {
  App as AntdApp,
  Button,
  ConfigProvider,
  Flex,
  Menu,
  Segmented,
  Space,
  Tabs,
  Tag,
  Typography,
  type MenuProps,
} from 'antd'
import {
  ArrowLeft,
  Blocks,
  CheckCircle2,
  FilePenLine,
  Gauge,
  KeyRound,
  ListChecks,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router'

import {
  ComponentCoverageActions,
  LoginScene,
  WorkPlanFormScene,
  WorkPlanListScene,
} from '@/features/component-lab/prototype-content'
import {
  prototypeScenes,
  sceneNames,
  type PrototypeScene,
} from '@/features/component-lab/prototype-types'
import { prototypeThemes } from '@/shared/theme/antd-theme'

type VariantProps = {
  scene: PrototypeScene
  setScene: (scene: PrototypeScene) => void
}

const sceneIcons = {
  login: <KeyRound className="size-4" />,
  list: <ListChecks className="size-4" />,
  form: <FilePenLine className="size-4" />,
}

function SceneContent({
  scene,
  direction,
}: {
  scene: PrototypeScene
  direction: 'A' | 'B' | 'C'
}) {
  if (scene === 'login') return <LoginScene direction={direction} />
  if (scene === 'form') return <WorkPlanFormScene direction={direction} />
  return <WorkPlanListScene direction={direction} />
}

function PrototypeNotice({ direction }: { direction: 'A' | 'B' | 'C' }) {
  const classes = {
    A: 'border-[#dfe4ee] bg-white text-[#667085]',
    B: 'border-[#dce7df] bg-white/70 text-[#5f7268]',
    C: 'border-[#cbc7c1] bg-[#e9e6e1] text-[#6f6962]',
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[11px] ${classes[direction]}`}
    >
      可丢弃原型：只验证 Ant Design v6 免费组件与视觉，不代表正式产品页面。
    </div>
  )
}

export function VariantA({ scene, setScene }: VariantProps) {
  const menuItems: MenuProps['items'] = prototypeScenes.map((item) => ({
    key: item,
    icon: sceneIcons[item],
    label: sceneNames[item],
  }))

  return (
    <ConfigProvider theme={prototypeThemes.A}>
      <AntdApp>
        <div className="min-h-dvh bg-[#f4f6fa] text-[#182235]">
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-[#151d2d] p-5 text-white lg:flex">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="grid size-10 place-items-center rounded-xl bg-[#3157d5]">
                <Blocks className="size-5" />
              </div>
              <div>
                <p className="text-sm font-bold">项目工作台</p>
                <p className="mt-1 text-[9px] tracking-[0.14em] text-white/40 uppercase">
                  Direction A
                </p>
              </div>
            </div>
            <p className="mt-8 px-3 text-[10px] tracking-[0.14em] text-white/35 uppercase">
              验证场景
            </p>
            <Menu
              className="!mt-2 !border-0 !bg-transparent"
              theme="dark"
              mode="inline"
              selectedKeys={[scene]}
              items={menuItems}
              onClick={({ key }) => setScene(key as PrototypeScene)}
            />
            <div className="mt-auto space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <Flex gap={8} align="center">
                  <ShieldCheck className="size-4 text-[#68d4b7]" />
                  <span className="text-xs font-semibold">免费核心组件</span>
                </Flex>
                <p className="mt-2 text-[11px] leading-5 text-white/45">
                  antd@6.6.1 · MIT
                  <br />
                  不包含 ProComponents 或付费模板
                </p>
              </div>
              <Link to="/" className="block">
                <Button
                  type="text"
                  block
                  className="!justify-start !text-white/60 hover:!bg-white/8 hover:!text-white"
                  icon={<ArrowLeft className="size-4" />}
                >
                  返回搭建概览
                </Button>
              </Link>
            </div>
          </aside>

          <main className="lg:pl-[260px]">
            <header className="sticky top-0 z-20 border-b border-[#e1e5ed] bg-[#f4f6fa]/92 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
              <Flex justify="space-between" align="center" gap={16} wrap="wrap">
                <div>
                  <Flex gap={8} align="center">
                    <Tag color="geekblue" variant="filled">
                      A · 秩序工作台
                    </Tag>
                    <Typography.Text className="!text-xs !text-[#8b95a7]">
                      克制、清晰、任务优先
                    </Typography.Text>
                  </Flex>
                </div>
                <ComponentCoverageActions />
              </Flex>
              <Segmented
                className="!mt-4 !w-full lg:!hidden"
                block
                value={scene}
                options={prototypeScenes.map((item) => ({
                  value: item,
                  label: sceneNames[item],
                }))}
                onChange={(value) => setScene(value as PrototypeScene)}
              />
            </header>

            <div className="mx-auto max-w-[1480px] space-y-4 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.14em] text-[#8b95a7] uppercase">
                  Ant Design v6 / Visual validation
                </p>
                <Typography.Title
                  level={2}
                  className="!mt-2 !mb-2 !tracking-[-0.035em]"
                >
                  {sceneNames[scene]}场景
                </Typography.Title>
                <Typography.Paragraph className="!mb-0 !text-[#667085]">
                  方向 A
                  以稳定工作台为核心，优先保证信息层级、可扫描性和长期使用舒适度。
                </Typography.Paragraph>
              </div>
              <PrototypeNotice direction="A" />
              <SceneContent scene={scene} direction="A" />
            </div>
          </main>
        </div>
      </AntdApp>
    </ConfigProvider>
  )
}

export function VariantB({ scene, setScene }: VariantProps) {
  return (
    <ConfigProvider theme={prototypeThemes.B}>
      <AntdApp>
        <div className="min-h-dvh bg-[#f1f5f0] pb-28 text-[#17231f]">
          <header className="border-b border-[#dce7df] bg-[#f7faf7]/90 px-4 py-4 backdrop-blur-xl sm:px-7">
            <div className="mx-auto flex max-w-[1320px] items-center gap-4">
              <div className="grid size-10 place-items-center rounded-2xl bg-[#116c5b] text-white shadow-sm">
                <Blocks className="size-5" />
              </div>
              <div>
                <p className="text-sm font-bold">项目空间</p>
                <p className="text-[10px] text-[#788a80]">Modern canvas</p>
              </div>
              <div className="mx-auto hidden md:block">
                <Segmented
                  value={scene}
                  options={prototypeScenes.map((item) => ({
                    value: item,
                    label: sceneNames[item],
                    icon: sceneIcons[item],
                  }))}
                  onChange={(value) => setScene(value as PrototypeScene)}
                />
              </div>
              <Space className="ml-auto">
                <ComponentCoverageActions compact />
                <Link to="/">
                  <Button icon={<ArrowLeft className="size-4" />}>概览</Button>
                </Link>
              </Space>
            </div>
          </header>

          <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-7 lg:py-9">
            <div className="mb-5 flex flex-col gap-4 rounded-[24px] border border-[#dce7df] bg-white/55 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Flex gap={8} align="center">
                  <Tag color="green" variant="filled">
                    B · 现代画布
                  </Tag>
                  <CheckCircle2 className="size-4 text-[#116c5b]" />
                  <span className="text-xs text-[#6e8076]">
                    柔和、友好、内容导向
                  </span>
                </Flex>
                <Typography.Title
                  level={2}
                  className="!mt-4 !mb-2 !tracking-[-0.04em]"
                >
                  {sceneNames[scene]}，也可以更有产品感
                </Typography.Title>
                <Typography.Paragraph className="!mb-0 !max-w-2xl !text-[#66776e]">
                  方向 B
                  减少传统后台的边框和密度，用更柔和的画布承载同一套企业组件能力。
                </Typography.Paragraph>
              </div>
              <Segmented
                className="md:!hidden"
                block
                value={scene}
                options={prototypeScenes.map((item) => ({
                  value: item,
                  label: sceneNames[item],
                }))}
                onChange={(value) => setScene(value as PrototypeScene)}
              />
            </div>
            <PrototypeNotice direction="B" />
            <div className="mt-4">
              <SceneContent scene={scene} direction="B" />
            </div>
          </main>
        </div>
      </AntdApp>
    </ConfigProvider>
  )
}

export function VariantC({ scene, setScene }: VariantProps) {
  return (
    <ConfigProvider theme={prototypeThemes.C}>
      <AntdApp>
        <div className="min-h-dvh bg-[#f2f1ef] pb-28 text-[#22201e]">
          <header className="border-b border-black bg-[#1e1d1b] px-3 py-2 text-white sm:px-5">
            <Flex justify="space-between" align="center" gap={12} wrap="wrap">
              <Flex align="center" gap={10}>
                <div className="grid size-8 place-items-center bg-[#d95d39]">
                  <Gauge className="size-4" />
                </div>
                <div>
                  <p className="font-mono text-[10px] font-bold tracking-[0.12em]">
                    WINH / OPERATIONS
                  </p>
                  <p className="text-[9px] text-white/40">
                    DIRECTION C · DENSE
                  </p>
                </div>
              </Flex>
              <ComponentCoverageActions compact />
            </Flex>
          </header>

          <div className="border-b border-[#cbc7c1] bg-[#e9e6e1] px-3 sm:px-5">
            <div className="mx-auto flex max-w-[1500px] items-center gap-4">
              <Tabs
                className="min-w-0 flex-1"
                size="small"
                activeKey={scene}
                onChange={(key) => setScene(key as PrototypeScene)}
                items={prototypeScenes.map((item) => ({
                  key: item,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      {sceneIcons[item]}
                      {sceneNames[item]}
                    </span>
                  ),
                  children: null,
                }))}
              />
              <Link to="/" className="hidden sm:block">
                <Button size="small" icon={<ArrowLeft className="size-3.5" />}>
                  返回概览
                </Button>
              </Link>
            </div>
          </div>

          <main className="mx-auto grid max-w-[1500px] gap-4 px-3 py-4 sm:px-5 xl:grid-cols-[190px_minmax(0,1fr)]">
            <aside className="hidden space-y-3 xl:block">
              <div className="border border-[#cbc7c1] bg-[#e9e6e1] p-4">
                <p className="font-mono text-[9px] tracking-[0.13em] text-[#817a72]">
                  CURRENT VIEW
                </p>
                <p className="mt-2 text-sm font-bold">{sceneNames[scene]}</p>
                <Tag color="volcano" variant="filled" className="!mt-3">
                  C · 高密度控制台
                </Tag>
              </div>
              <div className="border border-[#cbc7c1] bg-white p-4">
                <p className="text-xs font-bold">设计意图</p>
                <p className="mt-2 text-[11px] leading-5 text-[#6f6962]">
                  更少留白、更高扫描效率、明显的控制台气质，适合专业高频用户。
                </p>
              </div>
              <div className="border border-[#cbc7c1] bg-white p-4">
                <p className="font-mono text-[9px] text-[#817a72]">STATUS</p>
                <div className="mt-3 space-y-2 text-[11px]">
                  <p>● THEME TOKENS / OK</p>
                  <p>● CORE COMPONENTS / OK</p>
                  <p>○ BROWSER QA / PENDING</p>
                </div>
              </div>
            </aside>
            <div className="min-w-0 space-y-3">
              <PrototypeNotice direction="C" />
              <SceneContent scene={scene} direction="C" />
            </div>
          </main>
        </div>
      </AntdApp>
    </ConfigProvider>
  )
}
