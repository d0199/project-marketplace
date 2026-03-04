import type { NextApiRequest, NextApiResponse } from "next";
import {
  AdminCreateUserCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { ownerStore } from "@/lib/ownerStore";
import { getCognitoAdmin, USER_POOL_ID } from "@/lib/cognitoAdmin";

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
    try {
      const claims = await listAllClaims();
      claims.sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      );
      return res.status(200).json(claims);
    } catch (err) {
      console.error("[admin/claims GET]", err);
      return res.status(500).json({ error: String(err) });
    }
  }

  if (req.method === "PATCH") {
    const { action, id } = req.query as { action: string; id: string };
    const { notes } = req.body as { notes?: string };

    if (!id) return res.status(400).json({ error: "Missing id" });

    if (action === "reject") {
      try {
        await dataClient.models.Claim.update({ id, status: "rejected", notes: notes ?? "" });
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("[admin/claims reject]", err);
        return res.status(500).json({ error: String(err) });
      }
    }

    if (action === "approve") {
      try {
        const { data: claim } = await dataClient.models.Claim.get({ id });
        if (!claim) return res.status(404).json({ error: "Claim not found" });

        const gym = await ownerStore.getById(claim.gymId ?? "");
        if (!gym) return res.status(404).json({ error: `Gym not found: ${claim.gymId}` });

        const email = claim.claimantEmail ?? "";
        const cognitoClient = getCognitoAdmin();

        // Check if a Cognito user already exists for this email
        const { Users = [] } = await cognitoClient.send(
          new ListUsersCommand({
            UserPoolId: USER_POOL_ID,
            Filter: `email = "${email}"`,
            Limit: 1,
          })
        );

        let ownerId: string;
        let isNewUser: boolean;

        if (Users.length > 0) {
          // Existing user — use their current ownerId
          const attrs = Object.fromEntries(
            (Users[0].Attributes ?? []).map((a) => [a.Name, a.Value])
          );
          ownerId = attrs["custom:ownerId"] ?? `owner-${id.slice(0, 8)}`;
          isNewUser = false;
        } else {
          // New user — create Cognito account and send welcome email
          ownerId = `owner-${id.slice(0, 8)}`;
          const tempPassword = `Claim${claim.gymId}1!`;
          await cognitoClient.send(
            new AdminCreateUserCommand({
              UserPoolId: USER_POOL_ID,
              Username: email,
              TemporaryPassword: tempPassword,
              UserAttributes: [
                { Name: "email", Value: email },
                { Name: "email_verified", Value: "true" },
                { Name: "custom:ownerId", Value: ownerId },
              ],
            })
          );
          isNewUser = true;
        }

        // Assign ownerId to gym and mark claim approved
        await ownerStore.update({ ...gym, ownerId });
        await dataClient.models.Claim.update({
          id,
          status: "approved",
          notes: notes ?? (isNewUser
            ? `Approved — new Cognito user created, ownerId: ${ownerId}`
            : `Approved — gym added to existing user account, ownerId: ${ownerId}`),
        });

        return res.status(200).json({ ok: true, ownerId, isNewUser });
      } catch (err) {
        console.error("[admin/claims approve]", err);
        return res.status(500).json({ error: String(err) });
      }
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  return res.status(405).end();
}
