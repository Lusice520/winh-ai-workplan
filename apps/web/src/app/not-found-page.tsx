export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="text-muted font-mono text-xs tracking-[0.16em]">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">
          这个页面还不存在
        </h1>
        <p className="text-slate mt-2 text-sm">
          请从左侧导航返回已搭建的页面。
        </p>
      </div>
    </div>
  )
}
