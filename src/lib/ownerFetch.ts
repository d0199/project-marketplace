import { fetchAuthSession } from "aws-amplify/auth";

/** Authenticated fetch for owner portal — sends Cognito access token */
export async function ownerFetch(url: string, init?: RequestInit): Promise<Response> {
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
