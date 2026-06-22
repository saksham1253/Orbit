// Email is sent via Brevo's HTTPS Transactional API (NOT raw SMTP). Render's
// free tier blocks outbound SMTP ports, and Gmail blocks server sending — the
// HTTPS API avoids both and gives reliable delivery. Only an API key + a
// Brevo-verified sender address are needed; no nodemailer/SMTP transport.
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER; // must be VERIFIED in Brevo
const APP_URL = process.env.FRONTEND_URL || 'https://react-skill-swap-fully-fledged.vercel.app';

/**
 * Low-level send via Brevo. Returns { messageId } on success; throws on failure
 * so callers can log the real reason. Uses native fetch (Node 18+).
 */
async function dispatch({ to, subject, html, fromName = 'Orbit' }) {
    if (!BREVO_API_KEY) {
        throw new Error('BREVO_API_KEY is not set — cannot send email. Add it on the host and redeploy.');
    }
    if (!SENDER_EMAIL) {
        throw new Error('No sender address — set BREVO_SENDER_EMAIL (a Brevo-verified sender) or EMAIL_USER.');
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
            sender: { name: fromName, email: SENDER_EMAIL },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Brevo send failed (${res.status}): ${detail}`);
    }
    const data = await res.json().catch(() => ({}));
    return { messageId: data.messageId };
}

/**
 * Shared, email-client-safe shell (table layout + inline styles so Gmail /
 * Outlook / Apple Mail all render it consistently). `accent` tints the header
 * glow + button per email type. Renders on a soft page background with a dark
 * cosmic card — on-brand with the Orbit app.
 */
const emailShell = ({ accent = '#00c6ff', preheader = '', title, badge, bodyHtml }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#0a0713; -webkit-font-smoothing:antialiased; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <span style="display:none !important; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0713; padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:linear-gradient(180deg,#150f29 0%, #0f0a1c 100%); border-radius:20px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); box-shadow:0 20px 60px rgba(0,0,0,0.55);">
          <!-- Header -->
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, ${accent}26, transparent 65%);">
                <tr>
                  <td align="center" style="padding:40px 40px 8px 40px;">
                    <div style="display:inline-block; width:56px; height:56px; line-height:56px; border-radius:16px; background:linear-gradient(135deg, ${accent}, #ff0076); color:#ffffff; font-size:26px; font-weight:800; box-shadow:0 0 24px ${accent}66;">O</div>
                    <h1 style="margin:18px 0 0 0; font-size:26px; font-weight:800; letter-spacing:-0.5px; background:linear-gradient(135deg,#ffffff,${accent}); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:#ffffff;">Orbit</h1>
                    ${badge ? `<div style="margin-top:14px;"><span style="display:inline-block; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:${accent}; background:${accent}1f; border:1px solid ${accent}40; padding:6px 14px; border-radius:999px;">${badge}</span></div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 40px 8px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:28px 40px 40px 40px;">
              <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:24px; text-align:center;">
                <p style="margin:0 0 10px 0; font-size:13px; color:#8a86a0; line-height:1.6;">Learn in each other's orbit.</p>
                <a href="${APP_URL}" style="color:${accent}; font-size:13px; font-weight:600; text-decoration:none;">Open Orbit →</a>
                <p style="margin:18px 0 0 0; font-size:11px; color:#5a5670;">You're receiving this because you have an Orbit account.<br/>© Orbit · A peer-to-peer learning universe.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const ctaButton = (href, label, accent) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px 0;">
    <tr>
      <td align="center" style="border-radius:12px; background:linear-gradient(135deg, ${accent}, #ff0076);">
        <a href="${href}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:12px;">${label}</a>
      </td>
    </tr>
  </table>`;

exports.sendLoginNotification = async (userEmail, userName) => {
    try {
        const accent = '#00c6ff';
        const when = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
        const bodyHtml = `
            <p style="margin:0 0 16px 0; font-size:18px; font-weight:700; color:#ffffff;">Welcome back, ${userName}</p>
            <p style="margin:0 0 22px 0; font-size:15px; line-height:1.7; color:#c7c4d6;">
                A new sign-in to your Orbit account was just detected. If this was you, you're all set — the universe of learning awaits.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px;">
                <tr>
                    <td style="padding:16px 18px;">
                        <p style="margin:0; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#8a86a0;">Sign-in time</p>
                        <p style="margin:6px 0 0 0; font-size:15px; font-weight:600; color:#ffffff;">${when}</p>
                    </td>
                </tr>
            </table>
            <p style="margin:0 0 22px 0; font-size:14px; line-height:1.7; color:#a7a3ba;">
                <strong style="color:#ffffff;">Wasn't you?</strong> Secure your account right away by resetting your password — and consider enabling a stronger password.
            </p>
            ${ctaButton(`${APP_URL}/dashboard`, 'Go to my dashboard', accent)}
        `;

        const info = await dispatch({
            to: userEmail,
            fromName: 'Orbit Security',
            subject: 'New sign-in to your Orbit account',
            html: emailShell({
                accent,
                preheader: `New sign-in detected on ${when}.`,
                title: 'New sign-in to Orbit',
                badge: 'Security Alert',
                bodyHtml
            })
        });
        console.log("Login notification sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending login notification:", error.message || error);
    }
};

exports.sendRegistrationNotification = async (userEmail, userName) => {
    try {
        const accent = '#9B6BFF';
        const feature = (title, text) => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:12px;">
                <tr>
                    <td style="padding:16px 18px; border-left:3px solid ${accent};">
                        <p style="margin:0; font-size:15px; font-weight:700; color:#ffffff;">${title}</p>
                        <p style="margin:4px 0 0 0; font-size:13px; line-height:1.6; color:#a7a3ba;">${text}</p>
                    </td>
                </tr>
            </table>`;

        const bodyHtml = `
            <p style="margin:0 0 16px 0; font-size:22px; font-weight:800; color:#ffffff;">Welcome aboard, ${userName}!</p>
            <p style="margin:0 0 26px 0; font-size:15px; line-height:1.7; color:#c7c4d6;">
                You've just joined a universe where <strong style="color:#ffffff;">every person is both a student and a teacher</strong>.
                We are absolutely thrilled to have you. Here's a glimpse of what's waiting for you:
            </p>
            ${feature('Discover your constellation', 'Browse skills near you and find perfect mutual matches — people who can teach what you want, and want what you teach.')}
            ${feature('Connect & exchange', 'Message, video-call, and swap skills in real time with brilliant people from around the world.')}
            ${feature('Rise through the cosmos', 'Earn reviews, climb from Stardust to Supernova, and shine on your city’s Observatory leaderboard.')}
            <div style="height:8px;"></div>
            <p style="margin:0 0 18px 0; font-size:15px; line-height:1.7; color:#c7c4d6;">
                Your journey starts now. Add your first skill and watch the universe respond.
            </p>
            ${ctaButton(`${APP_URL}/dashboard`, 'Start exploring', accent)}
        `;

        const info = await dispatch({
            to: userEmail,
            fromName: 'Orbit',
            subject: `Welcome to Orbit, ${userName}`,
            html: emailShell({
                accent,
                preheader: 'Your peer-to-peer learning universe just got a new star — you.',
                title: 'Welcome to Orbit',
                badge: 'Welcome Aboard',
                bodyHtml
            })
        });
        console.log("Registration notification sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending registration notification:", error.message || error);
    }
};

// Generic transactional email sender (used by the password-reset flow).
// Throws on failure so the caller can handle/log it (authController wraps this
// in its own try/catch). This was the missing export that made the
// "forgot password" email silently never send.
exports.sendEmail = async ({ to, subject, html }) => {
    const info = await dispatch({ to, subject, html });
    console.log("Email sent: %s", info.messageId);
    return info;
};

// Beautifully-styled password-reset email (uses the shared cosmic shell so it
// matches the welcome/login emails). Throws on failure so the caller can log it.
exports.sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
    const accent = '#ff0076';
    const bodyHtml = `
        <p style="margin:0 0 16px 0; font-size:18px; font-weight:700; color:#ffffff;">Reset your password</p>
        <p style="margin:0 0 22px 0; font-size:15px; line-height:1.7; color:#c7c4d6;">
            Hello ${name || 'there'}, we received a request to reset the password for your Orbit account.
            Click the button below to choose a new one. This link is valid for <strong style="color:#ffffff;">1 hour</strong>.
        </p>
        ${ctaButton(resetUrl, 'Reset my password', accent)}
        <p style="margin:22px 0 8px 0; font-size:13px; line-height:1.6; color:#8a86a0;">
            Or paste this link into your browser:
        </p>
        <p style="margin:0 0 22px 0; font-size:12px; line-height:1.6; word-break:break-all;">
            <a href="${resetUrl}" style="color:${accent}; text-decoration:none;">${resetUrl}</a>
        </p>
        <p style="margin:0; font-size:13px; line-height:1.7; color:#a7a3ba;">
            Didn't request this? You can safely ignore this email — your password won't change.
        </p>
    `;

    const info = await dispatch({
        to,
        fromName: 'Orbit',
        subject: 'Reset your Orbit password',
        html: emailShell({
            accent,
            preheader: 'Reset your Orbit password — link valid for 1 hour.',
            title: 'Reset your Orbit password',
            badge: 'Password Reset',
            bodyHtml
        })
    });
    console.log("Password reset email sent: %s", info.messageId);
    return info;
};
