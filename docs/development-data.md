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
- USD 月费以美分保存，短信单价以百万分之一美元保存；这些是演示报价，没有真实钱包、交易、号码租约或收信能力。
- 目录是登录用户共享的开发参考库存，不是某个组织已购买的资源；组织私有短信及资源尚未实现，不能通过此接口访问。
- 打开 `http://localhost:3000/app/numbers?tab=catalog`，或使用 `/docs/api` 的 Catalog 分类。
- `APP_ENV` 不为 development 时，无论数据库里是否有模拟记录，接口都返回空列表与 `mode=disabled`。这不替代生产库隔离：生产应使用独立数据库，不复制开发用户。

## 重复执行与冲突

seed 使用单个事务和 PostgreSQL 事务级 advisory lock，避免并发初始化部分写入。固定 ID 保证重复执行不重复插入，不修改已有密码、角色或目录记录。若开发邮箱与已有非 seed 账号冲突，整笔事务回滚并返回安全错误，不接管已有账号。没有自动 reset／清库命令。

## 浏览器测试端口

默认使用 3000。若该端口由其他应用占用，可先 `pnpm dev --port 3001`，再设置 `$env:PLAYWRIGHT_PORT='3001'` 执行 `pnpm test:e2e`。Vite 的本地代理会把 Origin 转换为后端配置的 APP_ORIGIN，生产环境不做此转换。
