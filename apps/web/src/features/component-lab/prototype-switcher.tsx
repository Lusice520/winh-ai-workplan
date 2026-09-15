import { Button } from 'antd'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

import {
  normalizeVariant,
  prototypeVariants,
  variantNames,
} from '@/features/component-lab/prototype-types'

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.matches('input, textarea, select, [contenteditable="true"]') ||
    Boolean(target.closest('[contenteditable="true"]'))
  )
}

export function PrototypeSwitcher() {
  const [searchParams, setSearchParams] = useSearchParams()
  const current = normalizeVariant(searchParams.get('variant'))

  function changeVariant(direction: -1 | 1) {
    const currentIndex = prototypeVariants.indexOf(current)
    const nextIndex =
      (currentIndex + direction + prototypeVariants.length) %
      prototypeVariants.length
    const next = new URLSearchParams(searchParams)
    next.set('variant', prototypeVariants[nextIndex])
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTextEditingTarget(event.target)) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        changeVariant(-1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        changeVariant(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  if (import.meta.env.PROD) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[1200] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#101522] px-2 py-2 text-white shadow-[0_18px_54px_rgba(16,21,34,0.34)]"
      aria-label="原型视觉方向切换器"
    >
      <Button
        type="text"
        shape="circle"
        className="!text-white hover:!bg-white/10"
        icon={<ArrowLeft className="size-4" />}
        aria-label="上一个视觉方向"
        title="上一个视觉方向（←）"
        onClick={() => changeVariant(-1)}
      />
      <div className="min-w-[132px] px-2 text-center">
        <p className="text-[9px] tracking-[0.16em] text-white/50 uppercase">
          Prototype only
        </p>
        <p className="text-xs font-semibold">
          {current} — {variantNames[current]}
        </p>
      </div>
      <Button
        type="text"
        shape="circle"
        className="!text-white hover:!bg-white/10"
        icon={<ArrowRight className="size-4" />}
        aria-label="下一个视觉方向"
        title="下一个视觉方向（→）"
        onClick={() => changeVariant(1)}
      />
    </div>
  )
}
