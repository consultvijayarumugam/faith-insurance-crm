import { Skeleton, SkeletonStatRow, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-4 w-28" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <SkeletonStatRow count={3} />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4">
          <SkeletonTable rows={6} />
        </div>
      </div>
    </div>
  );
}
