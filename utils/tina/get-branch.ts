import { cookies } from "next/headers";

export const getBranch = async () => {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("x-branch")?.value || "";
  } catch (error) {
    // During build time or when cookies are not available, return empty string
    // This is safe because cookies() may not be available during static generation
    return "";
  }
};

export const getFetchOptions = async () => {
  const branch = await getBranch();
  return branch
    ? {
        fetchOptions: {
          headers: {
            "x-branch": branch,
          },
        },
      }
    : undefined;
};
