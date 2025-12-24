#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = 'https://searchapi.api.cloud.yandex.net/v2/web/search';

function getCredentials() {
  const apiKey = process.env.YANDEX_SEARCH_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!apiKey) {
    throw new Error('YANDEX_SEARCH_API_KEY environment variable is required. Get it from Yandex Cloud console.');
  }
  if (!folderId) {
    throw new Error('YANDEX_FOLDER_ID environment variable is required. Get it from Yandex Cloud console.');
  }

  return { apiKey, folderId };
}

function detectLanguage(text) {
  const cyrillicPattern = /[\u0400-\u04FF]/;
  if (cyrillicPattern.test(text)) {
    return 'ru';
  }
  return 'en';
}

function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    const match = url.match(/^(?:https?:\/\/)?([^/?#]+)/i);
    return match?.[1] || '';
  }
}

function parseXMLResults(xmlData, includeImages = false) {
  const results = [];
  const groupMatches = xmlData.matchAll(/<group>([\s\S]*?)<\/group>/g);

  let position = 0;
  for (const groupMatch of groupMatches) {
    const groupContent = groupMatch?.[1];
    if (!groupContent) continue;

    const docMatch = groupContent.match(/<doc[^>]*>([\s\S]*?)<\/doc>/);
    const docContent = docMatch?.[1];
    if (!docContent) continue;

    const urlMatch = docContent.match(/<url>([^<]+)<\/url>/);
    if (!urlMatch?.[1]) continue;

    position++;
    const url = urlMatch[1];

    const titleMatch = docContent.match(/<title>(.*?)<\/title>/s);
    const title = titleMatch?.[1] ? cleanText(titleMatch[1]) : 'No title';

    const headlineMatch = docContent.match(/<headline>(.*?)<\/headline>/s);
    const headline = headlineMatch?.[1] ? cleanText(headlineMatch[1]) : undefined;

    const passages = [];
    const passagesMatch = docContent.match(/<passages>([\s\S]*?)<\/passages>/);
    if (passagesMatch?.[1]) {
      const passageMatches = passagesMatch[1].matchAll(/<passage>(.*?)<\/passage>/gs);
      for (const match of passageMatches) {
        if (match[1]) {
          passages.push(cleanText(match[1]));
        }
      }
    }

    const snippet = passages.length > 0 ? passages.join(' ') : headline || '';

    const sizeMatch = docContent.match(/<size>(\d+)<\/size>/);
    const size = sizeMatch?.[1] ? parseInt(sizeMatch[1], 10) : undefined;

    const langMatch = docContent.match(/<lang>([^<]+)<\/lang>/);
    const lang = langMatch?.[1] || undefined;

    const cachedUrlMatch = docContent.match(/<saved-copy-url>([^<]+)<\/saved-copy-url>/);
    const cachedUrl = cachedUrlMatch?.[1] || undefined;

    const result = {
      position,
      url,
      domain: extractDomain(url),
      title,
      headline,
      passages: passages.length > 0 ? passages : undefined,
      snippet: snippet || 'No content available',
      size,
      lang,
      cachedUrl,
    };

    if (includeImages) {
      const imgMatch =
        groupContent.match(/<img[^>]*src="([^"]+)"/i) ||
        groupContent.match(/<image>([^<]+)<\/image>/i) ||
        groupContent.match(/<thumb>([^<]+)<\/thumb>/i);

      if (imgMatch?.[1]) {
        result.image = imgMatch[1];
      }
    }

    results.push(result);
  }

  return results;
}

async function search(query, options = {}) {
  const { apiKey, folderId } = getCredentials();
  const maxResults = options.maxResults || 10;
  const includeImages = options.includeImages ?? false;

  const language = detectLanguage(query);

  const searchTypeMap = {
    ru: 'SEARCH_TYPE_RU',
    be: 'SEARCH_TYPE_BE',
    uk: 'SEARCH_TYPE_UK',
    kk: 'SEARCH_TYPE_KK',
    en: 'SEARCH_TYPE_COM',
  };

  const l10nMap = {
    ru: 'LOCALIZATION_RU',
    be: 'LOCALIZATION_BE',
    uk: 'LOCALIZATION_UK',
    kk: 'LOCALIZATION_KK',
    en: 'LOCALIZATION_EN',
  };

  const searchType = searchTypeMap[language] || 'SEARCH_TYPE_RU';
  const l10n = l10nMap[language] || 'LOCALIZATION_RU';

  const requestBody = {
    query: {
      searchType: options.searchType || searchType,
      queryText: query,
      familyMode: options.familyMode || 'FAMILY_MODE_MODERATE',
      page: String(options.page || 0),
      fixTypoMode: 'FIX_TYPO_MODE_ON',
    },
    sortSpec: {
      sortMode: options.sortMode || 'SORT_MODE_BY_RELEVANCE',
      sortOrder: 'SORT_ORDER_DESC',
    },
    groupSpec: {
      groupMode: 'GROUP_MODE_DEEP',
      groupsOnPage: String(maxResults),
      docsInGroup: '1',
    },
    folderId,
    responseFormat: 'FORMAT_XML',
    l10n,
  };

  if (options.region) {
    requestBody.region = String(options.region);
  }

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Yandex Search API error (${response.status}): ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      if (errorText) {
        errorMessage = errorText;
      }
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const xmlData = Buffer.from(data.rawData, 'base64').toString('utf-8');
  const results = parseXMLResults(xmlData, includeImages);

  return results.slice(0, maxResults);
}

const server = new McpServer({
  name: 'yandex-search',
  version: '1.0.0',
});

server.registerTool(
  'search',
  {
    title: 'Yandex Search',
    description:
      'Search the web using Yandex. Optimized for Russian and Cyrillic content but works for any language. Returns structured results with position, url, domain, title, headline (meta description), passages (text snippets array), snippet (combined text), size, lang, and cachedUrl.',
    inputSchema: {
      query: z.string().describe('Search query'),
      maxResults: z.number().min(1).max(100).optional().describe('Maximum number of results (default: 10, max: 100)'),
      includeImages: z.boolean().optional().describe('Include image URLs in results (default: false)'),
      region: z.number().optional().describe('Region ID for localized results (e.g., 213 for Moscow)'),
      page: z.number().min(0).optional().describe('Page number for pagination (default: 0)'),
      familyMode: z
        .enum(['FAMILY_MODE_NONE', 'FAMILY_MODE_MODERATE', 'FAMILY_MODE_STRICT'])
        .optional()
        .describe('Content filtering level (default: FAMILY_MODE_MODERATE)'),
    },
  },
  async ({ query, maxResults, includeImages, region, page, familyMode }) => {
    const results = await search(query, {
      maxResults,
      includeImages,
      region,
      page,
      familyMode,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ query, totalResults: results.length, results }, null, 2),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Yandex Search MCP server running on stdio');
