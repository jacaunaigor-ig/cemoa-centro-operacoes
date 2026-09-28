import { Suspense } from "react";
import { MeteorologiaWorkbench } from "@/components/meteorologia/MeteorologiaWorkbench";
import { Skeleton } from "@/components/ui/skeleton";

export default function MeteorologiaPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-[70vh]" />}>
      <MeteorologiaWorkbench />
    </Suspense>
  );
}
