import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../amplify_outputs.json");

export const USER_POOL_ID: string = outputs.auth.user_pool_id;

/**
 * Creates a Cognito client per-request (not a module singleton) so env vars
 * are read at call time, not at Lambda cold-start / build time.
 *
 * Credential priority:
 *  1. ADMIN_AWS_ACCESS_KEY_ID + ADMIN_AWS_SECRET_ACCESS_KEY  (set in Amplify Console)
 *  2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY              (Lambda execution role)
 *
 * If neither pair is present, throws with a clear message.
 */
export function getCognitoAdmin(): CognitoIdentityProviderClient {
  const accessKeyId =
    process.env.ADMIN_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.ADMIN_AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken =
    process.env.ADMIN_AWS_SESSION_TOKEN ?? process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cognito admin credentials not found. " +
      "Set ADMIN_AWS_ACCESS_KEY_ID and ADMIN_AWS_SECRET_ACCESS_KEY in Amplify Console environment variables."
    );
  }

  return new CognitoIdentityProviderClient({
    region: outputs.auth.aws_region,
    credentials: {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    },
  });
}
