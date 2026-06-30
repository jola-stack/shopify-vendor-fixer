'use strict';

const crypto = require('crypto');
const { findCanonical } = require('../lib/vendors');

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);

  // Verify Shopify HMAC signature
  const shopifyHmac = req.headers['x-shopify-hmac-sha256'];
  const computed = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64');

  if (!shopifyHmac || computed !== shopifyHmac) {
    console.warn('[vendor-fixer] HMAC mismatch — rejected');
    return res.status(401).end();
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  const { id, vendor } = payload;
  if (!id || !vendor) return res.status(200).end();

  const canonical = findCanonical(vendor);

  if (!canonical) {
    console.log(`[vendor-fixer] No match for "${vendor}" (product ${id}) — skipping`);
    return res.status(200).end();
  }

  if (canonical === vendor) return res.status(200).end();

  console.log(`[vendor-fixer] "${vendor}" → "${canonical}" (product ${id})`);

  const shopifyRes = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2024-10/products/${id}.json`,
    {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ product: { id, vendor: canonical } }),
    }
  );

  if (!shopifyRes.ok) {
    const err = await shopifyRes.text();
    console.error(`[vendor-fixer] Shopify API error (${shopifyRes.status}):`, err);
    return res.status(500).end();
  }

  return res.status(200).end();
}

// Disable Vercel's body parser so we can verify the raw HMAC
handler.config = { api: { bodyParser: false } };

module.exports = handler;
