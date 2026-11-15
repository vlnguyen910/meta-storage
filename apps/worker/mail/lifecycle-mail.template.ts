import {
  LIFECYCLE_MAIL_MESSAGES as m,
  LIFECYCLE_MAIL_TEMPLATES as templates,
} from "./lifecycle-mail.messages";

export const escapeMailHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

// Inline, table-based layout for email clients; tokens follow docs/DESIGN.md.
export function renderLifecycleMail(type: string, subject: string, body: string): string {
  const content = Object.hasOwn(templates, type)
    ? templates[type as keyof typeof templates]
    : { title: subject, intro: "", label: m.brand };
  const e = escapeMailHtml;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(content.title)}</title></head>
<body style="margin:0;background:#FAFAFA;color:#0F172A;font-family:'Be Vietnam Pro',Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #EEEEEE;border-radius:15px">
<tr><td style="padding:24px;border-bottom:1px solid #EEEEEE;color:#165F4D;font-size:24px;font-weight:700">${e(m.brand)}</td></tr>
<tr><td style="padding:24px"><span style="display:inline-block;padding:8px 12px;border-radius:9999px;background:#E8F3EF;color:#165F4D;font-size:12px;font-weight:600">${e(content.label)}</span>
<h1 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:24px;line-height:1.3;margin:24px 0 16px">${e(content.title)}</h1>
<p style="font-size:16px;line-height:1.6">${e(content.intro)}</p>
<div style="padding:16px;background:#FAFAFA;border:1px solid #EEEEEE;border-radius:8px;font-size:14px;line-height:1.6;overflow-wrap:anywhere">${e(body).replace(/\n/g, "<br>")}</div>
</td></tr><tr><td style="padding:24px;border-top:1px solid #EEEEEE;color:#64748B;font-size:12px;line-height:1.5">${e(m.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}
