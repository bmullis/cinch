import { defineCommand } from "citty";
import { startMcpServer } from "../../mcp/server";

export const mcpCommand = defineCommand({
	meta: {
		name: "mcp",
		description: "Run cinch as an MCP server over stdio (for Claude Code etc.)",
	},
	async run() {
		await startMcpServer();
	},
});
