import type { ThemeConfig } from 'antd'

export const projectTheme: ThemeConfig = {
  cssVar: { prefix: 'winh' },
  token: {
    colorPrimary: '#3157d5',
    colorInfo: '#3157d5',
    colorSuccess: '#188b79',
    colorWarning: '#d27632',
    colorError: '#c4433a',
    colorText: '#182235',
    colorTextSecondary: '#667085',
    colorBgBase: '#ffffff',
    colorBgLayout: '#f5f7fb',
    colorBorder: '#e1e7f0',
    colorBorderSecondary: '#e9edf4',
    borderRadius: 10,
    borderRadiusLG: 14,
    controlHeight: 40,
    fontFamily:
      "Inter, 'Segoe UI Variable', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    fontSize: 14,
    boxShadow:
      '0 12px 36px rgba(24, 34, 53, 0.08), 0 2px 8px rgba(24, 34, 53, 0.04)',
    boxShadowSecondary: '0 8px 24px rgba(24, 34, 53, 0.08)',
  },
  components: {
    Button: {
      borderRadius: 9,
      primaryShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 600,
    },
    Card: {
      headerBg: 'transparent',
    },
    Table: {
      headerBg: '#f7f8fb',
      headerColor: '#48536a',
      headerSplitColor: '#e7eaf1',
      rowHoverBg: '#f5f7ff',
      cellPaddingBlock: 13,
      cellPaddingInline: 16,
    },
    Menu: {
      itemBg: '#ffffff',
      itemColor: '#53627b',
      itemHoverBg: '#f4f7fc',
      itemHoverColor: '#2167f3',
      itemSelectedBg: '#eaf2ff',
      itemSelectedColor: '#2167f3',
      groupTitleColor: '#94a0b4',
      itemBorderRadius: 8,
      itemHeight: 40,
    },
    Layout: {
      bodyBg: '#f5f7fb',
      headerBg: '#ffffff',
      siderBg: '#ffffff',
    },
    Tabs: {
      inkBarColor: '#3157d5',
      itemSelectedColor: '#223fa6',
    },
  },
}

export const prototypeThemes = {
  A: {
    ...projectTheme,
    token: {
      ...projectTheme.token,
      colorPrimary: '#3157d5',
      colorBgLayout: '#f4f6fa',
      borderRadius: 9,
      borderRadiusLG: 14,
    },
  },
  B: {
    ...projectTheme,
    token: {
      ...projectTheme.token,
      colorPrimary: '#116c5b',
      colorInfo: '#116c5b',
      colorBgLayout: '#f1f5f0',
      colorText: '#17231f',
      borderRadius: 13,
      borderRadiusLG: 20,
    },
    components: {
      ...projectTheme.components,
      Table: {
        ...projectTheme.components?.Table,
        headerBg: '#edf3ee',
        rowHoverBg: '#f1f8f3',
      },
    },
  },
  C: {
    ...projectTheme,
    token: {
      ...projectTheme.token,
      colorPrimary: '#d95d39',
      colorInfo: '#d95d39',
      colorBgLayout: '#f2f1ef',
      colorText: '#22201e',
      borderRadius: 5,
      borderRadiusLG: 8,
      controlHeight: 34,
      fontSize: 13,
    },
    components: {
      ...projectTheme.components,
      Table: {
        ...projectTheme.components?.Table,
        headerBg: '#e8e6e2',
        rowHoverBg: '#fff4ef',
        cellPaddingBlock: 9,
        cellPaddingInline: 12,
      },
      Button: {
        ...projectTheme.components?.Button,
        borderRadius: 5,
      },
      Menu: {
        ...projectTheme.components?.Menu,
        itemBorderRadius: 5,
      },
    },
  },
} satisfies Record<'A' | 'B' | 'C', ThemeConfig>
