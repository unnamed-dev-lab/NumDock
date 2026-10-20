# NumDock 前端 Agent 开发规范

本文件适用于 `frontend/` 及其子目录，与根目录 `AGENTS.md` 一起遵守。后端规范位于 `../backend/AGENTS.md`，不将前端 UI 约束应用到后端实现。

## 1. 工作方式

- 先检查项目结构、已有实现、依赖版本、脚本和约定，再修改代码。不得臆造项目已有的能力。
- 优先完成当前任务所需的最小完整改动，不顺带重构、迁移框架、升级依赖或引入整套组件库。
- 前端已采用 React 19、React Router 7 Framework Mode、TypeScript Strict 和 Tailwind CSS v4；后续遵循现有架构与锁定依赖，不重复初始化应用。
- 不覆盖用户未提交的改动，不提交密钥、凭据或本机私有配置。
- 完成后简要说明改动、实际执行的验证，以及尚未验证的事项。不得把建议执行的检查描述为已通过。

## 2. 页面与组件：禁止模板化的 AI 味

这是强制设计要求，适用于新增页面、组件、文案和交互。

- 设计必须服务 NumDock 的实际功能、内容与用户任务。先确定主要操作、信息层级和信息密度，再确定布局与视觉。
- 禁止默认套用紫蓝渐变、大面积光晕、玻璃拟态、无意义的装饰图形、超大营销标题、机械三列卡片、层层卡片嵌套、过度圆角与阴影，以及为填满页面而添加的区块。
- 上述手法只有在明确的产品需求或设计参考支持时才能使用，不能作为默认美化方案。
- 工具型页面优先呈现工作内容与操作，避免把每个功能页做成营销落地页。留白、动效和装饰必须有具体用途。
- 保持统一的字体层级、间距、边框、圆角、图标风格与内容密度；同类操作采用一致的组件和交互。
- 产品初期使用准确、简洁的英文界面，预留中文国际化资源，使用真实业务内容。禁止空泛宣传语、无依据的统计数字，以及用 Emoji 代替正式功能图标。
- 不凭空发明品牌配色和视觉体系；缺少设计基础时先建立少量、可复用的设计令牌，再实现页面。

## 3. 颜色：CSS 变量 + Tailwind CSS

所有界面颜色必须通过集中管理的 CSS 自定义属性定义，并通过映射到这些变量的 Tailwind 语义类使用。

### 强制规则

- 原始颜色值仅允许出现在集中管理的主题／设计令牌定义文件中，例如全局 CSS 的 `:root`、暗色主题选择器及其令牌区域。这里可以使用 `oklch()`、十六进制等颜色值。
- 组件、页面、局部样式、内联样式和 JS 样式对象中禁止出现原始颜色值；禁止使用 Tailwind 自带色板类绕过主题系统。
- 禁止示例：`bg-white`、`text-black`、`bg-slate-950`、`text-gray-500`、`border-zinc-200`、`dark:bg-gray-900`、`bg-[#fff]`、`text-[rgb(...)]`、`style={{ color: '#fff' }}`。
- 推荐示例：`bg-background`、`text-foreground`、`bg-surface`、`text-muted-foreground`、`border-border`、`ring-ring`、`bg-primary`、`text-primary-foreground`、`text-destructive`。使用前必须定义对应令牌与 Tailwind 映射，不得假定它们已存在。
- 颜色令牌按用途命名，不按颜色外观命名。优先复用已有令牌；确需新增时同时补齐明暗主题值，不能给单个组件另起一套色板。
- 明暗主题通过切换 CSS 变量值实现。普通组件不应通过堆叠 `dark:` 颜色类维护第二套配色。
- 悬停、选中、禁用、焦点、错误、成功状态，以及阴影、渐变、图表、SVG 等涉及的颜色，同样必须来自令牌。
- `transparent`、`currentColor`、继承值和语义令牌的透明度修饰可以使用；SVG 图标优先使用 `currentColor`。不得以这些机制掩盖实际的硬编码色值。
- 第三方组件引入后必须接入项目令牌，不得原样保留其硬编码颜色。外部图片、视频等原始媒体内容不属于界面颜色令牌范围。

### Tailwind 接入

- 先确认实际安装版本，按该版本的官方方式映射 CSS 变量。Tailwind v4 使用 CSS-first 的主题映射；已有 v3 项目沿用其配置方式，不为本规范迁移版本。
- 新建前端时采用 CSS 变量作为颜色的唯一事实来源，Tailwind 负责消费语义令牌，不在两处重复维护实际色值。
- 需要 CSS、Canvas 或图表库直接消费颜色时，仍须引用或读取同一组 CSS 变量，不得在 JavaScript 中复制色值。

## 4. 主题切换：View Transition API

本项目主题切换采用 **View Transition API**（`document.startViewTransition()`），并统一封装主题状态和切换入口。

- 主题按钮必须调用共享主题切换逻辑，不允许各页面分别实现切换方案。
- 在支持该 API 且用户未要求减少动态效果时，通过 `document.startViewTransition()` 执行主题切换；主题 DOM 更新必须在其回调中完成，并确保框架更新已提交后回调才结束。
- 切换动画保持短促、克制，并与按钮操作有明确联系。不强制采用圆形扩散，不添加与主题切换无关的动画。
- 必须检测 API 支持情况；不支持时直接完成主题切换，不能导致按钮失效。
- 尊重 `prefers-reduced-motion: reduce`，此时直接切换主题并关闭相应过渡动画。
- 明确处理连续点击、动画取消与失败，避免并发切换导致主题状态、按钮状态或持久化偏好不一致；动画失败不能阻断主题切换。
- 支持浅色、深色和跟随系统的主题偏好；首次访问默认跟随系统，用户主动选择后持久化。跟随系统时响应系统主题变化。
- 首次绘制前应用正确主题，避免亮暗闪烁；使用 SSR 时同时处理服务端渲染与 hydration 的一致性。
- 切换控件使用真实按钮，提供准确的可访问名称、可见焦点和键盘操作；仅图标按钮也必须有可访问名称。
- 不使用全局 `transition: all` 模拟主题切换，不为此引入不必要的大型动画库。

API 参考：https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition

## 5. 组件选型与复用

- 前端页面、布局和交互开发必须使用共享 `ui-craft` Skill；完成较大 UI 改动后必须使用 `ui-review`。
- 共享技能位置为 `~/.agents/skills/ui-craft/SKILL.md` 和 `~/.agents/skills/ui-review/SKILL.md`。工具未发现技能时直接读取文件；无法读取则如实说明。
- 实现前调查已有组件、依赖、设计令牌与 `components.json`，优先复用项目组件。
- 需要外部组件时，依次考虑适合的 shadcn/ui 基础交互、beUI 和按需使用的 Magic UI；不得为了使用库而引入库。
- 通过 MCP 或官方文档／注册表核实组件及 API、依赖、版本兼容性和许可，不凭记忆编造组件名、安装命令或调用方式。MCP 不可用时使用官方来源并说明限制。
- 允许组合业务组件；禁止重复手写已有成熟实现的 Dialog、Popover、Select、Tooltip 等基础交互。确需自写时先说明已有方案的具体缺口。
- Dropdown、Sheet、Tabs、Accordion、Modal 等同样必须复用成熟实现；如后续引入 AI 对话，优先核实并使用 assistant-ui 的组件与生态能力，不自写已有的基础对话交互。
- 新项目优先考虑 React 19、Tailwind CSS v4、shadcn/ui；已有项目遵循实际技术栈，不为套用偏好升级或迁移。

## 6. 验收要求

- 按实际改动范围运行项目已有的类型检查、Lint、构建或相关测试；文档改动不要求运行应用测试。
- UI 改动必须查看真实渲染；较大 UI 改动检查主要流程、窄屏、明暗主题，以及相关的加载、空、错误、禁用和成功状态。
- 检查键盘操作、焦点、可访问名称、可读性与对比度；不能仅靠颜色表达状态。
- 主题相关改动检查首次加载、刷新持久化、系统主题变化、连续切换、减少动态效果，以及 API 不可用时的降级。
- 提交 UI 改动前检查新增和修改的颜色用法：不得残留色板类、任意原始色值或组件内部的颜色硬编码。
- 不以机械截图、镜像实现的测试或无关检查代替有效验证。环境无法运行的检查须明确标注，不能声称已完成。

## 7. 前端架构与业务边界

- 初始化采用 React 19、TypeScript Strict Mode、React Router 7 Framework Mode、Tailwind CSS v4，包管理使用 pnpm。实施时从官方文档核实稳定兼容版本。
- 按需采用 shadcn/ui、beUI、Magic UI、TanStack Query v5、Zustand、TanStack Table、React Hook Form + Zod、Lucide React 和 Motion，不为满足列表一次性安装所有依赖。
- 公开营销页面使用 SSG / Prerendering；Dashboard 和 Admin 使用 CSR。核心业务由独立 Go API 负责，不增加没有实际收益的 Next.js 服务层。
- TanStack Query 是服务端状态的主要且统一的缓存层；使用规范的 Query Keys、Mutation 和缓存失效。SSE 按资源更新或失效相关缓存，避免全站重取。
- Zustand 仅管理主题、侧边栏、当前 Workspace、局部布局和显示偏好等客户端 UI 状态，不复制服务端业务状态作为权威数据。
- 可分享的搜索、筛选、排序、分页状态放入 URL Search Params；表单使用 React Hook Form + Zod。
- 使用 `../backend/openapi/` 中的契约生成 TypeScript API Client，不手工重复维护前后端传输类型，不直接修改生成文件。
- 价格、金额计算、权限、订单与租约状态机均以后端为准；隐藏按钮不等于执行授权。
- 浏览器会话使用后端提供的安全 HttpOnly Cookie，不在 localStorage 或 Zustand 中保存长期身份凭据；按后端契约配合 CSRF 防护。
- 公开页提供可索引 HTML、独立 Title / Description、Canonical、Sitemap、Robots 和适用的 hreflang，避免空洞的程序化 SEO 页面；私有数据不得写入静态 HTML。
- Dashboard 和 Admin 禁止搜索引擎索引，但索引控制不能代替服务端认证授权。
- Mock 模式必须明确标识，不得以静态数据伪装实时库存、价格、供应商连接、交易成功率或真实服务。
- 随功能建立 Vitest、React Testing Library 和 Playwright 验证，重点覆盖实际业务流程、SSE 重连及断网／超时交互。
