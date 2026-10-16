import { Skeleton, SkeletonStatRow, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-11 w-64 rounded-lg" />
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <SkeletonStatRow count={3} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <Skeleton className="h-4 w-24" />
        <div className="mt-4">
          <SkeletonTable rows={4} />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4">
          <SkeletonTable rows={6} />
        </div>
      </div>
    </div>
  );
}
