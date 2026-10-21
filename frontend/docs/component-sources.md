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
