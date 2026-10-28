// Reproducible replacement for the original probe.mjs referenced in the early
// history of docs/api-behavior.md. That script was never committed and cannot be
// recovered, so this is NOT the original: it re-observes the behaviors behind
// D1 to D6 with a small, sequential set of requests (about 15 in total).
//
// Usage: npm run probe        (reads BASE_URL, API_USERNAME, API_PASSWORD, PROBE_DELAY_MS)
//
// Mutations only touch bookings created by this run, which are deleted in a
// finally block. Tokens and passwords are never printed.
import 'dotenv/config';

const baseUrl = (process.env.BASE_URL?.trim() || 'https://restful-booker.herokuapp.com').replace(/\/+$/, '');
const username = process.env.API_USERNAME?.trim() || 'admin';
const password = process.env.API_PASSWORD?.trim() || 'password123';
const delayMs = Number(process.env.PROBE_DELAY_MS ?? 300);

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function summarize(text) {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}...` : oneLine;
}

async function call(label, method, path, { headers = JSON_HEADERS, body, hideBody = false } = {}) {
  await sleep(delayMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
    const text = await response.text();
    const allow = response.headers.get('allow');
    const shown = hideBody ? '(hidden)' : summarize(text);
    console.log(
      `${label.padEnd(44)} ${method.padEnd(6)} ${String(response.status).padEnd(4)} ` +
        `${(response.headers.get('content-type') ?? '-').split(';')[0].padEnd(18)} ` +
        `${allow ? `Allow: ${allow}  ` : ''}${shown}`,
    );
    return { status: response.status, text };
  } catch (error) {
    console.log(`${label.padEnd(44)} ${method.padEnd(6)} NETWORK ERROR: ${error.message}`);
    return { status: 0, text: '' };
  }
}

const booking = (overrides = {}) =>
  JSON.stringify({
    firstname: 'Probe',
    lastname: `Probe${Date.now()}`,
    totalprice: 100,
    depositpaid: true,
    bookingdates: { checkin: '2030-01-01', checkout: '2030-01-03' },
    ...overrides,
  });

console.log(`Probing ${baseUrl} (sequential, ${delayMs} ms between requests)\n`);
const created = [];
let token;

try {
  // Read-only probes.
  const list = await call('list bookings (body summarised)', 'GET', '/booking');
  await call('GET non-numeric id', 'GET', '/booking/not-a-number');
  console.log(`  (listing returned ${list.status === 200 ? JSON.parse(list.text).length : '?'} ids)\n`);

  // D1: authentication.
  const auth = await call('D1 valid credentials', 'POST', '/auth', {
    body: JSON.stringify({ username, password }),
    hideBody: true,
  });
  token = auth.status === 200 ? JSON.parse(auth.text).token : undefined;
  console.log(`  (token issued: ${token ? 'yes' : 'no'})`);
  await call('D1 wrong password', 'POST', '/auth', { body: JSON.stringify({ username, password: 'wrong' }) });
  await call('D1 empty body', 'POST', '/auth', { body: '{}' });
  console.log('');

  // D3, D4, D5: payload validation. D5 may create a record, so track it.
  await call('D3 empty object', 'POST', '/booking', { body: '{}' });
  await call('D3 missing fields', 'POST', '/booking', { body: JSON.stringify({ firstname: 'Only' }) });
  await call('D4 text/plain content type', 'POST', '/booking', {
    headers: { 'Content-Type': 'text/plain', Accept: 'application/json' },
    body: booking(),
  });
  const d5 = await call('D5 totalprice is a string', 'POST', '/booking', { body: booking({ totalprice: 'abc' }) });
  if (d5.status === 200) {
    const id = JSON.parse(d5.text).bookingid;
    created.push(id);
    await call('D5 read back stored record', 'GET', `/booking/${id}`);
  }
  console.log('');

  // D2, D6: lifecycle on a disposable booking.
  const make = await call('create disposable booking', 'POST', '/booking', { body: booking() });
  if (make.status === 200 && token) {
    const id = JSON.parse(make.text).bookingid;
    created.push(id);
    const auth = { ...JSON_HEADERS, Cookie: `token=${token}` };
    await call('D2 DELETE existing booking', 'DELETE', `/booking/${id}`, { headers: auth });
    await call('GET after delete', 'GET', `/booking/${id}`);
    await call('D6 DELETE missing booking', 'DELETE', `/booking/${id}`, { headers: auth });
    await call('D6 PUT missing booking', 'PUT', `/booking/${id}`, { headers: auth, body: booking() });
    await call('D6 PATCH missing booking', 'PATCH', `/booking/${id}`, {
      headers: auth,
      body: JSON.stringify({ firstname: 'Ghost' }),
    });
  } else {
    console.log('Skipping D2/D6: could not create a booking or obtain a token.');
  }
} finally {
  // Cleanup: anything still present is removed. 404/405 mean it is already gone.
  if (token) {
    for (const id of created) {
      await call(`cleanup booking ${id}`, 'DELETE', `/booking/${id}`, {
        headers: { ...JSON_HEADERS, Cookie: `token=${token}` },
      });
    }
  }
}
