import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../amplify_outputs.json");

export const USER_POOL_ID: string = outputs.auth.user_pool_id;

/**
 * Creates a Cognito admin client per-request.
 * Credentials come from the Amplify Hosting compute role (IAM role attached
 * in Amplify Console → Hosting → Compute role). That role must have:
 *   cognito-idp:ListUsers, AdminCreateUser, AdminSetUserPassword,
 *   AdminUpdateUserAttributes on the user pool.
 */
export function getCognitoAdmin(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({
    region: outputs.auth.aws_region,
  });
}
