// Yandex Direct represents all monetary amounts (bids, budgets) in "micro-units":
// the currency value multiplied by 1,000,000. Tools accept plain currency amounts
// (e.g. rubles) from callers and convert at the API boundary with these helpers.

const MICRO = 1_000_000;

export function toMicro(amount) {
  return Math.round(Number(amount) * MICRO);
}

export function fromMicro(micro) {
  if (micro === null || micro === undefined) return null;
  return Number(micro) / MICRO;
}
