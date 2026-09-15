export type ApiProblem = {
  code: string
  message: string
  fieldErrors: Array<{ field: string; message: string }>
  correlationId: string
}

export class HttpError extends Error {
  public readonly status: number
  public readonly body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }

  get problem(): ApiProblem | undefined {
    if (
      this.body &&
      typeof this.body === 'object' &&
      'code' in this.body &&
      'message' in this.body &&
      'fieldErrors' in this.body
    ) {
      return this.body as ApiProblem
    }

    return undefined
  }
}

type JsonRequestOptions = Omit<RequestInit, 'body' | 'headers' | 'method'> & {
  body?: unknown
  headers?: HeadersInit
  csrf?: boolean
}

let csrfTokenRequest: Promise<string> | undefined

export async function getJson<T>(
  path: string,
  init?: Omit<RequestInit, 'method'>,
): Promise<T> {
  return requestJson<T>(path, { ...init, method: 'GET', csrf: false })
}

export async function postJson<T>(
  path: string,
  body?: unknown,
  init?: JsonRequestOptions,
): Promise<T> {
  return requestJson<T>(path, { ...init, method: 'POST', body })
}

export async function patchJson<T>(
  path: string,
  body?: unknown,
  init?: JsonRequestOptions,
): Promise<T> {
  return requestJson<T>(path, { ...init, method: 'PATCH', body })
}

export async function putJson<T>(
  path: string,
  body?: unknown,
  init?: JsonRequestOptions,
): Promise<T> {
  return requestJson<T>(path, { ...init, method: 'PUT', body })
}

export async function requestJson<T>(
  path: string,
  options: JsonRequestOptions & { method?: string } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const mustSendCsrf =
    options.csrf ?? !['GET', 'HEAD', 'OPTIONS'].includes(method)
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  let body: BodyInit | undefined
  if (options.body !== undefined) {
    if (
      options.body instanceof FormData ||
      options.body instanceof URLSearchParams
    ) {
      body = options.body
    } else {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }
  }

  if (mustSendCsrf) {
    headers.set(
      'X-XSRF-TOKEN',
      await readCsrfToken(options.signal ?? undefined),
    )
  }

  const response = await fetch(path, {
    ...options,
    method,
    body,
    headers,
    credentials: options.credentials ?? 'include',
  })
  const responseBody = await readResponseBody(response)

  if (!response.ok) {
    if (isCsrfValidationProblem(responseBody)) {
      clearCachedCsrfToken()
    }
    throw new HttpError(
      response.status,
      problemMessage(responseBody, response.status),
      responseBody,
    )
  }

  return responseBody as T
}

export function clearCachedCsrfToken() {
  csrfTokenRequest = undefined
}

export function getProblemMessage(
  error: unknown,
  fallback = '操作未完成，请稍后重试。',
) {
  if (error instanceof HttpError) {
    return error.problem?.message ?? error.message
  }

  return fallback
}

async function readCsrfToken(signal?: AbortSignal) {
  // Session authentication can rotate the CSRF cookie between commands.
  // Share only an in-flight lookup, never a token from an earlier mutation.
  if (!csrfTokenRequest) {
    csrfTokenRequest = fetch('/api/auth/csrf', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal,
    })
      .then(async (response) => {
        const body = await readResponseBody(response)
        if (!response.ok) {
          throw new HttpError(
            response.status,
            problemMessage(body, response.status),
            body,
          )
        }
        if (!body || typeof body !== 'object' || !('token' in body)) {
          throw new HttpError(500, '未获得可用的请求校验令牌。', body)
        }
        return String(body.token)
      })
      .finally(() => {
        csrfTokenRequest = undefined
      })
  }

  return csrfTokenRequest
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  return text || undefined
}

function problemMessage(body: unknown, status: number) {
  if (body && typeof body === 'object' && 'message' in body) {
    return String(body.message)
  }

  return `请求失败（${status}）`
}

function isCsrfValidationProblem(body: unknown) {
  return (
    body &&
    typeof body === 'object' &&
    'code' in body &&
    body.code === 'CSRF_VALIDATION_FAILED'
  )
}
