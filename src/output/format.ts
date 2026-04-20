import pc from "picocolors";
import type { Task } from "../services/types";

const useColor = (): boolean => process.stdout.isTTY === true;
const c = (fn: (s: string) => string, s: string) => (useColor() ? fn(s) : s);

const priorityColor = (p: number, s: string): string => {
	if (!useColor()) return s;
	if (p === 1) return pc.red(pc.bold(s));
	if (p === 2) return pc.yellow(s);
	if (p === 3) return pc.cyan(s);
	return pc.dim(s);
};

const relativeDue = (dueIso: string | null): string => {
	if (!dueIso) return "";
	const due = new Date(dueIso);
	const now = new Date();
	const diffMs = due.getTime() - now.getTime();
	const day = 1000 * 60 * 60 * 24;
	const diffDays = Math.floor(diffMs / day);

	if (diffMs < 0) {
		const overdue = Math.abs(Math.ceil(diffMs / day));
		const text = overdue === 0 ? "overdue today" : `overdue ${overdue}d`;
		return c(pc.red, text);
	}
	if (diffDays === 0) return c(pc.yellow, "today");
	if (diffDays === 1) return c(pc.green, "tomorrow");
	if (diffDays < 7)
		return c(pc.green, due.toLocaleDateString(undefined, { weekday: "short" }));
	return c(pc.dim, due.toLocaleDateString());
};

export const formatTaskLine = (task: Task): string => {
	const id = c(pc.dim, `#${String(task.id).padStart(3)}`);
	const priority = priorityColor(task.priority, `p${task.priority}`);
	const project = task.project
		? c(pc.magenta, `[${task.project}]`)
		: c(pc.dim, "(inbox)");
	const title = task.completedAt ? c(pc.strikethrough, task.title) : task.title;
	const due = relativeDue(task.dueAt);
	const labels = task.labels.map((l) => c(pc.cyan, `@${l}`)).join(" ");
	return [id, priority, project, title, due, labels]
		.filter((s) => s.length > 0)
		.join("  ");
};

export const formatTaskList = (
	tasks: Task[],
	empty = "nothing here.",
): string =>
	tasks.length === 0 ? c(pc.dim, empty) : tasks.map(formatTaskLine).join("\n");

export const asJson = (value: unknown): string =>
	JSON.stringify(value, null, 2);
