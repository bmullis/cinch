#!/usr/bin/env bun
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
	command: "bun",
	args: ["run", "src/cli/index.ts", "mcp"],
	env: {
		...process.env,
		CINCH_DB: process.env.CINCH_DB ?? "./.dev.db",
	},
});

const client = new Client({ name: "cinch-smoke", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log(`discovered ${tools.tools.length} tools:`);
for (const t of tools.tools) console.log(`  - ${t.name}: ${t.description}`);

const added = await client.callTool({
	name: "add_task",
	arguments: { input: "MCP test task tomorrow p2 #mcp @claude" },
});
console.log("\nadd_task →", added.content);

const today = await client.callTool({ name: "list_today", arguments: {} });
console.log("\nlist_today →", today.content);

const done = await client.callTool({
	name: "complete_tasks",
	arguments: { ids: [1] },
});
console.log("\ncomplete_tasks([1]) →", done.content);

const undone = await client.callTool({ name: "undo", arguments: {} });
console.log("\nundo →", undone.content);

await client.close();
