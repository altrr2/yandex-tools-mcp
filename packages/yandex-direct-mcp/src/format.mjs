// Yandex Direct add/update/action calls return a per-item results array where each
// item carries an id (Id, or KeywordId for keywordbids.set) plus optional
// Warnings/Errors ({ Code, Message, Details }). summarizeResults folds that into a
// caller-friendly text summary.

export function summarizeResults(result) {
  const items =
    result.AddResults ||
    result.UpdateResults ||
    result.ActionResults ||
    result.DeleteResults ||
    result.SetResults ||
    [];

  const ids = [];
  const problems = [];

  for (const item of items) {
    const id = item.Id ?? item.KeywordId;
    if (item.Errors?.length) {
      problems.push(
        `ID ${id ?? '?'}: ${item.Errors.map((e) => `${e.Message}${e.Details ? ` (${e.Details})` : ''}`).join('; ')}`,
      );
      continue;
    }
    if (id != null) ids.push(id);
    if (item.Warnings?.length) {
      problems.push(`ID ${id} warning: ${item.Warnings.map((w) => w.Message).join('; ')}`);
    }
  }

  const parts = [];
  if (ids.length) parts.push(`Succeeded: ${ids.join(', ')}`);
  if (problems.length) parts.push(`Issues:\n${problems.map((p) => `  - ${p}`).join('\n')}`);

  return { ids, hasErrors: problems.length > 0, text: parts.join('\n') || 'Done.' };
}

// Standard MCP response for a WRITE tool: a "<label> — <summary>" line plus the raw result.
export function writeResult(label, result) {
  const { text } = summarizeResults(result);
  return { content: [{ type: 'text', text: `${label} — ${text}` }], structuredContent: result };
}

// Standard MCP response for a list/read tool: "Found N <noun>(s):" plus the formatted
// lines (or a "No <noun>s found." fallback), with the raw result as structured content.
export function listResult(noun, lines, result) {
  const body = lines.length ? lines.join('\n') : `No ${noun}s found.`;
  return {
    content: [{ type: 'text', text: `Found ${lines.length} ${noun}(s):\n${body}` }],
    structuredContent: result,
  };
}

// Current date as YYYY-MM-DD (used as a default campaign StartDate).
export function today() {
  return new Date().toISOString().slice(0, 10);
}
