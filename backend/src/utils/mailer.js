import axios from 'axios';
import { config } from '../config.js';

// Transactional email over each provider's HTTPS API rather than SMTP, so this
// needs no new dependency — axios is already here for other outbound calls.
//
// When mail is not configured the message is logged instead of sent. That keeps
// development usable without an API key, and makes the unconfigured production
// case loud rather than silent: the link is in the logs, and the warning says
// exactly which variables are missing.
const PROVIDERS = {
  resend: {
    url: 'https://api.resend.com/emails',
    headers: (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }),
    body: ({ to, subject, html, from }) => ({ from, to: [to], subject, html }),
  },
  sendgrid: {
    url: 'https://api.sendgrid.com/v3/mail/send',
    headers: (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }),
    body: ({ to, subject, html, from }) => ({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  },
};

/**
 * Never throws. A failed send must not turn into a 500 on /forgot-password,
 * because the response is deliberately identical whether or not the address
 * exists — an error surfacing only for real addresses would reintroduce the
 * account enumeration the endpoint is written to avoid.
 *
 * @returns {Promise<boolean>} whether the message was actually handed to a provider
 */
export async function sendMail({ to, subject, html }) {
  if (!config.mail.enabled) {
    console.warn(
      '[mail] not configured — set MAIL_PROVIDER, MAIL_API_KEY and MAIL_FROM to send. ' +
        `Message intended for ${to}:\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`
    );
    return false;
  }

  const provider = PROVIDERS[config.mail.provider];

  try {
    await axios.post(
      provider.url,
      provider.body({ to, subject, html, from: config.mail.from }),
      { headers: provider.headers(config.mail.apiKey), timeout: 10_000 }
    );
    return true;
  } catch (err) {
    console.error(
      `[mail] send to ${to} failed:`,
      err.response?.status,
      err.response?.data ?? err.message
    );
    return false;
  }
}

export function passwordResetEmail({ name, resetUrl, ttlMinutes }) {
  return {
    subject: 'Reset your NV Immigration password',
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;color:#0B0E14;line-height:1.5">
        <p>Hi ${escapeHtml(name)},</p>
        <p>We received a request to reset your password. Click the link below to choose a new one:</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 18px;background:#C96E0E;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Reset password</a></p>
        <p style="color:#5A6472;font-size:12.5px">Or paste this into your browser:<br>${escapeHtml(resetUrl)}</p>
        <p style="color:#5A6472;font-size:12.5px">This link expires in ${ttlMinutes} minutes and can only be used once. If you did not request it, nothing has changed and you can ignore this email.</p>
      </div>
    `,
  };
}

// The name comes from user input and is interpolated into HTML.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
