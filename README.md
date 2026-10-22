# NumDock

面向授权通信业务的号码与消息工作区。当前已实现持久化 Mock 开发版：身份、组织、号码申请与释放、消息、钱包账本、退款、API Key、Webhook、River 和 SSE。所有通信与资金均为明确标注的模拟业务。详细盘点见 [`docs/project-status.md`](docs/project-status.md)。

## 当前边界

- 后端：Go + Chi，pgx + sqlc，Goose 迁移，OpenAPI 契约。
- 前端：React 19 + TypeScript Strict，React Router 7 Framework Mode（SSR），Tailwind v4，beUI + shadcn/ui Base UI，TanStack Query，React Hook Form + Zod。
- 组件选型严格按 beUI > Magic UI > shadcn/ui；全部通过 CLI / registry 安装，来源与定制见 `frontend/docs/component-sources.md`。项目保留 pnpm 锁文件，组件 CLI 优先用 `bunx --bun`。
- Cookie 会话有效期 12 小时，数据库仅保存会话令牌摘要；密码使用带随机盐的 Argon2id。
- 身份变更接口执行 Origin + CSRF 校验；认证限流记录在 PostgreSQL，跨进程共享。通过 `TRUSTED_PROXIES` 配置可信代理 IP/CIDR；仅当直接对端是可信代理时才解析 `X-Forwarded-For`，默认不信任转发头。
- 界面支持英文与简体中文，使用 i18next + react-i18next；语言偏好通过 Cookie 持久化，并同步 SSR 首屏、页面标题、校验与错误提示。维护说明见 `frontend/docs/i18n.md`。
- 已有首页、平台、安全、状态与 API 文档公开页面。真实供应商、支付机构与 Redis 尚未接入；Mock 号码、订单、租约、消息、账本和持久任务已实现。Go HTTP 层已接入 OpenTelemetry traces／metrics 和可选 OTLP HTTP 导出，开发概览展示组织隔离的数据库样本。
- 工作台展示真实用户与组织数据；开发环境号码目录从 PostgreSQL 读取明确标识的模拟库存与报价，余额、号码和消息均明确标注为 Mock；不宣称真实供应商状态或第三方验证能力。非开发模式目录返回空列表与 `mode=disabled`。
- 目前还没有邮箱验证、密码找回、邀请成员或生产合规工作流。这是 Mock 开发版，不是完整生产发布版本。

## 目录

```text
backend/
  cmd/api/             API 入口与显式迁移命令
  internal/identity/   身份领域：用例、HTTP 适配与 PostgreSQL 适配
  internal/catalog/    开发只读目录、筛选与分页
  internal/devseed/    显式开发用户、组织与目录初始化
  internal/operations/ 号码、订单、消息、钱包、密钥、Webhook、River
  internal/providers/  Mock Provider
  internal/overview/   组织级开发概览
  internal/platform/telemetry/ HTTP 遥测 SDK 与导出
  internal/platform/   配置、HTTP 响应与通用中间件
  internal/server/     HTTP composition root 与集成测试
  db/migrations/       数据库迁移
  openapi/openapi.yaml 接口契约的单一事实来源
frontend/
  app/components/motion/ CLI 安装的 beUI 按钮、输入、主题、侧边栏
  app/components/ui/   CLI 安装的 shadcn Base UI 菜单和表格
  app/features/        认证、工作台壳与只读身份/组织页面组合
  app/lib/api/         生成类型与类型化客户端
  app/app.css          集中式明暗主题变量
  tests/              Playwright 浏览器流程
scripts/backend.ps1   Windows 后端任务入口
```

修改前阅读根目录和对应子目录的 `AGENTS.md`。

## API 文档

- OpenAPI 契约：`backend/openapi/openapi.yaml`，运行时由 `GET /v1/openapi.yaml` 提供
- Markdown 接口分类与详解：`backend/openapi/README.md`
- 错误码、限流、超时与 curl/PowerShell 示例：`backend/openapi/errors.md`、`backend/openapi/testing.md`
- TypeScript SDK：`backend/openapi/README.md` 中的 Hey API 命令；契约已用 Hey API 0.99 + TypeScript 5.9.3 做严格类型检查


## 本地启动

需要 Go 1.26+、Node.js 22.12+（建议 24 LTS）、pnpm 10、PostgreSQL 17。依赖版本以 `go.mod` 和 `frontend/pnpm-lock.yaml` 为准。

1. 复制根目录 `.env.example` 为 `.env`，修改本地数据库密码；`DATABASE_URL` 中的密码需做 URL 编码。
2. 启动数据库：`docker compose up -d postgres`。也可以使用自己的独立 PostgreSQL 数据库并配置 `DATABASE_URL`。
3. 应用迁移，然后启动 Go API：

   ```powershell
   ./scripts/backend.ps1 migrate
   ./scripts/backend.ps1 seed # 可选：创建开发用户、余额、号码、消息及模拟目录
   ./scripts/backend.ps1 run
   ```

4. 在另一个终端启动前端：

   ```powershell
   cd frontend
   pnpm install --frozen-lockfile
   pnpm dev
   ```

打开 **http://localhost:3000**，创建自己的测试账户，或使用 seed 生成的 `owner@numdock.test`。随机密码保存在 Git 忽略的 `.local/dev-seed-password`（如显式配置 `DEV_SEED_PASSWORD` 则使用配置值）。初始化与账号说明见 [`docs/development-data.md`](docs/development-data.md)。目录入口为 `/app/numbers?tab=catalog`。前端通过同源 `/v1` 代理访问 `127.0.0.1:8080`。若 3000 被占用，Vite 会自动尝试 3001、3002……并打印实际地址；开发代理会把 localhost 的 `/v1` Origin 重写为 `APP_ORIGIN`（默认 `http://localhost:3000`），因此本地注册和登录仍然可用。生产环境不启用该重写，浏览器 Origin 仍必须与 `APP_ORIGIN` 完全一致；不要混用 `localhost` 和 `127.0.0.1`。

本次开发环境使用的独立数据库位于被 Git 忽略的 `.local/postgres/`，监听 `127.0.0.1:55432`；随机密码和连接串保存在 `.local/`。Windows 脚本在没有根目录 `.env` 时可读取 `.local/dev.env`。不要同时启动占用同一端口的 Docker 数据库。

非 Windows 环境可先将 `.env` 中的后端变量导出到进程环境，再在 `backend/` 执行 `go run ./cmd/api -migrate` 和 `go run ./cmd/api`。

## 验证与生成

```powershell
./scripts/backend.ps1 check
# 使用 .local/dev.env 时，脚本会自动把 DATABASE_URL 映射为 TEST_DATABASE_URL。
# 如使用独立测试库，先显式设置 TEST_DATABASE_URL。
# 测试会为每次运行创建并清理随机 schema；测试账号需要 CREATE SCHEMA 权限。
./scripts/backend.ps1 test

cd frontend
pnpm generate:api
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install chromium
# 先启动已完成迁移的后端。Playwright 会启动或复用前端开发服务。
pnpm test:e2e
```

未设置 `TEST_DATABASE_URL` 时，PostgreSQL 集成测试会明确跳过；不能将其视为数据库测试通过。CI 使用 PostgreSQL 17 服务执行同等的格式化、vet、race 测试、构建、sqlc diff 和 staticcheck。浏览器注册流程会在开发库留下带 `browser-` 前缀的测试账户。

前端 Lint 同时检查颜色变量、Base UI 配置、Radix 依赖／导入禁令和组件安装来源清单。浏览器测试覆盖表单、会话、主题切换、菜单键盘操作、移动侧边栏焦点及工作区加载／错误／空状态；号码、消息、账单与开发者页面均接入持久化 Mock 业务流程。

SQL 变更后在 `backend/` 运行 `go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate`；OpenAPI 变更后在 `frontend/` 运行 `pnpm generate:api`。提交源文件和生成结果，不手动修改生成类型。

## 部署约束

后端 Docker 构建上下文为 `backend/`，可用 `docker build -t numdock-api backend` 构建。容器内需设置 `HTTP_ADDR=0.0.0.0:8080`，数据库迁移使用同一镜像执行 `/api -migrate`，不在 API 启动时隐式迁移。

前端产物位于 `frontend/build/client/`，静态托管需将路由回退到 `index.html`，并将 `/v1` 转发到 Go API。生产入口必须使用 `APP_ENV=production`、HTTPS、准确的 `APP_ORIGIN` 与 `COOKIE_SECURE=true`；安全 Cookie 使用 `__Host-` 前缀。部署反向代理时，将代理 IP/CIDR 写入 `TRUSTED_PROXIES`，并确保代理覆盖或追加 `X-Forwarded-For`。当前没有跨域 Cookie / CORS 部署方案。

本地 Docker 守护进程尚未运行，容器镜像与 Compose 启动需要在具备 Docker 的环境中验证。公开营销页的 SSG、SEO 和多语言将在对应切片落地；当前账户和工作区页面均为 noindex。

当前已完成 Mock 开发版号码、消息、订单／钱包、密钥、Webhook、River 与 SSE 业务闭环。使用说明、业务规则与签名协议见 [Mock 工作区](docs/mock-workspace.md)。真实供应商及支付尚未接入。

## 概览与运行监控

开发 seed 另为两个组织各补 30 天业务预览。登录 `owner@numdock.test` 后打开 `/app`，可查看号码快照、消息趋势、订单、模拟费用和每日明细；新组织没有样本时显示空状态。所有业务图表明确标为开发预览。

OpenTelemetry 采集真实 API 请求的 traces／metrics，OTLP 端点为空时不向外导出。独立 Grafana 本地栈与预置 API 看板见 [`docs/observability.md`](docs/observability.md)，启动命令为 `docker compose -f compose.observability.yaml up -d`。业务看板不依赖 Grafana。
