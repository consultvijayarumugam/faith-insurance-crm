import { Skeleton } from "@/components/ui/skeleton";

function SkeletonSection({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <SkeletonSection lines={4} />
      <SkeletonSection lines={2} />
      <SkeletonSection lines={1} />
      <SkeletonSection lines={2} />
      <SkeletonSection lines={2} />
      <SkeletonSection lines={3} />
    </div>
  );
}
