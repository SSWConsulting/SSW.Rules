import { cookies } from "next/headers";

export const getBranch = async () => {
  try {
    const cookieStore = await cookies();
    const branchValue = cookieStore.get("x-branch")?.value || "";
    console.log("[getBranch] Cookie x-branch value:", cookieStore.get("x-branch")?.value, "returning:", branchValue);
    return branchValue;
  } catch (error) {
    // During build time or when cookies are not available, return empty string
    // This is safe because cookies() may not be available during static generation
    console.log("[getBranch] Error reading cookies:", error);
    return "";
  }
};

export const getFetchOptions = async (branch?: string) => {
  // If branch is provided, use it directly (for use in cached functions)
  // Otherwise, read from cookies (for backward compatibility)
  const branchValue = branch !== undefined ? branch : await getBranch();
  console.log("[getFetchOptions] Branch value:", branchValue, branch !== undefined ? "(provided as param)" : "(from cookies)");
  const options = branchValue
    ? {
        fetchOptions: {
          headers: {
            "x-branch": branchValue,
          },
        },
      }
    : undefined;
  console.log("[getFetchOptions] Returning options:", JSON.stringify(options));
  return options;
};
