// Direct object IDs are int64, and some (combinatorial ad IDs, keyword IDs) exceed
// Number.MAX_SAFE_INTEGER (2^53 − 1). Plain JSON.parse silently rounds them, so an ID
// read from one call no longer matches anything in the next. This module keeps them
// exact end to end:
//   - parseJson(): unsafe integers in a response become decimal strings
//   - toJson(): ID fields given as decimal strings go back on the wire as bare numbers
//   - idSchema: tool inputs accept an ID as a number or a decimal string
// Safe integers stay plain numbers, so ordinary IDs are untouched.

import { z } from 'zod';

// Every JSON string literal or number literal, in document order. Matching strings
// first means digits inside a string are never mistaken for a number.
const JSON_TOKEN = /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
const INTEGER = /^-?\d+$/;

export function parseJson(text) {
  const quoted = text.replace(JSON_TOKEN, (token) =>
    INTEGER.test(token) && !Number.isSafeInteger(Number(token)) ? `"${token}"` : token,
  );
  return JSON.parse(quoted);
}

// Field names whose values are object IDs (Id, Ids, AdGroupId, CampaignIds, KeywordId, ...).
const ID_KEY = /Ids?$/;
const DECIMAL_ID = /^\d+$/;
const MARKER = '\u0000id:';
const MARKED = /"\\u0000id:(\d+)"/g;

function markId(value) {
  return typeof value === 'string' && DECIMAL_ID.test(value) ? `${MARKER}${value}` : value;
}

// JSON.stringify, except a decimal-string value under an ID key (or in an array under
// one) is written as a bare number. Only ID keys are touched, so free text that happens
// to be all digits (an ad title, a keyword) stays a string.
export function toJson(value) {
  const json = JSON.stringify(value, (key, v) => {
    if (!ID_KEY.test(key)) return v;
    return Array.isArray(v) ? v.map(markId) : markId(v);
  });
  return json.replace(MARKED, '$1');
}

export const idSchema = z.union([z.number().int().nonnegative(), z.string().regex(DECIMAL_ID)]);
