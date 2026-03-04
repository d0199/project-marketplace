import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../amplify_outputs.json");

// On Amplify Hosting the SSR Lambda execution role doesn't automatically have
// Cognito admin permissions. Set ADMIN_AWS_ACCESS_KEY_ID + ADMIN_AWS_SECRET_ACCESS_KEY
// as environment variables in Amplify Console (use the marketplace-local IAM key).
// Locally those can go in .env.local — or leave unset and use ~/.aws/credentials.
const explicitCredentials =
  process.env.ADMIN_AWS_ACCESS_KEY_ID && process.env.ADMIN_AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.ADMIN_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.ADMIN_AWS_SECRET_ACCESS_KEY,
        },
      }
    : {};

export const cognitoAdmin = new CognitoIdentityProviderClient({
  region: outputs.auth.aws_region,
  ...explicitCredentials,
});

export const USER_POOL_ID: string = outputs.auth.user_pool_id;
