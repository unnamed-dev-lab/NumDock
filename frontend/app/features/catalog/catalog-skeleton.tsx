import { Skeleton } from "@/components/ui/skeleton";

export function CatalogSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-md border border-border"
      >
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <Skeleton className="h-3.5 w-28 motion-reduce:animate-none" />
          <Skeleton className="ml-auto h-3.5 w-16 motion-reduce:animate-none" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[1.4fr_0.8fr_1fr_0.8fr]"
          >
            <Skeleton className="h-4 w-32 max-w-full motion-reduce:animate-none" />
            <Skeleton className="h-4 w-20 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-24 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-16 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
