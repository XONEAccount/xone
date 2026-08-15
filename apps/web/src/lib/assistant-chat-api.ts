import type { UIMessage } from "ai";
import { apiFetch } from "@/lib/api";

export type AssistantChatSessionDto = {
  id: string;
  ownerWallet: string;
  title: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Loads persisted assistant chat messages for a wallet.
 * @param ownerAddress - Owner wallet
 */
export async function loadAssistantChatSession(
  ownerAddress: string,
): Promise<UIMessage[]> {
  const data = await apiFetch<{
    messages?: UIMessage[];
    session: AssistantChatSessionDto | null;
  }>(
    `/api/agents/assistant/session?address=${encodeURIComponent(ownerAddress)}`,
    { token: "demo" },
  );
  return Array.isArray(data.messages) ? data.messages : [];
}

/**
 * Saves assistant chat messages for a wallet.
 * @param ownerAddress - Owner wallet
 * @param messages - UI messages
 */
export async function saveAssistantChatSession(
  ownerAddress: string,
  messages: UIMessage[],
): Promise<void> {
  await apiFetch("/api/agents/assistant/session", {
    method: "PUT",
    token: "demo",
    body: { ownerAddress, messages },
  });
}

/**
 * Clears persisted assistant chat for a wallet.
 * @param ownerAddress - Owner wallet
 */
export async function clearAssistantChatSession(
  ownerAddress: string,
): Promise<void> {
  await apiFetch("/api/agents/assistant/session", {
    method: "DELETE",
    token: "demo",
    body: { ownerAddress },
  });
}

const LOCAL_KEY_PREFIX = "xone-assistant-chat:";

/**
 * localStorage key for a wallet's chat backup.
 * @param ownerAddress - Owner wallet
 */
function localKey(ownerAddress: string): string {
  return `${LOCAL_KEY_PREFIX}${ownerAddress.toLowerCase()}`;
}

/**
 * Reads chat backup from localStorage.
 * @param ownerAddress - Owner wallet
 */
export function readLocalAssistantChat(ownerAddress: string): UIMessage[] | null {
  try {
    const raw = localStorage.getItem(localKey(ownerAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { messages?: UIMessage[] };
    return Array.isArray(parsed.messages) ? parsed.messages : null;
  } catch {
    return null;
  }
}

/**
 * Writes chat backup to localStorage.
 * @param ownerAddress - Owner wallet
 * @param messages - UI messages
 */
export function writeLocalAssistantChat(
  ownerAddress: string,
  messages: UIMessage[],
): void {
  try {
    localStorage.setItem(
      localKey(ownerAddress),
      JSON.stringify({ messages, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Quota / private mode — ignore.
  }
}

/**
 * Clears local chat backup.
 * @param ownerAddress - Owner wallet
 */
export function clearLocalAssistantChat(ownerAddress: string): void {
  try {
    localStorage.removeItem(localKey(ownerAddress));
  } catch {
    // ignore
  }
}
