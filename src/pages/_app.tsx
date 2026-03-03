import type { AppProps } from "next/app";
import { Amplify } from "aws-amplify";
import "@/styles/globals.css";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../amplify_outputs.json");

// Only configure Amplify Auth once real values are available.
// Until `npx ampx sandbox` has been run and amplify_outputs.json is updated,
// auth calls are no-ops and the owner portal login will gracefully fail.
const apiKey: unknown = outputs?.data?.api_key;
if (typeof apiKey === "string" && !apiKey.startsWith("PLACEHOLDER")) {
  Amplify.configure(outputs);
}

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
