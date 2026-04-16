const { Resend } = require('resend');

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY env var not set');
  return new Resend(key);
}

function fromAddress() {
  return process.env.RESET_EMAIL_FROM || 'Floral Botanical Medicine <onboarding@resend.dev>';
}

async function sendPasswordReset({ to, name, resetUrl }) {
  const friendly = name ? name.split(' ')[0] : 'there';
  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color:#2a2a26; line-height:1.6;">
      <h2 style="color:#3f5a3a; font-weight:500;">Reset your password</h2>
      <p>Hi ${friendly},</p>
      <p>We received a request to reset the password on your Floral Botanical Medicine account. Click below to set a new one. The link expires in one hour.</p>
      <p style="margin: 28px 0;">
        <a href="${resetUrl}" style="background:#3f5a3a; color:#f6f3ec; padding:12px 24px; text-decoration:none; letter-spacing:0.08em; text-transform:uppercase; font-size:13px;">Reset Password</a>
      </p>
      <p style="font-size:13px; color:#5a584f;">If the button doesn't work, paste this into your browser:<br>
        <a href="${resetUrl}" style="color:#3f5a3a; word-break:break-all;">${resetUrl}</a>
      </p>
      <p style="font-size:13px; color:#5a584f;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <hr style="border:none; border-top:1px solid #d8d2c1; margin:28px 0;" />
      <p style="font-size:12px; color:#8a887f;">Floral Botanical Medicine</p>
    </div>
  `;
  return client().emails.send({
    from: fromAddress(),
    to,
    subject: 'Reset your Floral Botanical Medicine password',
    html,
  });
}

module.exports = { sendPasswordReset };
