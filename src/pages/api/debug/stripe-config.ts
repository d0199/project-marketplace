import type { NextApiRequest, NextApiResponse } from "next";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId  = process.env.AMPLIFY_APP_ID;
  const region = process.env.AWS_REGION ?? "ap-southeast-2";
  const paths  = [
    `/amplify/shared/${appId}/STRIPE_SECRET_KEY`,
    `/amplify/shared/${appId}/STRIPE_WEBHOOK_SECRET`,
  ];

  const result: Record<string, unknown> = { appId, region, paths };

  try {
    const client = new SSMClient({ region });
    const r = await client.send(
      new GetParametersCommand({ Names: paths, WithDecryption: false })
    );
    result.found    = r.Parameters?.map(p => p.Name) ?? [];
    result.invalid  = r.InvalidParameters ?? [];
    result.keyFound = (r.Parameters?.length ?? 0) > 0;
  } catch (err) {
    result.error = String(err);
  }

  return res.status(200).json(result);
}
