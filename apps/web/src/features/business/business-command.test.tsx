import { App } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CommandDrawer } from './business-ui'
import { postJson } from '@/api/client/http'

vi.mock('@/api/client/http', async (original) => ({
  ...(await original<typeof import('@/api/client/http')>()),
  postJson: vi.fn().mockResolvedValue({ saved: true }),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it.each([0, 80])(
  'submits the actual numeric value %s without a string-required error',
  async (value) => {
    const close = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <App>
          <CommandDrawer
            command={{
              title: '投入申请',
              path: '/api/test-investment',
              fields: [{ name: 'hours', label: '申请人时', type: 'number' }],
            }}
            onClose={close}
          />
        </App>
      </QueryClientProvider>,
    )
    fireEvent.change(screen.getByRole('spinbutton', { name: '申请人时' }), {
      target: { value: String(value) },
    })
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))
    await waitFor(() =>
      expect(postJson).toHaveBeenCalledWith(
        '/api/test-investment',
        expect.objectContaining({ hours: value }),
        { headers: { 'Idempotency-Key': expect.any(String) } },
      ),
    )
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  },
)

it('reuses the authorization command key when retrying an unchanged review', async () => {
  vi.mocked(postJson).mockRejectedValueOnce(new Error('Interrupted response'))
  const close = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App>
        <CommandDrawer
          command={{
            title: '独立复核临时授权',
            path: '/api/access-control/temporary-grants/test/review',
            values: { version: 0, decision: 'APPROVED' },
            fields: [{ name: 'comment', label: '复核意见' }],
          }}
          onClose={close}
        />
      </App>
    </QueryClientProvider>,
  )
  fireEvent.change(screen.getByRole('textbox', { name: '复核意见' }), {
    target: { value: '保持原期限' },
  })
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  const calls = vi.mocked(postJson).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[0]).toEqual(calls[1])
  expect(calls[0][2]?.headers).toEqual({
    'Idempotency-Key': (calls[0][1] as { requestId: string }).requestId,
  })
})
