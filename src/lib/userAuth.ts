import type { NextApiRequest, NextApiResponse } from "next";
import { AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoAdmin, USER_POOL_ID } from "@/lib/cognitoAdmin";

/**
 * Validate that the request comes from an authenticated Cognito user.
 * Returns { email, ownerId, isAdmin } on success, or sends 401 and returns null.
 *
 * The client must send `Authorization: Bearer <accessToken>`.
 *
 * Admin impersonation: if the caller is an admin and sends
 * `X-Impersonate-OwnerId`, the returned ownerId is overridden to that value.
 */
export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ email: string; ownerId: string; isAdmin: boolean } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization" });
    return null;
  }

  const token = auth.slice(7);
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    const username = payload.username ?? payload["cognito:username"] ?? payload.sub;
    if (!username) {
      res.status(401).json({ error: "Invalid token" });
      return null;
    }

    const cognito = getCognitoAdmin();
    const { UserAttributes = [] } = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
    );
    const attrs = Object.fromEntries(
      UserAttributes.map((a) => [a.Name, a.Value])
    );

    const isAdmin = attrs["custom:isAdmin"] === "true";
    let ownerId = attrs["custom:ownerId"] ?? "";

    // Admin impersonation — allow admin users to act as another ownerId
    const impersonate = req.headers["x-impersonate-ownerid"] as string | undefined;
    if (impersonate) {
      if (!isAdmin) {
        res.status(403).json({ error: "Only admins can impersonate" });
        return null;
      }
      ownerId = impersonate;
    }

    return {
      email: attrs.email ?? username,
      ownerId,
      isAdmin,
    };
  } catch (err) {
    console.error("[userAuth] validation failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
}
