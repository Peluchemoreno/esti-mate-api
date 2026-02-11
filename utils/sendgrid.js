const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPasswordResetEmail(to, resetLink) {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: "Reset your password",
    html: `
      <p>You requested a password reset.</p>
      <p>Click the link below to set a new password:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link expires in 45 minutes.</p>
      <p>If you did not request this, ignore this email.</p>
    `,
  };

  await sgMail.send(msg);
}

module.exports = {
  sendPasswordResetEmail,
};
