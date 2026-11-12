
import { sortTaskBlocksInMarkdown } from "../lib/task-sorter";

export interface MarkdownFileLike {
	extension: string;
}

export interface EditorLike {
	getValue(): string;
	setValue(content: string): void;
}

export interface SortTasksApp {
	workspace: {
		activeEditor: { editor?: EditorLike } | null;
		getActiveFile(): MarkdownFileLike | null;
	};
	vault: {
		modify(file: MarkdownFileLike, content: string): Promise<void>;
		read(file: MarkdownFileLike): Promise<string>;
	};
}

export type SortTasksResult =
	| { status: "missing-file" }
	| { status: "no-change" }
	| { status: "updated"; changedBlocks: number };

export async function sortTasksInActiveNote(app: SortTasksApp): Promise<SortTasksResult> {
	const file = app.workspace.getActiveFile();
	if (!file || file.extension !== "md") {
		return { status: "missing-file" };
	}

	const editor = app.workspace.activeEditor?.editor ?? null;
	const original = editor ? editor.getValue() : await app.vault.read(file);
	const sorted = sortTaskBlocksInMarkdown(original);

	if (!sorted.changed) {
		return { status: "no-change" };
	}

	if (editor) {
		editor.setValue(sorted.content);
	} else {
		await app.vault.modify(file, sorted.content);
	}

	return { status: "updated", changedBlocks: sorted.changedBlocks };
}
