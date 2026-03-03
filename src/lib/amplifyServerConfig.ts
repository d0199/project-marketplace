// Server-side Amplify configuration — imported only by ownerStore and statsStore.
// ssr: true suppresses browser-specific Amplify internals (localStorage etc.).
// authMode 'apiKey' is used so no user session is needed server-side.
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../amplify_outputs.json");

// Returns true once amplify_outputs.json has been replaced with real values
// from `npx ampx sandbox` or the Amplify pipeline deploy.
export function isAmplifyConfigured(): boolean {
  const apiKey: unknown = outputs?.data?.api_key;
  return (
    typeof apiKey === "string" &&
    apiKey.length > 0 &&
    !apiKey.startsWith("PLACEHOLDER")
  );
}

if (isAmplifyConfigured()) {
  Amplify.configure(outputs, { ssr: true });
}

export const dataClient = generateClient<Schema>({ authMode: "apiKey" });
