import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TanStack declaration merging requires these type parameters.
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    align?: "left" | "right";
  }
}
