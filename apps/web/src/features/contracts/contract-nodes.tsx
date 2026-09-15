import {
  Button,
  Descriptions,
  Dropdown,
  Empty,
  Space,
  Table,
  Timeline,
} from 'antd'
import { MoreHorizontal } from 'lucide-react'
import { dateTime, label, money } from '@/features/business/business-data'
import {
  Panel,
  Status,
  type Command,
  type Field,
} from '@/features/business/business-ui'
import type {
  ContractDetail,
  ContractNode,
  ContractNodeFact,
} from './contract-types'
import './contract-nodes.css'

const revisionName = (kind: string) =>
  ({
    BASELINE: '历史启用时保留的事实',
    CREATED: '登记约定',
    COMPLETED: '登记完成',
    TERMS_CORRECTED: '调整约定',
    COMPLETION_CORRECTED: '纠正完成事实',
    COMPLETION_REOPENED: '撤销误报完成',
  })[kind] ?? kind

function NodeFacts({ fact }: { fact: ContractNodeFact | ContractNode }) {
  return (
    <Descriptions
      size="small"
      column={1}
      items={[
        { key: 'title', label: '节点', children: fact.title },
        { key: 'due', label: '约定日期', children: fact.dueDate },
        {
          key: 'amount',
          label: '约定金额',
          children: fact.amount === null ? '—' : money(fact.amount),
        },
        {
          key: 'condition',
          label: '条件与验收依据',
          children: fact.conditions,
        },
        {
          key: 'status',
          label: '完成状态',
          children: <Status value={fact.status} />,
        },
        {
          key: 'completed',
          label: '实际完成日期',
          children: fact.completedOn ?? '待完成',
        },
        {
          key: 'evidence',
          label: '完成证据',
          children: fact.evidence ?? '待登记',
        },
      ]}
    />
  )
}

export function ContractNodes({
  data,
  onAdd,
  onCommand,
}: {
  data: ContractDetail
  onAdd: () => void
  onCommand: (command: Command) => void
}) {
  const c = data.contract
  const editable =
    data.allowedActions.includes('CONTRACT_EDIT') &&
    c.archiveStatus !== 'SUBMITTED'
  const termsEditable = editable && c.status !== 'TERMINATED'
  const root = `/api/contracts/${c.id}/nodes`
  function showNode(n: ContractNode) {
    const canComplete = editable && n.status === 'PLANNED'
    onCommand({
      title: canComplete ? '登记节点完成证据' : '节点约定与证据',
      path: `${root}/${n.id}/complete`,
      readOnly: !canComplete,
      values: {
        version: n.version,
        completedOn: new Date().toLocaleDateString('en-CA'),
      },
      content: <NodeFacts fact={n} />,
      fields: canComplete
        ? [
            { name: 'completedOn', label: '实际完成日期', type: 'date' },
            { name: 'evidence', label: '完成依据', type: 'textarea' },
          ]
        : [],
      submitLabel: '保存完成证据',
    })
  }
  function history(n: ContractNode) {
    const entries = data.nodeHistory.filter((r) => r.nodeId === n.id)
    onCommand({
      title: `${n.title} · 节点历史`,
      path: `${root}/${n.id}`,
      readOnly: true,
      fields: [],
      description: '保留每次登记及更正的前后内容。完成记录不代表实际收付款。',
      content: entries.length ? (
        <Timeline
          items={entries.map((r) => ({
            key: r.id,
            content: (
              <div className="contract-node-revision">
                <Space wrap>
                  <strong>{revisionName(r.kind)}</strong>
                  <span>{r.recordedByName || '系统基线'}</span>
                  <span>{dateTime(r.createdAt)}</span>
                </Space>
                <p>{r.reason}</p>
                <div className="contract-node-revision__facts">
                  {r.before && (
                    <section>
                      <h4>更正前</h4>
                      <NodeFacts fact={r.before} />
                    </section>
                  )}
                  <section>
                    <h4>{r.before ? '登记后' : '保留事实'}</h4>
                    <NodeFacts fact={r.after} />
                  </section>
                </div>
              </div>
            ),
          }))}
        />
      ) : (
        <Empty description="此节点尚无历史记录" />
      ),
    })
  }
  function correct(n: ContractNode, kind: 'TERMS' | 'COMPLETION' | 'REOPEN') {
    const fields: Field[] =
      kind === 'TERMS'
        ? [
            { name: 'title', label: '节点名称' },
            { name: 'dueDate', label: '约定日期', type: 'date' },
            ...(n.kind === 'PAYMENT'
              ? [
                  {
                    name: 'amount',
                    label: '约定金额（元）',
                    type: 'number' as const,
                  },
                ]
              : []),
            ...(c.everArchived
              ? [
                  {
                    name: 'recordId',
                    label: '已签署的补充或变更依据',
                    type: 'select' as const,
                    options: data.records
                      .filter((r) => r.kind !== 'TERMINATION')
                      .map((r) => ({ value: r.id, label: r.title })),
                    wide: true,
                    hint: '须有当前有效签署文件；调整后重新归档。',
                  },
                ]
              : []),
            { name: 'conditions', label: '条件与验收依据', type: 'textarea' },
          ]
        : kind === 'COMPLETION'
          ? [
              {
                name: 'completedOn',
                label: '更正后的实际完成日期',
                type: 'date',
              },
              { name: 'evidence', label: '更正后的完成依据', type: 'textarea' },
            ]
          : []
    onCommand({
      title:
        kind === 'TERMS'
          ? '调整节点约定'
          : kind === 'COMPLETION'
            ? '纠正节点完成事实'
            : '撤销误报的节点完成',
      path: `${root}/${n.id}/corrections`,
      description:
        kind === 'TERMS'
          ? '保留原约定与更正原因；归档后的调整须有签署依据并重新归档。'
          : kind === 'COMPLETION'
            ? '原完成日期和证据保留在历史中，本次记录更正后的事实及原因。'
            : '节点将恢复待完成，原完成证据完整保留。请说明误报及后续处理安排。',
      values: { ...n, kind, version: n.version, contractVersion: c.version },
      fields: [
        ...fields,
        {
          name: 'reason',
          label: '更正原因',
          type: 'textarea',
          maxLength: 2000,
        },
      ],
      content: kind === 'REOPEN' ? <NodeFacts fact={n} /> : undefined,
      submitLabel:
        kind === 'REOPEN' ? '保留历史并恢复待完成' : '保存更正并留存历史',
    })
  }
  return (
    <Panel
      title="合同与验收节点"
      className="business-panel--table"
      subtitle={`${data.nodes.length} 个约定节点 · 完成证据与资金实际分别记录`}
      extra={
        termsEditable && (
          <Button size="small" onClick={onAdd}>
            新增节点
          </Button>
        )
      }
    >
      <Table
        size="small"
        rowKey="id"
        scroll={{ x: 745 }}
        pagination={false}
        dataSource={data.nodes}
        locale={{
          emptyText: data.sensitiveVisible
            ? '尚未登记合同约定节点'
            : '当前账号无权查看合同敏感节点',
        }}
        columns={[
          { title: '节点', dataIndex: 'title', width: 175 },
          { title: '类型', dataIndex: 'kind', width: 90, render: label },
          { title: '约定日期', dataIndex: 'dueDate', width: 115 },
          {
            title: '金额（元）',
            width: 125,
            align: 'right',
            render: (_, n) => (n.amount === null ? '—' : money(n.amount)),
          },
          {
            title: '状态',
            width: 100,
            render: (_, n) => <Status value={n.status} />,
          },
          {
            title: '操作',
            width: 140,
            render: (_, n) => (
              <Space size={4}>
                <Button size="small" onClick={() => showNode(n)}>
                  {editable && n.status === 'PLANNED' ? '登记完成' : '查看'}
                </Button>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      {
                        key: 'history',
                        label: '查看节点历史',
                        onClick: () => history(n),
                      },
                      ...(termsEditable
                        ? [
                            {
                              key: 'terms',
                              label: '调整节点约定',
                              onClick: () => correct(n, 'TERMS'),
                            },
                          ]
                        : []),
                      ...(editable && n.status === 'COMPLETED'
                        ? [
                            {
                              key: 'completion',
                              label: '纠正完成事实',
                              onClick: () => correct(n, 'COMPLETION'),
                            },
                            {
                              key: 'reopen',
                              label: '撤销误报完成',
                              onClick: () => correct(n, 'REOPEN'),
                            },
                          ]
                        : []),
                    ],
                  }}
                >
                  <Button
                    size="small"
                    aria-label={`${n.title}的更多操作`}
                    icon={<MoreHorizontal size={16} />}
                  />
                </Dropdown>
              </Space>
            ),
          },
        ]}
      />
    </Panel>
  )
}
