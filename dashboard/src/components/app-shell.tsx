import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import type { SidebarNavGroup } from "@/components/app-shared";

export function AppShell({
	children,
	page,
	title,
	navGroups,
	onNavigate,
	onSearch,
	headerActions,
	user,
	sidebarNote,
}: {
	children: ReactNode;
	page: string;
	title: ReactNode;
	navGroups: SidebarNavGroup[];
	onNavigate: (id: string) => void;
	onSearch: () => void;
	headerActions?: ReactNode;
	user?: ReactNode;
	sidebarNote?: ReactNode;
}) {
	return (
		<SidebarProvider
			className={cn(
				"[--app-wrapper-max-width:80rem]",
				"[--app-header-height:3.25rem]"
			)}
		>
			<AppSidebar
				navGroups={navGroups}
				note={sidebarNote}
				onNavigate={onNavigate}
				onSearch={onSearch}
				page={page}
			/>
			<SidebarInset className="bg-muted">
				<AppHeader actions={headerActions} title={title} user={user} />
				<div
					className={cn(
						"flex flex-1 flex-col p-4 md:p-6",
						"w-full max-w-(--app-wrapper-max-width)"
					)}
				>
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
