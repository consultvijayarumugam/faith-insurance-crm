import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full rounded-xl" />
      <SkeletonTable rows={8} />
    </div>
  );
}
