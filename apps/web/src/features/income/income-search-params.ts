import { useCallback, useLayoutEffect, useRef } from 'react'
import {
  createSearchParams,
  useSearchParams,
  type SetURLSearchParams,
} from 'react-router'

// Keep rapid changes to separate filters until the router commits the new URL.
export function useIncomeSearchParams() {
  const [params, navigate] = useSearchParams()
  const latest = useRef(params)
  useLayoutEffect(() => {
    latest.current = params
  }, [params])
  const setParams = useCallback<SetURLSearchParams>(
    (next, options) => {
      const resolved = createSearchParams(
        typeof next === 'function' ? next(latest.current) : next,
      )
      latest.current = resolved
      navigate(resolved, options)
    },
    [navigate],
  )
  return [params, setParams] as const
}
