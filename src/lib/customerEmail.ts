/**
 * Customer-facing confirmation emails for mynextgym.com.au
 *
 * All emails use the branded HTML template via buildEmailHtml + sendBrandedEmail.
 * These are fire-and-forget — failures are logged but never block API responses.
 */
import { sendBrandedEmail } from "./emailNotify";
import { buildEmailHtml } from "./emailTemplate";

const PORTAL_URL = "https://mynextgym.com.au/owner";
const BASE_URL = "https://mynextgym.com.au";

// ── Claims ───────────────────────────────────────────────────────────────────

export async function sendClaimSubmittedEmail(
  to: string,
  name: string,
  listingName: string,
  isNewListing: boolean,
) {
  const subject = isNewListing
    ? `We've received your listing — ${listingName}`
    : `We've received your claim — ${listingName}`;

  const html = buildEmailHtml({
    subject,
    greeting: `Hi ${name},`,
    body: `
      <p>Thanks for ${isNewListing ? "submitting your listing" : "claiming your profile"} for <strong>${listingName}</strong> on mynextgym.com.au.</p>
      <p>Our team will review your submission and get back to you within <strong>24 hours</strong>.</p>
      <p>If we need any additional information to verify your ${isNewListing ? "listing" : "claim"}, we'll be in touch via this email address.</p>
    `,
    footerNote: "You're receiving this because you submitted a request on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

export async function sendClaimApprovedEmail(
  to: string,
  listingName: string,
  isNewUser: boolean,
) {
  const subject = `Your listing has been approved — ${listingName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>Great news — your ${isNewUser ? "listing" : "claim"} for <strong>${listingName}</strong> has been approved and is now live on mynextgym.com.au.</p>
      ${isNewUser
        ? `<p>We've created an account for you. You'll receive a separate email with your temporary password. Use it to sign in to the Owner Portal where you can manage your profile, update photos, pricing, and more.</p>`
        : `<p>You can now manage your listing from the Owner Portal — update photos, pricing, hours, and more.</p>`
      }
    `,
    cta: { label: "Go to Owner Portal", url: PORTAL_URL },
    footerNote: "You're receiving this because your claim was approved on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

export async function sendClaimRejectedEmail(
  to: string,
  listingName: string,
  reason: string,
) {
  const subject = `Update on your submission — ${listingName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>We've reviewed your submission for <strong>${listingName}</strong> and unfortunately we're unable to approve it at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>If you believe this was made in error or would like to provide additional information, please reply to this email or contact us at <a href="mailto:admin@mynextgym.com.au" style="color:#F97316;">admin@mynextgym.com.au</a>.</p>
    `,
    footerNote: "You're receiving this because you submitted a request on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

// ── Edit moderation ──────────────────────────────────────────────────────────

export async function sendEditSubmittedEmail(
  to: string,
  listingName: string,
  entityType: "gym" | "pt",
) {
  const label = entityType === "pt" ? "PT profile" : "gym profile";
  const subject = `Your changes are being reviewed — ${listingName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>We've received your updates to your ${label} for <strong>${listingName}</strong>.</p>
      <p>Our team reviews all changes to ensure listing quality. Your edits will be reviewed within <strong>24 hours</strong> and you'll receive a confirmation once they're live.</p>
    `,
    cta: { label: "View Owner Portal", url: PORTAL_URL },
    footerNote: "You're receiving this because you updated your listing on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

export async function sendEditApprovedEmail(
  to: string,
  listingName: string,
  entityType: "gym" | "pt",
) {
  const label = entityType === "pt" ? "PT profile" : "gym profile";
  const subject = `Your changes are live — ${listingName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>Your recent updates to your ${label} for <strong>${listingName}</strong> have been approved and are now live on mynextgym.com.au.</p>
    `,
    cta: { label: "View Owner Portal", url: PORTAL_URL },
    footerNote: "You're receiving this because your listing was updated on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

export async function sendEditRejectedEmail(
  to: string,
  listingName: string,
  entityType: "gym" | "pt",
  reason: string,
) {
  const label = entityType === "pt" ? "PT profile" : "gym profile";
  const subject = `Update on your changes — ${listingName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>We've reviewed your recent changes to your ${label} for <strong>${listingName}</strong> and unfortunately we're unable to apply them.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>You can make new changes from the Owner Portal, or contact us at <a href="mailto:admin@mynextgym.com.au" style="color:#F97316;">admin@mynextgym.com.au</a> if you have questions.</p>
    `,
    cta: { label: "Go to Owner Portal", url: PORTAL_URL },
    footerNote: "You're receiving this because your listing was updated on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

// ── Qualification verification ───────────────────────────────────────────────

export async function sendVerificationSubmittedEmail(
  to: string,
  ptName: string,
  qualifications: string[],
) {
  const subject = `Verification request received — ${ptName}`;

  const qualList = qualifications.map((q) => `<li>${q}</li>`).join("");

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>We've received your qualification verification request for <strong>${ptName}</strong>.</p>
      <p>Qualifications submitted for review:</p>
      <ul>${qualList}</ul>
      <p>Our team will review your evidence within <strong>24 hours</strong> and update your profile once verified.</p>
    `,
    footerNote: "You're receiving this because you submitted a verification request on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

export async function sendVerificationApprovedEmail(
  to: string,
  ptName: string,
  qualifications: string[],
) {
  const subject = `Qualifications verified — ${ptName}`;

  const qualList = qualifications.map((q) => `<li>${q}</li>`).join("");

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>Great news — the following qualifications for <strong>${ptName}</strong> have been verified and your profile has been updated:</p>
      <ul>${qualList}</ul>
      <p>A verified badge will now appear on your profile for these qualifications.</p>
    `,
    cta: { label: "View Your Profile", url: PORTAL_URL },
    footerNote: "You're receiving this because your qualifications were verified on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

export async function sendVerificationRejectedEmail(
  to: string,
  ptName: string,
  reason: string,
) {
  const subject = `Update on your verification — ${ptName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>We've reviewed the qualification evidence submitted for <strong>${ptName}</strong> and unfortunately we're unable to verify at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      <p>You can resubmit with updated evidence from the Owner Portal, or contact us at <a href="mailto:admin@mynextgym.com.au" style="color:#F97316;">admin@mynextgym.com.au</a>.</p>
    `,
    cta: { label: "Go to Owner Portal", url: PORTAL_URL },
    footerNote: "You're receiving this because you submitted a verification request on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

// ── Subscription ─────────────────────────────────────────────────────────────

export async function sendSubscriptionCancelledEmail(
  to: string,
  listingName: string,
  periodEnd: string,
  entityType: "gym" | "pt",
) {
  const label = entityType === "pt" ? "PT profile" : "gym listing";
  const subject = `Subscription cancelled — ${listingName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>Your subscription for <strong>${listingName}</strong> has been cancelled.</p>
      <p>Your paid features will remain active until <strong>${periodEnd}</strong>. After that, your ${label} will revert to the free plan.</p>
      <p>You can resubscribe at any time from the Owner Portal.</p>
    `,
    cta: { label: "Go to Owner Portal", url: `${BASE_URL}/billing` },
    footerNote: "You're receiving this because you cancelled your subscription on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

// ── Affiliations ─────────────────────────────────────────────────────────────

export async function sendAffiliationRequestEmail(
  to: string,
  ptName: string,
  profileName: string,
) {
  const subject = `New affiliation request — ${ptName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p><strong>${ptName}</strong> has requested to be affiliated with your profile <strong>${profileName}</strong> on mynextgym.com.au.</p>
      <p>You can review and approve or decline this request from the Owner Portal.</p>
    `,
    cta: { label: "Review Request", url: PORTAL_URL },
    footerNote: "You're receiving this because an affiliation was requested on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

export async function sendAffiliationApprovedEmail(
  to: string,
  ptName: string,
  profileName: string,
) {
  const subject = `Affiliation approved — ${profileName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>Your affiliation request for <strong>${ptName}</strong> with <strong>${profileName}</strong> has been approved.</p>
      <p>Your profile will now appear as affiliated on their listing page.</p>
    `,
    cta: { label: "View Owner Portal", url: PORTAL_URL },
    footerNote: "You're receiving this because your affiliation was approved on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

export async function sendAffiliationRejectedEmail(
  to: string,
  ptName: string,
  profileName: string,
) {
  const subject = `Affiliation update — ${profileName}`;

  const html = buildEmailHtml({
    subject,
    greeting: "Hi there,",
    body: `
      <p>Your affiliation request for <strong>${ptName}</strong> with <strong>${profileName}</strong> has been declined.</p>
      <p>If you have questions, please contact us at <a href="mailto:admin@mynextgym.com.au" style="color:#F97316;">admin@mynextgym.com.au</a>.</p>
    `,
    footerNote: "You're receiving this because your affiliation request was reviewed on mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}

// ── Support ──────────────────────────────────────────────────────────────────

export async function sendSupportConfirmationEmail(
  to: string,
  name: string,
) {
  const subject = "We've received your message — mynextgym.com.au";

  const html = buildEmailHtml({
    subject,
    greeting: `Hi ${name},`,
    body: `
      <p>Thanks for getting in touch. We've received your message and our team will respond within <strong>24 hours</strong>.</p>
      <p>If your matter is urgent, you can reach us directly at <a href="mailto:admin@mynextgym.com.au" style="color:#F97316;">admin@mynextgym.com.au</a>.</p>
    `,
    footerNote: "You're receiving this because you contacted mynextgym.com.au.",
  });

  await sendBrandedEmail(to, subject, html);
}
