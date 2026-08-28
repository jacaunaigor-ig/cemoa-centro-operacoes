import { Suspense } from "react";
import { AlertsWorkbench } from "@/components/alerts/AlertsWorkbench";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <AlertsWorkbench />
    </Suspense>
  );
}

function PageFallback() {
  return (
    <div className="flex min-h-dvh flex-col gap-3 p-4">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="min-h-0 flex-1" />
    </div>
  );
}
