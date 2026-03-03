import type { NextApiRequest, NextApiResponse } from "next";

export interface ClaimRequest {
  gymId: string;
  gymName: string;
  gymAddress: string;
  gymWebsite?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  submittedAt: string;
}

// In-memory store until email/DynamoDB is wired up.
// TODO: replace with SES notification + DynamoDB ClaimRequest model once
// the Amplify backend is deployed. Each submission should trigger an email
// to admin@mynextgym.com.au for review.
const pendingClaims: ClaimRequest[] = [];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { gymId, gymName, gymAddress, gymWebsite, name, email, phone, message } =
    req.body as Partial<ClaimRequest>;

  if (!gymId || !name || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const claim: ClaimRequest = {
    gymId,
    gymName: gymName ?? "",
    gymAddress: gymAddress ?? "",
    gymWebsite: gymWebsite ?? "",
    name,
    email,
    phone: phone ?? "",
    message: message ?? "",
    submittedAt: new Date().toISOString(),
  };

  pendingClaims.push(claim);
  console.log("[claim-request]", claim);

  return res.status(200).json({ ok: true });
}
