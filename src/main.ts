
import { Plugin } from "obsidian";

import { registerCommands } from "./core/commands";

export default class TaskSorterPlugin extends Plugin {
	override async onload(): Promise<void> {
		registerCommands(this);
	}

	override onunload(): void {
		// Obsidian unregisters commands added through the plugin API.
	}
}
