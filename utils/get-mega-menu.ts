"use server";
import { cache } from "react";

const MEGAMENU_API_URL = "https://www.ssw.com.au/api/get-megamenu";

export const getMegamenu = cache(async () => {
  const data = await fetch(MEGAMENU_API_URL)
    .then((res) => res.json())
    .catch((error) => {
      console.error(`[getMegamenu] fetch failed url="${MEGAMENU_API_URL}":`, error);
      throw error;
    });

  return data;
});
