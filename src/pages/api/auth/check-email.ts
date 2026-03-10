import type { NextApiRequest, NextApiResponse } from "next";
import { getCognitoAdmin, USER_POOL_ID } from "@/lib/cognitoAdmin";
import { ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";

/**
 * GET /api/auth/check-email?email=user@example.com
 * Returns { exists: boolean } — used by claim modals to suggest signing in.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const email = String(req.query.email ?? "").toLowerCase().trim();
  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    const cognitoClient = getCognitoAdmin();
    const result = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: `email = "${email}"`,
        Limit: 1,
      })
    );
    return res.status(200).json({ exists: (result.Users?.length ?? 0) > 0 });
  } catch {
    // If Cognito check fails, don't block the user
    return res.status(200).json({ exists: false });
  }
}
