export const prototypeVariants = ['A', 'B', 'C'] as const
export const prototypeScenes = ['login', 'list', 'form'] as const
export const accessControlPrototypeScene = 'menu-resources' as const

export type PrototypeVariant = (typeof prototypeVariants)[number]
export type PrototypeScene = (typeof prototypeScenes)[number]
export type ComponentLabScene =
  PrototypeScene | typeof accessControlPrototypeScene

export const variantNames: Record<PrototypeVariant, string> = {
  A: '秩序工作台',
  B: '现代画布',
  C: '高密度控制台',
}

export const sceneNames: Record<PrototypeScene, string> = {
  login: '登录',
  list: '工作计划',
  form: '编辑表单',
}

export function normalizeVariant(value: string | null): PrototypeVariant {
  return prototypeVariants.includes(value as PrototypeVariant)
    ? (value as PrototypeVariant)
    : 'A'
}

export function normalizeScene(value: string | null): ComponentLabScene {
  if (value === accessControlPrototypeScene) return accessControlPrototypeScene

  return prototypeScenes.includes(value as PrototypeScene)
    ? (value as PrototypeScene)
    : 'list'
}
