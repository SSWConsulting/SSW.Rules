"use server";
import { cache } from "react";
import client from "@/tina/__generated__/client";

const MEGAMENU_API_URL = "https://www.ssw.com.au/api/get-megamenu";

export const getMegamenu = cache(async () => {
  const data = await fetch(MEGAMENU_API_URL).then((res) => res.json());

  return data;
});
export type MegaMenuProps = Awaited<ReturnType<typeof client.queries.megamenu>>;
