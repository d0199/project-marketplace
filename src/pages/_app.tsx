import type { AppProps } from "next/app";
import { Amplify } from "aws-amplify";
import "@/styles/globals.css";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../../amplify_outputs.json");

// Configure Amplify once for all client-side auth operations (signIn, signOut,
// getCurrentUser, fetchUserAttributes). The server-side data stores configure
// Amplify separately with { ssr: true } in amplifyServerConfig.ts.
Amplify.configure(outputs);

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
