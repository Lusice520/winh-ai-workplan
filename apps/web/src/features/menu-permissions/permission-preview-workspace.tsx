import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Result,
  Select,
  Spin,
  Timeline,
  Typography,
} from 'antd'
import { CircleCheckBig, CircleX, SearchCheck } from 'lucide-react'
import { useState } from 'react'

import { getProblemMessage } from '@/api/client/http'
import { getUsers } from '@/features/organization-users/organization-user-api'
import {
  getPermissionItems,
  previewPermission,
} from '@/features/menu-permissions/access-control-api'
import type { PermissionPreview } from '@/features/menu-permissions/access-control-types'

type PreviewFormValues = {
  subjectAccountId: string
  permissionCode: string
  organizationUnitId?: string
  projectId?: string
  objectReference?: string
  participatingProject: boolean
  resourceEnabled: boolean
  recordStateAllowed: boolean
  sensitiveConditionsMet: boolean
}

export function PermissionPreviewWorkspace() {
  const { message } = AntdApp.useApp()
  const [form] = Form.useForm<PreviewFormValues>()
  const [preview, setPreview] = useState<PermissionPreview>()
  const usersQuery = useQuery({
    queryKey: ['iam', 'users', 'access-control-preview'],
    queryFn: ({ signal }) => getUsers({ page: 1, pageSize: 100 }, signal),
  })
  const permissionsQuery = useQuery({
    queryKey: ['access-control', 'permission-items'],
    queryFn: ({ signal }) => getPermissionItems(signal),
  })

  const previewMutation = useMutation({
    mutationFn: (values: PreviewFormValues) =>
      previewPermission({
        subjectAccountId: values.subjectAccountId,
        permissionCode: values.permissionCode,
        organizationUnitId: values.organizationUnitId?.trim() || undefined,
        projectId: values.projectId?.trim() || undefined,
        objectReference: values.objectReference?.trim() || undefined,
        participatingProject: values.participatingProject,
        resourceEnabled: values.resourceEnabled,
        recordStateAllowed: values.recordStateAllowed,
        sensitiveConditionsMet: values.sensitiveConditionsMet,
      }),
    onSuccess: (result) => {
      setPreview(result)
    },
    onError: (error) => {
      message.error(
        getProblemMessage(error, '权限预览未完成，请检查条件后重试。'),
      )
    },
  })

  if (usersQuery.isPending || permissionsQuery.isPending) {
    return (
      <Card className="access-control-surface">
        <div className="grid min-h-[320px] place-items-center">
          <Spin description="正在准备权限预览条件…" />
        </div>
      </Card>
    )
  }

  if (usersQuery.isError || permissionsQuery.isError) {
    const error = usersQuery.error ?? permissionsQuery.error
    return (
      <Result
        status="error"
        title="无法准备权限预览"
        subTitle={getProblemMessage(
          error,
          '请确认当前账号具有权限预览和相关目录查看权限。',
        )}
        extra={
          <Button onClick={() => void usersQuery.refetch()}>重新加载</Button>
        }
      />
    )
  }

  const userOptions = (usersQuery.data?.items ?? []).map((user) => ({
    value: user.id,
    label: user.displayName + ' · ' + user.loginName,
  }))
  const permissionOptions = (permissionsQuery.data ?? []).map((permission) => ({
    value: permission.code,
    label: permission.name + ' · ' + permission.code,
  }))

  return (
    <div className="access-control-preview-layout">
      <Card
        className="access-control-surface access-control-preview-config"
        title={
          <span className="access-control-section-title">
            <SearchCheck className="size-4 text-[#4171d8]" />
            有效权限预览
          </span>
        }
      >
        <Typography.Paragraph className="access-control-preview-copy !mt-0 !text-sm !leading-6 !text-[#6a788c]">
          使用当前时点和最小资源上下文模拟中央
          decide(...)；结果只解释允许或拒绝原因，不回显业务对象数据。
        </Typography.Paragraph>
        <Form
          className="access-control-preview-form"
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{
            participatingProject: false,
            resourceEnabled: true,
            recordStateAllowed: true,
            sensitiveConditionsMet: true,
          }}
          onFinish={(values) => previewMutation.mutate(values)}
        >
          <Form.Item
            name="subjectAccountId"
            label="目标账号"
            rules={[{ required: true, message: '请选择目标账号。' }]}
          >
            <Select showSearch optionFilterProp="label" options={userOptions} />
          </Form.Item>
          <Form.Item
            name="permissionCode"
            label="目标权限项"
            rules={[{ required: true, message: '请选择目标权限项。' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={permissionOptions}
            />
          </Form.Item>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Form.Item name="organizationUnitId" label="组织范围 UUID">
              <Input placeholder="按需填写" />
            </Form.Item>
            <Form.Item name="projectId" label="项目范围 UUID">
              <Input placeholder="按需填写" />
            </Form.Item>
          </div>
          <Form.Item name="objectReference" label="对象引用">
            <Input placeholder="例如：project-object-42" />
          </Form.Item>
          <div className="access-control-constraint-panel access-control-preview-constraints">
            <Typography.Text className="!text-xs !font-semibold !text-[#586980]">
              硬约束条件
            </Typography.Text>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Form.Item name="resourceEnabled" valuePropName="checked" noStyle>
                <Checkbox>资源处于启用状态</Checkbox>
              </Form.Item>
              <Form.Item
                name="recordStateAllowed"
                valuePropName="checked"
                noStyle
              >
                <Checkbox>记录状态允许操作</Checkbox>
              </Form.Item>
              <Form.Item
                name="sensitiveConditionsMet"
                valuePropName="checked"
                noStyle
              >
                <Checkbox>敏感条件已满足</Checkbox>
              </Form.Item>
              <Form.Item
                name="participatingProject"
                valuePropName="checked"
                noStyle
              >
                <Checkbox>主体参与该项目</Checkbox>
              </Form.Item>
            </div>
          </div>
          <Button
            className="access-control-preview-submit !mt-5"
            type="primary"
            htmlType="submit"
            loading={previewMutation.isPending}
          >
            计算当前有效权限
          </Button>
        </Form>
      </Card>

      <PermissionPreviewResult preview={preview} />
    </div>
  )
}

function PermissionPreviewResult({
  preview,
}: {
  preview: PermissionPreview | undefined
}) {
  if (!preview) {
    return (
      <Card className="access-control-surface access-control-preview-result">
        <div className="grid min-h-[320px] place-items-center text-center">
          <div>
            <SearchCheck className="mx-auto size-8 text-[#7e92b5]" />
            <Typography.Text className="!mt-3 !block !font-medium !text-[#4f6079]">
              尚未计算
            </Typography.Text>
            <Typography.Paragraph className="!mt-1 !mb-0 !max-w-[260px] !text-xs !leading-5 !text-[#8290a2]">
              选择账号、目标权限项和最小资源上下文后，系统会给出即时解释链。
            </Typography.Paragraph>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      className="access-control-surface access-control-preview-result"
      title="当前决策结果"
    >
      <Alert
        type={preview.allowed ? 'success' : 'error'}
        showIcon
        icon={
          preview.allowed ? (
            <CircleCheckBig className="size-5" />
          ) : (
            <CircleX className="size-5" />
          )
        }
        title={preview.allowed ? '允许执行该权限项' : '拒绝执行该权限项'}
        description={
          preview.allowed
            ? '这是当前时点的正向授权合并结果；业务接口仍会按自己的资源上下文重新判断。'
            : '拒绝优先：任何账号、资源、范围、状态或敏感条件失败都不会被角色或临时授权覆盖。'
        }
      />
      <Descriptions
        className="!mt-5"
        column={1}
        size="small"
        items={[
          {
            key: 'permission',
            label: '权限项',
            children: preview.permissionCode,
          },
          { key: 'reason', label: '稳定原因码', children: preview.reasonCode },
        ]}
      />
      <Typography.Text className="!mt-5 !block !text-sm !font-semibold !text-[#40516b]">
        解释链
      </Typography.Text>
      <Timeline
        className="!mt-3"
        items={preview.explanation.map((explanation) => ({
          color: preview.allowed ? 'green' : 'red',
          children: (
            <span className="text-sm leading-6 text-[#62728b]">
              {explanation}
            </span>
          ),
        }))}
      />
    </Card>
  )
}
