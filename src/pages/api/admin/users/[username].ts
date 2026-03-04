import type { NextApiRequest, NextApiResponse } from "next";
import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../../../../amplify_outputs.json");

const cognitoClient = new CognitoIdentityProviderClient({
  region: outputs.auth.aws_region,
});
const USER_POOL_ID: string = outputs.auth.user_pool_id;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = String(req.query.username);

  if (req.method === "PATCH") {
    const { password, ownerId, isAdmin } = req.body as {
      password?: string;
      ownerId?: string;
      isAdmin?: string;
    };

    if (password) {
      await cognitoClient.send(
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
      await cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
          UserAttributes: attrs,
        })
      );
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
