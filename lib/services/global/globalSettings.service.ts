import { unstable_cache } from "next/cache";
import { tinaRetryOptions, withTinaRetry } from "@/lib/tina/tinaRequest";
import client from "@/tina/__generated__/client";

// The root layout reads the global settings, so this tag is on each page of the site.
// A revalidation of the tag renders all pages again.
export const GLOBAL_SETTINGS_TAG = "global-settings";

async function fetchGlobalSettings() {
  const { data } = await withTinaRetry("global", (attempt) => client.queries.global({ relativePath: "index.json" }, tinaRetryOptions(attempt)));
  return data.global;
}

// - No `revalidate`: Next.js copies a number to each page that calls this function and renders the page again
//   after that time. The root layout calls it, so a number here becomes the revalidation period of the whole
//   site. A change gets to the pages through GLOBAL_SETTINGS_TAG.
// - `unstable_cache`, not `fetchOptions` on the Tina request: in a build, the Tina client answers a repeated
//   query from its own disk cache and does not call `fetch`. Tags and periods in `fetchOptions` then apply only
//   to the few pages that send the request.
export const getGlobalSettings = unstable_cache(fetchGlobalSettings, ["global-settings"], { tags: [GLOBAL_SETTINGS_TAG] });
