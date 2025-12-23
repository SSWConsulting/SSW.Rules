"use server";
import { cache } from "react";

const MEGAMENU_API_URL = "https://www.ssw.com.au/api/get-megamenu";

export const getMegamenu = cache(async () => {
  const data = await fetch(MEGAMENU_API_URL).then((res) => res.json());

  return data;
});
