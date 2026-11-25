import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import type { Crumb, SidebarNavGroup } from "@/components/app-shared";

export function AppShell({
	children,
	crumbs,
	navGroups,
	switcher,
	onSearch,
	headerActions,
	user,
	sidebarNote,
	sidebarFooter,
}: {
	children: ReactNode;
	crumbs: Crumb[];
	navGroups: SidebarNavGroup[];
	switcher: ReactNode;
	onSearch: () => void;
	headerActions?: ReactNode;
	user?: ReactNode;
	sidebarNote?: ReactNode;
	sidebarFooter?: ReactNode;
}) {
	return (
		<SidebarProvider className="[--app-header-height:3rem]">
			<AppSidebar footer={sidebarFooter} navGroups={navGroups} note={sidebarNote} onSearch={onSearch} switcher={switcher} />
			<SidebarInset className="min-w-0 bg-muted">
				<AppHeader actions={headerActions} crumbs={crumbs} user={user} />
				{/* Ancho completo: la rejilla de 12 columnas usa todo el viewport. */}
				<div className={cn("flex w-full min-w-0 flex-1 flex-col p-3 md:p-4 2xl:px-6")}>{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
