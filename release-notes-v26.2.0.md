实时更新：v26.2.0，包含批量下载核心修复、GraphQL queryId 容错机制、暗色模式视觉修复与旧代码清理。

## 主要更新
- 修复媒体过滤逻辑 Bug：
  - 原过滤条件 `post.medias.length >= 0` 恒为真，无媒体的帖子未被过滤；现为标准非空校验（`Boolean(post.medias && post.medias.length > 0)`），正确跳过无媒体内容。
- 批量下载「暂停 / 继续」真正生效：
  - 抓取主循环（时间线翻页间隙）实时响应暂停标志位，暂停期间不再继续抓取下一页；大账户翻页耗时数分钟时也能立即挂起。停止逻辑不变（AbortController 通道）。
- GraphQL queryId 配置化与容错（新特性）：
  - `UserByScreenName` / `UserMedia` / `UserTweets` 的 queryId 从源码硬编码抽取为 `src/twitter/query-ids.ts` 配置对象，支持 primary + 多个备用 fallback ID 按顺序自动回退。
  - 支持外部覆盖：在应用数据目录放置 `query-ids.json` 即可切换 / 补充 queryId，无需改代码、无需重新打包。X 更新接口导致抓取失效时用户可自行救急。
  - 失效 ID（HTTP 400/404）跳过指数退避、立即尝试下一候选；最后一个候选保留完整的 Cookie 轮换 + 退避重试，单 ID 场景行为与旧版完全一致。
- 暗色模式视觉修复：
  - 左上角账户栏：背景透明化、用户名亮白（#FFFFFF）、头像回退图标亮灰（#CCCCCC），暗色下清晰可读。
  - 下载管理「任务创建中」容器、主页「下载配置」卡片、媒体网格单元：由硬编码白底改为主题感知深色底（#1F1F1F）+ 亮色文本，「取消」等按钮恢复暗色样式。
- 清理旧版批量下载进度模型死代码：
  - 移除未接线的 `useBatchDownload` hook 与 `BatchDownloadPanel` 组件及 store 中残留的 `batchDownloadTask` 字段 / 旧接口，暂停 / 停止统一走 `batchRunControl` 共享运行态。
- `.gitignore` 追加 `.ghconfig/`，防止本地网络配置（hosts 等）被误提交。

## 说明
- 便携版 `x-spider.exe` 已随本 Release 提供，下载后可直接运行（请确保 `aria2c` 就绪）。
- 安装包：`X-Spider-26.2.0-x64-setup.exe`。
