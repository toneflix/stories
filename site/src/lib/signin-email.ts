const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function signInEmail(url: string) {
  const origin = new URL(url).origin;
  const link = escape(url);
  const subject = 'Sign in to Toneflix Stories';

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#0A0C10;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0C10;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#121419;border:1px solid #1E252C;border-radius:20px;">
        <tr><td style="padding:36px 32px 8px;" align="left">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;"><img src="${origin}/brand/mark.png" width="32" height="32" alt="" style="display:block;border-radius:8px;"></td>
            <td style="font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;letter-spacing:0.22em;color:#F2F4F7;">STORIES</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;font-family:Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;color:#F2F4F7;">Sign in</td></tr>
        <tr><td style="padding:0 32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#A1A7B3;">This link works once and expires in 24 hours.</td></tr>
        <tr><td style="padding:0 32px 36px;">
          <a href="${link}" style="display:inline-block;background:#56BCF9;color:#0A0C10;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;">Sign in</a>
        </td></tr>
      </table>
      <p style="max-width:440px;margin:20px auto 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#6F747E;">If you didn't ask for this, you can ignore it.</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Sign in to Toneflix Stories\n\n${url}\n\nThis link works once and expires in 24 hours. If you didn't ask for this, you can ignore it.\n`;

  return { subject, html, text };
}
