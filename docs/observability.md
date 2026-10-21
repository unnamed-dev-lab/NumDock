# 概览与 OpenTelemetry

## 两种看板的数据来源

- NumDock `/app`：组织级业务预览，由 PostgreSQL 的 `development_overview_daily` 提供。开发样本包含号码快照、消息接收／处理失败、完成订单及 USD 模拟费用，不创建真实号码、订单、消息或账本。
- Grafana：API 的真实请求次数、错误比例、p95 延迟与调用链，由 OpenTelemetry SDK 采集。开发样本不会写成运行指标。OpenTelemetry 是遥测框架，不是业务数据库（[官方 Go 文档](https://opentelemetry.io/docs/languages/go/)）。

## 查看开发概览

```powershell
./scripts/backend.ps1 migrate
./scripts/backend.ps1 seed
./scripts/backend.ps1 run
# 在另一个终端启动 frontend/pnpm dev
```

使用 `owner@numdock.test` 登录，密码见 Git 忽略的 `.local/dev-seed-password`（显式 DEV_SEED_PASSWORD 配置优先）。owner、admin、member 共用主开发组织；isolated 账号在独立组织中，样本规模不同。新注册组织显示空状态，不继承其他组织的数据。

种子数据给两个开发组织各补最近 30 个 UTC 自然日，重复执行只补缺失记录、不覆盖已修改数据。概览支持最近 7／30 天、URL 保留周期和组织选择、刷新、明细表以及中英文／深浅主题。号码为最近记录快照，其余指标按所选日期求和。缺失日期补零。统计范围不包含未来日期。

`GET /v1/organizations/{organization_id}/overview?days=30` 需要会话和该组织成员关系。跨组织与不存在的组织同样返回 404。`mode=mock` 表示样本、`empty` 表示周期内无样本、`disabled` 表示非开发模式。生产模式不读取模拟业务记录。OpenAPI 为契约事实来源。

当前开发入口均应连接最新后端；常规启动默认 API 8080，前端 3000（占用时会顺延）。历史 3010／3011 前端预览入口转到当前统一的 3001 开发实例，后端统一使用 8080；多余的 8081／8082 进程已关闭。不要仅热更新前端而保留旧 Go 进程，否则新增接口会返回 404。

## 启用遥测导出

开发模式默认启用 SDK；生产默认关闭，可显式设置 `OTEL_ENABLED=true`。未设置导出端点时不向外发送数据，页面只显示埋点已启用／导出未配置。页面的导出状态只代表配置，不代表采集器可达。

在 `.env` 或脚本读取的环境文件中配置：

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=numdock-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

重启 API 后生效。仅支持通用 base endpoint 的 OTLP HTTP/protobuf 导出，分别追加 `/v1/traces` 和 `/v1/metrics`；不支持 per-signal 端点或 gRPC。服务认证可用标准 `OTEL_EXPORTER_OTLP_HEADERS`，不要提交该值。SDK 每 10 秒导出指标，调用链批量导出，退出时有限时 flush。

### 本地 Grafana

独立 Compose 文件不启动或修改业务数据库：

```powershell
docker compose -f compose.observability.yaml up -d
```

打开 `http://localhost:4300`，内置 NumDock API 看板随容器通过文件 provisioning 加载。服务名默认 `numdock-api`，Prometheus 数据源可在看板顶部选择。图表只有收到真实请求后才会出现数据；rate 和 p95 需要多个采集点，可浏览页面、登录、刷新目录后等待 30–60 秒。调用链在 Grafana Explore 的 Tempo 数据源中按 `service.name` 或日志里的 Trace ID 查找。

使用 [Grafana 官方开发用 LGTM 镜像](https://grafana.com/docs/opentelemetry/docker-lgtm/)，版本固定 0.37.0。Compose 仅绑定 loopback，数据保存在独立卷。此配置用于本地开发，不是生产监控部署。

## 已采集的信号与边界

- `numdock.http.server.requests`：按 HTTP 方法、Chi 路由模板、响应状态计数。
- `http.server.request.duration`：秒为单位的直方图，包含延迟分桶。
- HTTP server span：W3C traceparent 传播、Request ID、状态、模板化路由；不传播 baggage。
- 响应 `X-Trace-ID` 与结构化请求日志 `trace_id` 支持关联排查。
- 当前只覆盖 Go HTTP 层；未添加浏览器遥测、SQL 参数／数据库自动 tracing、日志 OTLP 导出或业务指标导出。现有 slog 仍写控制台。
- 上述 traces／metrics 不记录请求正文、Cookie、Authorization、查询字符串、邮箱、手机号或组织 ID。指标标签采用固定低基数路由模板，不使用完整 URL。既有控制台请求日志仍保留请求路径，用于本地排查；不包含正文或查询字符串。导出失败只输出安全通用警告，不将 SDK 原始错误或配置凭据写入日志。

## 验证范围

Go 测试覆盖内存指标与调用链、OTLP HTTP traces/metrics 接收、敏感数据不进入遥测，以及真实 PostgreSQL 的组织授权、汇总、缺失日期、种子数据幂等和生产隐藏策略。浏览器测试覆盖样本、周期切换、刷新持久化、中英文、移动端、主题、错误重试及新组织空状态。

Compose 可执行配置检查：`docker compose -f compose.observability.yaml config --quiet`。本机当前 Docker daemon 不可用，尚未实际启动 LGTM 镜像，因此 Grafana provisioning、Prometheus 转译名称和 Tempo UI 需要在可用 Docker 环境中做容器联调；不将接收器测试视为 Grafana 已运行。

当前工作区另显示来自业务表的有效租约、未读消息、已完成订单与钱包余额；这些数值会随 Mock 操作实时更新。下方历史演示趋势来自独立的开发样本表，二者分别标注，不参与资金结算。
