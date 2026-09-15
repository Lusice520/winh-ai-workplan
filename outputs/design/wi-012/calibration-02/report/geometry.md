# 元素几何偏差

偏差是 CSS 像素，不是还原率；布局可测量不证明未遮挡、字体正确或交互可用。

| 区域 | 状态 | Δx | Δy | Δ宽 | Δ高 |
| --- | --- | --- | --- | --- | --- |
| page-heading | measured | 13.0 | 4.0 | -25.0 | -7.781 |
| task-facts | measured | 13.0 | 37.219 | -25.0 | 6.984 |
| task-table | measured | 15.0 | 41.203 | 4.0 | 287.992 |
| review-queue | measured | 18.0 | 41.203 | -31.0 | -21.008 |
| package-criteria | measured | 18.0 | 19.195 | -31.0 | 47.141 |

## 相对前轮的最大绝对偏差

| 区域 | 前轮 | 本轮 | 变化 |
| --- | --- | --- | --- |
| page-heading | 25.0 | 25.0 | unchanged |
| task-facts | 37.219 | 37.219 | unchanged |
| task-table | 204.992 | 287.992 | increased |
| review-queue | 53.203 | 41.203 | reduced |
| package-criteria | 47.141 | 47.141 | unchanged |
