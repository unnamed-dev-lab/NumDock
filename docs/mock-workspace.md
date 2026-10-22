# Mock 工作区使用与接口

## 体验流程

1. 执行 `./scripts/backend.ps1 migrate`、`seed`、`run`，另开终端启动前端。
2. 使用 `owner@numdock.test` 登录。密码见 Git 忽略的 `.local/dev-seed-password`。
3. 在账单页创建充值订单，确认开发支付后查看余额和账本；不发生真实资金交易。待支付订单可恢复、取消，15 分钟后过期。
4. 在号码目录申请号码，选择合法用途并确认。租期 30 天、不自动续费；可开启供应商失败开关查看资金返还。
5. 在“你的号码”点击“模拟收信”，然后在消息页查看、已读或删除。
6. 先释放号码，再在下单后 14 天内退款。号码释放后隔离 5 分钟；每笔订单只能退款一次。

所有金额均为 USD 最小单位。Mock 模拟收信免费；目录中的短信单价仅为演示报价，不参与开发版扣费。过期／释放后不接收入站消息，晚到或异常事件进入隔离。消息正文和原始供应商事件加密，消息 30 天过期，删除时同步清除对应原始正文。

## 环境与密钥

Windows 脚本在 development 下自动生成 `.local/data-encryption-key`，值为 32 字节随机数据的标准 Base64。此文件被 Git 忽略，应随开发数据库一起保管；替换或丢失会使已有加密消息无法解密。

直接运行 Go 时，显式设置 `DATA_ENCRYPTION_KEY`。生产环境不启用 Mock，启动时不会隐式迁移或初始化用户。Goose 和 River 数据库迁移都由 `-migrate` 执行；API 同进程启动 River worker，重启后继续处理数据库中的任务。

## 业务 API

公开目录使用 GET /v1/catalog/numbers。私有资源位于 /v1/organizations/{organization_id} 下，路径参数用于内部授权校验；普通用户界面无需选择组织。

列表拆分为 /numbers、/messages、/orders、/billing/ledger、/billing/payments，统一返回 {items, mode, total, limit, offset}。查询参数仅用于 limit/offset/status/q，不再选择资源类型。摘要使用 /summary，余额使用 /billing/wallet。完整说明见 [资源接口](../backend/openapi/resources.md)，充值规则见 [支付接口](../backend/openapi/payments.md)。

| 方法 | 相对路径 | 用途 |
| --- | --- | --- |
| POST | /billing/payments | 创建支付订单，包含 amount_minor |
| GET | /billing/payments/{reference} | 当前账户的支付详情 |
| POST | /billing/payments/{id}/confirm | 确认开发支付，成功后幂等入账 |
| POST | /billing/payments/{id}/cancel | 取消待支付订单 |
| POST | /orders | 申请号码，含 catalog_item_id、purpose、confirmed_terms |
| POST | /leases/{id}/release | 释放租约 |
| POST | /orders/{id}/refund | 按开发规则退款 |
| POST | /messages/simulate | 指定 lease_id，可选 body，最多 1600 字符 |
| GET / DELETE | /messages/{id} | 授权解密并标记已读／永久删除 |
| GET | /events/stream | 浏览器会话 SSE，使用 Last-Event-ID 恢复 |

所有业务写操作需要 8–128 字符 Idempotency-Key。同账户、同操作、同键的重放不会重复扣款；内容不同返回 409。浏览器写操作要求 Origin、Cookie 与 X-CSRF-Token，并按账户及用户持久限流，每分钟 120 次。每次访问均校验当前成员关系和资源归属。

API Key、用户外发 Webhook、聚合 /workspace?view=... 和直接 /billing/mock-credit 已删除。历史表保留，旧投递任务完成后不发送网络请求。

## 供应商入站与实时事件

开发供应商入站使用 `POST /v1/providers/mock/webhook`，JSON 为 `{id,lease_id,body,occurred_at}`。`X-NumDock-Timestamp` 为秒级时间，`X-NumDock-Signature` 为十六进制 HMAC。先对解码后的 `DATA_ENCRYPTION_KEY` 计算 `HMAC-SHA256(key, "numdock/mock-provider-webhook")` 得到签名密钥，再按同一 `timestamp + "." + rawBody` 算法签名。时间窗口 5 分钟；相同事件 ID／内容去重，内容冲突返回 409，无法匹配有效租约的消息隔离。

实时事件来自 PostgreSQL 持久表，SSE 只发送资源元数据；前端集中 hooks 按资源合并并失效相关缓存。单次连接约 10 秒，浏览器自动携带事件游标重连。
