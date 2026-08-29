import { cn } from "@/lib/utils";

/** Marca compacta do CEMADEN: pluviômetro + pulso de monitoramento. */
export function CemadenIcon({
  className,
  title = "CEMADEN",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M12 3.2c-2.6 3.4-5.4 6.2-5.4 9.1a5.4 5.4 0 0 0 10.8 0c0-2.9-2.8-5.7-5.4-9.1Z"
        className="fill-focus/15 stroke-current"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.2v5.6"
        className="stroke-current"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.6 11.6h4.8"
        className="stroke-current"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.6" r="1.15" className="fill-current" />
      <path
        d="M6.2 8.4a8 8 0 0 0 0 7.2M17.8 8.4a8 8 0 0 1 0 7.2"
        className="stroke-current"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
