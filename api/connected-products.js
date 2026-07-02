'use strict';

const crypto = require('crypto');

const BRANDS = new Set(['Adidas', 'Adidas Originals', 'New Balance', 'Peak Performance']);
const API_VERSION = '2024-10';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function gql(query, variables = {}) {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function findSiblings(vendor, title) {
  const data = await gql(`
    query FindSiblings($q: String!) {
      products(first: 50, query: $q) {
        nodes {
          id
          title
          kon: metafield(namespace: "custom", key: "kon") { value }
          connected: metafield(namespace: "custom", key: "connected_products") { value }
        }
      }
    }
  `, { q: `vendor:"${vendor}" title:"${title}"` });
  return data.products.nodes;
}

async function setConnected(ownerId, gids) {
  const data = await gql(`
    mutation Set($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }
  `, {
    metafields: [{
      ownerId,
      namespace: 'custom',
      key: 'connected_products',
      value: JSON.stringify(gids),
      type: 'list.product_reference',
    }],
  });
  const errors = data.metafieldsSet.userErrors;
  if (errors.length) throw new Error(`metafieldsSet: ${JSON.stringify(errors)}`);
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);

  const shopifyHmac = req.headers['x-shopify-hmac-sha256'];
  const computed = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET || '')
    .update(rawBody)
    .digest('base64');
  if (shopifyHmac !== computed) {
    console.warn('[connected-products] HMAC mismatch — received:', shopifyHmac, 'computed:', computed);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  const { id: productId, vendor, title } = payload;
  if (!productId || !vendor || !title) return res.status(200).end();
  if (!BRANDS.has(vendor)) return res.status(200).end();

  console.log(`[connected-products] ${vendor} — "${title}" (${productId})`);

  const candidates = await findSiblings(vendor, title);

  // Exact title match + gender from webhook payload doesn't include metafields,
  // so we fetch gender from the candidate list (the triggering product is included)
  const triggeringGid = `gid://shopify/Product/${productId}`;
  const triggeringProduct = candidates.find(p => p.id === triggeringGid);

  if (!triggeringProduct) {
    console.log(`[connected-products] Triggering product not found in search results — skipping`);
    return res.status(200).end();
  }

  const gender = triggeringProduct.kon?.value;
  if (!gender) {
    console.log(`[connected-products] No custom.kon on ${productId} — skipping`);
    return res.status(200).end();
  }

  const titleLower = title.toLowerCase();
  const sortKon = v => JSON.parse(v).sort().join('|');
  const genderKey = sortKon(gender);
  const siblings = candidates.filter(
    p => p.title.toLowerCase() === titleLower && p.kon?.value && sortKon(p.kon.value) === genderKey
  );

  if (siblings.length < 2) {
    console.log(`[connected-products] Only ${siblings.length} product(s) match — nothing to link`);
    return res.status(200).end();
  }

  await Promise.all(siblings.map(product => {
    const others = siblings.filter(s => s.id !== product.id).map(s => s.id);

    const currentRaw = product.connected?.value;
    const current = currentRaw ? JSON.parse(currentRaw) : [];

    if (others.length === current.length && others.every(g => current.includes(g))) {
      console.log(`[connected-products] Already up to date: ${product.id}`);
      return Promise.resolve();
    }

    console.log(`[connected-products] Updating ${product.id} → [${others.join(', ')}]`);
    return setConnected(product.id, others);
  }));

  return res.status(200).end();
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
