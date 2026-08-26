import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createXOneMcpServer, ensureApiUrl } from "./server.js";

ensureApiUrl();

const server = createXOneMcpServer();
const transport = new StdioServerTransport();

try {
  await server.connect(transport);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`xone-mcp failed to start: ${message}`);
  process.exit(1);
}
