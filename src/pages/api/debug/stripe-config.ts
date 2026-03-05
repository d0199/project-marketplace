import type { NextApiRequest, NextApiResponse } from "next";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId  = process.env.AWS_APP_ID;
  const branch = process.env.AWS_BRANCH;
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-southeast-2";

  const branchPaths = [
    `/amplify/${appId}/${branch}/STRIPE_SECRET_KEY`,
    `/amplify/${appId}/${branch}/STRIPE_WEBHOOK_SECRET`,
  ];
  const sharedPaths = [
    `/amplify/${appId}/shared/STRIPE_SECRET_KEY`,
    `/amplify/${appId}/shared/STRIPE_WEBHOOK_SECRET`,
  ];

  const results: Record<string, unknown> = {
    env: { AWS_APP_ID: appId, AWS_BRANCH: branch, AWS_REGION: region },
    branchPaths,
    sharedPaths,
  };

  const client = new SSMClient({ region });

  for (const [label, paths] of [["branch", branchPaths], ["shared", sharedPaths]] as const) {
    try {
      const r = await client.send(new GetParametersCommand({ Names: paths as string[], WithDecryption: false }));
      results[`${label}_found`] = r.Parameters?.map(p => p.Name) ?? [];
      results[`${label}_invalid`] = r.InvalidParameters ?? [];
    } catch (err) {
      results[`${label}_error`] = String(err);
    }
  }

  return res.status(200).json(results);
}
