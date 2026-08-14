/**
 * Base error for all XOne SDK failures.
 */
export class XOneError extends Error {
  readonly code: string;

  /**
   * @param message - Human-readable message
   * @param code - Machine-readable error code
   */
  constructor(message: string, code: string) {
    super(message);
    this.name = "XOneError";
    this.code = code;
  }
}

/**
 * Thrown when a per-tx or daily spend limit would be exceeded.
 */
export class LimitExceededError extends XOneError {
  readonly limitType: "perTransaction" | "daily";
  readonly amount: number;
  readonly limit: number;

  /**
   * @param limitType - Which limit was hit
   * @param amount - Requested spend
   * @param limit - Configured cap
   * @param currency - Settlement currency
   */
  constructor(
    limitType: "perTransaction" | "daily",
    amount: number,
    limit: number,
    currency: string,
  ) {
    const label =
      limitType === "perTransaction" ? "per-transaction" : "daily";
    super(
      `Amount ${amount} exceeds ${label} limit of ${limit} ${currency}`,
      "LIMIT_EXCEEDED",
    );
    this.name = "LimitExceededError";
    this.limitType = limitType;
    this.amount = amount;
    this.limit = limit;
  }
}

/**
 * Thrown when the wallet balance is too low for the requested spend.
 */
export class InsufficientBalanceError extends XOneError {
  readonly balance: number;
  readonly amount: number;

  /**
   * @param balance - Current balance
   * @param amount - Requested spend
   * @param currency - Settlement currency
   */
  constructor(balance: number, amount: number, currency: string) {
    super(
      `Insufficient balance: have ${balance} ${currency}, need ${amount}`,
      "INSUFFICIENT_BALANCE",
    );
    this.name = "InsufficientBalanceError";
    this.balance = balance;
    this.amount = amount;
  }
}

/**
 * Thrown when the agent is paused and a spend is attempted.
 */
export class AgentPausedError extends XOneError {
  readonly agentId: string;

  /**
   * @param agentId - Paused agent id
   */
  constructor(agentId: string) {
    super(`Agent is paused: ${agentId}`, "AGENT_PAUSED");
    this.name = "AgentPausedError";
    this.agentId = agentId;
  }
}

/**
 * Thrown when the agent has been soft-deleted.
 */
export class AgentDeletedError extends XOneError {
  readonly agentId: string;

  /**
   * @param agentId - Deleted agent id
   */
  constructor(agentId: string) {
    super(`Agent is deleted: ${agentId}`, "AGENT_DELETED");
    this.name = "AgentDeletedError";
    this.agentId = agentId;
  }
}

/**
 * Thrown when an agent id is not found in the store.
 */
export class AgentNotFoundError extends XOneError {
  readonly agentId: string;

  /**
   * @param agentId - Missing agent id
   */
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, "AGENT_NOT_FOUND");
    this.name = "AgentNotFoundError";
    this.agentId = agentId;
  }
}

/**
 * Thrown when an API key token is missing or inactive.
 */
export class InvalidApiKeyError extends XOneError {
  /**
   * @param message - Detail
   */
  constructor(message = "Invalid or deleted API key") {
    super(message, "INVALID_API_KEY");
    this.name = "InvalidApiKeyError";
  }
}

/**
 * Thrown when create/update params fail validation.
 */
export class ValidationError extends XOneError {
  /**
   * @param message - Validation detail
   */
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

/**
 * Thrown when an agent token is used for an operator-only action
 * (create, limits, pause, delete, transfer).
 */
export class OperatorRequiredError extends XOneError {
  /**
   * @param message - Detail
   */
  constructor(
    message = "This action requires the console. Agent tokens may only get, pay, and read history.",
  ) {
    super(message, "OPERATOR_REQUIRED");
    this.name = "OperatorRequiredError";
  }
}
