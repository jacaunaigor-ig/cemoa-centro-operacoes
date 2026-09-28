import { Suspense } from "react";
import { RiscoWorkbench } from "@/components/risco/RiscoWorkbench";
import { Skeleton } from "@/components/ui/skeleton";

export default function RiscoPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-[70vh]" />}>
      <RiscoWorkbench />
    </Suspense>
  );
}
