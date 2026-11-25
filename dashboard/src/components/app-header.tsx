import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Crumb } from "@/components/app-shared";

export function AppHeader({ crumbs, actions, user }: { crumbs: Crumb[]; actions?: ReactNode; user?: ReactNode }) {
	return (
		<header className="sticky top-0 z-30 flex h-(--app-header-height) w-full shrink-0 items-center gap-2 border-b bg-background px-3 md:px-4">
			<SidebarTrigger className="-ml-1 text-muted-foreground" />
			<Separator className="mr-1 h-4 data-[orientation=vertical]:self-center" orientation="vertical" />
			<Breadcrumb className="min-w-0 flex-1">
				<BreadcrumbList className="flex-nowrap text-[13px]">
					{crumbs.map((c, i) => {
						const last = i === crumbs.length - 1;
						return (
							<Fragment key={i}>
								{i > 0 && <BreadcrumbSeparator className={i < crumbs.length - 1 ? "hidden md:block" : ""} />}
								<BreadcrumbItem className={cn2(!last && "hidden md:inline-flex", "min-w-0")}>
									{last || !c.to ? (
										<BreadcrumbPage className="truncate font-medium">{c.label}</BreadcrumbPage>
									) : (
										<BreadcrumbLink asChild>
											<Link to={c.to}>{c.label}</Link>
										</BreadcrumbLink>
									)}
								</BreadcrumbItem>
							</Fragment>
						);
					})}
				</BreadcrumbList>
			</Breadcrumb>
			<div className="flex shrink-0 items-center gap-1.5 md:gap-2">
				{actions}
				{user && (
					<>
						<Separator className="mx-1 h-4 data-[orientation=vertical]:self-center" orientation="vertical" />
						{user}
					</>
				)}
			</div>
		</header>
	);
}

const cn2 = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
