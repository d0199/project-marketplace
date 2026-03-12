import { useState, useEffect } from "react";

interface ApiFlags {
  claudeApi: boolean;
  googleApi: boolean;
}

const DEFAULTS: ApiFlags = { claudeApi: true, googleApi: true };

let cached: ApiFlags | null = null;

/** Client-side hook to check claudeApi / googleApi feature flags. Fetches once per page load. */
export function useApiFlags(): ApiFlags {
  const [flags, setFlags] = useState<ApiFlags>(cached ?? DEFAULTS);

  useEffect(() => {
    if (cached) return;
    fetch("/api/api-status")
      .then((r) => r.json())
      .then((data) => {
        cached = {
          claudeApi: data.claudeApi ?? true,
          googleApi: data.googleApi ?? true,
        };
        setFlags(cached);
      })
      .catch(() => {});
  }, []);

  return flags;
}
