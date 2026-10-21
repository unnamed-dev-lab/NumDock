# Mock 工作区使用与接口

## 体验流程

1. 执行 `./scripts/backend.ps1 migrate`、`seed`、`run`，另开终端启动前端。
2. 使用 `owner@numdock.test` 登录。密码见 Git 忽略的 `.local/dev-seed-password`。
3. 在账单页查看模拟余额、订单和账本；“充值模拟余额”不发生真实支付。
4. 在号码目录申请号码，选择合法用途并确认。租期 30 天、不自动续费；可开启供应商失败开关查看资金返还。
5. 在“你的号码”点击“模拟收信”，然后在消息页查看、已读或删除。
6. 先释放号码，再在下单后 14 天内退款。号码释放后隔离 5 分钟；每笔订单只能退款一次。
7. 开发者页创建 API Key 或 Webhook，复制仅显示一次的密钥。`mock://success` 返回成功，`mock://failure` 用于检查失败与重试。

所有金额均为 USD 最小单位。Mock 模拟收信免费；目录中的短信单价仅为演示报价，不参与开发版扣费。过期／释放后不接收入站消息，晚到或异常事件进入隔离。消息正文和原始供应商事件加密，消息 30 天过期，删除时同步清除对应原始正文。

## 环境与密钥

Windows 脚本在 development 下自动生成 `.local/data-encryption-key`，值为 32 字节随机数据的标准 Base64。此文件被 Git 忽略，应随开发数据库一起保管；替换或丢失会使已有加密消息及 Webhook 密钥无法解密。

直接运行 Go 时，显式设置 `DATA_ENCRYPTION_KEY`。生产环境不启用 Mock，启动时不会隐式迁移或初始化用户。Goose 和 River 数据库迁移都由 `-migrate` 执行；API 同进程启动 River worker，重启后继续处理数据库中的任务。

## 业务 API

所有资源均位于 `/v1/organizations/{organization_id}` 下；列表采用 `GET /workspace?view=numbers|messages|orders|ledger|keys|webhooks|deliveries&limit=20&offset=0`。`status` 按视图筛选，`q` 搜索号码。列表按创建时间降序和 ID 稳定排序；目录另支持排序参数。返回钱包、计数和所选分页资源。API Key 不具备账单／消息读取权限时，相应附带摘要归零。

| 方法 | 相对路径 | 用途 |
| --- | --- | --- |
| POST | `/billing/mock-credit` | 模拟充值 `amount_minor`，100–1,000,000 美分 |
| POST | `/orders` | 申请号码，含 `catalog_item_id`、`purpose`、`confirmed_terms`、可选 `simulate_failure` |
| POST | `/leases/{id}/release` | 释放租约 |
| POST | `/orders/{id}/refund` | 按 Mock 规则退款 |
| POST | `/messages/simulate` | 指定 `lease_id`，可选 `body`，最多 1600 字符 |
| GET / DELETE | `/messages/{id}` | 授权解密并标记已读／永久删除 |
| POST | `/api-keys` | `name`、至少一项 `scopes`、`expires_days`（默认 30，最多 90） |
| POST | `/api-keys/{id}/revoke` | 撤销密钥 |
| POST | `/webhooks` | 创建端点 `url` |
| PATCH | `/webhooks/{id}` | 设置 `enabled` |
| POST | `/webhooks/{id}/test` | 创建测试事件及投递 |
| GET | `/events/stream` | 浏览器会话 SSE，使用 `Last-Event-ID` 恢复 |

所有写操作需要 8–128 字符 `Idempotency-Key`。同组织、同操作、同键的重放不会重复扣款；内容不同返回 409。密钥与 Webhook secret 不保存在幂等响应中：网络丢失后重试可获取资源 ID，但无法再次获得 secret，应撤销／停用后重新创建。业务写操作按组织及用户持久限流，每分钟 120 次。

浏览器写操作仍要求 Origin、Cookie 与 `X-CSRF-Token`。API Key 仅支持 `numbers:read`、`numbers:write`、`messages:read`、`billing:read`；`numbers:write` 可以申请和释放，充值、退款、模拟收信及密钥／Webhook 管理需要浏览器管理员会话。权限每次与数据库当前成员关系校验，撤销即时生效。

```bash
curl "$BASE/v1/organizations/$ORG/workspace?view=numbers"   -H "Authorization: Bearer $NUMDOCK_API_KEY"
curl -X POST "$BASE/v1/organizations/$ORG/orders"   -H "Authorization: Bearer $NUMDOCK_API_KEY"   -H "Content-Type: application/json" -H "Idempotency-Key: example-order-001"   --data '{"catalog_item_id":"CATALOG_ID","purpose":"customer_support","confirmed_terms":true}'
```

## Webhook 协议

出站请求为 HTTPS POST（或内部 Mock 端点），不跟随重定向，拒绝私网、环回及保留地址，DNS 解析后固定到已验证地址，无环境代理。只允许 HTTPS 443，URL 不接受凭据、query 或 fragment。

事件 JSON 为 `{id,type,resource_id,source:"mock"}`，不携带消息正文。请求头 `X-NumDock-Event-ID` 标识事件，`X-NumDock-Signature: t=UNIX_SECONDS,v1=HEX_HMAC_SHA256`。签名输入为 `timestamp + "." + rawBody`，签名密钥为创建端点时一次性展示的 `whsec_...` 字符串。接收端应校验时间、签名并按事件 ID 去重，2xx 表示成功。普通失败按 5、10、20、40 秒间隔重试，共最多 5 次；River 的调度周期可能使实际执行稍晚。网络发送与本地事务提交之间无法保证恰好一次，因此接收端必须去重。

开发供应商入站使用 `POST /v1/providers/mock/webhook`，JSON 为 `{id,lease_id,body,occurred_at}`。`X-NumDock-Timestamp` 为秒级时间，`X-NumDock-Signature` 为十六进制 HMAC。先对解码后的 `DATA_ENCRYPTION_KEY` 计算 `HMAC-SHA256(key, "numdock/mock-provider-webhook")` 得到签名密钥，再按同一 `timestamp + "." + rawBody` 算法签名。时间窗口 5 分钟；相同事件 ID／内容去重，内容冲突返回 409，无法匹配有效租约的消息隔离。

实时事件来自 PostgreSQL 持久表，SSE 只发送资源元数据；前端按当前组织失效缓存。单次连接约 10 秒，浏览器自动携带事件游标重连。Webhook 投递状态更新也触发事件，但不再次投递 Webhook，避免循环。
