export type BudgetStatus = {
  textOnly: boolean;
  attemptsRemaining?: number;
  reservedUsd: number;
  maximumUsd: number;
  spentUsd?: number;
  remainingUsd?: number;
  accounting?: "tokens";
};
export interface Budget {
  reserve(): void | string | Promise<void | string>;
  usage(
    inputTokens: number,
    outputTokens: number,
    cachedTokens?: number,
    receipt?: void | string,
  ): void | Promise<void>;
  status(): BudgetStatus | Promise<BudgetStatus>;
}
