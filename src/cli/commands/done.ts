import { defineCommand } from "citty";
import { asJson, formatTaskLine } from "../../output/format";
import { recordMutation } from "../../services/journal";
import { completeTask, getTask } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const doneCommand = defineCommand({
	meta: { name: "done", description: "Mark one or more tasks complete" },
	args: {
		ids: {
			type: "positional",
			description: "Task IDs",
			required: true,
		},
		...baseArgs,
	},
	run({ args, rawArgs }) {
		const raw = rawArgs.filter((a) => !a.startsWith("-"));
		const ids = raw.map((s) => Number.parseInt(s, 10));
		if (ids.some(Number.isNaN))
			throw new Error(`invalid id(s): ${raw.join(" ")}`);

		const completed = withDb((db) =>
			ids
				.map((id) => {
					const before = getTask(db, id);
					if (!before || before.completedAt) return before;
					const after = completeTask(db, id);
					if (after) recordMutation(db, { kind: "complete", taskId: after.id });
					return after;
				})
				.filter((t) => t !== undefined),
		);

		if (args.json) {
			console.log(asJson(completed));
			return;
		}
		if (completed.length === 0) {
			console.log("no matching tasks");
			return;
		}
		for (const t of completed) console.log(`done  ${formatTaskLine(t)}`);
	},
});
