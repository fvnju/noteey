import { Skeleton } from "@heroui/react";

export function NoteSkeleton() {
  return (
    <div className="flex-1 bg-background rounded-lg overflow-hidden flex flex-col">
      <div className="shrink-0 px-[54px] pt-8 pb-4">
        <Skeleton className="h-9 w-3/4 rounded" animationType="shimmer" />
        <div className="mt-3 flex min-h-8 items-center gap-2">
          <Skeleton
            className="h-8 w-1/3 rounded-full"
            animationType="shimmer"
          />
          <Skeleton className="h-8 w-24 rounded-full" animationType="shimmer" />
        </div>
      </div>
      <div className="flex-1 min-h-[calc(70dvh)] flex flex-col bg-surface rounded-xl px-[54px] pt-6 space-y-4">
        <Skeleton className="h-4 w-full rounded" animationType="shimmer" />
        <Skeleton className="h-4 w-full rounded" animationType="shimmer" />
        <Skeleton className="h-4 w-2/3 rounded" animationType="shimmer" />
        <Skeleton className="h-4 w-5/6 rounded" animationType="shimmer" />
        <Skeleton className="h-4 w-1/2 rounded" animationType="shimmer" />
        <Skeleton className="h-4 w-3/4 rounded" animationType="shimmer" />
      </div>
    </div>
  );
}
