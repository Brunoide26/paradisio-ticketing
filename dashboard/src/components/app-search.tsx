"use client";

import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SearchIcon } from "lucide-react";

// Abre la paleta de comandos (el atajo ⌘K / Ctrl+K se registra en App).
export function AppSearch({ onOpen }: { onOpen: () => void }) {
	return (
		<InputGroup className="cursor-pointer bg-background" onClick={onOpen}>
			<InputGroupAddon align="inline-start" className="pl-1.75">
				<SearchIcon />
			</InputGroupAddon>
			<InputGroupInput
				aria-label="Buscar"
				className="cursor-pointer"
				onFocus={(e) => {
					e.currentTarget.blur();
					onOpen();
				}}
				placeholder="Buscar…"
				readOnly
				type="search"
			/>
			<InputGroupAddon align="inline-end">
				<KbdGroup>
					<Kbd>⌘</Kbd>
					<Kbd>K</Kbd>
				</KbdGroup>
			</InputGroupAddon>
		</InputGroup>
	);
}
