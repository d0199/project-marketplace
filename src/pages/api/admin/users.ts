import type { NextApiRequest, NextApiResponse } from "next";
import {
  ListUsersCommand,
  AdminCreateUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoAdmin as cognitoClient, USER_POOL_ID } from "@/lib/cognitoAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const q = String(req.query.q ?? "").trim();
    try {
      const cmd = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Limit: 60,
        ...(q ? { Filter: `email ^= "${q}"` } : {}),
      });
      const { Users = [] } = await cognitoClient.send(cmd);

      const users = Users.map((u) => {
        const attrs = Object.fromEntries(
          (u.Attributes ?? []).map((a) => [a.Name, a.Value])
        );
        return {
          username: u.Username,
          email: attrs["email"],
          status: u.UserStatus,
          ownerId: attrs["custom:ownerId"] ?? "",
          isAdmin: attrs["custom:isAdmin"] ?? "",
          enabled: u.Enabled,
          createdAt: u.UserCreateDate,
        };
      });

      return res.status(200).json(users);
    } catch (err) {
      console.error("[admin/users GET]", err);
      return res.status(500).json({ error: String(err) });
    }
  }

  if (req.method === "POST") {
    const { email, password, ownerId, isAdmin } = req.body as {
      email: string;
      password: string;
      ownerId?: string;
      isAdmin?: boolean;
    };

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    try {
      const userAttributes = [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
      ];
      if (ownerId) userAttributes.push({ Name: "custom:ownerId", Value: ownerId });
      if (isAdmin) userAttributes.push({ Name: "custom:isAdmin", Value: "true" });

      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          TemporaryPassword: password,
          UserAttributes: userAttributes,
        })
      );

      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("[admin/users POST]", err);
      return res.status(500).json({ error: String(err) });
    }
  }

  return res.status(405).end();
}
