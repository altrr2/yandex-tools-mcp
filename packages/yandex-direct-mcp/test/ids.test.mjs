import { describe, expect, test } from 'bun:test';
import { idSchema, parseJson, toJson } from '../src/ids.mjs';

const BIG = '1915883588174806058'; // a real combinatorial ad ID, above 2^53

describe('parseJson', () => {
  test('keeps integers above 2^53 exact as strings', () => {
    expect(String(JSON.parse(`{"Id":${BIG}}`).Id)).not.toBe(BIG); // the bug being fixed
    expect(parseJson(`{"Id":${BIG}}`).Id).toBe(BIG);
    expect(parseJson(`[-${BIG}]`)[0]).toBe(`-${BIG}`);
  });

  test('leaves safe integers, decimals and exponents as numbers', () => {
    expect(parseJson('{"Id":16297436925,"Max":9007199254740991}')).toEqual({ Id: 16297436925, Max: 9007199254740991 });
    expect(parseJson('[1.5, 2e3, -0.25, 1.2345678901234567890]')).toEqual([1.5, 2000, -0.25, 1.2345678901234567]);
  });

  test('does not touch digits inside strings, including escaped quotes', () => {
    expect(parseJson(`{"Text":"call ${BIG} \\"now\\"","Id":${BIG}}`)).toEqual({ Text: `call ${BIG} "now"`, Id: BIG });
  });
});

describe('toJson', () => {
  test('writes string IDs under ID keys as bare numbers', () => {
    const body = toJson({ SelectionCriteria: { Ids: [BIG, '16297436925'] }, KeywordBids: [{ KeywordId: BIG }] });
    expect(body).toBe(`{"SelectionCriteria":{"Ids":[${BIG},16297436925]},"KeywordBids":[{"KeywordId":${BIG}}]}`);
  });

  test('round-trips a parsed response exactly', () => {
    const wire = `{"Ads":[{"Id":${BIG},"AdGroupId":5432101234,"CampaignId":123}]}`;
    expect(toJson(parseJson(wire))).toBe(wire);
  });

  test('leaves all-digit text in non-ID fields as strings', () => {
    expect(toJson({ TextAd: { Title: '1234567890123456789' }, Keyword: '2024' })).toBe(
      '{"TextAd":{"Title":"1234567890123456789"},"Keyword":"2024"}',
    );
  });

  test('leaves non-numeric values under ID keys alone', () => {
    expect(toJson({ AdImageHash: 'abc123', Id: 42, Ids: ['x1'] })).toBe(
      '{"AdImageHash":"abc123","Id":42,"Ids":["x1"]}',
    );
  });
});

describe('idSchema', () => {
  test('accepts numbers and decimal strings, rejects anything else', () => {
    expect(idSchema.parse(42)).toBe(42);
    expect(idSchema.parse(BIG)).toBe(BIG);
    for (const bad of ['12a', '', -1, 1.5, '-5']) expect(idSchema.safeParse(bad).success).toBe(false);
  });
});
