import { fetchAuthSession } from "aws-amplify/auth";

/** Authenticated fetch for owner portal — sends Cognito access token.
 *  If impersonating (sessionStorage "impersonateOwnerId"), sends the header. */
export async function ownerFetch(url: string, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  const impersonateOwnerId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("impersonateOwnerId")
      : null;
  const impersonateEmail =
    typeof window !== "undefined"
      ? sessionStorage.getItem("impersonateEmail")
      : null;
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(impersonateOwnerId ? { "X-Impersonate-OwnerId": impersonateOwnerId } : {}),
      ...(impersonateOwnerId && impersonateEmail ? { "X-Impersonate-Email": impersonateEmail } : {}),
    },
  });
}
