/**
 * Server-side Slack webhook notifications.
 * Each trigger URL corresponds to a Slack Workflow Builder trigger with specific metadata fields.
 */

const WEBHOOKS: Record<string, string> = {
  feedback:
    process.env.SLACK_WEBHOOK_FEEDBACK ??
    "https://hooks.slack.com/triggers/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",
  claim:
    process.env.SLACK_WEBHOOK_CLAIM ??
    "https://hooks.slack.com/triggers/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",
  moderation:
    process.env.SLACK_WEBHOOK_MODERATION ??
    "https://hooks.slack.com/triggers/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",
};

export type SlackChannel = "feedback" | "claim" | "moderation";

/** Current timestamp formatted in AWST (UTC+8) */
export function nowAWST(): string {
  return new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }) + " AWST";
}

export async function sendSlackNotification(
  channel: SlackChannel,
  payload: Record<string, string>,
): Promise<void> {
  const url = WEBHOOKS[channel];
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`[slackNotify] ${channel} webhook error:`, err);
  }
}
