import { defineCommand } from "citty";
import { asJson, formatTaskLine } from "../../output/format";
import { recordMutation } from "../../services/journal";
import { getTask, reopenTask } from "../../services/tasks";
import { baseArgs, withDb } from "../shared";

export const reopenCommand = defineCommand({
	meta: { name: "reopen", description: "Reopen one or more completed tasks" },
	args: {
		ids: { type: "positional", description: "Task IDs", required: true },
		...baseArgs,
	},
	run({ args, rawArgs }) {
		const raw = rawArgs.filter((a) => !a.startsWith("-"));
		const ids = raw.map((s) => Number.parseInt(s, 10));
		if (ids.some(Number.isNaN))
			throw new Error(`invalid id(s): ${raw.join(" ")}`);

		const reopened = withDb((db) =>
			ids
				.map((id) => {
					const before = getTask(db, id);
					if (!before?.completedAt) return before;
					const after = reopenTask(db, id);
					if (after) recordMutation(db, { kind: "reopen", taskId: after.id });
					return after;
				})
				.filter((t) => t !== undefined),
		);

		if (args.json) {
			console.log(asJson(reopened));
			return;
		}
		if (reopened.length === 0) {
			console.log("no matching tasks");
			return;
		}
		for (const t of reopened) console.log(`reopened  ${formatTaskLine(t)}`);
	},
});
