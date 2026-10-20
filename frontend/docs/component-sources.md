# Component sources and selection

This project follows **beUI > Magic UI > shadcn/ui**. shadcn components use **Base UI**. All library source below was installed by the official shadcn CLI, then customized; MCP source was inspected only and was never written into the application.

## Actual installation

On 2026-10-20, shadcn CLI **4.22.1** was run through Bun; the CLI used the existing pnpm project for dependency resolution. The pnpm lockfile remains the only project lockfile.

```powershell
bunx --bun shadcn@4.22.1 add @beui/input @beui/theme-toggle @beui/animated-sidebar --yes --overwrite
bunx --bun shadcn@4.22.1 add @beui/button-base dropdown-menu table --yes --overwrite
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
