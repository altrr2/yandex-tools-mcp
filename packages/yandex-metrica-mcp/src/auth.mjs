import readline from 'node:readline';

const OAUTH_URL = 'https://oauth.yandex.ru/authorize';
const TOKEN_URL = 'https://oauth.yandex.ru/token';

function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';

  import('node:child_process').then(({ exec }) => {
    exec(`${start} "${url}"`);
  });
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function exchangeCodeForToken(code, clientId, clientSecret) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function runAuth() {
  const clientId = process.env.YANDEX_CLIENT_ID;
  const clientSecret = process.env.YANDEX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing credentials. Set environment variables:');
    console.error('  export YANDEX_CLIENT_ID=your_client_id');
    console.error('  export YANDEX_CLIENT_SECRET=your_client_secret');
    console.error('');
    console.error('Get these from https://oauth.yandex.ru/client/new by creating an app with Metrica API access.');
    console.error('Required scopes: metrika:read');
    console.error('');
    console.error('Then run: npx yandex-metrica-mcp auth');
    process.exit(1);
  }

  console.log('Starting OAuth flow for Yandex Metrica...\n');

  const authUrl = `${OAUTH_URL}?response_type=code&client_id=${clientId}`;

  console.log('Opening browser for authorization...');
  console.log("If browser doesn't open, visit this URL manually:\n");
  console.log(authUrl);
  console.log('');

  openBrowser(authUrl);

  const code = await prompt('Paste the authorization code from Yandex: ');

  if (!code) {
    console.error('No code provided. Aborting.');
    process.exit(1);
  }

  console.log('\nExchanging code for token...');

  try {
    const token = await exchangeCodeForToken(code, clientId, clientSecret);

    console.log('\n✓ Authorization successful!\n');
    console.log('Your access token:');
    console.log('─'.repeat(50));
    console.log(token);
    console.log('─'.repeat(50));
    console.log('\nAdd it to your MCP config:');
    console.log(`
{
  "mcpServers": {
    "yandex-metrica": {
      "command": "npx",
      "args": ["-y", "yandex-metrica-mcp"],
      "env": {
        "YANDEX_METRICA_TOKEN": "${token}"
      }
    }
  }
}
`);
  } catch (err) {
    console.error('Failed to get token:', err);
    process.exit(1);
  }
}
