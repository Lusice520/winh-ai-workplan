export function getStablePopupContainer(triggerNode?: HTMLElement) {
  if (!triggerNode || triggerNode === triggerNode.ownerDocument.body) {
    return document.body
  }

  return (
    triggerNode.closest<HTMLElement>(
      '.ant-select, .ant-picker, .ant-cascader',
    ) ??
    triggerNode.parentElement ??
    triggerNode.ownerDocument.body
  )
}
