import { describe, expect, test } from 'bun:test';
import {
  calculateTrend,
  flattenRegionsTree,
  formatShare,
  fromRFC3339Date,
  normalizePeriod,
  regionsToStrings,
  resolveDynamicsDates,
  toInt,
  toRFC3339Date,
  toYandexDevices,
  toYandexPeriod,
  toYandexRegionGranularity,
} from '../src/convert.mjs';

describe('date conversion', () => {
  test('toRFC3339Date converts YYYY-MM-DD to UTC midnight', () => {
    expect(toRFC3339Date('2025-04-30')).toBe('2025-04-30T00:00:00Z');
  });

  test('toRFC3339Date passes through empty and already-RFC3339', () => {
    expect(toRFC3339Date('')).toBe('');
    expect(toRFC3339Date('2025-04-30T00:00:00Z')).toBe('2025-04-30T00:00:00Z');
    expect(toRFC3339Date('not-a-date')).toBe('not-a-date');
  });

  test('fromRFC3339Date converts RFC3339 to YYYY-MM-DD', () => {
    expect(fromRFC3339Date('2025-01-01T00:00:00Z')).toBe('2025-01-01');
  });

  test('fromRFC3339Date passes through empty and invalid', () => {
    expect(fromRFC3339Date('')).toBe('');
    expect(fromRFC3339Date('garbage')).toBe('garbage');
  });

  test('round-trips', () => {
    expect(fromRFC3339Date(toRFC3339Date('2024-12-25'))).toBe('2024-12-25');
  });
});

describe('enum mapping', () => {
  test('normalizePeriod', () => {
    expect(normalizePeriod('daily')).toBe('daily');
    expect(normalizePeriod('PERIOD_WEEKLY')).toBe('weekly');
    expect(normalizePeriod('')).toBe('monthly');
    expect(normalizePeriod(undefined)).toBe('monthly');
    expect(normalizePeriod('nonsense')).toBe('monthly');
  });

  test('toYandexPeriod', () => {
    expect(toYandexPeriod('daily')).toBe('PERIOD_DAILY');
    expect(toYandexPeriod('weekly')).toBe('PERIOD_WEEKLY');
    expect(toYandexPeriod('monthly')).toBe('PERIOD_MONTHLY');
    expect(toYandexPeriod('PERIOD_DAILY')).toBe('PERIOD_DAILY');
    expect(toYandexPeriod(undefined)).toBe('PERIOD_MONTHLY');
  });

  test('toYandexDevices maps aliases and drops unknowns', () => {
    expect(toYandexDevices(['desktop', 'phone', 'tablet'])).toEqual([
      'DEVICE_DESKTOP',
      'DEVICE_PHONE',
      'DEVICE_TABLET',
    ]);
    expect(toYandexDevices(['mobile', 'all'])).toEqual(['DEVICE_PHONE', 'DEVICE_ALL']);
    expect(toYandexDevices(['DEVICE_DESKTOP'])).toEqual(['DEVICE_DESKTOP']);
    expect(toYandexDevices(['unknown'])).toBeUndefined();
    expect(toYandexDevices([])).toBeUndefined();
    expect(toYandexDevices(undefined)).toBeUndefined();
  });

  test('toYandexRegionGranularity defaults to REGION_ALL', () => {
    expect(toYandexRegionGranularity('cities')).toBe('REGION_CITIES');
    expect(toYandexRegionGranularity('regions')).toBe('REGION_REGIONS');
    expect(toYandexRegionGranularity('all')).toBe('REGION_ALL');
    expect(toYandexRegionGranularity('REGION_CITIES')).toBe('REGION_CITIES');
    expect(toYandexRegionGranularity(undefined)).toBe('REGION_ALL');
  });
});

describe('regionsToStrings', () => {
  test('converts numbers to strings', () => {
    expect(regionsToStrings([213, 2])).toEqual(['213', '2']);
  });

  test('returns undefined for empty', () => {
    expect(regionsToStrings([])).toBeUndefined();
    expect(regionsToStrings(undefined)).toBeUndefined();
  });
});

describe('toInt (proto3 JSON int64)', () => {
  test('parses quoted strings', () => {
    expect(toInt('45230')).toBe(45230);
  });
  test('parses bare numbers', () => {
    expect(toInt(45230)).toBe(45230);
  });
  test('empty/null/garbage -> 0', () => {
    expect(toInt('')).toBe(0);
    expect(toInt(null)).toBe(0);
    expect(toInt(undefined)).toBe(0);
    expect(toInt('abc')).toBe(0);
  });
});

describe('formatShare (adaptive precision, trimmed zeros)', () => {
  test('keeps significant digits for tiny shares', () => {
    expect(formatShare(0.0123)).toBe('0.0123'); // would collapse to "0.01" with toFixed(2)
    expect(formatShare(0.000123)).toBe('0.000123');
  });
  test('two decimals for shares >= 1', () => {
    expect(formatShare(12.345)).toBe('12.35');
    expect(formatShare(5)).toBe('5');
  });
  test('trims trailing zeros', () => {
    expect(formatShare(0.01)).toBe('0.01');
    expect(formatShare(2.5)).toBe('2.5');
  });
  test('zero / invalid -> "0"', () => {
    expect(formatShare(0)).toBe('0');
    expect(formatShare(null)).toBe('0');
    expect(formatShare(undefined)).toBe('0');
  });
});

describe('resolveDynamicsDates', () => {
  // Fixed "now": Sunday 2026-06-07 (June 7 2026 is a Sunday).
  const now = new Date('2026-06-07T12:00:00Z');

  test('monthly: from=1st of month a year back, to=last day of prev month', () => {
    const { fromDate, toDate } = resolveDynamicsDates('monthly', '', '', now);
    expect(toDate).toBe('2026-05-31'); // last day of May
    expect(fromDate).toBe('2025-05-01'); // first day of month, 12 months before toDate
  });

  test('weekly: to=most recent Sunday, from=Monday 363 days earlier', () => {
    const { fromDate, toDate } = resolveDynamicsDates('weekly', '', '', now);
    expect(toDate).toBe('2026-06-07'); // now is Sunday
    expect(new Date(`${toDate}T00:00:00Z`).getUTCDay()).toBe(0); // Sunday
    expect(new Date(`${fromDate}T00:00:00Z`).getUTCDay()).toBe(1); // Monday
    expect(fromDate).toBe('2025-06-09');
  });

  test('daily: to=today, from=59 days back', () => {
    const { fromDate, toDate } = resolveDynamicsDates('daily', '', '', now);
    expect(toDate).toBe('2026-06-07');
    expect(fromDate).toBe('2026-04-09'); // 59 days before
    const span = (new Date(`${toDate}T00:00:00Z`) - new Date(`${fromDate}T00:00:00Z`)) / 86400000;
    expect(span).toBe(59);
  });

  test('caller-supplied dates pass through unchanged', () => {
    const { fromDate, toDate } = resolveDynamicsDates('monthly', '2024-01-01', '2024-12-31', now);
    expect(fromDate).toBe('2024-01-01');
    expect(toDate).toBe('2024-12-31');
  });
});

describe('calculateTrend', () => {
  test('up / down / stable', () => {
    expect(calculateTrend([{ count: 100 }, { count: 200 }])).toBe('up 100.0%');
    expect(calculateTrend([{ count: 200 }, { count: 100 }])).toBe('down 50.0%');
    expect(calculateTrend([{ count: 100 }, { count: 100 }])).toBe('stable');
    expect(calculateTrend([{ count: 0 }, { count: 50 }])).toBe('up (new)');
    expect(calculateTrend([{ count: 100 }])).toBe('stable');
    expect(calculateTrend([])).toBe('stable');
  });
});

describe('flattenRegionsTree (v2 {id,label,children} shape)', () => {
  test('flattens into a Map keyed by numeric region IDs', () => {
    const tree = [
      {
        id: '225',
        label: 'Россия',
        children: [
          { id: '1', label: 'Москва и область', children: [{ id: '213', label: 'Москва', children: null }] },
          { id: '2', label: 'Санкт-Петербург', children: null },
        ],
      },
    ];
    const map = flattenRegionsTree(tree, null, new Map());
    expect(map.size).toBe(4);
    expect(map.get(225)).toEqual({ label: 'Россия', parentId: null });
    expect(map.get(213)).toEqual({ label: 'Москва', parentId: 1 });
    expect(map.get(2)).toEqual({ label: 'Санкт-Петербург', parentId: 225 });
    // keys are numbers, not strings
    expect([...map.keys()].every((k) => typeof k === 'number')).toBe(true);
  });
});
