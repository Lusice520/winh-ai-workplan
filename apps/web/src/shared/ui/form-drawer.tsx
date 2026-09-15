import { Typography } from 'antd'
import type { ReactNode } from 'react'

export function FormSection({
  icon,
  tone = 'blue',
  title,
  children,
}: {
  icon: ReactNode
  tone?: 'blue' | 'green' | 'amber' | 'violet'
  title: string
  children: ReactNode
}) {
  return (
    <section className="form-section">
      <div className="form-section__header">
        <span
          aria-hidden="true"
          className={`form-section__icon form-section__icon--${tone}`}
        >
          {icon}
        </span>
        <Typography.Text className="!text-[15px] !font-semibold !text-[#25324b]">
          {title}
        </Typography.Text>
      </div>
      <div className="form-section__body">{children}</div>
    </section>
  )
}

export function DrawerTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-xl bg-[#eef4ff] text-[#2167f3]"
      >
        {icon}
      </span>
      <div>
        <Typography.Text className="!block !text-lg !font-semibold !text-[#1f2d48]">
          {title}
        </Typography.Text>
        <Typography.Text className="!text-xs !text-[#8390a7]">
          {subtitle}
        </Typography.Text>
      </div>
    </div>
  )
}

export function AccessControlDrawerHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="access-control-drawer-heading">
      <Typography.Text className="access-control-drawer-heading__crumb">
        {subtitle}
      </Typography.Text>
      <Typography.Text className="access-control-drawer-heading__title">
        {title}
      </Typography.Text>
    </div>
  )
}
