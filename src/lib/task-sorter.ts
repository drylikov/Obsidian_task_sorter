
const TASK_LINE_REGEX = /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/;
const LIST_ITEM_REGEX = /^(\s*)([-*+])\s+(.*)$/;
const START_DATE_REGEX = /🛫\s*(\d{4}-\d{2}-\d{2})/;

interface SortResult {
	changed: boolean;
	changedBlocks: number;
	content: string;
}

interface ListNode {
	indent: number;
	line: string;
	originalOrder: number;
	tail: NodeSegment[];
	type: "plain" | "task";
}

type NodeSegment =
	| { type: "children"; items: ListNode[] }
	| { type: "line"; line: string };

interface TaskMetadata {
	checked: boolean;
	priority: number;
	startDate: string | null;
}

interface ParseState {
	nextOrder: number;
}

export function sortTaskBlocksInMarkdown(markdown: string): SortResult {
	const hasTrailingNewline = markdown.endsWith("\n");
	const lines = markdown.length === 0 ? [] : markdown.split("\n");
	const blocks = extractListBlocks(lines);

	if (blocks.length === 0) {
		return { changed: false, changedBlocks: 0, content: markdown };
	}

	const output = [...lines];
	let changedBlocks = 0;

	for (let index = blocks.length - 1; index >= 0; index -= 1) {
		const block = blocks[index];
		const sortedLines = sortBlock(block.lines);
		if (joinLines(sortedLines) === joinLines(block.lines)) {
			continue;
		}

		output.splice(block.start, block.end - block.start + 1, ...sortedLines);
		changedBlocks += 1;
	}

	const content = output.length === 0 ? "" : output.join("\n");
	return {
		changed: changedBlocks > 0,
		changedBlocks,
		content: hasTrailingNewline && content.length > 0 ? `${content}\n` : content,
	};
}

function sortBlock(blockLines: string[]): string[] {
	if (blockLines.length === 0 || !containsTask(blockLines)) {
		return blockLines;
	}

	const rootIndent = getIndent(blockLines[0]);
	const state: ParseState = { nextOrder: 0 };
	const parsed = parseItems(blockLines, 0, rootIndent, state);
	if (parsed.nextIndex !== blockLines.length) {
		return blockLines;
	}

	const sortedItems = sortItems(parsed.items);
	const flattened = flattenItems(sortedItems);
	return flattened.length === blockLines.length ? flattened : blockLines;
}

function sortItems(items: ListNode[]): ListNode[] {
	const processed = items.map((item) => ({
		...item,
		tail: item.tail.map((segment) =>
			segment.type === "children"
				? { type: "children" as const, items: sortItems(segment.items) }
				: segment,
		),
	}));

	const sortedTasks = processed
		.filter((item) => item.type === "task")
		.slice()
		.sort(compareTaskNodes);

	let taskIndex = 0;
	return processed.map((item) =>
		item.type === "task" ? sortedTasks[taskIndex++] : item,
	);
}

function compareTaskNodes(left: ListNode, right: ListNode): number {
	const leftTask = analyzeTask(left.line);
	const rightTask = analyzeTask(right.line);

	if (leftTask.checked !== rightTask.checked) {
		return Number(leftTask.checked) - Number(rightTask.checked);
	}

	if (leftTask.priority !== rightTask.priority) {
		return rightTask.priority - leftTask.priority;
	}

	const startDateOrder = compareStartDates(leftTask.startDate, rightTask.startDate);
	if (startDateOrder !== 0) {
		return startDateOrder;
	}

	return left.originalOrder - right.originalOrder;
}

function compareStartDates(left: string | null, right: string | null): number {
	const leftCategory = getStartDateCategory(left);
	const rightCategory = getStartDateCategory(right);

	if (leftCategory !== rightCategory) {
		return leftCategory - rightCategory;
	}

	if (left === right) {
		return 0;
	}

	if (left === null) {
		return 0;
	}

	if (right === null) {
		return 0;
	}

	return left.localeCompare(right);
}

function parseItems(
	blockLines: string[],
	startIndex: number,
	levelIndent: number,
	state: ParseState,
): { items: ListNode[]; nextIndex: number } {
	const items: ListNode[] = [];
	let index = startIndex;

	while (index < blockLines.length) {
		const line = blockLines[index];
		if (!isListItemLine(line)) {
			break;
		}

		const indent = getIndent(line);
		if (indent < levelIndent || indent > levelIndent) {
			break;
		}

		const node: ListNode = {
			indent,
			line,
			originalOrder: state.nextOrder,
			tail: [],
			type: isTaskLine(line) ? "task" : "plain",
		};
		state.nextOrder += 1;
		index += 1;

		while (index < blockLines.length) {
			const nextLine = blockLines[index];
			if (isListItemLine(nextLine)) {
				const nextIndent = getIndent(nextLine);
				if (nextIndent <= levelIndent) {
					break;
				}

				const childItems = parseItems(blockLines, index, nextIndent, state);
				node.tail.push({ type: "children", items: childItems.items });
				index = childItems.nextIndex;
				continue;
			}

			if (isBlankLine(nextLine) || getIndent(nextLine) > levelIndent) {
				node.tail.push({ type: "line", line: nextLine });
				index += 1;
				continue;
			}

			break;
		}

		items.push(node);
	}

	return { items, nextIndex: index };
}

function flattenItems(items: ListNode[]): string[] {
	const output: string[] = [];

	for (const item of items) {
		output.push(item.line);
		for (const segment of item.tail) {
			if (segment.type === "line") {
				output.push(segment.line);
				continue;
			}

			output.push(...flattenItems(segment.items));
		}
	}

	return output;
}

function extractListBlocks(lines: string[]): Array<{ end: number; lines: string[]; start: number }> {
	const blocks: Array<{ end: number; lines: string[]; start: number }> = [];
	let index = 0;

	while (index < lines.length) {
		if (!isListItemLine(lines[index])) {
			index += 1;
			continue;
		}

		const start = index;
		const baseIndent = getIndent(lines[index]);
		index += 1;

		while (index < lines.length && isBlockLine(lines[index], baseIndent)) {
			index += 1;
		}

		blocks.push({
			end: index - 1,
			lines: lines.slice(start, index),
			start,
		});
	}

	return blocks;
}

function isBlockLine(line: string, baseIndent: number): boolean {
	if (isListItemLine(line)) {
		return getIndent(line) >= baseIndent;
	}

	return getIndent(line) > baseIndent;
}

function containsTask(lines: string[]): boolean {
	return lines.some((line) => isTaskLine(line));
}

function analyzeTask(line: string): TaskMetadata {
	const match = line.match(TASK_LINE_REGEX);
	if (!match) {
		return {
			checked: false,
			priority: 2,
			startDate: null,
		};
	}

	const text = match[4];
	return {
		checked: match[3].toLowerCase() === "x",
		priority: getPriorityRank(text),
		startDate: getStartDate(text),
	};
}

function getPriorityRank(text: string): number {
	if (text.includes("🔺")) {
		return 5;
	}

	if (text.includes("⏫")) {
		return 4;
	}

	if (text.includes("🔼")) {
		return 3;
	}

	if (text.includes("🔽")) {
		return 1;
	}

	if (text.includes("⏬")) {
		return 0;
	}

	return 2;
}

function getStartDate(text: string): string | null {
	const match = text.match(START_DATE_REGEX);
	return match ? match[1] : null;
}

function getStartDateCategory(startDate: string | null): number {
	if (startDate === null) {
		return 1;
	}

	const today = getTodayDateString();
	return startDate <= today ? 0 : 2;
}

function getTodayDateString(): string {
	return new Date().toISOString().slice(0, 10);
}

function isBlankLine(line: string): boolean {
	return line.trim().length === 0;
}

function isListItemLine(line: string): boolean {
	return LIST_ITEM_REGEX.test(line);
}

function isTaskLine(line: string): boolean {
	return TASK_LINE_REGEX.test(line);
}

function getIndent(line: string): number {
	const match = line.match(/^(\s*)/);
	return match ? match[1].length : 0;
}

function joinLines(lines: string[]): string {
	return lines.join("\n");
}
