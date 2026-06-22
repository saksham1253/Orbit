/**
 * Brevo API diagnostic — verifies email sending without touching the database.
 *
 * Usage (locally, with BackEnd/.env containing BREVO_API_KEY + BREVO_SENDER_EMAIL):
 *     node test-brevo.js you@example.com
 *
 * Or inline:
 *     BREVO_API_KEY=xkeysib-... BREVO_SENDER_EMAIL=verified@gmail.com node test-brevo.js you@example.com
 */
require('dotenv').config();
const { sendEmail } = require('./utils/sendEmail');

const to = process.argv[2] || process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER;

console.log('--- Brevo config ---');
console.log('BREVO_API_KEY:', process.env.BREVO_API_KEY ? `set, length=${process.env.BREVO_API_KEY.length}` : '(missing)');
console.log('Sender:', process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || '(missing)');
console.log('Sending to:', to);
console.log('--------------------\n');

(async () => {
    try {
        const info = await sendEmail({
            to,
            subject: 'Orbit Brevo test',
            html: '<p>If you can read this, Brevo is working.</p>',
        });
        console.log('Sent. messageId:', info.messageId);
        console.log('Check the inbox (and Spam). Also see Brevo dashboard → Transactional → Logs.');
    } catch (err) {
        console.error('FAILED:', err.message || err);
        console.error('\nCommon meanings:');
        console.error('  401 / unauthorized        → BREVO_API_KEY wrong/missing.');
        console.error('  400 sender not valid       → BREVO_SENDER_EMAIL is not a VERIFIED sender in Brevo.');
        console.error('  "BREVO_API_KEY is not set" → add the env var.');
    } finally {
        process.exit(0);
    }
})();
