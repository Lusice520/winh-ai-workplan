import { downloadFile, fileKinds, fileSize, fileKindName } from './file-data'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd'
import { Download, FileText, UploadCloud } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { getProblemMessage, postJson } from '@/api/client/http'
import { useCurrentSession } from '@/features/auth/auth-session'
import {
  CommandDrawer,
  History,
  Panel,
  QueryState,
  Status,
  type Command,
} from '@/features/business/business-ui'
import {
  dateTime,
  label,
  options,
  useBusinessQuery,
} from '@/features/business/business-data'
import type { FileDetail, FileWorkspace, ProjectDocument } from './file-types'

export function ProjectFiles({
  projectId,
  defaultKind,
}: {
  projectId: string
  defaultKind?: string
}) {
  const [keyword, setKeyword] = useState(''),
    [kind, setKind] = useState<string>(),
    [status, setStatus] = useState<string>()
  const [selected, setSelected] = useState<string>(),
    [upload, setUpload] = useState(false)
  const query = useBusinessQuery<FileWorkspace>(
    `/api/projects/${projectId}/files`,
  )
  const rows =
    query.data?.items.filter(
      (d) =>
        (!keyword ||
          `${d.title} ${d.latestVersion.filename}`
            .toLowerCase()
            .includes(keyword.toLowerCase())) &&
        (!kind || d.kind === kind) &&
        (!status || d.latestVersion.status === status),
    ) ?? []
  return (
    <div className="business-stack">
      {query.data && !query.data.storageConfigured && (
        <Alert
          type="warning"
          showIcon
          title="文件存储待连接"
          description="当前仍可查阅已登记资料。请联系管理员配置文件服务后上传或下载。"
        />
      )}
      <Panel
        title="项目资料"
        subtitle="当前有效版本与修订历史统一保存，可作为合同、成果和移交依据。"
        className="business-panel--table"
        extra={
          query.data?.allowedActions.includes('FILE_UPLOAD') && (
            <Button
              type="primary"
              icon={<UploadCloud size={15} />}
              disabled={!query.data.storageConfigured}
              onClick={() => setUpload(true)}
            >
              上传资料
            </Button>
          )
        }
      >
        <div className="business-panel-body business-toolbar">
          <Input.Search
            aria-label="搜索项目资料"
            placeholder="搜索资料名称或文件名"
            allowClear
            onSearch={setKeyword}
          />
          <Select
            aria-label="资料类型"
            placeholder="全部资料类型"
            options={options(fileKinds).map((o) => ({
              ...o,
              label: fileKindName(o.value) ?? o.label,
            }))}
            allowClear
            onChange={setKind}
          />
          <Select
            aria-label="资料状态"
            placeholder="全部版本状态"
            options={options([
              'DRAFT',
              'IN_REVIEW',
              'PUBLISHED',
              'RETURNED',
              'SUPERSEDED',
              'VOID',
            ])}
            allowClear
            onChange={setStatus}
          />
        </div>
        <QueryState query={query}>
          <Table
            size="small"
            rowKey="id"
            scroll={{ x: 840 }}
            dataSource={rows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            columns={[
              {
                title: '资料名称',
                dataIndex: 'title',
                width: 270,
                render: (_, d) => (
                  <Button
                    type="link"
                    className="business-title-link"
                    onClick={() => setSelected(d.id)}
                  >
                    <FileText size={16} />
                    {d.title}
                  </Button>
                ),
              },
              {
                title: '类型 / 密级',
                width: 160,
                render: (_, d) => (
                  <div>
                    {fileKindName(d.kind) ?? label(d.kind)}
                    <div className="business-muted">
                      {label(d.classification)}
                    </div>
                  </div>
                ),
              },
              {
                title: '版本',
                width: 120,
                render: (_, d) => (
                  <div>
                    最新 v{d.latestVersion.versionNumber}
                    <div className="business-muted">
                      {d.currentVersionId ? '有当前发布版' : '尚未发布'}
                    </div>
                  </div>
                ),
              },
              {
                title: '最新状态',
                render: (_, d) => <Status value={d.latestVersion.status} />,
              },
              {
                title: '上传 / 更新',
                width: 140,
                render: (_, d) => (
                  <div>
                    {d.latestVersion.uploaderName}
                    <div className="business-muted">
                      {dateTime(d.updatedAt)}
                    </div>
                  </div>
                ),
              },
              {
                title: '操作',
                width: 88,
                render: (_, d) => (
                  <Button size="small" onClick={() => setSelected(d.id)}>
                    查看版本
                  </Button>
                ),
              },
            ]}
          />
        </QueryState>
      </Panel>
      {upload && query.data && (
        <FileUploadDrawer
          projectId={projectId}
          initialKind={defaultKind}
          workspace={query.data}
          onClose={() => setUpload(false)}
          onSuccess={(id) => {
            setUpload(false)
            setSelected(id)
          }}
        />
      )}
      {selected && (
        <FileDetailDrawer
          id={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </div>
  )
}

export function FileUploadDrawer({
  projectId,
  workspace,
  document,
  initialKind,
  onClose,
  onSuccess,
}: {
  projectId: string
  workspace: Pick<FileWorkspace, 'allowedActions' | 'maxBytes'>
  document?: ProjectDocument
  initialKind?: string
  onClose: () => void
  onSuccess: (id: string) => void
}) {
  const [form] = Form.useForm(),
    [fileList, setFileList] = useState<UploadFile[]>([]),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<unknown>()
  const intent = useRef({ id: crypto.randomUUID(), fingerprint: '' }),
    cache = useQueryClient()
  async function save(values: Record<string, unknown>) {
    const file = fileList[0]?.originFileObj
    if (!file) {
      form.setFields([{ name: 'file', errors: ['请选择实际文件。'] }])
      return
    }
    if (!file.size || file.size > workspace.maxBytes) {
      form.setFields([
        {
          name: 'file',
          errors: [`请选择非空文件，最大 ${fileSize(workspace.maxBytes)}。`],
        },
      ])
      return
    }
    setSaving(true)
    setError(undefined)
    const fingerprint = JSON.stringify([
      values,
      file.name,
      file.size,
      file.lastModified,
    ])
    if (
      intent.current.fingerprint &&
      intent.current.fingerprint !== fingerprint
    )
      intent.current.id = crypto.randomUUID()
    intent.current.fingerprint = fingerprint
    try {
      const metadata = {
        ...values,
        version: document?.version,
        requestId: intent.current.id,
      }
      const body = new FormData()
      body.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
      )
      body.append('file', file)
      const data = await postJson<FileDetail>(
        document
          ? `/api/files/${document.id}/versions`
          : `/api/projects/${projectId}/files`,
        body,
      )
      await cache.invalidateQueries({ queryKey: ['business'] })
      onSuccess(data.document.id)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }
  const classifications = [
    { value: 'INTERNAL', label: '内部资料' },
    ...(workspace.allowedActions.includes('FILE_CONTRACT_READ')
      ? [{ value: 'CONTRACT', label: '合同敏感' }]
      : []),
    ...(workspace.allowedActions.includes('FILE_COST_READ')
      ? [{ value: 'COST', label: '成本敏感' }]
      : []),
  ]
  return (
    <Drawer
      open
      title={document ? `修订资料 · ${document.title}` : '上传项目资料'}
      size={660}
      onClose={() => {
        if (!saving) onClose()
      }}
      maskClosable={false}
      className="business-drawer"
      footer={
        <div className="business-drawer-footer">
          <span>上传后先保存为草稿</span>
          <Space>
            <Button disabled={saving} onClick={onClose}>
              取消
            </Button>
            <Button
              type="primary"
              loading={saving}
              onClick={() => form.submit()}
            >
              上传并保存
            </Button>
          </Space>
        </div>
      }
    >
      <p className="business-form-intro">
        新修订不覆盖历史文件。发布前，业务依据仍使用原有效版本。
      </p>
      {!!error && (
        <Alert
          type="error"
          showIcon
          title={getProblemMessage(error)}
          className="business-form-error"
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={saving}
        initialValues={{
          title: document?.title,
          kind: document?.kind ?? initialKind ?? 'OTHER',
          classification:
            document?.classification ??
            (initialKind === 'CONTRACT' ? 'CONTRACT' : 'INTERNAL'),
        }}
        onFinish={save}
      >
        <Form.Item
          name="title"
          label="资料标题"
          rules={[{ required: true, whitespace: true }]}
        >
          <Input maxLength={160} disabled={!!document} />
        </Form.Item>
        <div className="business-form-grid">
          <Form.Item name="kind" label="资料类型" rules={[{ required: true }]}>
            <Select
              options={options(fileKinds).map((o) => ({
                ...o,
                label: fileKindName(o.value) ?? o.label,
              }))}
              disabled={!!document}
              onChange={(kind) => {
                if (kind === 'CONTRACT' || kind === 'ESTIMATE')
                  form.setFieldValue(
                    'classification',
                    kind === 'CONTRACT' ? 'CONTRACT' : 'COST',
                  )
              }}
            />
          </Form.Item>
          <Form.Item
            name="classification"
            label="资料密级"
            rules={[{ required: true }]}
          >
            <Select options={classifications} disabled={!!document} />
          </Form.Item>
        </div>
        <Form.Item
          name="file"
          label="实际文件"
          extra={`最大 ${fileSize(workspace.maxBytes)}；保留原文件名和校验记录。`}
        >
          <Upload
            fileList={fileList}
            maxCount={1}
            beforeUpload={() => false}
            onChange={({ fileList: next }) => setFileList(next)}
          >
            <Button icon={<UploadCloud size={15} />}>选择文件</Button>
          </Upload>
        </Form.Item>
        <Form.Item
          name="changeNote"
          label="版本说明"
          rules={[{ required: true, whitespace: true }]}
        >
          <Input.TextArea
            rows={4}
            maxLength={2000}
            showCount
            placeholder="说明本次文件的适用范围、变化和签署/编制依据"
          />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

export function FileDetailDrawer({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const query = useBusinessQuery<FileDetail>(`/api/files/${id}`),
    [command, setCommand] = useState<Command | null>(null),
    [revision, setRevision] = useState(false),
    [downloading, setDownloading] = useState<string>()
  const { message } = App.useApp(),
    session = useCurrentSession()
  const workspace = useBusinessQuery<FileWorkspace>(
    query.data
      ? `/api/projects/${query.data.document.projectId}/files`
      : undefined,
  )
  const d = query.data
  async function download(v: FileDetail['versions'][number]) {
    setDownloading(v.id)
    try {
      await downloadFile(id, v.id, v.filename)
    } catch (error) {
      message.error(getProblemMessage(error))
    } finally {
      setDownloading(undefined)
    }
  }
  return (
    <Drawer
      open
      title="资料与版本"
      size={860}
      onClose={onClose}
      className="business-drawer"
    >
      <QueryState query={query}>
        {d && (
          <div className="business-stack">
            <div>
              <h2 className="business-detail-title">{d.document.title}</h2>
              <Space>
                <Tag>{label(d.document.classification)}</Tag>
                <span>
                  {fileKindName(d.document.kind) ?? label(d.document.kind)}
                </span>
                {d.allowedActions.includes('FILE_UPLOAD') && (
                  <Button onClick={() => setRevision(true)}>上传新版本</Button>
                )}
              </Space>
            </div>
            {d.versions.map((v) => (
              <Panel
                key={v.id}
                title={
                  <Space>
                    版本 {v.versionNumber}
                    <Status value={v.status} />
                    {d.document.currentVersionId === v.id && (
                      <Tag color="blue">当前有效</Tag>
                    )}
                  </Space>
                }
                extra={
                  d.allowedActions.includes('FILE_DOWNLOAD') && (
                    <Button
                      size="small"
                      icon={<Download size={14} />}
                      loading={downloading === v.id}
                      onClick={() => void download(v)}
                    >
                      下载
                    </Button>
                  )
                }
              >
                <Descriptions
                  size="small"
                  column={{ xs: 1, sm: 2 }}
                  items={[
                    { key: 'file', label: '文件', children: v.filename },
                    {
                      key: 'size',
                      label: '大小',
                      children: fileSize(v.sizeBytes),
                    },
                    {
                      key: 'author',
                      label: '上传人',
                      children: `${v.uploaderName} · ${dateTime(v.createdAt)}`,
                    },
                    {
                      key: 'review',
                      label: '复核人',
                      children: v.reviewerName ?? '待复核',
                    },
                  ]}
                />
                <p className="business-text">{v.changeNote}</p>
                {v.reviewComment && (
                  <p className="business-muted">处理意见：{v.reviewComment}</p>
                )}
                <Space wrap>
                  {[
                    ...(d.allowedActions.includes('FILE_UPLOAD') &&
                    ['DRAFT', 'RETURNED'].includes(v.status) &&
                    d.versions[0].id === v.id
                      ? [{ decision: 'IN_REVIEW', text: '提交发布评审' }]
                      : []),
                    ...(d.allowedActions.includes('FILE_PUBLISH') &&
                    v.status === 'IN_REVIEW' &&
                    session.data?.accountId !== v.uploadedBy
                      ? [
                          { decision: 'PUBLISHED', text: '发布此版本' },
                          { decision: 'RETURNED', text: '退回补充' },
                        ]
                      : []),
                    ...(d.allowedActions.includes('FILE_PUBLISH') &&
                    !['VOID', 'SUPERSEDED'].includes(v.status)
                      ? [{ decision: 'VOID', text: '作废版本' }]
                      : []),
                  ].map((action) => (
                    <Button
                      key={action.decision}
                      size="small"
                      danger={action.decision === 'VOID'}
                      onClick={() =>
                        setCommand({
                          title: action.text,
                          path: `/api/files/${id}/versions/${v.id}/transition`,
                          values: {
                            version: v.version,
                            decision: action.decision,
                          },
                          fields: [
                            {
                              name: 'comment',
                              label: '处理意见',
                              type: 'textarea',
                            },
                          ],
                        })
                      }
                    >
                      {action.text}
                    </Button>
                  ))}
                </Space>
              </Panel>
            ))}
            <Panel title="资料历史">
              <History events={d.history} />
            </Panel>
          </div>
        )}
      </QueryState>
      {revision && d && workspace.data && (
        <FileUploadDrawer
          projectId={d.document.projectId}
          workspace={workspace.data}
          document={d.document}
          onClose={() => setRevision(false)}
          onSuccess={() => setRevision(false)}
        />
      )}
      <CommandDrawer command={command} onClose={() => setCommand(null)} />
    </Drawer>
  )
}
