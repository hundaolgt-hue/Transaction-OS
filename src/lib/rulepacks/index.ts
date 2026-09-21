import type { RulePack } from './types';
import { ecmaEquityPack } from './ecma-equity';
import { ecmaDebtPack } from './ecma-debt';
import { maPack } from './ma';

export * from './types';

export const RULE_PACKS: RulePack[] = [ecmaEquityPack, ecmaDebtPack, maPack];

export function getRulePack(key: string | null | undefined): RulePack {
  return RULE_PACKS.find((p) => p.key === key) ?? ecmaEquityPack;
}

export function packForTransaction(transactionType: string): RulePack {
  return RULE_PACKS.find((p) => p.transactionTypes.includes(transactionType)) ?? ecmaEquityPack;
}
