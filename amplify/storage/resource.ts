import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "ptEvidence",
  access: (allow) => ({
    // PT evidence uploads: authenticated users can upload, admins can read
    "pt-evidence/{entity_id}/*": [
      allow.authenticated.to(["read", "write"]),
    ],
    // Public read for profile images (future use)
    "profile-images/*": [
      allow.guest.to(["read"]),
      allow.authenticated.to(["read", "write"]),
    ],
  }),
});
