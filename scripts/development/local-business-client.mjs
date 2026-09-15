import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

export function localClient(origin, state) {
  const url = new URL(origin)
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname), 'Loopback development server required.')
  const cookies = new Map((state?.cookies ?? []).map((cookie) => [cookie.name, cookie.value]))
  async function request(method, path, body, expected = 200, key = randomUUID()) {
    const csrf = method === 'GET' ? null : (await request('GET', '/api/auth/csrf')).token
    const binary = body instanceof FormData
    const response = await fetch(origin + path, {
      method,
      headers: {
        ...(!binary ? { 'Content-Type': 'application/json' } : {}),
        Cookie: [...cookies].map(([name, value]) => name + '=' + value).join('; '),
        ...(csrf ? { 'X-XSRF-TOKEN': csrf, 'Idempotency-Key': key } : {}),
      },
      body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
    })
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';')[0], index = pair.indexOf('=')
      cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    const data = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : Buffer.from(await response.arrayBuffer())
    assert.equal(response.status, expected, method + ' ' + path + ': ' + response.status + ' ' + (data?.code ?? '') + ' ' + (data?.message ?? ''))
    return data
  }
  return {
    request,
    get: (path, expected) => request('GET', path, undefined, expected),
    post: (path, body, expected = 200, key = randomUUID()) => request('POST', path, { ...body, requestId: key }, expected, key),
    patch: (path, body, expected = 200, key = randomUUID()) => request('PATCH', path, { ...body, requestId: key }, expected, key),
    login: (loginName, password) => request('POST', '/api/auth/login', { loginName, password }),
    save: (path) => writeFile(path, JSON.stringify({
      cookies: [...cookies].map(([name, value]) => ({ name, value, domain: url.hostname, path: '/', httpOnly: name !== 'XSRF-TOKEN', secure: false, sameSite: 'Lax' })),
      origins: [],
    }), { mode: 0o600 }),
  }
}
export async function storedClient(origin, path) {
  return localClient(origin, JSON.parse(await readFile(path, 'utf8')))
}
