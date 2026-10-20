# Third-party UI source

`app/components/motion/` contains components installed from the official [beUI registry](https://beui.dev/), using shadcn CLI 4.22.1. They provide the buttons, inputs, theme transition and responsive sidebar. beUI is MIT licensed; the notice is in `licenses/beui.txt`.

`app/components/ui/{dropdown-menu,table}.tsx` was installed from the official [shadcn/ui registry](https://ui.shadcn.com/), using CLI 4.22.1 and the `base-vega` style. The dropdown uses Base UI. The old Radix components and dependency have been removed.

Application adaptations and exact installation commands are recorded in [docs/component-sources.md](docs/component-sources.md) and `component-sources.json`.

The interactive API reference at `/docs/api` uses `@scalar/api-reference-react` 0.9.81 (MIT). It is a specialized OpenAPI renderer loaded client-only, themed with project CSS variables, and wrapped with same-origin cookie/CSRF handling.

shadcn/ui is distributed under the [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md). See the accompanying `licenses/shadcn-ui.txt` for the upstream license notice. Other installed dependencies retain their licenses within their packages.
