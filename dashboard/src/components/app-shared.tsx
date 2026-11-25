import type { ReactNode } from "react";

export type SidebarNavItem = {
	id: string;
	title: string;
	icon?: ReactNode;
};

export type SidebarNavGroup = {
	label: string;
	items: SidebarNavItem[];
};
