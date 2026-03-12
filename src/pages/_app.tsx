import type { AppProps } from "next/app";
import Script from "next/script";
import { Amplify } from "aws-amplify";
import "@/styles/globals.css";
import { DynamicIconProvider } from "@/lib/DynamicIconContext";

const GA_MEASUREMENT_ID = "G-PE18WDRRB4";
const IS_PRODUCTION =
  process.env.NEXT_PUBLIC_BASE_URL === "https://www.mynextgym.com.au";
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
  return (
    <>
      {IS_PRODUCTION && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}
      <DynamicIconProvider>
        <Component {...pageProps} />
      </DynamicIconProvider>
    </>
  );
}
