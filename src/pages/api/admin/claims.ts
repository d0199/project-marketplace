import type { NextApiRequest, NextApiResponse } from "next";
import {
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { getCognitoAdmin, USER_POOL_ID } from "@/lib/cognitoAdmin";
import { requireAdmin } from "@/lib/adminAuth";
import { POSTCODE_COORDS } from "@/lib/utils";

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
  if (!(await requireAdmin(req, res))) return;

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

        const email = claim.claimantEmail ?? "";
        const cognitoClient = getCognitoAdmin();

        // Create or find Cognito user
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
          const attrs = Object.fromEntries(
            (Users[0].Attributes ?? []).map((a) => [a.Name, a.Value])
          );
          const existingOwnerId = attrs["custom:ownerId"];
          ownerId = existingOwnerId ?? `owner-${crypto.randomUUID()}`;
          isNewUser = false;
          // If existing user had no ownerId, write the generated one back to Cognito
          if (!existingOwnerId) {
            await cognitoClient.send(
              new AdminUpdateUserAttributesCommand({
                UserPoolId: USER_POOL_ID,
                Username: Users[0].Username!,
                UserAttributes: [{ Name: "custom:ownerId", Value: ownerId }],
              })
            );
          }
        } else {
          ownerId = `owner-${crypto.randomUUID()}`;
          const tempPassword = `Welcome${id.slice(0, 4).toUpperCase()}1!`;
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

        const claimType = (claim as Record<string, unknown>).claimType as string | undefined;

        if (claimType === "pt") {
          // PT profile claim — assign ownership
          const pt = await ptStore.getById(claim.gymId ?? "");
          if (!pt) return res.status(404).json({ error: `PT not found: ${claim.gymId}` });

          await ptStore.update({ ...pt, ownerId });
          await dataClient.models.Claim.update({
            id,
            status: "approved",
            notes: notes ?? (isNewUser
              ? `Approved — PT profile claimed, new Cognito user created, ownerId: ${ownerId}`
              : `Approved — PT profile claimed, added to existing user account, ownerId: ${ownerId}`),
          });

          return res.status(200).json({ ok: true, ownerId, isNewUser });
        } else if (claim.isNewListing) {
          // New listing — create a gym record from submitted details
          const postcode = claim.gymPostcode ?? "";
          const coords = POSTCODE_COORDS[postcode];
          const [lat, lng] = coords ?? [-31.9505, 115.8605]; // Perth default

          const newGym = await ownerStore.create({
            ownerId,
            createdBy: email,
            name: claim.gymName ?? "",
            description: claim.message ?? "",
            address: {
              street: "",
              suburb: claim.gymSuburb ?? "",
              state: "WA",
              postcode,
            },
            lat,
            lng,
            phone: claim.gymPhone || claim.claimantPhone || "",
            email: claim.gymEmail || email,
            website: claim.gymWebsite ?? "",
            amenities: [],
            images: [],
            hours: {},
            pricePerWeek: 0,
            isActive: false, // admin activates once profile is complete
          });

          await dataClient.models.Claim.update({
            id,
            status: "approved",
            gymId: newGym.id,
            notes: notes ?? (isNewUser
              ? `Approved — gym created (${newGym.id}), new Cognito user created, ownerId: ${ownerId}`
              : `Approved — gym created (${newGym.id}), added to existing user account, ownerId: ${ownerId}`),
          });

          return res.status(200).json({ ok: true, ownerId, isNewUser, gymId: newGym.id });
        } else {
          // Existing gym claim — assign ownership and clear AI-generated data
          const gym = await ownerStore.getById(claim.gymId ?? "");
          if (!gym) return res.status(404).json({ error: `Gym not found: ${claim.gymId}` });

          await ownerStore.update({
            ...gym,
            ownerId,
            priceVerified: false,
            pricingNotes: "",
            amenitiesVerified: false,
            amenitiesNotes: "",
          });
          await dataClient.models.Claim.update({
            id,
            status: "approved",
            notes: notes ?? (isNewUser
              ? `Approved — new Cognito user created, ownerId: ${ownerId}`
              : `Approved — gym added to existing user account, ownerId: ${ownerId}`),
          });

          return res.status(200).json({ ok: true, ownerId, isNewUser });
        }
      } catch (err) {
        console.error("[admin/claims approve]", err);
        return res.status(500).json({ error: String(err) });
      }
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  return res.status(405).end();
}
