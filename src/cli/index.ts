#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { addCommand } from "./commands/add";
import { doneCommand } from "./commands/done";
import { editCommand } from "./commands/edit";
import { labelsCommand } from "./commands/labels";
import { listCommand } from "./commands/list";
import { mcpCommand } from "./commands/mcp";
import { overdueCommand } from "./commands/overdue";
import { projectsCommand } from "./commands/projects";
import { reopenCommand } from "./commands/reopen";
import { rmCommand } from "./commands/rm";
import { searchCommand } from "./commands/search";
import { todayCommand } from "./commands/today";
import { undoCommand } from "./commands/undo";
import { upcomingCommand } from "./commands/upcoming";

const subCommands = {
	add: addCommand,
	today: todayCommand,
	upcoming: upcomingCommand,
	overdue: overdueCommand,
	list: listCommand,
	search: searchCommand,
	done: doneCommand,
	reopen: reopenCommand,
	rm: rmCommand,
	edit: editCommand,
	undo: undoCommand,
	projects: projectsCommand,
	labels: labelsCommand,
	mcp: mcpCommand,
};

const main = defineCommand({
	meta: {
		name: "cinch",
		version: "0.0.1",
		description: "local-first todo CLI",
	},
	subCommands,
});

const argv = process.argv.slice(2);
if (argv.length === 0) {
	process.argv.splice(2, 0, "today");
}

runMain(main);
