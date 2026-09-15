import { Empty, Table, Tabs } from 'antd'
import { QueryState } from '@/features/business/business-ui'
import { dateTime, useBusinessQuery } from '@/features/business/business-data'
import { ObjectReadout } from './delivery-components'
import {
  contentKey,
  personName,
  type DeliveryContent,
  type DeliveryObject,
  type DeliveryWorkspace,
} from './delivery-types'

type Revision = {
  id: string
  objectVersion: number
  beforeJson: string | null
  afterJson: string | null
  actorId: string
  createdAt: string
  reason: string | null
  impact: string | null
  basis: string | null
}
function content(
  value: string | null,
  object: DeliveryObject,
): DeliveryContent | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = 'content' in parsed ? parsed.content : parsed
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      !(contentKey[object.kind] in candidate)
    )
      return null
    return candidate as DeliveryContent
  } catch {
    return null
  }
}
export function ObjectHistory({
  data,
  object,
}: {
  data: DeliveryWorkspace
  object: DeliveryObject
}) {
  const query = useBusinessQuery<Revision[]>(
    `/api/delivery-initiation/${data.project.projectId}/objects/${object.id}/history`,
  )
  const readout = (json: string | null, before: boolean) => {
    const body = content(json, object)
    return body ? (
      <ObjectReadout data={data} object={{ ...object, content: body }} />
    ) : (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          before && !json
            ? '此前尚无本交付对象。'
            : '本次记录了来源接纳，完整范围可在对应基线中查看。'
        }
      />
    )
  }
  return (
    <QueryState query={query}>
      <Table<Revision>
        size="small"
        rowKey="id"
        tableLayout="fixed"
        dataSource={query.data}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          hideOnSinglePage: true,
        }}
        locale={{ emptyText: '暂无修订记录。' }}
        columns={[
          { title: '版本', width: 65, render: (_, r) => `V${r.objectVersion}` },
          {
            title: '修订原因 / 责任人',
            render: (_, r) => (
              <>
                <strong>{r.reason ?? '修订说明查看受限'}</strong>
                <span className="business-cell-sub">
                  {personName(data, r.actorId)} · {dateTime(r.createdAt)}
                </span>
              </>
            ),
          },
        ]}
        expandable={{
          expandedRowRender: (r) => (
            <div className="delivery-section-stack">
              {r.impact && (
                <p>
                  <strong>影响：</strong>
                  {r.impact}
                </p>
              )}
              {r.basis && (
                <p>
                  <strong>依据：</strong>
                  {r.basis}
                </p>
              )}
              <Tabs
                items={[
                  {
                    key: 'after',
                    label: '修订后',
                    children: readout(r.afterJson, false),
                  },
                  {
                    key: 'before',
                    label: '修订前',
                    children: readout(r.beforeJson, true),
                  },
                ]}
              />
            </div>
          ),
        }}
      />
    </QueryState>
  )
}
