import * as chrono from "chrono-node";
import type { NewTask, Priority } from "../services/types";

const PRIORITY_RE = /(?:^|\s)p([1-4])(?=\s|$)/i;
const PROJECT_RE = /(?:^|\s)#([\w-]+)/;
const LABEL_RE = /(?:^|\s)@([\w-]+)/g;

export type ParsedQuickAdd = NewTask & {
	rawDatePhrase?: string;
};

export const parseQuickAdd = (input: string): ParsedQuickAdd => {
	let working = input.trim();

	let priority: Priority | undefined;
	const pMatch = working.match(PRIORITY_RE);
	if (pMatch) {
		priority = Number(pMatch[1]) as Priority;
		working = working.replace(pMatch[0], " ");
	}

	let project: string | undefined;
	const projMatch = working.match(PROJECT_RE);
	if (projMatch) {
		project = projMatch[1];
		working = working.replace(projMatch[0], " ");
	}

	const labels: string[] = [];
	for (const m of working.matchAll(LABEL_RE)) {
		const name = m[1];
		if (name) labels.push(name.toLowerCase());
	}
	working = working.replace(LABEL_RE, " ");

	let dueAt: string | undefined;
	let rawDatePhrase: string | undefined;
	const [first] = chrono.parse(working, new Date(), { forwardDate: true });
	if (first) {
		dueAt = first.start.date().toISOString();
		rawDatePhrase = first.text;
		working = (
			working.slice(0, first.index) +
			working.slice(first.index + first.text.length)
		).trim();
	}

	const title = working.replace(/\s+/g, " ").trim();

	return {
		title,
		priority,
		project,
		labels: labels.length > 0 ? labels : undefined,
		dueAt: dueAt ?? null,
		rawDatePhrase,
	};
};
