"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function InfoTooltip({
  label,
  title,
  body,
  children,
  className,
}: {
  label: string;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex size-5 items-center justify-center rounded-full text-text-mute hover:bg-hover hover:text-focus",
              className,
            )}
          >
            <Info className="size-3.5" />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <p className="mb-1 font-bold text-text">{title}</p>
        <p>{body}</p>
      </TooltipContent>
    </Tooltip>
  );
}
