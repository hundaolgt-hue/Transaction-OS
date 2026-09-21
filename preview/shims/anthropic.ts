export class LlmUnavailable extends Error {}
export async function complete(): Promise<never> {
  throw new LlmUnavailable('The preview runs the deterministic rule engine only.');
}
export function extractJson<T>(_t: string): T | null { return null; }
