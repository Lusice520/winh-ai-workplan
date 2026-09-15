import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { TaskHistory, TaskStatus } from './task-ui'
import {
  matchesTask,
  taskStats,
  type TaskEvent,
  type TaskRow,
} from './task-types'

const row = (changes: Partial<TaskRow> = {}): TaskRow => ({
  id: 'task',
  version: 0,
  workVersion: 0,
  title: '验证·接口核对',
  acceptanceCriteria: '逐项确认',
  status: 'OPEN',
  needsReview: false,
  sourceRequirementId: null,
  ownerId: 'owner',
  ownerName: '验证·负责人',
  verifierId: 'verifier',
  verifierName: '验证·核验人',
  startsOn: '2026-10-12',
  dueDate: '2026-10-16',
  estimatedDays: 1.5,
  progress: 0,
  actualStartedOn: null,
  actualCompletedOn: null,
  itemCount: 1,
  allowedActions: [],
  ...changes,
})
describe('delivery task facts', () => {
  it('counts only independently verified current work and separates cancellations and stale completions', () => {
    expect(
      taskStats([
        row({ status: 'DONE', progress: 100 }),
        row({ status: 'PENDING_VERIFICATION', progress: 100 }),
        row({ status: 'DONE', needsReview: true, progress: 100 }),
        row({ status: 'CANCELLED' }),
        row(),
      ]),
    ).toEqual({
      total: 4,
      done: 1,
      pending: 1,
      review: 1,
      cancelled: 1,
      percent: 25,
    })
    expect(taskStats([]).percent).toBe(0)
    render(
      <TaskStatus
        task={row({ status: 'PENDING_VERIFICATION', progress: 100 })}
      />,
    )
    expect(screen.getByText('待验证')).toBeVisible()
    expect(screen.queryByText('已验证')).not.toBeInTheDocument()
  })
  it('retains complete text and uses inclusive date and state filters on the actual rows', () => {
    const task = row({ actualStartedOn: '2026-09-13', progress: 30 })
    expect(
      matchesTask(
        task,
        new URLSearchParams(
          'q=负责人&state=IN_PROGRESS&from=2026-10-12&to=2026-10-16',
        ),
      ),
    ).toBe(true)
    expect(matchesTask(task, new URLSearchParams('state=DONE'))).toBe(false)
    expect(matchesTask(task, new URLSearchParams('from=2026-10-13'))).toBe(
      false,
    )
    expect(matchesTask(task, new URLSearchParams('to=2026-10-15'))).toBe(false)
    expect(
      matchesTask(
        row({ needsReview: true }),
        new URLSearchParams('state=NEEDS_REVIEW'),
      ),
    ).toBe(true)
  })
  it('shows prior completion evidence and restricted file counts without exposing hidden identifiers', () => {
    const event: TaskEvent = {
      id: 'event',
      taskId: 'task',
      action: 'RETURN',
      note: '验证·补齐第二轮',
      actorId: 'verifier',
      actorName: '验证·核验人',
      at: '2026-09-13T10:00:00Z',
      before: {
        json: JSON.stringify({
          status: 'PENDING_VERIFICATION',
          evidence: '验证·第一轮原成果',
          ownerName: '验证·原负责人',
        }),
        files: { files: [], restricted: 1 },
      },
      after: {
        json: JSON.stringify({ status: 'OPEN', evidence: '验证·第一轮原成果' }),
        files: { files: [], restricted: 0 },
      },
    }
    render(
      <MemoryRouter>
        <TaskHistory events={[event]} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /expand row/i }))
    expect(screen.getAllByText('验证·第一轮原成果')).toHaveLength(2)
    expect(screen.getByText('1 项附件的查看权限受限')).toBeVisible()
    expect(screen.getByRole('link', { name: '原记录' })).toHaveAttribute(
      'href',
      '/work-items/task',
    )
  })
})
