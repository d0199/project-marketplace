import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    "custom:ownerId": {
      dataType: "String",
      mutable: true,
    },
    "custom:isAdmin": {
      dataType: "String",
      mutable: true,
    },
  },
});
