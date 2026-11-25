"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Tarjeta del pie de la barra lateral (en el bloque: "latest change").
export function LatestChange({
	eyebrow,
	title,
	description,
	onClick,
	tone = "default",
}: {
	eyebrow?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	onClick?: () => void;
	tone?: "default" | "warn";
}) {
	const Comp = onClick ? "button" : "div";
	return (
		<Comp
			className={cn(
				"w-full rounded-lg border bg-background px-3 py-2.5 text-left",
				onClick && "transition-colors hover:border-ring",
				tone === "warn" && "border-[#F2D9B0] bg-[#FFF8EC] text-[#7A4A06]"
			)}
			onClick={onClick}
			type={onClick ? "button" : undefined}
		>
			{eyebrow && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{eyebrow}</p>}
			<p className="mt-1 flex items-center gap-2 font-medium text-xs">{title}</p>
			{description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
		</Comp>
	);
}
