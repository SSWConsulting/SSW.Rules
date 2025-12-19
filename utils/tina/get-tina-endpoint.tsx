// We can't use the config file because it's not available on the server side as it's client-side only
// import { config } from "../../tina/config";

export const getTinaEndpoint = (activeBranch?: string): string | null => {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:4001/graphql";
  }

  const clientId = process.env.NEXT_PUBLIC_TINA_CLIENT_ID;
  const branch =
    activeBranch ||
    process.env.NEXT_PUBLIC_TINA_BRANCH || // custom branch env override
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || // Vercel branch env
    process.env.HEAD; // Netlify branch env

  if (!clientId || !branch) {
    return null;
  }

  return `https://content.tinajs.io/1.5/content/${clientId}/github/${branch}`;
};
