import crypto from "crypto";

export function extractUsernameFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    if (trimmed.toLowerCase().startsWith("http")) {
      const u = new URL(trimmed);
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length > 0) return segments[0].replace(/^@/, "");
    }
  } catch {
    // Ignore URL parsing errors and try regex-based cleanup
  }
  const cleaned = trimmed
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/^\//, "");
  const username = cleaned.split("/")[0].trim();
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
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Normalizes a private key to proper PEM format
 * Handles base64 encoded keys, keys with escaped newlines, etc.
 * @param privateKey The private key in various formats
 * @returns Normalized PEM format key
 */
function normalizePrivateKey(privateKey: string): string {
  // Trim whitespace
  let key = privateKey.trim();

  // Check if key appears truncated (has BEGIN but no END, and no escaped newlines)
  // This indicates .env file only loaded the first line
  if (key.includes("-----BEGIN") && !key.includes("-----END") && !key.includes("\\n")) {
    throw new Error(
      "Private key appears to be truncated (only first line was loaded from .env file).\n" +
        ".env files don't support multi-line values. You must use one of these formats:\n\n" +
        "OPTION 1 - Base64-encoded (RECOMMENDED):\n" +
        "  Convert your PEM key to base64, then use:\n" +
        "  GH_APP_PRIVATE_KEY=LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFcEFJQkFBS0NBUUVB...\n\n" +
        "  To convert on Windows PowerShell:\n" +
        "  [Convert]::ToBase64String([System.IO.File]::ReadAllBytes('your-key.pem'))\n\n" +
        "OPTION 2 - Escaped newlines:\n" +
        "  Replace all actual newlines with \\n:\n" +
        "  GH_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\\nMIIEpAIBAAKCAQEA...\\n-----END RSA PRIVATE KEY-----"
    );
  }

  // If it's already in PEM format, ensure proper newlines
  if (key.includes("-----BEGIN")) {
    // Replace escaped newlines with actual newlines
    key = key.replace(/\\n/g, "\n");
    // Ensure it ends with a newline if it doesn't already
    if (!key.endsWith("\n")) {
      key += "\n";
    }
    return key;
  }

  // Try to decode as base64
  try {
    // Remove any whitespace/newlines from base64 string
    const base64Cleaned = key.replace(/\s/g, "");
    const decoded = Buffer.from(base64Cleaned, "base64").toString("utf-8");

    // Check if decoded result looks like PEM
    if (decoded.includes("-----BEGIN")) {
      // Ensure proper newlines
      let pemKey = decoded.replace(/\\n/g, "\n");
      if (!pemKey.endsWith("\n")) {
        pemKey += "\n";
      }
      return pemKey;
    }

    // If decoded doesn't look like PEM, the original might be the key itself
    // This shouldn't happen, but fall back to original
    throw new Error("Decoded base64 does not contain PEM headers");
  } catch (error) {
    // If base64 decoding fails, try treating it as raw PEM with escaped newlines
    if (key.includes("BEGIN") || key.includes("PRIVATE")) {
      key = key.replace(/\\n/g, "\n");
      if (!key.endsWith("\n")) {
        key += "\n";
      }
      return key;
    }

    throw new Error(
      "Invalid private key format. Expected PEM format (starting with -----BEGIN) or base64-encoded PEM. " +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generates a JWT token for GitHub App authentication
 * @param appId GitHub App ID
 * @param privateKey GitHub App private key (PEM format, can be base64 encoded)
 * @returns JWT token string
 */
function generateJWT(appId: string, privateKey: string): string {
  // Normalize the private key to proper PEM format
  const key = normalizePrivateKey(privateKey);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued at time (60 seconds in the past to allow for clock skew)
    exp: now + 600, // Expires in 10 minutes
    iss: appId, // Issuer (GitHub App ID)
  };

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  // Use base64url encoding (URL-safe base64)
  const encodedHeader = base64ToBase64Url(Buffer.from(JSON.stringify(header)).toString("base64"));
  const encodedPayload = base64ToBase64Url(Buffer.from(JSON.stringify(payload)).toString("base64"));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  try {
    const signature = base64ToBase64Url(crypto.createSign("RSA-SHA256").update(signatureInput).sign(key, "base64"));

    return `${signatureInput}.${signature}`;
  } catch (error) {
    throw new Error(
      `Failed to generate JWT signature. Please verify your private key is correct. ` + `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Gets an installation access token for the GitHub App
 * @param appId GitHub App ID
 * @param privateKey GitHub App private key
 * @param installationId GitHub App installation ID (optional, will auto-detect if not provided)
 * @returns Installation access token
 */
async function getInstallationToken(appId: string, privateKey: string, installationId?: string): Promise<string> {
  const jwt = generateJWT(appId, privateKey);

  // If installation ID is not provided, try to auto-detect it
  let targetInstallationId = installationId;
  if (!targetInstallationId) {
    const installationsResponse = await fetch("https://api.github.com/app/installations", {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Rules.V3",
      },
    });

    if (!installationsResponse.ok) {
      throw new Error(`Failed to fetch GitHub App installations: ${installationsResponse.status} ${installationsResponse.statusText}`);
    }

    const installations = await installationsResponse.json();
    if (!Array.isArray(installations) || installations.length === 0) {
      throw new Error("No GitHub App installations found");
    }

    // Use the first installation (or you could filter by owner/repo if needed)
    targetInstallationId = installations[0].id.toString();
  }

  const tokenResponse = await fetch(`https://api.github.com/app/installations/${targetInstallationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Rules.V3",
    },
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get installation token: ${tokenResponse.status} ${tokenResponse.statusText}. ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.token;
}

/**
 * Gets a valid GitHub App installation access token, using cache when available
 * @returns Installation access token
 */
export async function getGitHubAppToken(): Promise<string> {
  const appId = process.env.GH_APP_ID;
  const privateKey = process.env.GH_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials are not configured. Please set GH_APP_ID and GH_APP_PRIVATE_KEY environment variables.");
  }

  // Check if the private key appears to be truncated (only first line loaded)
  // This happens when .env files have multi-line values without proper escaping
  if (privateKey.includes("-----BEGIN") && !privateKey.includes("-----END")) {
    throw new Error(
      "Private key appears to be truncated (only first line loaded). " +
        ".env files don't support multi-line values. Please use one of these formats:\n" +
        "1. Base64-encoded (RECOMMENDED): Convert your PEM key to base64\n" +
        "2. Escaped newlines: Replace actual newlines with \\n\n" +
        "See README.md for detailed instructions."
    );
  }

  // Check if we have a valid cached token (with 5 minute buffer before expiry)
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 5 * 60 * 1000) {
    return tokenCache.token;
  }

  try {
    // Get a new token
    const token = await getInstallationToken(appId, privateKey, installationId);

    // Cache the token (GitHub tokens expire in 1 hour)
    tokenCache = {
      token,
      expiresAt: now + 55 * 60 * 1000, // Cache for 55 minutes to be safe
    };

    return token;
  } catch (error) {
    // Clear cache on error
    tokenCache = null;

    // Provide more helpful error messages
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("DECODER") || errorMessage.includes("unsupported")) {
      throw new Error(
        `Invalid private key format. The GH_APP_PRIVATE_KEY must be in PEM format ` +
          `(starting with -----BEGIN RSA PRIVATE KEY----- or -----BEGIN PRIVATE KEY-----) ` +
          `or base64-encoded PEM. If your key has escaped newlines (\\n), they will be handled automatically. ` +
          `Original error: ${errorMessage}`
      );
    }

    throw error;
  }
}
