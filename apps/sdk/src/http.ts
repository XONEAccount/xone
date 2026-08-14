import {
  AgentDeletedError,
  AgentNotFoundError,
  AgentPausedError,
  InvalidApiKeyError,
  OperatorRequiredError,
  ValidationError,
  XOneError,
} from "./errors.js";
import { X402PaymentError } from "./x402/payUrl.js";

/**
 * Typed fetch helper for the XOne Hono API.
 * Maps `{ error, code }` responses onto SDK error classes.
 *
 * @param baseUrl - API origin
 * @param path - Path starting with /
 * @param init - Fetch options + optional bearer
 * @returns Parsed JSON
 */
export async function httpJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });
  } catch (err) {
    throw new XOneError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      "NETWORK_ERROR",
    );
  }

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw mapApiError(res.status, body.error || `HTTP ${res.status}`, body.code);
  }

  return body as T;
}

/**
 * @param status - HTTP status
 * @param message - Error message
 * @param code - API machine code
 * @returns Typed SDK error
 */
function mapApiError(status: number, message: string, code?: string): Error {
  switch (code) {
    case "invalid_api_key":
    case "INVALID_API_KEY":
      return new InvalidApiKeyError(message);
    case "validation_error":
    case "VALIDATION_ERROR":
      return new ValidationError(message);
    case "limit_exceeded":
    case "LIMIT_EXCEEDED":
      return Object.assign(new XOneError(message, "LIMIT_EXCEEDED"), {
        name: "LimitExceededError",
      });
    case "insufficient_balance":
    case "INSUFFICIENT_BALANCE":
      return Object.assign(new XOneError(message, "INSUFFICIENT_BALANCE"), {
        name: "InsufficientBalanceError",
      });
    case "agent_paused":
    case "AGENT_PAUSED":
      return new AgentPausedError("remote");
    case "agent_deleted":
    case "AGENT_DELETED":
      return new AgentDeletedError("remote");
    case "not_found":
    case "AGENT_NOT_FOUND":
      return new AgentNotFoundError("remote");
    case "x402_payment_failed":
    case "X402_PAYMENT_FAILED":
      return new X402PaymentError(message, status);
    case "operator_required":
    case "OPERATOR_REQUIRED":
      return new OperatorRequiredError(message);
    case "forbidden_url":
    case "forbidden_payee":
    case "x402_network_mismatch":
      return new ValidationError(message);
    case "payment_in_progress":
    case "payment_uncertain":
    case "idempotency_conflict":
      return new XOneError(message, code);
    default:
      return new XOneError(message, code ?? `HTTP_${status}`);
  }
}
