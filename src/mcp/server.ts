import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools";

export const startMcpServer = async (): Promise<void> => {
	const server = new McpServer({
		name: "cinch",
		version: "0.0.1",
	});
	registerTools(server);
	const transport = new StdioServerTransport();
	await server.connect(transport);
};
