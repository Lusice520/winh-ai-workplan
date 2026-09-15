import { Result, Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router'

import { HttpError } from '@/api/client/http'
import { useCurrentSession } from '@/features/auth/auth-session'

export function AuthGate() {
  const location = useLocation()
  const sessionQuery = useCurrentSession()

  if (sessionQuery.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f5f7fb]">
        <Spin description="正在确认本地会话…" size="large" />
      </div>
    )
  }

  if (sessionQuery.error) {
    if (
      sessionQuery.error instanceof HttpError &&
      sessionQuery.error.status === 401
    ) {
      return (
        <Navigate
          replace
          to="/login"
          state={{ from: `${location.pathname}${location.search}` }}
        />
      )
    }

    return (
      <div className="grid min-h-dvh place-items-center bg-[#f5f7fb] p-5">
        <Result
          status="warning"
          title="暂时无法确认登录状态"
          subTitle="请确认本地后端和数据库均已启动后刷新页面。"
        />
      </div>
    )
  }

  if (
    sessionQuery.data.mustChangePassword &&
    location.pathname !== '/password/change'
  ) {
    return <Navigate replace to="/password/change" />
  }

  return <Outlet />
}
