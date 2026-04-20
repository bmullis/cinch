import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
import { asJson, formatTaskLine } from "../../output/format";
import { recordMutation } from "../../services/journal";
import { getTask, updateTask } from "../../services/tasks";
import type { Priority, TaskPatch } from "../../services/types";
import { baseArgs, parseDueFlag, withDb } from "../shared";

type EditableBlob = {
	title: string;
	notes: string | null;
	project: string | null;
	priority: Priority;
	due_at: string | null;
	labels: string[];
};

const editInExternalEditor = (id: number): TaskPatch => {
	const existing = withDb((db) => getTask(db, id));
	if (!existing) throw new Error(`task #${id} not found`);

	const blob: EditableBlob = {
		title: existing.title,
		notes: existing.notes,
		project: existing.project,
		priority: existing.priority,
		due_at: existing.dueAt,
		labels: existing.labels,
	};

	const dir = mkdtempSync(join(tmpdir(), "cinch-edit-"));
	const file = join(dir, `task-${id}.json`);
	writeFileSync(file, `${JSON.stringify(blob, null, 2)}\n`, "utf8");

	const editor = process.env.EDITOR || process.env.VISUAL || "vi";
	const res = spawnSync(editor, [file], { stdio: "inherit" });
	if (res.status !== 0) {
		rmSync(dir, { recursive: true, force: true });
		throw new Error(`editor exited with status ${res.status}`);
	}

	const edited = readFileSync(file, "utf8");
	rmSync(dir, { recursive: true, force: true });

	const parsed = JSON.parse(edited) as EditableBlob;
	return {
		title: parsed.title,
		notes: parsed.notes,
		project: parsed.project,
		priority: parsed.priority,
		dueAt: parsed.due_at,
		labels: parsed.labels,
	};
};

export const editCommand = defineCommand({
	meta: {
		name: "edit",
		description: "Edit a task by flags, or open $EDITOR with --editor",
	},
	args: {
		id: { type: "positional", description: "Task ID", required: true },
		title: { type: "string", description: "New title" },
		notes: { type: "string", description: "New notes" },
		project: { type: "string", description: "New project (empty to clear)" },
		priority: { type: "string", description: "Priority 1-4" },
		due: { type: "string", description: "Due (natural language or 'none')" },
		label: { type: "string", description: "Replace labels with this one" },
		clearLabels: {
			type: "boolean",
			description: "Remove all labels",
			default: false,
		},
		editor: {
			type: "boolean",
			description: "Open $EDITOR with a JSON blob",
			default: false,
		},
		...baseArgs,
	},
	run({ args }) {
		const id = Number.parseInt(args.id, 10);
		if (Number.isNaN(id)) throw new Error(`invalid id: ${args.id}`);

		const patch: TaskPatch = args.editor ? editInExternalEditor(id) : {};

		if (!args.editor) {
			if (args.title !== undefined) patch.title = args.title;
			if (args.notes !== undefined) patch.notes = args.notes || null;
			if (args.project !== undefined)
				patch.project = args.project === "" ? null : args.project;
			if (args.priority !== undefined) {
				const p = Number(args.priority);
				if (![1, 2, 3, 4].includes(p))
					throw new Error(`priority must be 1-4, got ${args.priority}`);
				patch.priority = p as Priority;
			}
			if (args.due !== undefined) patch.dueAt = parseDueFlag(args.due);
			if (args.clearLabels) patch.labels = [];
			else if (args.label !== undefined) patch.labels = [args.label];
		}

		const updated = withDb((db) => {
			const before = getTask(db, id);
			if (!before) return undefined;
			const after = updateTask(db, id, patch);
			if (after) recordMutation(db, { kind: "update", taskId: id, before });
			return after;
		});
		if (!updated) throw new Error(`task #${id} not found`);

		console.log(
			args.json ? asJson(updated) : `edited  ${formatTaskLine(updated)}`,
		);
	},
});
