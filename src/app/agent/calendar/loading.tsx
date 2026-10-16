import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-[500px] w-full rounded-2xl" />
    </div>
  );
}
