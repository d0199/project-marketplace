import type { NextApiRequest, NextApiResponse } from "next";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { ownerStore } from "@/lib/ownerStore";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../../../amplify_outputs.json");

const cognitoClient = new CognitoIdentityProviderClient({
  region: outputs.auth.aws_region,
});
const USER_POOL_ID: string = outputs.auth.user_pool_id;

async function listAllClaims() {
  const results: Record<string, unknown>[] = [];
  let nextToken: string | null | undefined;
  do {
    const res = await dataClient.models.Claim.list({ limit: 1000, nextToken });
    results.push(...(res.data ?? []));
    nextToken = res.nextToken;
  } while (nextToken);
  return results;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAmplifyConfigured()) {
    return res.status(503).json({ error: "Backend not configured" });
  }

  if (req.method === "GET") {
    const claims = await listAllClaims();
    claims.sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );
    return res.status(200).json(claims);
  }

  if (req.method === "PATCH") {
    const { action, id } = req.query as { action: string; id: string };

    if (!id) return res.status(400).json({ error: "Missing id" });

    if (action === "reject") {
      await dataClient.models.Claim.update({ id, status: "rejected" });
      return res.status(200).json({ ok: true });
    }

    if (action === "approve") {
      const { data: claim } = await dataClient.models.Claim.get({ id });
      if (!claim) return res.status(404).json({ error: "Claim not found" });

      const gym = await ownerStore.getById(claim.gymId ?? "");
      if (!gym) return res.status(404).json({ error: "Gym not found" });

      const ownerId = `owner-${id.slice(0, 8)}`;
      const tempPassword = `Claim${claim.gymId}!`;

      // Create Cognito user (suppress welcome email via SUPPRESS)
      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: claim.claimantEmail ?? "",
          TemporaryPassword: tempPassword,
          MessageAction: "SUPPRESS",
          UserAttributes: [
            { Name: "email", Value: claim.claimantEmail ?? "" },
            { Name: "email_verified", Value: "true" },
            { Name: "custom:ownerId", Value: ownerId },
          ],
        })
      );

      // Set permanent password so owner doesn't need to reset
      await cognitoClient.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: USER_POOL_ID,
          Username: claim.claimantEmail ?? "",
          Password: tempPassword,
          Permanent: true,
        })
      );

      // Assign ownerId to gym
      await ownerStore.update({ ...gym, ownerId });

      // Mark claim approved
      await dataClient.models.Claim.update({ id, status: "approved" });

      return res.status(200).json({ ok: true, ownerId });
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  return res.status(405).end();
}
