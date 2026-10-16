import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-4 w-28" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}
