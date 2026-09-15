import type {
  MenuResource,
  MenuResourceType,
} from '@/features/menu-permissions/access-control-types'

export function defaultParentIdForNewResource(
  resources: MenuResource[],
  selectedResource: MenuResource | undefined,
  resourceType: MenuResourceType,
) {
  if (resourceType === 'DIRECTORY') {
    return undefined
  }

  if (resourceType === 'MENU_PAGE') {
    if (
      selectedResource?.resourceType === 'DIRECTORY' &&
      selectedResource.status === 'ENABLED'
    ) {
      return selectedResource.id
    }
    return resources.find(
      (resource) =>
        resource.resourceType === 'DIRECTORY' && resource.status === 'ENABLED',
    )?.id
  }

  if (
    selectedResource?.resourceType === 'MENU_PAGE' &&
    selectedResource.status === 'ENABLED'
  ) {
    return selectedResource.id
  }
  if (selectedResource?.resourceType === 'OPERATION') {
    const parent = resources.find(
      (resource) => resource.id === selectedResource.parentId,
    )
    if (parent?.resourceType === 'MENU_PAGE' && parent.status === 'ENABLED') {
      return parent.id
    }
  }
  return resources.find(
    (resource) =>
      resource.resourceType === 'MENU_PAGE' && resource.status === 'ENABLED',
  )?.id
}
