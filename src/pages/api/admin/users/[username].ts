import type { NextApiRequest, NextApiResponse } from "next";
import {
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoAdmin, USER_POOL_ID } from "@/lib/cognitoAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = String(req.query.username);

  if (req.method === "DELETE") {
    try {
      await getCognitoAdmin().send(
        new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
      );
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[admin/users DELETE]", err);
      return res.status(500).json({ error: String(err) });
    }
  }

  if (req.method === "PATCH") {
    const { password, ownerId, isAdmin } = req.body as {
      password?: string;
      ownerId?: string;
      isAdmin?: string;
    };

    try {
      const cognito = getCognitoAdmin();

      if (password) {
        await cognito.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            Password: password,
            Permanent: true,
          })
        );
      }

      const attrs: { Name: string; Value: string }[] = [];
      if (ownerId !== undefined) attrs.push({ Name: "custom:ownerId", Value: ownerId });
      if (isAdmin !== undefined) attrs.push({ Name: "custom:isAdmin", Value: isAdmin });

      if (attrs.length > 0) {
        await cognito.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            UserAttributes: attrs,
          })
        );
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[admin/users PATCH]", err);
      return res.status(500).json({ error: String(err) });
    }
  }

  return res.status(405).end();
}
