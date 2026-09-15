import {
  Alert,
  App,
  Button,
  Collapse,
  Empty,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { getJson, getProblemMessage } from '@/api/client/http'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import {
  Panel,
  QueryState,
  type Command,
} from '@/features/business/business-ui'
import {
  BudgetComposition,
  DeliveryStatus,
  ObjectReadout,
  StageTimeline,
} from './delivery-components'
import {
  archiveObjectCommand,
  commitmentCommand,
  contentSummary,
  objectCommand,
  resourceCommand,
  type DeliveryEditorContext,
} from './delivery-editor'
import {
  activeObjects,
  budgetCents,
  deliveryLabel,
  formatCents,
  objectName,
  objectTitle,
  personName,
  type ContractNodeCandidate,
  type DeliveryKind,
  type DeliveryObject,
  type DeliveryResource,
  type DeliverySnapshot,
  type DeliveryWorkspace,
  type PublishedDeliveryConfiguration,
  type ResourceOverlap,
  type WorkPackageCandidate,
} from './delivery-types'
import {
  scopeLabel,
  scopeActionLabel,
  type ScopeFrozen,
  type ScopeResourceEdit,
  type ScopeRow,
  type ScopeView,
} from './scope-types'

type SetCommand = (command: Command) => void
const root = (projectId: string) =>
  `/api/delivery-initiation/${projectId}/scope-changes`
const kinds: DeliveryKind[] = [
  'STAGE',
  'MILESTONE',
  'WORK_PACKAGE',
  'ITEM',
  'PLAN',
  'BUDGET',
]
const area = (name: string, label: string) => ({
  name,
  label,
  type: 'textarea' as const,
})

function scopeWorkspace(
  data: DeliveryWorkspace,
  snapshot: DeliverySnapshot,
  version?: number,
): DeliveryWorkspace {
  return {
    ...data,
    objects: snapshot.objects,
    resources: snapshot.resources,
    findings: snapshot.findings,
    preparation: data.preparation
      ? {
          ...data.preparation,
          header: snapshot.header,
          template: snapshot.template,
          policy: snapshot.policy,
          ...(version !== undefined ? { status: 'PREPARING', version } : {}),
        }
      : null,
  }
}

export function ScopeSection({
  data,
  ctx,
  setCommand,
}: {
  data: DeliveryWorkspace
  ctx: DeliveryEditorContext
  setCommand: SetCommand
}) {
  const projectId = data.project.projectId,
    { message } = App.useApp()
  const [selected, setSelected] = useState<string>(),
    [opening, setOpening] = useState(false)
  const list = useBusinessQuery<ScopeRow[]>(root(projectId))
  const id = selected ?? list.data?.[0]?.id
  const detail = useBusinessQuery<ScopeView>(
    id ? `${root(projectId)}/${id}` : undefined,
  )
  const canCreate =
    !list.isPending &&
    !list.isError &&
    data.allowedActions.includes('EDIT') &&
    data.preparation?.budgetReadable &&
    data.preparation.status === 'APPROVED' &&
    !list.data?.some((d) =>
      ['DRAFT', 'RETURNED', 'SUBMITTED'].includes(d.status),
    )
  async function editMetadata(view?: ScopeView) {
    setOpening(true)
    try {
      const configs = await getJson<PublishedDeliveryConfiguration[]>(
        `/api/delivery-initiation/${projectId}/configurations?kind=REVIEW_POLICY`,
      )
      setCommand({
        title: view ? '调整整组变更说明' : '建立整组范围变更',
        path: root(projectId) + (view ? `/${view.change.id}` : ''),
        method: view ? 'PATCH' : 'POST',
        description:
          '逐步补齐拟调整范围，提交后由规则指定的独立公司授权人确认。现有批准工作继续执行。',
        values: {
          version: view?.change.version ?? data.preparation?.version,
          reason: view?.change.reason,
          impact: view?.impact,
          basis: view?.basis,
          policyEditionId: view?.selectedPolicyEditionId ?? null,
        },
        fields: [
          area('reason', '变更原因'),
          area('impact', '对范围、日期、资源及预算的影响'),
          area('basis', '变更依据'),
          {
            name: 'policyEditionId',
            label: '本次适用审批规则',
            type: 'select',
            required: false,
            hint: '留空沿用当前批准规则；金额或风险区间发生变化时，明确选择适用的已发布规则。',
            options: configs.map((c) => ({
              value: c.id,
              label: `${c.name} · V${c.edition}`,
            })),
          },
        ],
        onSuccess: (result) => {
          if (
            result &&
            typeof result === 'object' &&
            'change' in result &&
            result.change &&
            typeof result.change === 'object' &&
            'id' in result.change &&
            typeof result.change.id === 'string'
          )
            setSelected(result.change.id)
        },
      })
    } catch (error) {
      message.error(getProblemMessage(error))
    } finally {
      setOpening(false)
    }
  }
  return (
    <div className="delivery-section-stack">
      <Panel
        title="整组范围变更"
        subtitle="把新增或调整的阶段、工作包、清单、计划、资源与预算成组核对，一次批准生效。"
        extra={
          canCreate && (
            <Button
              type="primary"
              loading={opening}
              onClick={() => editMetadata()}
            >
              新建范围变更
            </Button>
          )
        }
      >
        <QueryState query={list}>
          {list.data?.length ? (
            <div className="delivery-scope-selector">
              <Select
                aria-label="选择范围提案"
                value={id}
                onChange={setSelected}
                options={list.data.map((d, index) => ({
                  value: d.id,
                  label: `${index === 0 ? '最近 · ' : ''}${scopeLabel(d.status)} · 引用 V${d.baseBaselineVersion} · ${d.reason ?? dateTime(d.createdAt)}`,
                }))}
              />
              <span>
                {list.data.length} 份提案 · 当前基线 V
                {data.preparation?.baselineVersion}
              </span>
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无整组范围变更。需增加互相关联的交付范围时，从这里建立草案。"
            />
          )}
        </QueryState>
      </Panel>
      {id && (
        <QueryState query={detail}>
          {detail.data && (
            <ScopeEditor
              key={id}
              view={detail.data}
              data={data}
              ctx={ctx}
              setCommand={setCommand}
              metadata={() => editMetadata(detail.data)}
            />
          )}
        </QueryState>
      )}
    </div>
  )
}

function ScopeEditor({
  view,
  data,
  ctx,
  setCommand,
  metadata,
}: {
  view: ScopeView
  data: DeliveryWorkspace
  ctx: DeliveryEditorContext
  setCommand: SetCommand
  metadata: () => void
}) {
  const [kind, setKind] = useState<DeliveryKind>('STAGE'),
    [onlyChanges, setOnlyChanges] = useState(false),
    [opening, setOpening] = useState(false)
  const { message } = App.useApp(),
    projectId = data.project.projectId,
    path = `${root(projectId)}/${view.change.id}`
  const candidate = scopeWorkspace(data, view.candidate, view.change.version)
  candidate.people = [
    ...data.people,
    ...ctx.people
      .filter((p) => !data.people.some((x) => x.id === p.value))
      .map((p) => ({ id: p.value, name: p.label })),
  ]
  const candidateCtx = { ...ctx, data: candidate }
  const can = (action: string) => view.allowedActions.includes(action),
    edits = view.draft.objects
  const budget = activeObjects(candidate, 'BUDGET')[0]?.content.budget
  const pending = view.draft.resources.filter(
    (e) => !['COMMITTED', 'RESOLVED', 'REVOKED'].includes(e.proposed.status),
  ).length
  function act(
    action: string,
    title: string,
    extra?: { objectId?: string; resourceId?: string },
  ) {
    setCommand({
      title,
      path: `${path}/actions`,
      values: { version: view.change.version, action, ...extra },
      fields: [area('note', '意见与依据')],
      description:
        action === 'REBASE'
          ? '保留无冲突草案并更新基线引用。有并发修改的草案项须先明确撤回，再重新编辑。'
          : action === 'APPROVE'
            ? '按本份提案统一应用范围与指定人签认的资源安排，形成下一版基线。旧版本和原对象来源保持连续。'
            : undefined,
      content:
        action === 'APPROVE' || action === 'RETURN' ? (
          <ScopeReviewSummary view={view} data={candidate} />
        ) : undefined,
      submitLabel: action === 'APPROVE' ? '确认批准整组变更' : '确认提交',
    })
  }
  async function editObject(kind: DeliveryKind, object?: DeliveryObject) {
    setOpening(true)
    try {
      const candidates =
        kind === 'WORK_PACKAGE' && !object
          ? await getJson<WorkPackageCandidate[]>(
              `/api/delivery-initiation/${projectId}/work-packages`,
            )
          : []
      const contractNodes =
        kind === 'MILESTONE'
          ? await getJson<ContractNodeCandidate[]>(
              `/api/delivery-initiation/${projectId}/contract-nodes`,
            )
          : []
      const command = objectCommand(
        {
          ...candidateCtx,
          candidates: candidates.filter(
            (w) =>
              w.status === 'OPEN' &&
              !['BASELINED', 'IN_REVIEW', 'RETIRED'].includes(w.deliveryState),
          ),
          contractNodes,
        },
        kind,
        object,
      )
      setCommand({
        ...command,
        title: `${object ? '调整拟定' : '新增拟定'}${deliveryLabel(kind)}`,
        path: `${path}/objects${object ? `/${object.id}` : ''}`,
        description:
          '保存到本份范围草案，尚未改写当前有效基线。关联项可以逐步补齐，提交前核验整组关系。',
      })
    } catch (error) {
      message.error(getProblemMessage(error))
    } finally {
      setOpening(false)
    }
  }
  function showObject(object: DeliveryObject) {
    setCommand({
      title: `${objectTitle(object)} · 范围对照`,
      path: `scope-object:${object.id}`,
      readOnly: true,
      fields: [],
      content: (
        <ScopeObjectComparison
          data={candidate}
          reference={view.reference}
          object={object}
        />
      ),
    })
  }
  function editResource(resource?: DeliveryResource) {
    const command = resourceCommand(candidateCtx, resource)
    setCommand({
      ...command,
      title: resource ? '调整拟投入资源' : '新增拟投入资源',
      path: `${path}/resources${resource ? `/${resource.id}` : ''}`,
      transform: (v) => ({
        ...command.transform?.(v),
        releaseRequested: false,
      }),
    })
  }
  function sign(edit: ScopeResourceEdit) {
    const command = commitmentCommand(candidate, edit.proposed)
    setCommand({
      ...command,
      title: edit.releaseRequested
        ? '确认撤回原资源投入'
        : '签认本次拟投入资源',
      path: `${path}/resources/${edit.proposed.id}/commit`,
      values: {
        ...command.values,
        ...(edit.releaseRequested ? { decision: 'REVOKED' } : {}),
      },
      fields: command.fields.map((f) =>
        f.name === 'decision'
          ? {
              ...f,
              options: f.options?.filter((o) =>
                edit.releaseRequested
                  ? o.value === 'REVOKED'
                  : o.value !== 'REVOKED',
              ),
            }
          : f,
      ),
      content: (
        <>
          <Alert type="info" title={edit.proposed.request.requestNote} />
          <ScopeOverlaps
            path={`${path}/resources/${edit.proposed.id}/overlaps`}
          />
        </>
      ),
    })
  }
  function release(resource: DeliveryResource) {
    const original = view.reference.resources.find((r) => r.id === resource.id)
    if (!original) return
    setCommand({
      title: '申请撤回原资源投入',
      path: `${path}/resources/${resource.id}`,
      method: 'PATCH',
      values: {
        version: view.change.version,
        resourceVersion: resource.version,
        request: original.request,
        releaseRequested: true,
      },
      description: `${personName(candidate, original.request.personId)} · ${original.request.startsOn} 至 ${original.request.endsOn} · 每天 ${original.request.dailyHours} 小时。指定原承诺人确认后，随整组提案批准生效。`,
      fields: [area('reason', '撤回原因')],
    })
  }
  const objects = candidate.objects.filter(
    (o) =>
      o.kind === kind &&
      (!o.archived || edits.some((e) => e.proposed.id === o.id)) &&
      (!onlyChanges || edits.some((e) => e.proposed.id === o.id)),
  )
  return (
    <>
      <div className="delivery-scope-facts">
        <div>
          <span>本份提案</span>
          <strong>{scopeLabel(view.change.status)}</strong>
          <small>
            引用 V{view.change.baseBaselineVersion} ·{' '}
            {dateTime(view.change.updatedAt)}
          </small>
        </div>
        <div>
          <span>拟调整对象</span>
          <strong>
            {view.change.objectCount} <small>项</small>
          </strong>
          <small>
            {edits.filter((e) => e.originalVersion === null).length} 项新增 ·{' '}
            {edits.filter((e) => e.proposed.archived).length} 项停用
          </small>
        </div>
        <div>
          <span>资源签认</span>
          <strong>
            {view.change.resourceCount - pending} / {view.change.resourceCount}
          </strong>
          <small>
            {pending ? `${pending} 项待签认或协调` : '拟资源已有明确结论'}
          </small>
        </div>
        <div>
          <span>拟生效预算</span>
          <strong>
            {view.budgetReadable
              ? formatCents(budgetCents(budget))
              : '查看受限'}
          </strong>
          <small>
            {view.budgetReadable ? '覆盖整份候选范围' : '按当前账号权限显示'}
          </small>
        </div>
      </div>
      {view.staleProblems.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="引用依据已变化"
          description={view.staleProblems.join('；')}
          action={
            can('REBASE') && (
              <Button
                size="small"
                onClick={() => act('REBASE', '更新范围提案引用')}
              >
                核对后更新引用
              </Button>
            )
          }
        />
      )}
      <div className="delivery-scope-grid">
        <div className="delivery-scope-main">
          <Panel
            title="候选交付范围"
            subtitle="原内容与拟调整内容合并展示；点开对象可查看前后对照。"
            extra={
              <Space>
                <span>仅看变更</span>
                <Switch
                  size="small"
                  aria-label="仅看变更对象"
                  checked={onlyChanges}
                  onChange={setOnlyChanges}
                />
              </Space>
            }
          >
            <Tabs
              size="small"
              activeKey={kind}
              onChange={(value) => setKind(value as DeliveryKind)}
              items={kinds
                .filter((k) => k !== 'BUDGET' || view.budgetReadable)
                .map((k) => ({
                  key: k,
                  label: `${deliveryLabel(k)} ${candidate.objects.filter((o) => o.kind === k && !o.archived).length}`,
                }))}
            />
            {kind === 'STAGE' &&
              candidate.objects.some((o) => o.kind === 'STAGE') && (
                <StageTimeline data={candidate} onOpen={showObject} />
              )}
            <div className="delivery-scope-toolbar">
              <span>
                {objects.length} 项{onlyChanges ? '拟调整内容' : '候选内容'}
              </span>
              {can(kind === 'BUDGET' ? 'EDIT_BUDGET' : 'EDIT') &&
                !(
                  kind === 'BUDGET' && activeObjects(candidate, kind).length
                ) && (
                  <Button
                    size="small"
                    loading={opening}
                    disabled={view.change.stale}
                    onClick={() => editObject(kind)}
                  >
                    新增{deliveryLabel(kind)}
                  </Button>
                )}
            </div>
            <div className="delivery-scope-object-list">
              {objects.map((o) => {
                const edit = edits.find((e) => e.proposed.id === o.id),
                  change = o.archived
                    ? '拟停用'
                    : edit
                      ? edit.originalVersion === null
                        ? edit.adopted
                          ? '接纳原工作包'
                          : '拟新增'
                        : '拟调整'
                      : '沿用原内容'
                return (
                  <article className="delivery-scope-object" key={o.id}>
                    <div>
                      <Button type="link" onClick={() => showObject(o)}>
                        {objectTitle(o)}
                      </Button>
                      <Tag
                        color={
                          edit ? (o.archived ? 'orange' : 'blue') : undefined
                        }
                      >
                        {change}
                      </Tag>
                    </div>
                    <p>{contentSummary(o.content)}</p>
                    <div className="delivery-scope-object-actions">
                      <Button size="small" onClick={() => showObject(o)}>
                        查看对照
                      </Button>
                      {can(o.kind === 'BUDGET' ? 'EDIT_BUDGET' : 'EDIT') &&
                        !o.archived && (
                          <Button
                            size="small"
                            loading={opening}
                            disabled={view.change.stale}
                            onClick={() => editObject(o.kind, o)}
                          >
                            编辑
                          </Button>
                        )}
                      {can('EDIT') &&
                        o.kind !== 'BUDGET' &&
                        !o.archived &&
                        (!edit || edit.originalVersion !== null) && (
                          <Button
                            size="small"
                            disabled={view.change.stale}
                            onClick={() => {
                              const command = archiveObjectCommand(candidate, o)
                              setCommand({
                                ...command,
                                title: `拟停用${objectTitle(o)}`,
                                path: `${path}/objects/${o.id}/archive`,
                              })
                            }}
                          >
                            拟停用
                          </Button>
                        )}
                      {edit &&
                        can(o.kind === 'BUDGET' ? 'EDIT_BUDGET' : 'EDIT') && (
                          <Button
                            size="small"
                            onClick={() =>
                              act(
                                'REVERT_OBJECT',
                                `撤回草案项 · ${objectTitle(o)}`,
                                { objectId: o.id },
                              )
                            }
                          >
                            撤回本项调整
                          </Button>
                        )}
                      {view.change.status === 'APPROVED' &&
                        o.kind === 'WORK_PACKAGE' &&
                        !o.archived && (
                          <Link to={`/work-items/${o.id}`}>打开工作包</Link>
                        )}
                    </div>
                  </article>
                )
              })}
            </div>
            {!objects.length && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  onlyChanges
                    ? '本类暂无拟调整内容。关闭筛选可查看原对象。'
                    : '本类暂无内容，可先建立草案再补齐关联。'
                }
              />
            )}
          </Panel>
          <Panel
            title="资源安排与指定人签认"
            subtitle="拟投入与其他已承诺资源一并核验；批准后统一生效。"
            extra={
              can('EDIT') && (
                <Button
                  size="small"
                  disabled={view.change.stale}
                  onClick={() => editResource()}
                >
                  新增拟投入
                </Button>
              )
            }
          >
            <ScopeResourceCards
              view={view}
              data={candidate}
              actorId={ctx.actorId}
              edit={editResource}
              release={release}
              sign={sign}
              revert={(r) =>
                act('REVERT_RESOURCE', '撤回资源草案', { resourceId: r.id })
              }
            />
          </Panel>
        </div>
        <aside className="delivery-scope-aside">
          <Panel
            title="核验与处理"
            extra={
              <Tag color={view.problems.length ? 'orange' : 'green'}>
                {['APPROVED', 'CANCELLED'].includes(view.change.status)
                  ? scopeLabel(view.change.status)
                  : view.problems.length
                    ? `${view.problems.length} 项待处理`
                    : '条件已齐备'}
              </Tag>
            }
          >
            {view.problems.length > 0 ? (
              <>
                <ul className="delivery-scope-problems">
                  {view.problems.slice(0, 5).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {view.problems.length > 5 && (
                  <Collapse
                    size="small"
                    items={[
                      {
                        key: 'more',
                        label: `其余 ${view.problems.length - 5} 项`,
                        children: (
                          <ul className="delivery-scope-problems">
                            {view.problems.slice(5).map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        ),
                      },
                    ]}
                  />
                )}
              </>
            ) : (
              <p className="delivery-scope-muted">
                {view.change.status === 'APPROVED'
                  ? '本份提案已统一生效，历史提交内容保留。'
                  : '提交与批准时将再次核验当前来源、责任、范围、资源和预算。'}
              </p>
            )}
            <div className="delivery-scope-actions">
              {can('SUBMIT') && (
                <Button
                  type="primary"
                  disabled={
                    view.problems.length > 0 || view.staleProblems.length > 0
                  }
                  onClick={() => act('SUBMIT', '提交整组范围变更')}
                >
                  提交独立确认
                </Button>
              )}
              {can('DECIDE') && (
                <>
                  <Button
                    type="primary"
                    disabled={
                      view.problems.length > 0 || view.staleProblems.length > 0
                    }
                    onClick={() => act('APPROVE', '独立批准整组范围变更')}
                  >
                    独立批准
                  </Button>
                  <Button onClick={() => act('RETURN', '退回范围提案补齐')}>
                    退回补齐
                  </Button>
                </>
              )}
              {can('WITHDRAW') && (
                <Button onClick={() => act('WITHDRAW', '撤回已提交范围提案')}>
                  撤回补齐
                </Button>
              )}
              {can('CANCEL') && (
                <Button onClick={() => act('CANCEL', '取消本份范围提案')}>
                  取消提案
                </Button>
              )}
            </div>
          </Panel>
          <Panel
            title="变更依据"
            extra={
              can('EDIT') &&
              view.budgetReadable && (
                <Button size="small" onClick={metadata}>
                  编辑说明
                </Button>
              )
            }
          >
            <dl className="delivery-scope-notes">
              <dt>原因</dt>
              <dd>{view.change.reason ?? '查看受限'}</dd>
              <dt>影响</dt>
              <dd>{view.impact ?? '查看受限'}</dd>
              <dt>依据</dt>
              <dd>{view.basis ?? '查看受限'}</dd>
              <dt>审批规则</dt>
              <dd>
                {view.candidate.policy?.name} · V
                {view.candidate.policy?.edition}
              </dd>
              <dt>独立确认人</dt>
              <dd>{personName(candidate, view.finalApproverId)}</dd>
            </dl>
          </Panel>
          {view.budgetReadable && (
            <Panel title="候选预算构成">
              <BudgetComposition budget={budget} />
            </Panel>
          )}
          <Panel title="提交与处理记录">
            {view.rounds.length ? (
              view.rounds.map((r) => (
                <div className="delivery-scope-round" key={r.id}>
                  <strong>
                    第 {r.number} 轮 · {scopeLabel(r.status)}
                  </strong>
                  <small>
                    {personName(candidate, r.submittedBy)} ·{' '}
                    {dateTime(r.submittedAt)}
                  </small>
                  {r.decisionNote && <p>{r.decisionNote}</p>}
                  {r.baselineVersion && (
                    <Tag color="green">形成基线 V{r.baselineVersion}</Tag>
                  )}
                  <Button
                    size="small"
                    onClick={() =>
                      setCommand({
                        title: `整组范围提案 · 第 ${r.number} 轮`,
                        path: `scope-snapshot:${r.id}`,
                        readOnly: true,
                        fields: [],
                        content: (
                          <ScopeFrozenReadout
                            path={`${path}/submissions/${r.id}`}
                            data={candidate}
                          />
                        ),
                      })
                    }
                  >
                    查看当轮内容
                  </Button>
                </div>
              ))
            ) : (
              <p className="delivery-scope-muted">
                本份提案未产生提交轮次，草案维护记录见下方。
              </p>
            )}
          </Panel>
          {!!view.events?.length && (
            <Panel
              title="维护与提交说明"
              subtitle="保留每次操作的责任人和说明，最近 100 条。"
            >
              <Collapse
                size="small"
                items={view.events.map((e) => ({
                  key: e.id,
                  label: `${scopeActionLabel(e.action)} · ${dateTime(e.at)}`,
                  children: (
                    <>
                      <strong>{personName(candidate, e.actorId)}</strong>
                      <p className="delivery-scope-muted">
                        {e.note ?? '说明查看受限'}
                      </p>
                    </>
                  ),
                }))}
              />
            </Panel>
          )}
        </aside>
      </div>
    </>
  )
}

function ScopeResourceCards({
  view,
  data,
  actorId,
  edit,
  release,
  sign,
  revert,
}: {
  view: ScopeView
  data: DeliveryWorkspace
  actorId: string
  edit: (r: DeliveryResource) => void
  release: (r: DeliveryResource) => void
  sign: (e: ScopeResourceEdit) => void
  revert: (r: DeliveryResource) => void
}) {
  const can = (action: string) => view.allowedActions.includes(action)
  const rows = data.resources.filter(
    (r) =>
      r.status !== 'REVOKED' ||
      view.draft.resources.some((e) => e.proposed.id === r.id),
  )
  return rows.length ? (
    <div className="delivery-scope-resource-list">
      {rows.map((r) => {
        const delta = view.draft.resources.find((e) => e.proposed.id === r.id),
          request = r.request
        return (
          <article className="delivery-scope-resource" key={r.id}>
            <div>
              <strong>{personName(data, request.personId)}</strong>
              {delta ? (
                <Tag color={delta.releaseRequested ? 'orange' : 'blue'}>
                  {delta.releaseRequested
                    ? '拟撤回'
                    : delta.originalVersion === null
                      ? '拟新增'
                      : '拟调整'}
                </Tag>
              ) : (
                <Tag>沿用原安排</Tag>
              )}
              <DeliveryStatus value={delta?.proposed.status ?? r.status} />
            </div>
            <p>{objectName(data, request.workPackageId)}</p>
            <p>安排：{request.requestNote}</p>
            <p>
              {request.startsOn} 至 {request.endsOn} · 每天{' '}
              <b>{request.dailyHours}</b> 小时
            </p>
            <p>
              签认：{personName(data, request.committerId)}
              {r.commitment
                ? ` · 可用 ${r.commitment.dailyCapacity} 小时 / 天`
                : ''}
            </p>
            {delta?.proposed.commitment?.conclusion && (
              <p className="delivery-scope-muted">
                {delta.proposed.commitment.conclusion}
              </p>
            )}
            <Space wrap size="small">
              {can('EDIT') && !delta?.releaseRequested && (
                <Button
                  size="small"
                  disabled={view.change.stale}
                  onClick={() => edit(r)}
                >
                  调整拟安排
                </Button>
              )}
              {can('EDIT') &&
                !delta?.releaseRequested &&
                (!delta || delta.originalVersion !== null) && (
                  <Button
                    size="small"
                    disabled={view.change.stale}
                    onClick={() => release(r)}
                  >
                    拟撤回投入
                  </Button>
                )}
              {delta &&
                can('SIGN_RESOURCES') &&
                request.committerId === actorId && (
                  <Button
                    size="small"
                    type="primary"
                    disabled={view.change.stale}
                    onClick={() => sign(delta)}
                  >
                    {delta.releaseRequested ? '确认撤回' : '签认拟投入'}
                  </Button>
                )}
              {delta && can('EDIT') && (
                <Button size="small" onClick={() => revert(r)}>
                  撤回本项草案
                </Button>
              )}
            </Space>
          </article>
        )
      })}
    </div>
  ) : (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="暂无资源安排，请为拟执行工作包补齐投入。"
    />
  )
}

function ScopeOverlaps({ path }: { path: string }) {
  const query = useBusinessQuery<ResourceOverlap[]>(path)
  return (
    <QueryState query={query}>
      <Alert
        type="info"
        showIcon
        title="以下重叠安排包含本提案内其他拟投入；容量按全部并行需求合计校验。"
      />
      <Table
        size="small"
        className="delivery-scope-overlaps"
        tableLayout="fixed"
        pagination={false}
        rowKey="displayKey"
        dataSource={query.data?.map((r, index) => ({
          ...r,
          displayKey: r.resourceId ?? `restricted-${index}`,
        }))}
        locale={{ emptyText: '当前没有其他重叠安排。' }}
        columns={[
          {
            title: '项目 / 窗口',
            render: (_, r) => (
              <>
                <strong>{r.projectName}</strong>
                <span className="business-cell-sub">
                  {r.startsOn} 至 {r.endsOn}
                </span>
              </>
            ),
          },
          { title: '每天工时', dataIndex: 'dailyHours', width: 82 },
        ]}
      />
    </QueryState>
  )
}

function ScopeObjectComparison({
  data,
  reference,
  object,
}: {
  data: DeliveryWorkspace
  reference: DeliverySnapshot
  object: DeliveryObject
}) {
  const previous = reference.objects.find((o) => o.id === object.id)
  return (
    <Tabs
      defaultActiveKey="after"
      items={[
        {
          key: 'after',
          label: object.archived ? '拟停用的内容' : '拟生效内容',
          children: (
            <>
              {object.archived && (
                <Alert type="warning" title="本提案申请停用该对象。" />
              )}
              <ObjectReadout data={data} object={object} />
            </>
          ),
        },
        {
          key: 'before',
          label: '引用的原内容',
          children: previous ? (
            <ObjectReadout
              data={scopeWorkspace(data, reference)}
              object={previous}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="这是本次新增的交付范围。原需求派生工作包的来源关系将在生效后保留。"
            />
          ),
        },
      ]}
    />
  )
}

function ScopeReviewSummary({
  view,
  data,
}: {
  view: ScopeView
  data: DeliveryWorkspace
}) {
  return (
    <div className="delivery-scope-review-summary">
      <Alert
        type="info"
        showIcon
        title={`引用基线 V${view.change.baseBaselineVersion} · ${view.change.objectCount} 项对象 · ${view.change.resourceCount} 项资源调整`}
        description={`原因：${view.change.reason ?? '查看受限'}；影响：${view.impact ?? '查看受限'}`}
      />
      <Collapse
        size="small"
        items={view.draft.objects.map((e) => ({
          key: e.proposed.id,
          label: `${e.proposed.archived ? '拟停用' : e.originalVersion === null ? '拟新增' : '拟调整'} · ${objectTitle(e.proposed)}`,
          children: (
            <ScopeObjectComparison
              data={data}
              reference={view.reference}
              object={e.proposed}
            />
          ),
        }))}
      />
      {view.draft.resources.map((e) => (
        <p key={e.proposed.id}>
          {personName(data, e.proposed.request.personId)} ·{' '}
          {e.releaseRequested ? '拟撤回' : '拟投入'}{' '}
          {e.proposed.request.dailyHours} 小时 / 天 ·{' '}
          <DeliveryStatus value={e.proposed.status} />
        </p>
      ))}
    </div>
  )
}

function ScopeFrozenReadout({
  path,
  data,
}: {
  path: string
  data: DeliveryWorkspace
}) {
  const query = useBusinessQuery<ScopeFrozen>(path),
    f = query.data
  return (
    <QueryState query={query}>
      {f && (
        <div className="delivery-section-stack">
          <Alert
            type="info"
            showIcon
            title={`当轮引用基线 V${f.baseBaselineVersion}`}
            description={f.reason ?? '变更说明查看受限'}
          />
          {f.impact && (
            <p>
              <strong>影响：</strong>
              {f.impact}
            </p>
          )}
          {f.basis && (
            <p>
              <strong>依据：</strong>
              {f.basis}
            </p>
          )}
          <Collapse
            items={f.draft.objects.map((e) => ({
              key: e.proposed.id,
              label: objectTitle(e.proposed),
              children: (
                <ScopeObjectComparison
                  data={scopeWorkspace(data, f.candidate)}
                  reference={f.reference}
                  object={e.proposed}
                />
              ),
            }))}
          />
          {f.draft.resources.map((e) => (
            <div className="delivery-scope-resource" key={e.proposed.id}>
              <strong>
                {personName(data, e.proposed.request.personId)} ·{' '}
                {e.releaseRequested ? '撤回原安排' : '拟投入安排'}
              </strong>
              <p>
                {e.proposed.request.startsOn} 至 {e.proposed.request.endsOn} ·
                每天 {e.proposed.request.dailyHours} 小时
              </p>
              <p>{e.proposed.commitment?.conclusion}</p>
              <DeliveryStatus value={e.proposed.status} />
            </div>
          ))}
        </div>
      )}
    </QueryState>
  )
}
