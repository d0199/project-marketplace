import { fetchAuthSession } from "aws-amplify/auth";

/** Authenticated fetch — sends Cognito access token with every admin API call */
export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
