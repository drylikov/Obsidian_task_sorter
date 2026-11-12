
import { describe, expect, it, vi } from "vitest";

import { sortTasksInActiveNote } from "../core/sort-current-note";
import { sortTaskBlocksInMarkdown } from "../lib/task-sorter";

describe("sortTaskBlocksInMarkdown", () => {
	it("keeps undated tasks above future-start tasks with the same priority", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-09T12:00:00Z"));

		const input = [
			"- [ ] future 🛫 2026-04-10",
			"- [ ] undated",
			"- [ ] today 🛫 2026-04-09",
		].join("\n");

		const result = sortTaskBlocksInMarkdown(input);

		expect(result.content).toBe(
			[
				"- [ ] today 🛫 2026-04-09",
				"- [ ] undated",
				"- [ ] future 🛫 2026-04-10",
			].join("\n"),
		);

		vi.useRealTimers();
	});

	it("sorts by completion, priority, and start date while keeping equal tasks stable", () => {
		const input = [
			"- [ ] Zebra",
			"- [ ] Alpha",
			"- [ ] Later ⏫ 🛫 2026-04-15",
			"- [ ] Sooner ⏫ 🛫 2026-04-10",
			"- [x] Done 🔺",
		].join("\n");

		const result = sortTaskBlocksInMarkdown(input);

		expect(result.changed).toBe(true);
		expect(result.changedBlocks).toBe(1);
		expect(result.content).toBe(
			[
				"- [ ] Sooner ⏫ 🛫 2026-04-10",
				"- [ ] Later ⏫ 🛫 2026-04-15",
				"- [ ] Zebra",
				"- [ ] Alpha",
				"- [x] Done 🔺",
			].join("\n"),
		);
	});

	it("keeps plain bullets fixed while reordering task siblings around them", () => {
		const input = [
			"- [ ] Medium 🔼",
			"- Notes anchor",
			"- [ ] Highest 🔺",
			"- [ ] Lowest 🔽",
		].join("\n");

		const result = sortTaskBlocksInMarkdown(input);

		expect(result.content).toBe(
			[
				"- [ ] Highest 🔺",
				"- Notes anchor",
				"- [ ] Medium 🔼",
				"- [ ] Lowest 🔽",
			].join("\n"),
		);
	});

	it("moves parent tasks with their subtrees and sorts nested task groups", () => {
		const input = [
			"- [ ] Medium parent 🔼",
			"    - [ ] child low 🔽",
			"    - [ ] child high 🔺",
			"- [ ] High parent 🔺",
			"    - [ ] child medium 🔼",
			"    continuation line",
		].join("\n");

		const result = sortTaskBlocksInMarkdown(input);

		expect(result.content).toBe(
			[
				"- [ ] High parent 🔺",
				"    - [ ] child medium 🔼",
				"    continuation line",
				"- [ ] Medium parent 🔼",
				"    - [ ] child high 🔺",
				"    - [ ] child low 🔽",
			].join("\n"),
		);
	});

	it("leaves unchanged content untouched when no reorder is needed", () => {
		const input = [
			"# Heading",
			"",
			"- [ ] Highest 🔺",
			"- [ ] Next 🔼",
			"- [x] Done",
			"",
			"Paragraph.",
		].join("\n");

		const result = sortTaskBlocksInMarkdown(input);

		expect(result.changed).toBe(false);
		expect(result.changedBlocks).toBe(0);
		expect(result.content).toBe(input);
	});

	it("does not pull blank separators between list blocks into the preceding block", () => {
		const input = [
			"## Block 1",
			"- [ ] low 🔽",
			"- [ ] high 🔺",
			"",
			"",
			"## Block 2",
			"- [ ] medium 🔼",
			"- [ ] low 🔽",
		].join("\n");

		const result = sortTaskBlocksInMarkdown(input);

		expect(result.content).toBe(
			[
				"## Block 1",
				"- [ ] high 🔺",
				"- [ ] low 🔽",
				"",
				"",
				"## Block 2",
				"- [ ] medium 🔼",
				"- [ ] low 🔽",
			].join("\n"),
		);
	});
});

describe("sortTasksInActiveNote", () => {
	it("returns missing-file when there is no active markdown file", async () => {
		const result = await sortTasksInActiveNote({
			workspace: {
				activeEditor: null,
				getActiveFile: () => null,
			},
			vault: {
				modify: vi.fn(),
				read: vi.fn(),
			},
		});

		expect(result).toEqual({ status: "missing-file" });
	});

	it("updates the active editor buffer when sorting changes are needed", async () => {
		const editor = {
			getValue: vi
				.fn()
				.mockReturnValue("- [ ] low 🔽\n- [ ] high 🔺"),
			setValue: vi.fn(),
		};

		const result = await sortTasksInActiveNote({
			workspace: {
				activeEditor: { editor },
				getActiveFile: () => ({
					basename: "Tasks",
					extension: "md",
					path: "Tasks.md",
				}),
			},
			vault: {
				modify: vi.fn(),
				read: vi.fn(),
			},
		});

		expect(result).toEqual({ status: "updated", changedBlocks: 1 });
		expect(editor.setValue).toHaveBeenCalledWith("- [ ] high 🔺\n- [ ] low 🔽");
	});

	it("reports no-change without writing when sorting is already correct", async () => {
		const read = vi.fn().mockResolvedValue("- [ ] high 🔺\n- [ ] low 🔽");
		const modify = vi.fn();

		const result = await sortTasksInActiveNote({
			workspace: {
				activeEditor: null,
				getActiveFile: () => ({
					basename: "Tasks",
					extension: "md",
					path: "Tasks.md",
				}),
			},
			vault: {
				modify,
				read,
			},
		});

		expect(result).toEqual({ status: "no-change" });
		expect(read).toHaveBeenCalledTimes(1);
		expect(modify).not.toHaveBeenCalled();
	});
});
