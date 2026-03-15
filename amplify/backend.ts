import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";
import { storage } from "./storage/resource.js";
import type { CfnUserPool } from "aws-cdk-lib/aws-cognito";

// Re-export Schema so src/lib/* can import it from "../../amplify/backend"
export type { Schema } from "./data/resource.js";

const backend = defineBackend({ auth, data, storage });

// Customize the Cognito invitation email (sent when admin creates a user)
const cfnUserPool = backend.auth.resources.cfnResources
  .cfnUserPool as CfnUserPool;

cfnUserPool.adminCreateUserConfig = {
  ...cfnUserPool.adminCreateUserConfig as object,
  inviteMessageTemplate: {
    emailSubject: "Welcome to mynextgym.com.au — Your account is ready",
    emailMessage: [
      `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">`,
      `<div style="background-color:#111111;padding:24px 32px;border-radius:8px 8px 0 0;text-align:center;">`,
      `<a href="https://www.mynextgym.com.au" style="text-decoration:none;font-size:22px;font-weight:bold;color:#F97316;letter-spacing:0.5px;">mynextgym</a>`,
      `</div>`,
      `<div style="background-color:#F97316;height:4px;"></div>`,
      `<div style="background-color:#FFFFFF;padding:32px;">`,
      `<p style="font-size:16px;color:#111111;margin:0 0 16px;">Hi there,</p>`,
      `<p style="font-size:15px;color:#333333;line-height:1.6;">Your account on <strong>mynextgym.com.au</strong> has been created. Use the details below to sign in to the Owner Portal and start managing your listing.</p>`,
      `<div style="background-color:#F5F5F5;border-radius:8px;padding:16px 20px;margin:20px 0;">`,
      `<p style="margin:0 0 8px;font-size:14px;color:#333333;"><strong>Email:</strong> {username}</p>`,
      `<p style="margin:0;font-size:14px;color:#333333;"><strong>Temporary password:</strong> {####}</p>`,
      `</div>`,
      `<p style="font-size:14px;color:#666666;line-height:1.6;">You'll be asked to set a new password on your first sign-in.</p>`,
      `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto;">`,
      `<tr><td style="border-radius:6px;background-color:#F97316;">`,
      `<a href="https://www.mynextgym.com.au/owner" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:6px;">Sign in to Owner Portal</a>`,
      `</td></tr></table>`,
      `</div>`,
      `<div style="background-color:#111111;padding:24px 32px;border-radius:0 0 8px 8px;text-align:center;">`,
      `<p style="margin:0 0 8px;font-size:13px;color:#999999;"><a href="https://www.mynextgym.com.au" style="color:#F97316;text-decoration:none;">mynextgym.com.au</a> &middot; Perth, Western Australia</p>`,
      `<p style="margin:0;font-size:11px;color:#666666;">&copy; 2026 mynextgym. All rights reserved.</p>`,
      `</div></div>`,
    ].join(""),
    smsMessage: "Your mynextgym.com.au account: username {username}, temporary password {####}",
  },
};
