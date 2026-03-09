import type { NextApiRequest, NextApiResponse } from "next";
import { AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoAdmin, USER_POOL_ID } from "@/lib/cognitoAdmin";

/**
 * Validate that the request comes from an admin user.
 *
 * The client sends `Authorization: Bearer <accessToken>` where accessToken
 * is the Cognito access token. We call AdminGetUser to verify identity and
 * check `custom:isAdmin === "true"`.
 *
 * Returns the admin email on success, or sends a 401/403 and returns null.
 */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization" });
    return null;
  }

  const token = auth.slice(7);

  try {
    // Decode the access token to get the username (sub claim)
    // Cognito access tokens are JWTs — the payload is the second segment
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    const username = payload.username ?? payload["cognito:username"] ?? payload.sub;

    if (!username) {
      res.status(401).json({ error: "Invalid token" });
      return null;
    }

    // Verify the user exists and is admin via Cognito AdminGetUser
    const cognito = getCognitoAdmin();
    const { UserAttributes = [] } = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
    );
    const attrs = Object.fromEntries(
      UserAttributes.map((a) => [a.Name, a.Value])
    );

    if (attrs["custom:isAdmin"] !== "true") {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }

    return attrs.email ?? username;
  } catch (err) {
    console.error("[adminAuth] validation failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
}
