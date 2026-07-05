import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Spawns the MCP server against a local mock of the Webmaster API and
// verifies each tool requests the upstream path documented at
// https://yandex.com/dev/webmaster/doc/en/reference (see issue #2).

const requestedPaths = [];
let httpServer;
let client;

beforeAll(async () => {
  httpServer = createServer((req, res) => {
    requestedPaths.push(new URL(req.url, 'http://localhost').pathname);
    res.setHeader('Content-Type', 'application/json');
    res.end(req.url.endsWith('/user') ? '{"user_id":123}' : '{}');
  });
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}/v4`;

  client = new Client({ name: 'endpoint-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [new URL('../src/index.mjs', import.meta.url).pathname],
    env: {
      ...process.env,
      YANDEX_WEBMASTER_TOKEN: 'test-token',
      YANDEX_WEBMASTER_BASE_URL: baseUrl,
    },
  });
  await client.connect(transport);
});

afterAll(async () => {
  await client?.close();
  httpServer?.close();
});

async function upstreamPathFor(tool) {
  requestedPaths.length = 0;
  const result = await client.callTool({ name: tool, arguments: { host_id: 'example.com' } });
  expect(result.isError).toBeFalsy();
  const path = requestedPaths.find((p) => p !== '/v4/user');
  return path?.replace('/v4/user/123/hosts/example.com', '');
}

describe('upstream paths match the Webmaster API v4 docs', () => {
  test('get-insearch-history', async () => {
    expect(await upstreamPathFor('get-insearch-history')).toBe('/search-urls/in-search/history');
  });

  test('get-insearch-samples', async () => {
    expect(await upstreamPathFor('get-insearch-samples')).toBe('/search-urls/in-search/samples');
  });

  test('get-broken-internal-links', async () => {
    expect(await upstreamPathFor('get-broken-internal-links')).toBe('/links/internal/broken/samples');
  });

  test('get-broken-internal-links-history', async () => {
    expect(await upstreamPathFor('get-broken-internal-links-history')).toBe('/links/internal/broken/history');
  });
});
