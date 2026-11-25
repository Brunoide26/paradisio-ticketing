import type { ReactNode } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { CustomTrigger } from "@/components/custom-trigger";

export function AppHeader({
	title,
	actions,
	user,
}: {
	title: ReactNode;
	actions?: ReactNode;
	user?: ReactNode;
}) {
	return (
		<header className="sticky top-0 z-30 flex h-(--app-header-height) w-full shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
			<CustomTrigger place="navbar" />
			<Breadcrumb className="min-w-0 flex-1">
				<BreadcrumbList className="flex-nowrap">
					<BreadcrumbItem className="hidden md:inline-flex">
						Paradisio Entertainment Group
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem className="min-w-0">
						<BreadcrumbPage className="truncate font-medium">{title}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="flex shrink-0 items-center gap-3">
				{actions}
				{user && (
					<>
						<Separator
							className="h-4 data-[orientation=vertical]:self-center"
							orientation="vertical"
						/>
						{user}
					</>
				)}
			</div>
		</header>
	);
}
