const { Webhook } = require('svix');
const { markEmailStatus } = require('../lib/tickets');

// Resend signs webhook payloads with Svix, over the exact raw request body —
// so this route needs the raw bytes, not Vercel's auto-parsed JSON.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RESEND_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'server_error' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('Failed to read webhook body:', err);
    return res.status(400).json({ error: 'bad_request' });
  }

  let event;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature'],
    });
  } catch (err) {
    console.error('Resend webhook signature verification failed:', err);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  try {
    const { type, data } = event || {};
    const emailId = data && data.email_id;

    if (emailId && type === 'email.delivered') {
      await markEmailStatus(emailId, 'delivered');
    } else if (emailId && type === 'email.bounced') {
      await markEmailStatus(emailId, 'bounced');
    }
    // Other event types (opened, clicked, complained, etc.) are ignored — this
    // panel only tracks whether the QR actually reached an inbox.

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing Resend webhook:', err);
    return res.status(500).json({ error: 'server_error' });
  }
};
