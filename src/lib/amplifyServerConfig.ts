// Server-side Amplify configuration — imported only by ownerStore and statsStore,
// which run exclusively in API routes and getServerSideProps (Node.js context).
// ssr: true suppresses browser-specific Amplify internals (localStorage etc.).
// authMode 'apiKey' is used for all data operations so no user session is needed
// server-side — ownership is enforced by comparing ownerId values, matching the
// existing prototype behaviour described in CLAUDE.md.
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../amplify_outputs.json");

Amplify.configure(outputs, { ssr: true });

export const dataClient = generateClient<Schema>({ authMode: "apiKey" });
