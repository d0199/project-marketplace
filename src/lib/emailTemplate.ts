/**
 * Branded HTML email template for mynextgym.com.au
 *
 * Brand tokens:
 *   Orange (primary): #F97316
 *   Orange dark (hover): #EA580C
 *   Orange light (tint): #FED7AA
 *   Black (header/footer): #111111
 *   White: #FFFFFF
 *   Grey (body bg): #F5F5F5
 *
 * Uses inline styles for maximum email client compatibility.
 */

const BASE_URL = "https://mynextgym.com.au";
const LOGO_URL = `${BASE_URL}/icon-192.png`;

interface EmailTemplateOptions {
  /** Email subject (also used as preview text) */
  subject: string;
  /** Greeting line, e.g. "Hi David," */
  greeting?: string;
  /** Main body HTML (can include <p>, <ul>, etc.) */
  body: string;
  /** Optional CTA button */
  cta?: { label: string; url: string };
  /** Optional footer note (plain text) */
  footerNote?: string;
}

/**
 * Wraps content in a fully branded HTML email layout.
 * Returns an HTML string ready for SES Html body.
 */
export function buildEmailHtml(options: EmailTemplateOptions): string {
  const { subject, greeting, body, cta, footerNote } = options;

  const ctaHtml = cta
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto;">
        <tr>
          <td style="border-radius:6px;background-color:#F97316;">
            <a href="${cta.url}" target="_blank"
               style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:6px;">
              ${cta.label}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
  <!--[if mso]>
  <noscript><xml>
    <o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preview text (hidden) -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${subject}
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         style="background-color:#F5F5F5;">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <!-- Email card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"
               width="600" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#111111;padding:24px 32px;border-radius:8px 8px 0 0;text-align:center;">
              <a href="${BASE_URL}" target="_blank" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="mynextgym" width="48" height="48"
                     style="display:inline-block;vertical-align:middle;border:0;" />
                <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-size:22px;font-weight:bold;color:#F97316;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.5px;">
                  mynextgym
                </span>
              </a>
            </td>
          </tr>

          <!-- Orange accent bar -->
          <tr>
            <td style="background-color:#F97316;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#FFFFFF;padding:32px 32px 24px 32px;">
              ${greeting ? `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:#111111;">${greeting}</p>` : ""}
              <div style="font-size:15px;line-height:1.6;color:#333333;">
                ${body}
              </div>
              ${ctaHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#111111;padding:24px 32px;border-radius:0 0 8px 8px;text-align:center;">
              ${footerNote ? `<p style="margin:0 0 12px 0;font-size:13px;color:#999999;">${footerNote}</p>` : ""}
              <p style="margin:0 0 8px 0;font-size:13px;color:#999999;">
                <a href="${BASE_URL}" style="color:#F97316;text-decoration:none;">mynextgym.com.au</a>
                &nbsp;&middot;&nbsp;Perth, Western Australia
              </p>
              <p style="margin:0;font-size:11px;color:#666666;">
                &copy; ${new Date().getFullYear()} mynextgym. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
}
