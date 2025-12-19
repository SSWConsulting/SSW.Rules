import { config } from "../../tina/config";
// this can only be used in the client side

export const getBearerAuthHeader = (): Record<string, string> => {
  const tinacmsAuthString = localStorage.getItem("tinacms-auth");
  let token: string | null = null;
  try {
    const authData = tinacmsAuthString ? JSON.parse(tinacmsAuthString) : null;
    token = authData?.id_token || config.token || null;
  } catch (e) {
    token = config.token || null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};
