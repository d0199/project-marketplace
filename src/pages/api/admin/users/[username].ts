import type { NextApiRequest, NextApiResponse } from "next";
import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoAdmin, USER_POOL_ID } from "@/lib/cognitoAdmin";
import { ownerStore } from "@/lib/ownerStore";
import { requireAdmin } from "@/lib/adminAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;

  const username = String(req.query.username);

  if (req.method === "DELETE") {
    try {
      const cognito = getCognitoAdmin();

      // Look up the user's ownerId before deleting so we can release their gyms
      const { UserAttributes = [] } = await cognito.send(
        new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
      );
      const attrs = Object.fromEntries(UserAttributes.map((a) => [a.Name, a.Value]));
      const ownerId = attrs["custom:ownerId"];

      // Release any gyms owned by this user back to unclaimed
      let gymsReleased = 0;
      if (ownerId) {
        const gyms = await ownerStore.getByOwner(ownerId);
        gymsReleased = gyms.length;
        await Promise.all(gyms.map((gym) => ownerStore.update({ ...gym, ownerId: "unclaimed" })));
      }

      await cognito.send(
        new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
      );
      return res.status(200).json({ ok: true, gymsReleased });
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
