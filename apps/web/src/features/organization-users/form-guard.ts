import { App, type FormInstance } from 'antd'
import { useEffect } from 'react'

type UnsavedFormGuardOptions<Values extends object> = {
  form: FormInstance<Values>
  enabled: boolean
  isSubmitting: boolean
  onDiscard: () => void
}

/**
 * Keeps drawer editing safe without leaking navigation concerns into each form.
 * Successful submissions close their drawer from the workspace; this guard only
 * handles user-initiated dismissal of locally changed fields.
 */
export function useUnsavedFormGuard<Values extends object>({
  form,
  enabled,
  isSubmitting,
  onDiscard,
}: UnsavedFormGuardOptions<Values>) {
  const { modal } = App.useApp()

  useEffect(() => {
    if (!enabled || isSubmitting) {
      return
    }

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!form.isFieldsTouched()) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [enabled, form, isSubmitting])

  function requestClose() {
    if (isSubmitting) {
      return
    }

    if (!form.isFieldsTouched()) {
      onDiscard()
      return
    }

    modal.confirm({
      title: '放弃未保存的内容？',
      content: '关闭后，本次填写的内容不会保存。',
      okText: '放弃更改',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      zIndex: 1200,
      onOk: () => {
        form.resetFields()
        onDiscard()
      },
    })
  }

  return requestClose
}
