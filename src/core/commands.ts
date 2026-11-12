
import type { Plugin } from "obsidian";
import { Notice } from "obsidian";

import {
	sortTasksInActiveNote,
	type SortTasksResult,
} from "./sort-current-note";

export function registerCommands(plugin: Plugin): void {
	plugin.addCommand({
		id: "sort-tasks-in-current-note",
		name: "Sort Tasks in Current Note",
		callback: async () => {
			try {
				const result = await sortTasksInActiveNote(plugin.app);
				showNotice(result);
			} catch (error) {
				console.error("Task Sorter: failed to sort tasks.", error);
				new Notice("Task Sorter: failed to sort tasks.");
			}
		},
	});
}

function showNotice(result: SortTasksResult): void {
	switch (result.status) {
		case "missing-file":
			new Notice("Task Sorter: open a Markdown note to sort tasks.");
			return;
		case "no-change":
			new Notice("Task Sorter: no task reordering needed.");
			return;
		case "updated":
			new Notice(`Task Sorter: sorted ${result.changedBlocks} list block${result.changedBlocks === 1 ? "" : "s"}.`);
	}
}
