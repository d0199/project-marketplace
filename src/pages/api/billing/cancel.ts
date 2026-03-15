import type { NextApiRequest, NextApiResponse } from "next";
import { getStripe } from "@/lib/stripe";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { requireUser } from "@/lib/userAuth";
import { sendSubscriptionCancelledEmail } from "@/lib/customerEmail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  const { gymId, entityType } = req.body as { gymId: string; entityType?: "gym" | "pt" };
  if (!gymId) return res.status(400).json({ error: "Missing required fields" });

  const isPT = entityType === "pt";

  // Look up entity and verify ownership
  let subscriptionId: string | undefined;
  let entityName = "";

  if (isPT) {
    const pt = await ptStore.getById(gymId);
    if (!pt) return res.status(404).json({ error: "Entity not found" });
    if (pt.ownerId !== user.ownerId && !user.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    subscriptionId = pt.stripeSubscriptionId;
    entityName = pt.name;
  } else {
    const gym = await ownerStore.getById(gymId);
    if (!gym) return res.status(404).json({ error: "Entity not found" });
    if (gym.ownerId !== user.ownerId && !user.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    subscriptionId = gym.stripeSubscriptionId;
    entityName = gym.name;
  }

  if (!subscriptionId) {
    return res.status(404).json({ error: "No active subscription found" });
  }

  const stripe = await getStripe();

  // Cancel at period end — features remain active until the billing period ends
  const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = updated as any;
  const periodEndTs: number | undefined = raw.current_period_end ?? raw.cancel_at;
  const periodEnd = periodEndTs
    ? new Date(periodEndTs * 1000).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : "the end of your billing period";

  sendSubscriptionCancelledEmail(user.email, entityName, periodEnd, isPT ? "pt" : "gym").catch(() => {});

  return res.status(200).json({ ok: true, periodEnd });
}
