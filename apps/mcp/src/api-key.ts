import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeApiKey, type McpSpendSession } from "./session.js";

const MISSING_KEY_MESSAGE = [
  "Stopped: XOne needs your console API key before it can create a wallet or spend.",
  "",
  "1. Open the XOne console and copy a spend key (starts with xone_).",
  "2. Paste it into the prompt, or call xone_set_api_key / pass apiKey on this tool.",
  "3. Do not continue until the key is set — the server will not guess one.",
].join("\n");

const ELICIT_SCHEMA = {
  type: "object" as const,
  properties: {
    apiKey: {
      type: "string" as const,
      title: "XOne API Key",
      description: "Spend token from the XOne console (starts with xone_)",
    },
  },
  required: ["apiKey"],
};

/**
 * Resolves a user-supplied API key, interrupting via MCP elicitation when missing.
 *
 * Order: tool argument → session → host prompt. Does not invent a key.
 *
 * @param options - Session, server, optional key from this call
 * @returns Normalized key, or `undefined` if the user declined / host cannot prompt
 */
export async function requireUserApiKey(options: {
  session: McpSpendSession;
  server: McpServer;
  provided?: string;
}): Promise<string | undefined> {
  const fromArgs = normalizeApiKey(options.provided);
  if (fromArgs) {
    options.session.setApiKey(fromArgs);
    return fromArgs;
  }

  const fromSession = options.session.getApiKey();
  if (fromSession) return fromSession;

  const elicited = await elicitApiKey(options.server);
  const fromPrompt = normalizeApiKey(elicited);
  if (fromPrompt) {
    options.session.setApiKey(fromPrompt);
    return fromPrompt;
  }

  return undefined;
}

/**
 * @returns User-facing stop message when create/pay cannot proceed
 */
export function missingApiKeyMessage(): string {
  return MISSING_KEY_MESSAGE;
}

/**
 * Asks the connected MCP host to collect the API key from the human.
 *
 * @param server - High-level MCP server
 * @returns Raw key string, or `undefined` if elicitation is unavailable
 */
async function elicitApiKey(server: McpServer): Promise<string | undefined> {
  try {
    const result = await server.server.elicitInput({
      mode: "form",
      message:
        "Enter your XOne API key to continue. Create one in the console if you do not have it yet. The server will not proceed without it.",
      requestedSchema: ELICIT_SCHEMA,
    });
    if (result.action !== "accept") return undefined;
    const value = result.content?.apiKey;
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}
