import client from "@/tina/__generated__/client";
import { cache } from "react";

export const getMegamenu = cache(async () => {
  const data = await client.queries.megamenu({
    relativePath: "menu.json",
  });

  return data;
});
export type MegaMenuProps = Awaited<ReturnType<typeof client.queries.megamenu>>;
