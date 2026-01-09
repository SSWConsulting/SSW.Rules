import crypto from 'crypto';

export function extractUsernameFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    if (trimmed.toLowerCase().startsWith('http')) {
      const u = new URL(trimmed);
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length > 0) return segments[0].replace(/^@/, '');
    }
  } catch {
    // Ignore URL parsing errors and try regex-based cleanup
  }
  const cleaned = trimmed
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^@/, '')
    .replace(/^\//, '');
  const username = cleaned.split('/')[0].trim();
  return username || null;
}

// ---------------- GitHub App Authentication ----------------

interface CachedToken {
  token: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

/**
 * Converts base64 to base64url (URL-safe base64)
 */
function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generates a JWT token for GitHub App authentication
 * @param appId GitHub App ID
 * @param privateKey GitHub App private key (PEM format, can be base64 encoded)
 * @returns JWT token string
 */
function generateJWT(appId: string, privateKey: string): string {
  // Decode base64 private key if needed
  let key = privateKey;
  if (!key.includes('-----BEGIN')) {
    key = Buffer.from(privateKey, 'base64').toString('utf-8');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued at time (60 seconds in the past to allow for clock skew)
    exp: now + 600, // Expires in 10 minutes
    iss: appId, // Issuer (GitHub App ID)
  };

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // Use base64url encoding (URL-safe base64)
  const encodedHeader = base64ToBase64Url(Buffer.from(JSON.stringify(header)).toString('base64'));
  const encodedPayload = base64ToBase64Url(Buffer.from(JSON.stringify(payload)).toString('base64'));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = base64ToBase64Url(
    crypto.createSign('RSA-SHA256').update(signatureInput).sign(key, 'base64')
  );

  return `${signatureInput}.${signature}`;
}

/**
 * Gets an installation access token for the GitHub App
 * @param appId GitHub App ID
 * @param privateKey GitHub App private key
 * @param installationId GitHub App installation ID (optional, will auto-detect if not provided)
 * @returns Installation access token
 */
async function getInstallationToken(
  appId: string,
  privateKey: string,
  installationId?: string
): Promise<string> {
  const jwt = generateJWT(appId, privateKey);

  // If installation ID is not provided, try to auto-detect it
  let targetInstallationId = installationId;
  if (!targetInstallationId) {
    const installationsResponse = await fetch('https://api.github.com/app/installations', {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Rules.V3',
      },
    });

    if (!installationsResponse.ok) {
      throw new Error(
        `Failed to fetch GitHub App installations: ${installationsResponse.status} ${installationsResponse.statusText}`
      );
    }

    const installations = await installationsResponse.json();
    if (!Array.isArray(installations) || installations.length === 0) {
      throw new Error('No GitHub App installations found');
    }

    // Use the first installation (or you could filter by owner/repo if needed)
    targetInstallationId = installations[0].id.toString();
  }

  const tokenResponse = await fetch(
    `https://api.github.com/app/installations/${targetInstallationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Rules.V3',
      },
    }
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(
      `Failed to get installation token: ${tokenResponse.status} ${tokenResponse.statusText}. ${errorText}`
    );
  }

  const tokenData = await tokenResponse.json();
  return tokenData.token;
}

/**
 * Gets a valid GitHub App installation access token, using cache when available
 * @returns Installation access token
 */
export async function getGitHubAppToken(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

  if (!appId || !privateKey) {
    throw new Error(
      'GitHub App credentials are not configured. Please set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY environment variables.'
    );
  }

  // Check if we have a valid cached token (with 5 minute buffer before expiry)
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 5 * 60 * 1000) {
    return tokenCache.token;
  }

  // Get a new token
  const token = await getInstallationToken(appId, privateKey, installationId);

  // Cache the token (GitHub tokens expire in 1 hour)
  tokenCache = {
    token,
    expiresAt: now + 55 * 60 * 1000, // Cache for 55 minutes to be safe
  };

  return token;
}


