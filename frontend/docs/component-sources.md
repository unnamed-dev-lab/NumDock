# Component sources and selection

This project follows **beUI > Magic UI > shadcn/ui**. shadcn components use **Base UI**. All library source below was installed by the official shadcn CLI, then customized; MCP source was inspected only and was never written into the application.

## Actual installation

On 2026-10-20, shadcn CLI **4.22.1** was run through Bun; the CLI used the existing pnpm project for dependency resolution. The pnpm lockfile remains the only project lockfile.

```powershell
bunx --bun shadcn@4.22.1 add @beui/input @beui/theme-toggle @beui/animated-sidebar --yes --overwrite
bunx --bun shadcn@4.22.1 add @beui/button-base dropdown-menu table --yes --overwrite
bunx --bun shadcn@4.22.1 add @beui/not-found-stacked --overwrite --yes
pnpm add @base-ui/react
pnpm remove radix-ui next-themes class-variance-authority
```

beUI MCP returned `@beui/button`, whose official endpoint returned HTTP 404. The live official registry index `https://beui.dev/r/registry.json` exposed `button-base`; CLI dry-run and installation succeeded with `@beui/button-base`.

## Decisions

| Need | Selected source | Reason and customization |
| --- | --- | --- |
| Form fields | beUI `input` | Highest-priority matching component. RHF Controller adapts its string change callback; labels, refs, validation and focus remain library-owned. Uses project radius and tokens. |
| Buttons | beUI `button-base` | Highest-priority matching component; only the base variant is installed. Restrained press feedback, project radius, explicit form submit behavior. |
| Theme transition | beUI `theme-toggle` | Native View Transition implementation. Adapted after installation to preserve light/dark/system, the existing storage key, blocked-storage support, reduced motion, concurrency guard and failure recovery. |
| Sidebar | beUI `animated-sidebar` | Library-owned responsive navigation and mobile focus handling. Workspace content is composed from its public parts; scrim uses a semantic token. Indexed focus targets are safely guarded under strict TypeScript. |
| Theme radio menu | shadcn `base-vega/dropdown-menu` | beUI search has no suitable radio menu; its bloom menu has different interaction semantics. Magic UI's reviewed theme toggler is a binary visual switch, not the three-choice menu required here. Base UI supplies radio selection, keyboard handling and focus restoration. |
| Read-only organization table | shadcn `base-vega/table` | beUI's table targets virtualization, sorting, selection, resize and reorder; those features do not match this small read-only membership list. Magic UI visual effects do not provide this semantic table. Uses CLI-installed table markup with application data. |
| 404 page | beUI `not-found-stacked` | Highest-priority matching block. Installed from the live registry (the aggregate `@beui/not-found` endpoint returns 404), then adapted to project radius, display typography and localized Back home / Open workspace actions. |
| Interactive API reference | `@scalar/api-reference-react` 0.9.81 | No beUI, Magic UI or shadcn equivalent provides a full OpenAPI reference with a request client. Scalar is the official specialized integration (MIT), loaded client-only to avoid its untested SSR path. It is themed through semantic Scalar/CSS variables and wrapped with same-origin cookie and CSRF handling. Installed with `pnpm add @scalar/api-reference-react@0.9.81`. |

The Base UI radio menu explicitly uses `closeOnClick` to retain the previous select-and-close behavior; Base UI's default for radio items keeps the menu open. The generated `render` composition API replaces Radix `asChild`.

The shadcn MCP item summary exposed the default Radix dropdown metadata in this session. That variant was not installed: the CLI was configured with `base-vega`, its live `view dropdown-menu` output was inspected, and the installed source imports `@base-ui/react/menu`.

Magic UI was checked through its official documentation/registry; this session exposed callable beUI and shadcn MCP tools but no Magic UI or assistant-ui MCP. No decorative effects or chat components were installed just to increase library count. Recheck available MCP tools for future work.

The app-owned `features/` modules contain business validation, API calls and page compositions, not replacement interaction primitives. `lib/theme-context.tsx` owns preferences and initial paint; the installed beUI hook owns transition execution.

## Maintenance

- `component-sources.json` records installed registry items, files and exact CLI commands. Keep it current after actual CLI operations.
- `pnpm lint` checks colors, Base UI configuration, absence of Radix imports/dependencies, raw Base UI usage outside generated components, and unrecorded component files.
- This static check supports review; it cannot prove that a historical command was executed. Installation logs and source review remain required.
- Reinstalling upstream components can overwrite business adaptations. Inspect the CLI dry-run/diff, then restore token and accessibility adaptations and run typecheck, lint, browser tests and build.

## i18n 定制

语言菜单复用已通过 CLI 安装的 Base UI DropdownMenu 和 beUI Button；没有新增基础交互组件。已有 beUI 移动侧边栏遮罩关闭标签和 shadcn Dialog 关闭文案接入 react-i18next，业务侧边栏入口传入本地化标签。

## 开发目录接口接入

此切片没有安装新组件，复用既有 beUI Input／Button、Base UI Select／Badge／Tabs 和应用 DataTable。筛选器使用官方 `Select.Root.items` 标签映射（见 [Base UI Select 文档](https://base-ui.com/react/components/select)），避免把内部值 `all` 显示为用户文案。表格服务端分页接入 [TanStack Table 的 manualPagination 和 rowCount](https://tanstack.com/table/v8/docs/guide/pagination)，并同步采用服务端筛选和排序；补齐排序 ARIA 状态与每页条数标签。

## 概览趋势图

本次实际执行 `bunx --bun shadcn@4.22.1 add chart --yes`，CLI 新增 `app/components/ui/chart.tsx` 和 Recharts 3.8.0，跳过未变化的 Card；仍使用 pnpm 锁文件。安装前 dry-run 已核对文件与依赖范围。

已检索 beUI：CompositionChart 是标准化百分比份额，无法忠实表达每日绝对消息量，其他金融图表也不匹配；Magic UI chart 检索无结果，因此降级到项目 Base UI 风格的 shadcn Chart。MCP 的例子使用默认 Radix 风格路径，仅用于核对 API，实际安装使用项目 `base-vega`。没有复制示例数据或手写底层图表。

生成组件定制：主题选择器接入 `[data-theme="dark"]`，默认 SVG 颜色匹配改为语义类；业务图表使用 `--primary`、`--destructive` 和 `--border`，无渐变或新品牌色。关闭绘图动画，提供 UTC 日期、当前语言的数字格式、键盘可达图表及可滚动的原始数据表。既有 beUI Button、Base UI Select、Card 和 Table 继续复用。

## Mock 工作区业务页面

本次没有安装新的基础组件。号码、账单、消息和开发者页面继续复用 CLI 安装的 beUI Button／Input，以及 Base UI Dialog、Select、Switch、Tabs、Textarea 与项目 DataTable。已检索 beUI 表单／弹窗候选，没有匹配的表单对话框组合；复用现有 Base UI 组件组合业务表单，没有引入装饰性 Magic UI 或手写基础交互。表单使用 React Hook Form + Zod；列表筛选及分页进入 URL，TanStack Query 消费生成契约，SSE 失效当前组织缓存。

窄屏截图审查修正了 Tabs 业务容器方向及最小宽度；未重新安装或覆盖基础组件。一次性密钥仅保存在弹窗内存，关闭清除；消息正文查询关闭后从缓存移除。

## 概览周期切换的文字动效

按用户指定的 beUI Text Animation 页面，MCP 核对 `text-cascade` 后实际执行 `bunx --bun shadcn@4.22.1 add @beui/text-cascade --yes`，新增 `app/components/motion/text-cascade.tsx`。安装时对 `action-swap.tsx` 和 `utils.ts` 的覆盖提示选择 No；复用已有 ActionSwap 和 ease，未安装整套 Text Animation、未复制 MCP 源码。依赖已在项目中，安装后核对 package.json 与锁文件，没有新增依赖或改变既有版本约束。

仅四项概览指标数值使用逐字切换；没有随机字符、彩色扫描或全卡片动画。沿用组件的减少动态效果与完整文本无障碍回退。周期请求采用同组织 placeholderData，保留图表与指标 DOM，预取另一个周期；缓存新鲜期 30 秒、非活跃缓存 5 分钟，切换组织不复用上一组织结果。

## 工作区连接失败状态

复用既有 InlineNote、StatusBadge 和 beUI Button；不新增组件。工作区状态请求失败显示“连接异常”，不会再被当成后端明确停用；重试同时失效摘要与列表缓存。密钥操作的 mutation 使用零空闲缓存时间，配合关闭时清理展示状态。

## 桌面侧栏折叠

复用已通过 CLI 安装的 beUI AnimatedSidebar，MCP 重新核对 `animated-sidebar` 的 icon 模式、Trigger 与减少动态效果支持；没有新增安装或复制源码。桌面恢复图标栏折叠与切换按钮，品牌文字、组织详情和用户详情随折叠隐藏，保留带名称提示的组织图标与用户头像；移动端继续使用原组件的完整抽屉、焦点管理与 Escape 关闭。

## 公开页面身份与功能状态

复用既有 beUI Button／ButtonLink 和 CLI 安装的 Base UI DropdownMenu；账户菜单提取为业务组件，公开页与工作区共享，不新增底层组件或依赖。统一 identityQuery：401 缓存为匿名状态，网络错误保留独立的重试状态；退出撤销 Cookie 会话并清空查询缓存。公开页面 SSR 从 `/v1/status` 取得非租户数据，TanStack Query 使用同一契约同步功能模式并支持刷新；Mock 与真实渠道接入状态分别展示。

## 工作区操作精简

继续复用已安装的 beUI Button／Input 与 Base UI Dialog，无新增组件或依赖。开发环境仅在工作区顶栏集中标识，移除菜单、页面与目录的重复提示；连接失败和停用状态保留统一处理。美元金额以十进制字符串转换为整数美分；成功操作自动关闭，含一次性密钥的弹窗仍等待用户保存。测试收信、测试 Webhook、启停端点直接执行并反馈状态，重试同一失败命令保留幂等键；释放、退款、删除和撤销仍确认。申请号码成功切回已租号码列表。
