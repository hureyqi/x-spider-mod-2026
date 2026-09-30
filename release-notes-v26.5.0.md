# v26.5.0

## 新功能
- 批量下载列表新增「最后同步」列：基于最近下载时间展示相对时间标签（悬停显示精确时间），未下载过的列表显示「从未同步」，深/浅色主题自适应。

## 性能优化（承接 v26.4.0）
- 数据层 gid→下标缓存，`updateDownloadTask` 定位降为 O(1)，`batchUpdateDownloadTasks` 仅更新变化任务、无变化不触发重渲染。
- `scheduleAutoSyncTasks` 仅轮询屏幕内可见 gid，去掉全量 map / Promise.all。
- 批量下载日志限量 300 条，已完成/失败 @ 标签限量渲染 50 个，避免数千任务卡顿。