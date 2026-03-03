import { defineAuth } from "@aws-amplify/backend";

// Email + password sign-in. Gym owner accounts are admin-created in the
// Cognito console — self-registration is not enabled.
// Each user has a custom:ownerId attribute (e.g. "owner-1") that is used
// by the data authorization rules and by client-side ownership checks.
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
