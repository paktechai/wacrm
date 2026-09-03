import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const raw = process.env.HUB_RECORD_JSON;
const supplied = process.env.HUB_SIGNATURE || '';
const secret = process.env.HUB_DISPATCH_SIGNING_SECRET;
if (!raw || !secret || !/^[a-f0-9]{64}$/.test(supplied)) throw new Error('Invalid dispatch environment');
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  ).join(',')}}`;
}
const record = JSON.parse(raw);
const expected = crypto.createHmac('sha256', secret).update(canonicalJson(record)).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
  throw new Error('Dispatch signature mismatch');
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug) || !String(record.url).startsWith('https://')) {
  throw new Error('Invalid Hub record');
}
const path = new URL('../data/hub.json', import.meta.url);
const document = JSON.parse(await fs.readFile(path, 'utf8'));
const apps = Array.isArray(document) ? document : document.apps;
if (!Array.isArray(apps)) throw new Error('data/hub.json must be an array or contain an apps array');

const card = {
  id: record.id,
  slug: record.slug,
  name: record.name,
  description: record.description,
  url: record.url,
  icon: record.icon,
  category: record.category,
  sort_order: Number(record.sort_order || 1000),
  updated_at: record.updated_at,
};
const index = apps.findIndex((app) => app.id === card.id || app.slug === card.slug);
if (index >= 0) apps[index] = card;
else apps.push(card);
apps.sort((a, b) => Number(a.sort_order || 1000) - Number(b.sort_order || 1000) || a.name.localeCompare(b.name));

const output = Array.isArray(document) ? apps : { ...document, apps };
await fs.writeFile(path, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
