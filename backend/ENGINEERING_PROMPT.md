# NumDock — Full-Stack Engineering Master Prompt

## 1. 项目定位

你是一名资深软件架构师、Go 后端工程师、React 前端工程师和具有成熟产品审美的技术负责人。

请设计并实现 **NumDock**，一个面向国际市场的虚拟号码管理、授权短信接收和通信 API 平台。

产品采用现代 SaaS 架构，提供号码资源管理、号码租约、授权短信收件箱、API 接入、订单交易、用户账户和运营管理能力。

系统必须以合法、透明、经过供应商明确授权的通信业务为前提。

严禁实现绕过第三方平台验证限制、批量养号、账号滥用、未经授权接收验证码或规避运营商风控的功能。

产品名称暂定 NumDock，品牌名称、域名和文案均应支持统一配置。

目标是交付一个可以持续迭代、长期维护、具备商业工程质量的产品，而非演示级项目。

## 2. 核心开发原则

- Architecture First：优先建立清晰的架构边界。
- Type Safety：强类型，避免 `any` 和无意义的类型断言。
- Composition Over Reinvention：优先组合成熟组件及库，不重复造轮子。
- Backend as Source of Truth：后端作为业务状态最终权威来源。
- Explicit State Machines：订单、租约、支付和消息必须有明确生命周期。
- Minimal Abstraction：不为尚不存在的需求增加抽象。
- Security by Default：租户隔离、权限校验、幂等、数据最小化。
- Production Quality：真实错误处理、测试、日志、监控和部署配置。
- No Fake Functionality：不得以静态数据伪装真实服务。

禁止提前拆分微服务。首先采用模块化单体，按照领域组织代码。

## 3. 技术栈

### Backend

- Go：使用已验证的稳定版本。
- Chi：HTTP Router。
- pgx + sqlc：PostgreSQL 数据访问。
- PostgreSQL：核心业务存储。
- River：PostgreSQL-backed Job Queue。
- Redis：缓存、限流和短期协调。
- slog：结构化日志。
- OpenTelemetry：Tracing / Metrics。
- OpenAPI：REST API 契约。
- SSE：实时事件通知。
- Docker：容器部署。

优先使用 Go 标准库，只有确有必要才增加依赖。

### Frontend

- React 19
- TypeScript Strict Mode
- React Router 7 Framework Mode
- Tailwind CSS v4
- shadcn/ui
- beUI
- Magic UI
- TanStack Query v5
- Zustand
- TanStack Table
- React Hook Form + Zod
- Lucide React
- Motion
- OpenAPI-generated TypeScript Client
- Vitest + React Testing Library + Playwright

包管理采用 pnpm，使用官方文档确认依赖的最新稳定兼容版本。

### Rendering

- 公开营销页面：SSG / Prerendering。
- 用户 Dashboard：CSR。
- 运营后台：CSR。
- SEO 元数据、Sitemap、Robots、Canonical、hreflang 均需要完善。
- 不引入没有实际价值的 Next.js 服务层。
- 独立 Go API 负责全部核心业务。

## 4. 推荐仓库结构

采用一个统一 Git 仓库：

```text
numdock/
├── apps/
│   ├── web/
│   └── api/
├── internal/
│   ├── auth/
│   ├── organizations/
│   ├── catalog/
│   ├── inventory/
│   ├── leases/
│   ├── orders/
│   ├── messaging/
│   ├── billing/
│   ├── providers/
│   ├── compliance/
│   └── realtime/
├── workers/
├── packages/
│   └── api-client/
├── db/
│   ├── migrations/
│   └── queries/
├── openapi/
├── infra/
├── docs/
└── AGENTS.md
```

上述结构是起点，不必机械照搬。可以根据 Go module、sqlc 和前端构建工具的实际约束调整，但领域边界必须明确。

## 5. 核心业务模块

### Authentication & Organization

实现：

- 注册与登录。
- 用户资料。
- 组织、成员与角色权限。
- API Key 管理。
- 会话撤销。
- 后台操作审计。

浏览器会话优先使用安全的 HttpOnly Cookie。不要把长期身份凭据保存在 localStorage 或 Zustand 中。

必须正确实现 CSRF 防护、会话过期、权限检查和速率限制。

### Number Catalog & Inventory

实现：

- 号码国家与地区。
- 号码类型。
- 经授权的供应商资源目录。
- 可用资源查询。
- 定价快照。
- 资源锁定和独占租约。
- 号码生命周期及隔离策略。

真实库存、价格和可用性必须来自授权供应商接口，不得编造。

### Provider Adapter

采用独立接口隔离外部通信服务。

要求：

- Capability Discovery。
- 获取可用资源与报价。
- 申请与释放号码。
- 入站 Webhook 验签。
- 消息归一化。
- 幂等与失败补偿。
- 供应商请求超时和速率限制。
- 供应商合同及允许业务范围的配置。

首先实现 Mock Provider，用于端到端开发和测试。

Live Provider 只有在存在明确商业授权和正式 API 文档时才允许接入。

不要假定所有 Provider 都支持短租、退款或立即释放号码。

### Orders & Leases

建立正式的订单与号码租约状态机。

订单和号码租约必须是不同领域实体。

保证：

- 原子性租约分配。
- 并发下防止重复租约。
- 订单幂等。
- 状态转换合法性验证。
- 超时任务可靠执行。
- 上游请求失败时的补偿机制。
- 可审计的订单事件记录。

禁止仅依赖 Redis TTL 决定交易的最终状态。

### Messaging

实现：

- Webhook 身份验证。
- 原始事件可靠持久化。
- 基于供应商事件 ID 的去重。
- 接收号码与合法有效租约匹配。
- 加密保存敏感消息。
- 用户级和租户级访问隔离。
- 消息留存、过期和删除策略。
- 异常消息隔离。
- SSE 通知与断线恢复。

不得将短信验证码或完整消息内容输出到日志、Tracing 或错误监控平台。

### Billing & Ledger

实现：

- 充值订单。
- 支付结果处理。
- 用户余额。
- 资金预留。
- 扣款。
- 退款。
- 不可变账本。
- 供应商费用记录。
- 账务对账。
- 异常交易处理。

账本必须使用 Decimal / 最小货币单位和明确币种，不使用浮点数处理金额。

支付 Webhook 必须验证真实性，资金结算必须幂等。

具体支付机构必须符合其商户政策，并得到业务模式审批。

### Compliance & Risk

实现：

- 用户与组织验证。
- 业务用途声明。
- 供应商授权记录。
- 场景白名单。
- 异常操作限流。
- 消息访问审计。
- 滥用投诉处理。
- 隐私数据保留策略。
- 号码暂停与封禁管理。

不允许公共共享验证码收件箱，不允许跨租户读取短信。

## 6. API 契约

使用 OpenAPI 维护接口的单一事实来源。

至少覆盖：

- `/v1/auth/*`
- `/v1/me`
- `/v1/organizations/*`
- `/v1/catalog/*`
- `/v1/numbers/*`
- `/v1/leases/*`
- `/v1/orders/*`
- `/v1/messages/*`
- `/v1/billing/*`
- `/v1/api-keys/*`
- `/v1/events/stream`
- `/v1/admin/*`

使用 OpenAPI 生成 TypeScript API Client，禁止手工重复维护前后端类型。

所有列表接口应统一：

- Pagination。
- Sorting。
- Filtering。
- Error Schema。
- Request ID。

创建订单、租约、充值和退款必须支持 Idempotency-Key。

所有接口由后端执行租户及对象级授权。

## 7. 前端架构

TanStack Query 是所有服务端状态的唯一主要缓存层：

- 用户数据。
- 号码目录。
- 号码库存。
- 租约状态。
- 消息记录。
- 订单列表。
- 余额与交易记录。

使用 Query Keys、Mutation 和 Cache Invalidation。

SSE 负责发送实时变化事件；客户端收到事件后按资源类型更新或失效对应 Query 缓存。

避免无意义的全站重取。

Zustand 仅用于客户端 UI 状态：

- Theme。
- Sidebar。
- 当前 Workspace。
- 局部界面布局。
- 用户显示偏好。

URL Search Params 负责可分享的搜索、筛选、排序、分页状态。

React Hook Form + Zod 负责表单与客户端验证。

业务规则、金额计算、价格确认、权限、状态机均以 Go 后端为准。

## 8. UI 组件约束

必须优先使用：

1. shadcn/ui：基础交互组件。
2. beUI：高质量动态交互组件。
3. Magic UI：营销与品牌展示组件。

严禁重复实现已有成熟组件的功能，包括：

- Dialog。
- Popover。
- Select。
- Combobox。
- Tooltip。
- Tabs。
- Drawer。
- Toast。
- Form。
- Data Table。
- Pagination。
- Calendar。
- Animation Primitives。

如果已有库可以满足需求，禁止用原生 div、自写事件监听与定时器重新实现。

允许编写业务页面和必要的组合型业务组件，但应基于成熟组件库组合，不创建第二套自研基础组件库。

视觉上必须避免常见的 AI 生成后台模板风格。前端的详细设计规范由独立的 UI Prompt 约束。

## 9. 国际化与 SEO

面向国际市场，架构应支持多语言。

初期实现英文界面，预留中文国际化资源。

公开页面必须：

- 提供可索引的 HTML。
- 使用独立 Title 和 Description。
- 支持 Canonical。
- 生成 Sitemap。
- 支持 hreflang。
- 避免重复、空洞的程序化 SEO 页面。
- 不将用户私有数据输出到静态 HTML。

Dashboard 和 Admin 不允许被搜索引擎索引，所有私有接口必须经过服务端认证授权。

## 10. 工程质量

必须建立：

- Backend Unit Tests。
- PostgreSQL Integration Tests。
- Contract Tests。
- Frontend Component Tests。
- Playwright E2E Tests。
- Webhook 重复与乱序测试。
- 号码并发租约测试。
- 钱包双重扣款测试。
- SSE 重连测试。
- 跨租户访问隔离测试。
- 断网、超时和任务重试测试。

不得使用未经验证的假实现替代关键逻辑。

Mock Mode 必须明确标识，仅用于开发和演示。

不得生成虚假的实时库存、用户量、交易成功率或真实供应商连接状态。

## 11. 实施顺序

按照垂直功能切片迭代。

Phase 1：基础项目、数据库、OpenAPI、用户身份、设计系统。

Phase 2：授权供应商 Mock、号码目录、独占租约与订单状态机。

Phase 3：入站消息、Webhook、River、SSE、消息收件箱。

Phase 4：计费账本、充值、退款、对账。

Phase 5：运营管理、安全审计、合规工作流。

Phase 6：正式供应商接入、生产部署与性能验证。

每个阶段都要有运行代码、验证方法和完成标准，而不是只生成设计文档。

## 12. 对编程 Agent 的执行要求

开始工作时：

1. 阅读现有代码、依赖和仓库约束。
2. 核实关键依赖的当前官方文档。
3. 列出总体架构和第一阶段实施计划。
4. 明确模块边界与 API 契约。
5. 立即实施第一个可运行的垂直切片。
6. 执行测试、类型检查、Lint 和构建。
7. 修复失败后汇报实际完成情况。

不要停留在概念设计。

不要引入没有收益的复杂架构。

不要编造 API、库导出、组件名称或供应商能力。

不要因为开发方便而牺牲交易一致性、安全性和代码质量。

最终交付的 NumDock 应是一套设计克制、工程可靠、可以迭代的现代通信资源 SaaS 平台。