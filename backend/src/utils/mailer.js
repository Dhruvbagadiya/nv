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

export function emailVerificationEmail({ name, verifyUrl, ttlHours }) {
  return {
    subject: 'Confirm your email — NV Immigration',
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;color:#0B0E14;line-height:1.5">
        <p>Hi ${escapeHtml(name)},</p>
        <p>Welcome to NV Immigration. Confirm this address to finish setting up your account and start submitting applications:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 18px;background:#C96E0E;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Confirm email</a></p>
        <p style="color:#5A6472;font-size:12.5px">Or paste this into your browser:<br>${escapeHtml(verifyUrl)}</p>
        <p style="color:#5A6472;font-size:12.5px">This link expires in ${ttlHours} hours and can only be used once. You can browse programs without confirming — you will just need to confirm before you can submit an application. If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  };
}

/*
 * One shell for every transactional message, so they cannot drift apart in
 * styling the way three hand-written <div>s would. `body` is trusted HTML the
 * caller has already escaped; `cta` is optional.
 */
function shell({ name, intro, body = '', cta, footer }) {
  return `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;color:#0B0E14;line-height:1.5">
        <p>Hi ${escapeHtml(name)},</p>
        <p>${intro}</p>
        ${body}
        ${cta ? `<p><a href="${cta.url}" style="display:inline-block;padding:10px 18px;background:#C96E0E;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>` : ''}
        ${footer ? `<p style="color:#5A6472;font-size:12.5px">${footer}</p>` : ''}
      </div>
    `;
}

// A labelled fact table — reference number, program, stage. Plain rows rather
// than a <table> with borders, because Outlook renders bordered tables badly.
function facts(rows) {
  return rows
    .filter(([, v]) => v)
    .map(([k, v]) =>
      `<p style="margin:2px 0"><span style="color:#5A6472">${escapeHtml(k)}:</span> <strong>${escapeHtml(String(v))}</strong></p>`)
    .join('');
}

/**
 * A — the stage moved. The most important message this system sends.
 *
 * Students have no notification UI: their portal is Programs / My Applications /
 * Profile, with no bell and nothing polling. Every STAGE_CHANGE notification is
 * written to a table they cannot read. Until there is a bell, this email IS how
 * a student learns their application progressed.
 */
export function applicationStageEmail({ name, reference, program, institution, stage, note, url }) {
  return {
    subject: `Your application #${reference} is now ${stage}`,
    html: shell({
      name,
      intro: `There is an update on your application.`,
      body: facts([
        ['Reference', `#${reference}`],
        ['Program', program],
        ['Institution', institution],
        ['New stage', stage],
        ['Note', note],
      ]),
      cta: url ? { url, label: 'View application' } : undefined,
      footer: 'You are receiving this because you applied through NV Immigration.',
    }),
  };
}

/** B — submission receipt, so the applicant has the reference to quote. */
export function applicationReceivedEmail({ name, reference, program, institution, url }) {
  return {
    subject: `Application received — #${reference}`,
    html: shell({
      name,
      intro: 'We have received your application and our team will begin reviewing it.',
      body: facts([
        ['Reference', `#${reference}`],
        ['Program', program],
        ['Institution', institution],
      ]),
      cta: url ? { url, label: 'Track your application' } : undefined,
      footer: 'Quote your reference number if you contact us about this application.',
    }),
  };
}

/** C — internal alert, so a self-submitted application is not left unseen. */
export function newApplicationAlertEmail({
  reference, studentName, program, institution, studentEmail, studentPhone, filedBy,
}) {
  return {
    subject: `New application #${reference} — ${studentName}`,
    html: shell({
      name: 'team',
      intro: 'A student submitted an application through the portal.',
      /*
       * The applicant's own email and phone, then who filed it — labelled
       * separately because they are frequently different people.
       *
       * This used to show the FILER's address under a bare "Email", directly
       * beneath the student's name. On an agency-filed application that is a
       * member of staff, so the one line telling you how to reach the applicant
       * was actually the address of the colleague who typed the form.
       */
      body: facts([
        ['Reference', `#${reference}`],
        ['Student', studentName],
        ['Email', studentEmail],
        ['Mobile', studentPhone],
        ['Program', program],
        ['Institution', institution],
        ['Filed by', filedBy],
      ]),
      footer: 'Sent automatically by the NV Immigration portal.',
    }),
  };
}

/**
 * D — an account was created for someone. They choose their own password.
 *
 * The link is an ordinary password-reset token, which is why this says "set"
 * rather than "reset": it is the same mechanism, used before a password the
 * person knows has ever existed. It replaces an administrator picking a password
 * and reading it down the phone.
 */
export function accountCreatedEmail({ name, setPasswordUrl, ttlHours, role }) {
  return {
    subject: 'Your NV Immigration account',
    html: shell({
      name,
      intro: `An account has been created for you on the NV Immigration portal${role ? ` as ${escapeHtml(role.toLowerCase())}` : ''}. Choose a password to finish setting it up.`,
      cta: { url: setPasswordUrl, label: 'Set your password' },
      footer: `This link expires in ${ttlHours} hours and can only be used once. If it expires, use "Forgot password" on the sign-in page.`,
    }),
  };
}

// The name comes from user input and is interpolated into HTML.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
