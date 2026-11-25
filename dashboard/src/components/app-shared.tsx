import type { ReactNode } from "react";

export type SidebarNavItem = {
	to: string;
	title: string;
	icon?: ReactNode;
	badge?: ReactNode;
	end?: boolean;
	/** Otras rutas que también lo marcan como activo. */
	match?: string[];
};

export type SidebarNavGroup = {
	label: string;
	items: SidebarNavItem[];
	collapsible?: boolean;
};

export type Crumb = { label: ReactNode; to?: string };
