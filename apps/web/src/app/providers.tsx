import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useState, type ReactNode } from 'react'

import { projectTheme } from '@/shared/theme/antd-theme'
import { getStablePopupContainer } from '@/shared/ui/popup-container'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        getPopupContainer={getStablePopupContainer}
        locale={zhCN}
        theme={projectTheme}
      >
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
