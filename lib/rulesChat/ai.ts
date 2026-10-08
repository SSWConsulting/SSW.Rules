import type { AccessToken, TokenCredential } from "@azure/identity";
import { getRulesChatConfig } from "./config";

const FOUNDRY_SCOPE = "https://cognitiveservices.azure.com/.default";
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

let credential: TokenCredential | undefined;
let cachedToken: AccessToken | undefined;

// Locally the models run in Ollama, which takes any API key. Foundry has keys turned off, so on Azure each call carries
// a Microsoft Entra token for the site's managed identity.
export async function aiHeaders(): Promise<Record<string, string>> {
  const { aiApiKey } = getRulesChatConfig();
  if (aiApiKey) return { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` };
  if (!cachedToken || cachedToken.expiresOnTimestamp - Date.now() < TOKEN_REFRESH_MARGIN_MS) {
    // Loaded only when needed: with an API key (local development, tests) the Azure SDK never loads.
    const { DefaultAzureCredential } = await import("@azure/identity");
    credential ??= new DefaultAzureCredential({ managedIdentityClientId: process.env.RULES_CHAT_IDENTITY_CLIENT_ID });
    const token = await credential.getToken(FOUNDRY_SCOPE);
    if (!token) throw new Error("Couldn't get a Microsoft Entra token for Microsoft Foundry");
    cachedToken = token;
  }
  return { "Content-Type": "application/json", Authorization: `Bearer ${cachedToken.token}` };
}
