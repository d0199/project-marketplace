/**
 * Server-side Slack webhook notifications.
 * Each trigger URL corresponds to a Slack Workflow Builder trigger with specific metadata fields.
 */

const WEBHOOKS = {
  feedback:
    "https://hooks.slack.com/triggers/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",
  claim:
    "https://hooks.slack.com/triggers/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",
  moderation:
    "https://hooks.slack.com/triggers/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",
} as const;

export type SlackChannel = keyof typeof WEBHOOKS;

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
