# 开发数据与内置用户

开发数据只供本地联调。迁移只创建表结构，API 启动不自动创建账号或库存。

## 初始化

根 `.env` 设置 `APP_ENV=development`、数据库连接和本地 Cookie／Origin 配置（参考 `.env.example`）。已有 `.local/dev.env` 的 Windows 开发环境由脚本在未配置 APP_ENV 时按 development 运行。Go 直接启动默认 production，需显式导出环境变量。

```powershell
./scripts/backend.ps1 migrate
./scripts/backend.ps1 seed
./scripts/backend.ps1 run
```

Windows seed 任务在没有 `DEV_SEED_PASSWORD` 时，生成随机密码并保存到 Git 忽略的 `.local/dev-seed-password`，以后复用此文件。也可以显式配置 12–128 字符的 `DEV_SEED_PASSWORD`。密码不会写入版本库或日志，数据库保存带随机盐的 Argon2id 哈希。

```powershell
Get-Content .local/dev-seed-password
```

如果使用显式密码，不会创建此密码文件。重复 seed **不会重置已有账号密码**；改变环境变量不能修改已经创建的用户密码。遗失密码需通过独立的账户恢复流程或在可丢弃的独立开发库重建，脚本不自动删除数据。

非 Windows：先导出 `APP_ENV=development`、`DATABASE_URL`、`DEV_SEED_PASSWORD` 及服务配置，在 `backend/` 执行 `go run ./cmd/api -migrate`、`go run ./cmd/api -seed` 和 `go run ./cmd/api`。

## 内置用户

所有初次创建的用户使用本次 seed 密码。这里的 admin 只是组织成员角色，**不是平台超级管理员**，也不代表已有成员管理接口。

| 邮箱 | 角色 | 组织 |
| --- | --- | --- |
| `owner@numdock.test` | owner | NumDock Development (Mock) |
| `admin@numdock.test` | admin | NumDock Development (Mock) |
| `member@numdock.test` | member | NumDock Development (Mock) |
| `isolated@numdock.test` | owner | Isolated Development (Mock) |

用户经正常登录接口建立会话，不存在开发后门。独立组织用于检查 `/v1/me` 和 `/v1/organizations` 只返回本人的成员关系；不预置跨组织成员关系。

## 模拟目录

- 24 条记录：US、CA 各 12 条；使用合成的 555-01xx 演示号码。
- 唯一供应商标识为 `NumDock Mock`，`source=mock`；能力仅为 `sms`、`voice`、`mms`，不宣称可用于第三方账号验证。
- USD 月费以美分保存，短信单价以百万分之一美元保存；这些是演示报价，以模拟业务规则计价，开发版通过真实数据库钱包、订单和租约实现业务流程，模拟收信免费。
- 目录是游客与登录用户均可浏览的开发参考库存，不是某个组织已购买的资源；已租用资源会从可用目录移出；组织私有号码和消息通过组织工作区接口访问。
- 打开 `http://localhost:3000/app/numbers?tab=catalog`，也可直接访问公开首页目录。
- `APP_ENV` 不为 development 时，无论数据库里是否有模拟记录，接口都返回空列表与 `mode=disabled`。这不替代生产库隔离：生产应使用独立数据库，不复制开发用户。

## 重复执行与冲突

基础账号、目录及历史样本使用单个事务和 advisory lock。业务演示通过真实事务用例逐项创建，失败后可重跑继续；稳定幂等键避免重复充值或申请。固定 ID 保证重复执行不重复插入，不修改已有密码、角色或目录记录。若开发邮箱与已有非 seed 账号冲突，整笔事务回滚并返回安全错误，不接管已有账号。没有自动 reset／清库命令。

## 浏览器测试端口

默认使用 3000。若该端口由其他应用占用，可先 `pnpm dev --port 3001`，再设置 `$env:PLAYWRIGHT_PORT='3001'` 执行 `pnpm test:e2e`。Vite 的本地代理会把 Origin 转换为后端配置的 APP_ORIGIN，生产环境不做此转换。

## 概览样本

seed 还给主开发组织和独立组织各补最近 30 个 UTC 自然日的概览样本，表为 `development_overview_daily`。重复执行只补缺失日期，不覆盖已有记录。此表与真实交易实体隔离，生产模式接口不读取。登录后打开 `/app` 可查看 7／30 天指标、趋势和明细；新建组织不会自动获得别的组织的样本。详情见 [概览与 OpenTelemetry](observability.md)。

## 预装业务

每个组织初始充值 250 USD Mock 余额。主组织预租 3 个号码（其中 2 个支持 SMS），独立组织预租 1 个号码；每个 SMS 号码各有 2 条模拟通知，每个组织还创建 2 个密钥状态样本（只读／已撤销）、3 个 Webhook 端点（成功／失败／已停用），并为成功与失败端点各创建一次测试投递。样本密钥随机生成后丢弃明文，只保存哈希；要调用 API 请在页面新建密钥获取一次性 token。重复 seed 不重置余额、不恢复已释放号码或已删除消息。

Windows 脚本还自动初始化 Git 忽略的 `.local/data-encryption-key`。非 Windows 必须设置 Base64 编码的 32 字节 `DATA_ENCRYPTION_KEY`。业务操作、密钥及签名协议见 [Mock 工作区](mock-workspace.md)。历史趋势样本与当前余额／租约／消息计数分别展示，不能把历史样本当成实时账本。

## 开发者样本与后端版本

`seed` 可再次执行：不会重复充值、创建样本密钥、端点或测试投递。投递通过真实 River 队列执行，需启动当前版本 API；成功端点返回 200，失败端点按实际重试从等待变成失败。

页面显示 404 时应先检查实际连接的后端，缺少数据应返回 200 和空列表。`GET /v1/openapi.yaml` 必须包含 `/v1/organizations/{organization_id}/workspace`。更新 Go 代码后需要重启后端；Vite 热更新只更新前端。现在前端启动会检查后端契约，并在终端提示旧版连接。页面也区分加载中、连接异常与明确停用，重试会同时刷新工作区状态和当前列表。

当前会话统一使用 `http://localhost:3001` 开发前端，历史 3010／3011 预览入口跳转到同一实例，避免多个 React Router 进程争用生成目录。调用样例见 [resources.http](../backend/openapi/examples/resources.http)。
