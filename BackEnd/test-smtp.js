/**
 * Standalone SMTP diagnostic — run this to see the REAL reason email fails.
 * It does NOT touch the database; it only tests the mail transport using the
 * same EMAIL_* env vars the app uses.
 *
 * Usage (locally, with BackEnd/.env present):
 *     node test-smtp.js you@example.com
 *
 * The optional argument is where the test email is sent (defaults to EMAIL_USER).
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const to = process.argv[2] || process.env.EMAIL_USER;

console.log('--- SMTP config seen by the app ---');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST || '(missing)');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT || '(missing)');
console.log('EMAIL_USER:', process.env.EMAIL_USER || '(missing)');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS
    ? `set, length=${process.env.EMAIL_PASS.length}${/\s/.test(process.env.EMAIL_PASS) ? ' ⚠️ CONTAINS SPACES' : ''}`
    : '(missing)');
console.log('secure (true only for port 465):', Number(process.env.EMAIL_PORT) === 465);
console.log('Sending test email to:', to);
console.log('-----------------------------------\n');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

(async () => {
    try {
        console.log('1) Verifying connection + auth…');
        await transporter.verify();
        console.log('   ✅ verify() passed — host reachable and credentials accepted.\n');

        console.log('2) Sending a test email…');
        const info = await transporter.sendMail({
            from: `"SkillSwap Test" <${process.env.EMAIL_USER}>`,
            to,
            subject: 'SkillSwap SMTP test ✅',
            html: '<p>If you can read this, SMTP is working. 🎉</p>',
        });
        console.log('   ✅ sent. messageId:', info.messageId);
        console.log('   response:', info.response);
        console.log('\nAll good. If the inbox is empty, check Spam/Promotions.');
    } catch (err) {
        console.error('\n❌ SMTP FAILED. Real error below:\n');
        console.error('  code:   ', err.code);
        console.error('  command:', err.command);
        console.error('  message:', err.message);
        if (err.response) console.error('  response:', err.response);
        console.error('\nCommon meanings:');
        console.error('  EAUTH / 535            → wrong password. Use a Gmail APP PASSWORD (no spaces), not your normal password.');
        console.error('  ECONNECTION / ETIMEDOUT → host blocks outbound SMTP, or wrong host/port.');
        console.error('  ESOCKET / self-signed   → TLS/port mismatch (try port 587 with secure:false).');
    } finally {
        process.exit(0);
    }
})();
