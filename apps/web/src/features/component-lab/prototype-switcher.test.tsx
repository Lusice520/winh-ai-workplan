import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PrototypeSwitcher } from '@/features/component-lab/prototype-switcher'

function renderSwitcher() {
  const router = createMemoryRouter(
    [
      {
        path: '/component-lab',
        element: (
          <>
            <input aria-label="原型输入框" />
            <PrototypeSwitcher />
          </>
        ),
      },
    ],
    { initialEntries: ['/component-lab?variant=A&scene=list'] },
  )

  render(<RouterProvider router={router} />)
  return router
}

describe('PrototypeSwitcher', () => {
  it('cycles visual variants and keeps the selected scene in the URL', async () => {
    const user = userEvent.setup()
    const router = renderSwitcher()

    expect(screen.getByText('A — 秩序工作台')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '下一个视觉方向' }))

    expect(screen.getByText('B — 现代画布')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?variant=B&scene=list')
  })

  it('does not intercept arrow keys while a form field is focused', async () => {
    const user = userEvent.setup()
    const router = renderSwitcher()

    await user.click(screen.getByRole('textbox', { name: '原型输入框' }))
    await user.keyboard('{ArrowRight}')

    expect(router.state.location.search).toBe('?variant=A&scene=list')
  })
})
