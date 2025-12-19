import { getTinaEndpoint } from "./get-tina-endpoint";

export class TinaGraphQLClient {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(token: string, branch?: string) {
    const endpoint = getTinaEndpoint(branch);
    if (!endpoint) throw new Error("TinaCMS endpoint is not configured");

    this.endpoint = endpoint;
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async request<T = any>(query: string, variables: Record<string, any>): Promise<T> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ query, variables }),
      });

      const json = await response.json();

      if (!response.ok || json.errors) {
        const errorMsg = json.errors?.map((e: any) => e.message).join(", ") || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      return json.data;
    } catch (err) {
      console.error("Tina GraphQL request failed:", err);
      throw err;
    }
  }
}
