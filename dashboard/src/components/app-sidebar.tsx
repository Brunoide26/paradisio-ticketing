"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { AppSearch } from "@/components/app-search";
import type { SidebarNavGroup } from "@/components/app-shared";
import { CustomTrigger } from "@/components/custom-trigger";

export function GroupLogo({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"flex size-8 shrink-0 items-center justify-center rounded-md bg-[#0B0B0B] px-[3px]",
				className
			)}
		>
			<img alt="" className="w-full" src="/administracion/logos/paradisio-orange.png" />
		</span>
	);
}

export function AppSidebar({
	page,
	navGroups,
	onNavigate,
	onSearch,
	note,
}: {
	page: string;
	navGroups: SidebarNavGroup[];
	onNavigate: (id: string) => void;
	onSearch: () => void;
	note?: ReactNode;
}) {
	const { isMobile, setOpenMobile } = useSidebar();
	const go = (id: string) => {
		onNavigate(id);
		if (isMobile) setOpenMobile(false);
	};

	return (
		<Sidebar
			className={cn(
				"*:data-[slot=sidebar-inner]:bg-sidebar",
				"transition-[left,right,top,width] group-data-[collapsible=offcanvas]:top-[calc(var(--app-header-height)*0.5)]"
			)}
			collapsible="offcanvas"
			variant="sidebar"
		>
			<SidebarHeader className="h-(--app-header-height,3rem) flex-row items-center justify-between border-b">
				<button
					className="flex min-w-0 items-center gap-2.5 rounded-md px-1 py-1 text-left"
					onClick={() => go("group")}
					type="button"
				>
					<GroupLogo />
					<span className="min-w-0 leading-tight">
						<span className="block truncate font-semibold text-[13px] tracking-tight">
							Paradisio
						</span>
						<span className="block truncate text-[11px] text-muted-foreground">
							Entertainment Group
						</span>
					</span>
				</button>
				<CustomTrigger place="sidebar" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<AppSearch onOpen={onSearch} />
				</SidebarGroup>
				{navGroups.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarMenu>
							{group.items.map((item) => (
								<SidebarMenuItem key={item.id}>
									<SidebarMenuButton
										isActive={item.id === page}
										onClick={() => go(item.id)}
										tooltip={item.title}
									>
										{item.icon}
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			{note && <SidebarFooter className="gap-2 px-3 pb-3">{note}</SidebarFooter>}
			<SidebarRail />
		</Sidebar>
	);
}
