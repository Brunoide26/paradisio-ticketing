"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DownloadIcon, LogOutIcon, RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";

export function NavUser({
	onExport,
	onRefresh,
	onEdit,
	onLogout,
	staff,
}: {
	onExport: () => void;
	onRefresh: () => void;
	onEdit: () => void;
	onLogout: () => void;
	staff?: boolean;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button aria-label="Cuenta" className="rounded-full" type="button">
					<Avatar className="size-8">
						<AvatarFallback className="bg-[#0B0B0B] font-medium text-[11px] text-white">
							CEO
						</AvatarFallback>
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="pointer-events-none">
						<span className="font-medium text-foreground">Acceso dirección</span>
						<div className="text-muted-foreground text-xs">
							{staff ? "Con clave del staff" : "Paradisio Entertainment Group"}
						</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onSelect={onExport}>
						<DownloadIcon />
						Exportar CSV
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onRefresh}>
						<RefreshCwIcon />
						Actualizar datos
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onEdit}>
						<SlidersHorizontalIcon />
						Editar datos
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onLogout} variant="destructive">
					<LogOutIcon />
					Salir
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
