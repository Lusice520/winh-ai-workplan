import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearCachedCsrfToken, postJson } from '@/api/client/http'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  clearCachedCsrfToken()
  vi.unstubAllGlobals()
})

describe('HTTP client CSRF recovery', () => {
  it('refreshes the token between consecutive successful mutations', async () => {
    let generation = 0
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/auth/csrf')
        return Promise.resolve(jsonResponse({ token: `token-${++generation}` }))
      expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe(
        `token-${generation}`,
      )
      return Promise.resolve(jsonResponse({ saved: generation }))
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      postJson('/api/projects/fixture', { version: 1 }),
    ).resolves.toEqual({ saved: 1 })
    await expect(
      postJson('/api/projects/fixture', { version: 2 }),
    ).resolves.toEqual({ saved: 2 })
    expect(generation).toBe(2)
  })
  it('uses a freshly requested token when the server rejects a previously cached token', async () => {
    clearCachedCsrfToken()
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/auth/csrf') {
        const token =
          fetchMock.mock.calls.filter(
            ([request]) => String(request) === '/api/auth/csrf',
          ).length === 1
            ? 'expired-token'
            : 'fresh-token'
        return Promise.resolve(jsonResponse({ token }))
      }

      if (url === '/api/iam/users') {
        const token = new Headers(init?.headers).get('X-XSRF-TOKEN')
        if (token === 'fresh-token') {
          return Promise.resolve(jsonResponse({ id: 'new-user' }, 201))
        }
        return Promise.resolve(
          jsonResponse(
            {
              code: 'CSRF_VALIDATION_FAILED',
              message:
                '请求校验已失效，请再次提交；如仍失败，请刷新页面后重试。',
              fieldErrors: [],
              correlationId: 'test-correlation-id',
            },
            403,
          ),
        )
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      postJson('/api/iam/users', { displayName: '验收用户' }),
    ).rejects.toThrow(
      '请求校验已失效，请再次提交；如仍失败，请刷新页面后重试。',
    )

    await expect(
      postJson('/api/iam/users', { displayName: '验收用户' }),
    ).resolves.toEqual({
      id: 'new-user',
    })
    expect(
      fetchMock.mock.calls.filter(
        ([request]) => String(request) === '/api/auth/csrf',
      ),
    ).toHaveLength(2)
  })
})
