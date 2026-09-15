// PROTOTYPE — Existing visual directions plus an isolated, dev-only access-control scene.
import { useSearchParams } from 'react-router'

import { MenuResourceRegistryPrototype } from '@/features/component-lab/menu-resource-registry-prototype'
import { PrototypeSwitcher } from '@/features/component-lab/prototype-switcher'
import {
  accessControlPrototypeScene,
  normalizeScene,
  normalizeVariant,
  type PrototypeScene,
} from '@/features/component-lab/prototype-types'
import {
  VariantA,
  VariantB,
  VariantC,
} from '@/features/component-lab/visual-variants'

export function ComponentLabPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const variant = normalizeVariant(searchParams.get('variant'))
  const scene = normalizeScene(searchParams.get('scene'))

  function setScene(nextScene: PrototypeScene) {
    const next = new URLSearchParams(searchParams)
    next.set('scene', nextScene)
    setSearchParams(next, { replace: true })
  }

  if (scene === accessControlPrototypeScene) {
    return <MenuResourceRegistryPrototype />
  }

  return (
    <>
      {variant === 'A' ? <VariantA scene={scene} setScene={setScene} /> : null}
      {variant === 'B' ? <VariantB scene={scene} setScene={setScene} /> : null}
      {variant === 'C' ? <VariantC scene={scene} setScene={setScene} /> : null}
      <PrototypeSwitcher />
    </>
  )
}
