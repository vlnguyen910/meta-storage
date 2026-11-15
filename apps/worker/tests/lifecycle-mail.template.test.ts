import { describe, expect, test } from "bun:test";
import {
  LIFECYCLE_MAIL_MESSAGES as m,
  LIFECYCLE_MAIL_TEMPLATES as templates,
} from "../mail/lifecycle-mail.messages";
import { renderLifecycleMail } from "../mail/lifecycle-mail.template";

describe("lifecycle HTML emails", () => {
  for (const type of [
    "UPCOMING_EXPIRY",
    "SUPPORT_UPDATED",
    "RETURN_SCHEDULED",
    "RETURN_CHANGED",
    "RETURN_SETTLED",
    "RETURN_REFUND",
  ] as const) {
    test(`${type} uses its own customer copy and escapes dynamic data`, () => {
      const html = renderLifecycleMail(type, "subject", '<script>alert("x")</script>\nSecond line');
      expect(html).toContain(templates[type].title);
      expect(html).toContain(templates[type].intro);
      expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>Second line");
      expect(html).not.toContain("<script>");
      expect(html).toContain('lang="vi"');
    });
  }
  test("expiry copy shows the actual expiry in Vietnam time without promising renewal", () => {
    const body = m.expiryBody("rental-1", new Date("2026-11-20T17:00:00Z"));
    expect(body).toContain("21/11/2026");
    expect(body).toContain("rental-1");
  });
});
