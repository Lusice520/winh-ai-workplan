import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { getJson, patchJson } from '@/api/client/http'
import { ConfigurationEditor } from './configuration-editor'
import { ConfigurationWorkspace } from './configuration-workspace'
import type { ConfigurationDetail } from './configuration-types'

vi.mock('@/api/client/http', async (original) => ({
  ...(await original<typeof import('@/api/client/http')>()),
  getJson: vi.fn(),
  patchJson: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const fixture: ConfigurationDetail = {
  configuration: {
    id: 'template-test',
    version: 2,
    seriesId: 'series-test',
    edition: 1,
    kind: 'STAGE_TEMPLATE',
    name: '验证·配置模板',
    status: 'DRAFT',
    projectTypes: ['SYSTEM_INTEGRATION'],
    stageCount: 1,
    reviewerCount: 0,
    createdByName: '验证·配置人',
    publishedByName: null,
    publishedAt: null,
    updatedAt: '2026-09-13T00:00:00Z',
  },
  versionNote: '用于验证字段转换',
  template: {
    projectTypes: ['SYSTEM_INTEGRATION'],
    stages: [
      {
        code: 'DESIGN',
        name: '验证·方案设计',
        applicability: 'REQUIRED',
        condition: null,
        ownerRoleHint: '技术负责人',
        predecessorCodes: [],
        parallelCodes: [],
        milestones: ['方案冻结'],
        actions: ['方案复核'],
        deliverables: ['设计图'],
        completionCriteria: '指定人员确认成果',
      },
    ],
  },
  policy: null,
  snapshotHash: null,
  people: [],
  problems: [],
  editions: [],
  retirementReason: null,
  retiredAt: null,
  history: [],
  allowedActions: [],
}
function providers(content: React.ReactNode) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App>{content}</App>
    </QueryClientProvider>
  )
}

it.each([{ allowedActions: [] }, { allowedActions: ['EDIT'] }])(
  'does not offer publication without the server action, actions=%j',
  async ({ allowedActions }) => {
    vi.mocked(getJson).mockResolvedValue({ ...fixture, allowedActions })
    render(
      providers(
        <MemoryRouter
          initialEntries={['/system/delivery-configuration/template-test']}
        >
          <Routes>
            <Route
              path="/system/delivery-configuration/:id"
              element={<ConfigurationWorkspace />}
            />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await screen.findByText('验证·配置模板')
    expect(screen.queryByText('发布此版')).not.toBeInTheDocument()
    expect(screen.queryByText('退役此版')).not.toBeInTheDocument()
    if (allowedActions.includes('EDIT'))
      expect(screen.getByText('维护草稿').closest('button')).toBeEnabled()
    else expect(screen.queryByText('维护草稿')).not.toBeInTheDocument()
  },
)

it('preserves the edition version and converts editable lines into structured stage requirements', async () => {
  vi.mocked(getJson).mockResolvedValue([])
  vi.mocked(patchJson).mockResolvedValue(fixture)
  const saved = vi.fn()
  render(
    providers(
      <ConfigurationEditor
        kind="STAGE_TEMPLATE"
        detail={fixture}
        onClose={vi.fn()}
        onSaved={saved}
      />,
    ),
  )
  fireEvent.change(await screen.findByLabelText(/交付成果/), {
    target: { value: ' 设计图 \n接口清单\n' },
  })
  fireEvent.click(screen.getByText('保存草稿').closest('button')!)
  await waitFor(() => expect(saved).toHaveBeenCalledOnce())
  const [path, body, options] = vi.mocked(patchJson).mock.calls[0]
  expect(path).toBe('/api/delivery-configurations/template-test')
  expect(body).toEqual({
    requestId: expect.any(String),
    version: 2,
    name: '验证·配置模板',
    versionNote: '用于验证字段转换',
    policy: null,
    template: {
      projectTypes: ['SYSTEM_INTEGRATION'],
      stages: [
        {
          ...fixture.template!.stages[0],
          deliverables: ['设计图', '接口清单'],
        },
      ],
    },
  })
  expect(options?.headers).toEqual({
    'Idempotency-Key': (body as { requestId: string }).requestId,
  })
})
