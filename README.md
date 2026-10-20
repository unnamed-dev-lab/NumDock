# NumDock

面向授权通信业务的号码与消息工作区。当前交付的是第一阶段的身份切片：真实 PostgreSQL 注册、组织所有者成员关系、登录、当前账户查询、退出和会话撤销，以及对应的前端界面。

## 当前边界

- 后端：Go + Chi，pgx + sqlc，Goose 迁移，OpenAPI 契约。
- 前端：React 19 + TypeScript Strict，React Router 7 Framework SPA，Tailwind v4，shadcn/ui / Radix，TanStack Query，React Hook Form + Zod。
- Cookie 会话有效期 12 小时，数据库仅保存会话令牌摘要；密码使用带随机盐的 Argon2id。
- 身份变更接口执行 Origin + CSRF 校验；认证限流记录在 PostgreSQL，跨进程共享。当前直接使用连接来源 IP，不信任转发头；部署反向代理前需配置并测试可信代理策略。
- 号码、订单、供应商、短信、账本、River、Redis、OpenTelemetry、多语言资源和公开营销页面尚未实现。不会显示虚假库存或交易数据。
- 目前还没有邮箱验证、密码找回、邀请成员、API Key 管理或生产合规工作流。这是开发基础切片，不是完整生产发布版本。

## 目录

```text
backend/
  cmd/api/             API 入口与显式迁移命令
  internal/auth/       身份、Cookie 会话、CSRF 与认证限流
  internal/store/      sqlc 生成代码，不手动修改
  internal/server/     HTTP 基础设施、数据库集成与响应契约测试
  db/migrations/       数据库迁移
  db/queries/          SQL 查询源文件
  openapi/openapi.yaml 接口契约的单一事实来源
frontend/
  app/components/ui/   官方 shadcn 组件，已接入项目令牌
  app/lib/api/         生成类型与类型化客户端
  app/app.css          集中式明暗主题变量
  tests/              Playwright 浏览器流程
scripts/backend.ps1   Windows 后端任务入口
```

修改前阅读根目录和对应子目录的 `AGENTS.md`。

## 本地启动

需要 Go 1.26+、Node.js 22.12+（建议 24 LTS）、pnpm 10、PostgreSQL 17。依赖版本以 `go.mod` 和 `frontend/pnpm-lock.yaml` 为准。

1. 复制根目录 `.env.example` 为 `.env`，修改本地数据库密码；`DATABASE_URL` 中的密码需做 URL 编码。
2. 启动数据库：`docker compose up -d postgres`。也可以使用自己的独立 PostgreSQL 数据库并配置 `DATABASE_URL`。
3. 应用迁移，然后启动 Go API：

   ```powershell
   ./scripts/backend.ps1 migrate
   ./scripts/backend.ps1 run
   ```

4. 在另一个终端启动前端：

   ```powershell
   cd frontend
   pnpm install --frozen-lockfile
   pnpm dev
   ```

打开 **http://localhost:3000**，创建自己的测试账户。前端通过同源 `/v1` 代理访问 `127.0.0.1:8080`。浏览器访问地址的 Origin 必须与 `APP_ORIGIN` 完全一致，不要混用 `localhost` 和 `127.0.0.1`。

本次开发环境使用的独立数据库位于被 Git 忽略的 `.local/postgres/`，监听 `127.0.0.1:55432`；随机密码和连接串保存在 `.local/`。Windows 脚本在没有根目录 `.env` 时可读取 `.local/dev.env`。不要同时启动占用同一端口的 Docker 数据库。

非 Windows 环境可先将 `.env` 中的后端变量导出到进程环境，再在 `backend/` 执行 `go run ./cmd/api -migrate` 和 `go run ./cmd/api`。

## 验证与生成

```powershell
./scripts/backend.ps1 check
# 设置独立测试数据库后，测试会为每次运行创建并清理随机 schema。
# 测试账号需要 CREATE SCHEMA 权限；不要指向生产数据库。
$env:TEST_DATABASE_URL = $env:DATABASE_URL
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

未设置 `TEST_DATABASE_URL` 时，PostgreSQL 集成测试会明确跳过；不能将其视为数据库测试通过。浏览器注册流程会在开发库留下带 `browser-` 前缀的测试账户。

SQL 变更后在 `backend/` 运行 `go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate`；OpenAPI 变更后在 `frontend/` 运行 `pnpm generate:api`。提交源文件和生成结果，不手动修改生成类型。

## 部署约束

后端 Docker 构建上下文为 `backend/`，可用 `docker build -t numdock-api backend` 构建。容器内需设置 `HTTP_ADDR=0.0.0.0:8080`，数据库迁移使用同一镜像执行 `/api -migrate`，不在 API 启动时隐式迁移。

前端产物位于 `frontend/build/client/`，静态托管需将路由回退到 `index.html`，并将 `/v1` 转发到 Go API。生产入口必须使用 HTTPS、准确的 `APP_ORIGIN` 与 `COOKIE_SECURE=true`；安全 Cookie 使用 `__Host-` 前缀。当前没有跨域 Cookie / CORS 部署方案。

本地 Docker 守护进程尚未运行，容器镜像与 Compose 启动需要在具备 Docker 的环境中验证。公开营销页的 SSG、SEO 和多语言将在对应切片落地；当前账户和工作区页面均为 noindex。

下一切片：Mock Provider、号码目录、订单和独占租约状态机，先验证并发与幂等，再接入真实授权供应商。
