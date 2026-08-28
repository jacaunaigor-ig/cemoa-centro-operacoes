import { Suspense } from "react";
import { HydrologyWorkbench } from "@/components/hydrology/HydrologyWorkbench";
import { Skeleton } from "@/components/ui/skeleton";

export default function BoletimPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-[70vh]" />}>
      <HydrologyWorkbench />
    </Suspense>
  );
}
