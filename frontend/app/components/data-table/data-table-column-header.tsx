import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <div className={cn("text-xs font-medium text-muted-foreground", className)}>
        {title}
      </div>
    );
  }

  const isSorted = column.getIsSorted();

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=open]:bg-muted"
        onClick={() => column.toggleSorting(isSorted === "asc")}
      >
        <span>{title}</span>
        {isSorted === "desc" ? (
          <ArrowDown className="ml-1.5 size-3.5" aria-hidden="true" />
        ) : isSorted === "asc" ? (
          <ArrowUp className="ml-1.5 size-3.5" aria-hidden="true" />
        ) : (
          <ArrowUpDown className="ml-1.5 size-3.5 opacity-50" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}

