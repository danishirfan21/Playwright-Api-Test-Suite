import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures';
import type { BookingClient } from '../clients/BookingClient';
import type { CreatedBooking } from '../clients/types';
import { expectKnownDefect } from '../utils/knownDefect';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const INTERNAL_ERROR = 'Internal Server Error';
const METHOD_NOT_ALLOWED = 'Method Not Allowed';

/** Deletes a fixture booking and proves it is gone, so the id is a known nonexistent one. */
async function makeMissing(bookingClient: BookingClient, created: CreatedBooking, token: string): Promise<number> {
  const deleted = await bookingClient.delete(created.bookingid, token);
  expect([200, 201, 204], 'prerequisite: delete should succeed').toContain(deleted.status());
  expect((await bookingClient.get(created.bookingid)).status(), 'prerequisite: booking should be gone').toBe(404);
  return created.bookingid;
}

test.describe('authorization', () => {
  test('PUT without a token is forbidden and changes nothing', async ({ bookingClient, bookingFactory, createdBooking }) => {
    const response = await bookingClient.update(createdBooking.bookingid, bookingFactory());

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('PUT with an invalid token is forbidden and changes nothing', async ({ bookingClient, bookingFactory, createdBooking }) => {
    const response = await bookingClient.update(createdBooking.bookingid, bookingFactory(), 'invalid-token');

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('PATCH without a token is forbidden and changes nothing', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.partialUpdate(createdBooking.bookingid, { firstname: 'Nope' });

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('PATCH with an invalid token is forbidden and changes nothing', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.partialUpdate(createdBooking.bookingid, { firstname: 'Nope' }, 'invalid-token');

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('DELETE without a token is forbidden and the booking survives', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.delete(createdBooking.bookingid);

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(reread.status()).toBe(200);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('DELETE with an invalid token is forbidden and the booking survives', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.delete(createdBooking.bookingid, 'invalid-token');

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(reread.status()).toBe(200);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });
});

test.describe('nonexistent booking', () => {
  // Each test deletes its own booking, so the id is known to be gone without guessing a number.
  test('GET returns 404', async ({ bookingClient, createdBooking, token }) => {
    const id = await makeMissing(bookingClient, createdBooking, token);

    const response = await bookingClient.get(id);

    expect(response.status()).toBe(404);
  });

  test('D6: PUT on a missing id returns 405 instead of 404', async ({ bookingClient, bookingFactory, createdBooking, token }) => {
    const id = await makeMissing(bookingClient, createdBooking, token);

    const response = await bookingClient.update(id, bookingFactory(), token);

    await expectKnownDefect(response, {
      id: 'D6',
      observedStatus: 405,
      observedBody: METHOD_NOT_ALLOWED,
      expectedStatuses: [404],
    });
  });

  test('D6: PATCH on a missing id returns 405 instead of 404', async ({ bookingClient, createdBooking, token }) => {
    const id = await makeMissing(bookingClient, createdBooking, token);

    const response = await bookingClient.partialUpdate(id, { firstname: 'Ghost' }, token);

    await expectKnownDefect(response, {
      id: 'D6',
      observedStatus: 405,
      observedBody: METHOD_NOT_ALLOWED,
      expectedStatuses: [404],
    });
  });

  test('D6: DELETE on a missing id returns 405 instead of 404', async ({ bookingClient, createdBooking, token }) => {
    const id = await makeMissing(bookingClient, createdBooking, token);

    const response = await bookingClient.delete(id, token);

    await expectKnownDefect(response, {
      id: 'D6',
      observedStatus: 405,
      observedBody: METHOD_NOT_ALLOWED,
      expectedStatuses: [404],
    });
  });
});

test.describe('invalid payloads', () => {
  test('malformed JSON is rejected with 400', async ({ bookingClient }) => {
    const response = await bookingClient.createRaw('{"firstname": ', JSON_HEADERS);

    expect(response.status()).toBe(400);
    expect(await response.text()).toBe('Bad Request');
  });

  test('PUT with a missing field is rejected with 400 and changes nothing', async ({
    bookingClient,
    createdBooking,
    token,
  }) => {
    const incomplete: Partial<typeof createdBooking.booking> = { ...createdBooking.booking };
    delete incomplete.firstname;

    const put = await bookingClient.update(createdBooking.bookingid, incomplete as typeof createdBooking.booking, token);

    expect(put.status()).toBe(400);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('D3: empty object returns 500 instead of 400', async ({ bookingClient }) => {
    const response = await bookingClient.createRaw('{}', JSON_HEADERS);

    await expectKnownDefect(response, {
      id: 'D3',
      observedStatus: 500,
      observedBody: INTERNAL_ERROR,
      expectedStatuses: [400, 422],
    });
  });

  test('D3: missing required fields return 500 instead of 400', async ({ bookingClient }) => {
    const response = await bookingClient.createRaw(JSON.stringify({ firstname: 'Only' }), JSON_HEADERS);

    await expectKnownDefect(response, {
      id: 'D3',
      observedStatus: 500,
      observedBody: INTERNAL_ERROR,
      expectedStatuses: [400, 422],
    });
  });

  test('D5: non-numeric totalprice is accepted and stored as null', async ({ bookingClient, bookingFactory, trackBooking }) => {
    const body = JSON.stringify({ ...bookingFactory(), totalprice: 'not-a-number' });

    const response = await bookingClient.createRaw(body, JSON_HEADERS);
    // Register before asserting: the defect path creates a record that must be removed.
    // eslint-disable-next-line playwright/no-conditional-in-test -- a corrected API creates nothing
    const bookingid = response.ok() ? ((await response.json()) as { bookingid: number }).bookingid : undefined;
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (bookingid !== undefined) trackBooking(bookingid);

    await expectKnownDefect(response, { id: 'D5', observedStatus: 200, expectedStatuses: [400, 422] });
    // Only reached while the defect exists: prove the invalid value was really persisted.
    const stored = await bookingClient.get(bookingid as number);
    expect(((await stored.json()) as { totalprice: unknown }).totalprice).toBeNull();
  });
});

test.describe('wrong content type', () => {
  test('a text/plain body does not create a booking', async ({ bookingClient, bookingFactory }) => {
    const lastname = `Ln${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const body = JSON.stringify(bookingFactory({ lastname }));

    const response = await bookingClient.createRaw(body, { 'Content-Type': 'text/plain' });

    expect(response.ok()).toBe(false);
    // Rejection is not enough: nothing may have been stored as a side effect.
    const listed = await bookingClient.list({ lastname });
    expect(await listed.json()).toEqual([]);
  });

  test('D4: text/plain returns 500 instead of 415 or 400', async ({ bookingClient, bookingFactory }) => {
    const response = await bookingClient.createRaw(JSON.stringify(bookingFactory()), { 'Content-Type': 'text/plain' });

    await expectKnownDefect(response, {
      id: 'D4',
      observedStatus: 500,
      observedBody: INTERNAL_ERROR,
      expectedStatuses: [400, 415],
    });
  });
});
