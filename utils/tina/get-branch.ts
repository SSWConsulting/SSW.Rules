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

export const getFetchOptions = async () => {
  const branch = await getBranch();
  console.log("[getFetchOptions] Branch from getBranch():", branch);
  const options = branch
    ? {
        fetchOptions: {
          headers: {
            "x-branch": branch,
          },
        },
      }
    : undefined;
  console.log("[getFetchOptions] Returning options:", JSON.stringify(options));
  return options;
};
