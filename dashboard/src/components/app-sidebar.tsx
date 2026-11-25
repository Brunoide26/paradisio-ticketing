"use client";

import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AppSearch } from "@/components/app-search";
import type { SidebarNavGroup, SidebarNavItem } from "@/components/app-shared";

export function GroupLogo({ className }: { className?: string }) {
	return (
		<span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md bg-[#0B0B0B] px-[3px]", className)}>
			<img alt="" className="w-full" src="/administracion/logos/paradisio-orange.png" />
		</span>
	);
}

function isActive(item: SidebarNavItem, pathname: string) {
	const paths = [item.to, ...(item.match || [])];
	return paths.some((p) => (item.end || p === "/" ? pathname === p : pathname === p || pathname.startsWith(p + "/")));
}

function NavItems({ items }: { items: SidebarNavItem[] }) {
	const { pathname } = useLocation();
	const { isMobile, setOpenMobile } = useSidebar();
	return (
		<SidebarMenu>
			{items.map((item) => (
				<SidebarMenuItem key={item.to + item.title}>
					<SidebarMenuButton asChild isActive={isActive(item, pathname)} size="sm" tooltip={item.title} className="h-8 text-[13px]">
						<NavLink onClick={() => isMobile && setOpenMobile(false)} to={item.to}>
							{item.icon}
							<span>{item.title}</span>
						</NavLink>
					</SidebarMenuButton>
					{item.badge != null && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
				</SidebarMenuItem>
			))}
		</SidebarMenu>
	);
}

export function AppSidebar({
	navGroups,
	onSearch,
	switcher,
	note,
	footer,
}: {
	navGroups: SidebarNavGroup[];
	onSearch: () => void;
	switcher: ReactNode;
	note?: ReactNode;
	footer?: ReactNode;
}) {
	return (
		<Sidebar collapsible="icon" variant="sidebar" className="*:data-[slot=sidebar-inner]:bg-sidebar">
			<SidebarHeader className="gap-2 border-b p-2">
				{switcher}
				<div className="group-data-[collapsible=icon]:hidden">
					<AppSearch onOpen={onSearch} />
				</div>
			</SidebarHeader>
			<SidebarContent className="gap-0 py-1">
				{navGroups.map((group) =>
					group.collapsible ? (
						<Collapsible className="group/collapsible" defaultOpen key={group.label}>
							<SidebarGroup className="py-1">
								<SidebarGroupLabel asChild className="text-[11px] uppercase tracking-wide">
									<CollapsibleTrigger>
										{group.label}
										<ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
									</CollapsibleTrigger>
								</SidebarGroupLabel>
								<CollapsibleContent>
									<SidebarGroupContent>
										<NavItems items={group.items} />
									</SidebarGroupContent>
								</CollapsibleContent>
							</SidebarGroup>
						</Collapsible>
					) : (
						<SidebarGroup className="py-1" key={group.label}>
							<SidebarGroupLabel className="text-[11px] uppercase tracking-wide">{group.label}</SidebarGroupLabel>
							<SidebarGroupContent>
								<NavItems items={group.items} />
							</SidebarGroupContent>
						</SidebarGroup>
					)
				)}
			</SidebarContent>
			{(note || footer) && (
				<SidebarFooter className="gap-2 border-t p-2">
					<div className="flex flex-col gap-2 group-data-[collapsible=icon]:hidden">{note}</div>
					{footer}
				</SidebarFooter>
			)}
			<SidebarRail />
		</Sidebar>
	);
}
