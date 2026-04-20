import { defineCommand } from "citty";
import { asJson, formatTaskLine } from "../../output/format";
import { undoLast } from "../../services/journal";
import { baseArgs, withDb } from "../shared";

export const undoCommand = defineCommand({
	meta: { name: "undo", description: "Reverse the last mutation" },
	args: { ...baseArgs },
	run({ args }) {
		const result = withDb((db) => undoLast(db));
		if (args.json) {
			console.log(asJson(result));
			return;
		}
		switch (result.kind) {
			case "nothing":
				console.log("nothing to undo");
				return;
			case "deleted":
				console.log(`undo: removed new task #${result.id}`);
				return;
			case "created":
				console.log(`undo: restored  ${formatTaskLine(result.task)}`);
				return;
			case "reopened":
				console.log(`undo: reopened  ${formatTaskLine(result.task)}`);
				return;
			case "completed":
				console.log(`undo: re-completed  ${formatTaskLine(result.task)}`);
				return;
			case "reverted":
				console.log(`undo: reverted  ${formatTaskLine(result.task)}`);
				return;
		}
	},
});
