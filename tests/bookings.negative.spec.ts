import { test, expect } from '../fixtures';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

test.describe('authorization', () => {
  test('PUT without a token is forbidden and changes nothing', async ({ bookingClient, bookingFactory, createdBooking }) => {
    const response = await bookingClient.update(createdBooking.bookingid, bookingFactory());

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('PUT with an invalid token is forbidden', async ({ bookingClient, bookingFactory, createdBooking }) => {
    const response = await bookingClient.update(createdBooking.bookingid, bookingFactory(), 'invalid-token');

    expect(response.status()).toBe(403);
  });

  test('PATCH without a token is forbidden and changes nothing', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.partialUpdate(createdBooking.bookingid, { firstname: 'Nope' });

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('PATCH with an invalid token is forbidden', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.partialUpdate(createdBooking.bookingid, { firstname: 'Nope' }, 'invalid-token');

    expect(response.status()).toBe(403);
  });

  test('DELETE without a token is forbidden and the booking survives', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.delete(createdBooking.bookingid);

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(reread.status()).toBe(200);
  });

  test('DELETE with an invalid token is forbidden and the booking survives', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.delete(createdBooking.bookingid, 'invalid-token');

    expect(response.status()).toBe(403);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(reread.status()).toBe(200);
  });
});

test.describe('nonexistent booking', () => {
  // Each test deletes its own booking, so the id is known to be gone without guessing a number.
  test('GET returns 404', async ({ bookingClient, createdBooking, token }) => {
    await bookingClient.delete(createdBooking.bookingid, token);

    const response = await bookingClient.get(createdBooking.bookingid);

    expect(response.status()).toBe(404);
  });

  test('DEFECT D6: PUT on a missing id should return 404, not 405', async ({
    bookingClient,
    bookingFactory,
    createdBooking,
    token,
  }) => {
    test.fail(true, 'D6: the API answers 405 Method Not Allowed for a missing id');
    await bookingClient.delete(createdBooking.bookingid, token);

    const response = await bookingClient.update(createdBooking.bookingid, bookingFactory(), token);

    expect(response.status()).toBe(404);
  });

  test('DEFECT D6: PATCH on a missing id should return 404, not 405', async ({ bookingClient, createdBooking, token }) => {
    test.fail(true, 'D6: the API answers 405 Method Not Allowed for a missing id');
    await bookingClient.delete(createdBooking.bookingid, token);

    const response = await bookingClient.partialUpdate(createdBooking.bookingid, { firstname: 'Ghost' }, token);

    expect(response.status()).toBe(404);
  });

  test('DEFECT D6: DELETE on a missing id should return 404, not 405', async ({ bookingClient, createdBooking, token }) => {
    test.fail(true, 'D6: the API answers 405 Method Not Allowed for a missing id');
    await bookingClient.delete(createdBooking.bookingid, token);

    const response = await bookingClient.delete(createdBooking.bookingid, token);

    expect(response.status()).toBe(404);
  });
});

test.describe('invalid payloads', () => {
  test('malformed JSON is rejected with 400', async ({ bookingClient }) => {
    const response = await bookingClient.createRaw('{"firstname": ', JSON_HEADERS);

    expect(response.status()).toBe(400);
  });

  test('PUT with a missing field is rejected with 400 and changes nothing', async ({
    bookingClient,
    createdBooking,
    token,
  }) => {
    const incomplete: Partial<typeof createdBooking.booking> = { ...createdBooking.booking };
    delete incomplete.firstname;

    const put =await bookingClient.update(createdBooking.bookingid, incomplete as typeof createdBooking.booking, token);

    expect(put.status()).toBe(400);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(createdBooking.booking);
  });

  test('DEFECT D3: empty object should be rejected with 400, not 500', async ({ bookingClient }) => {
    test.fail(true, 'D3: the API answers 500 Internal Server Error for an empty object');

    const response = await bookingClient.createRaw('{}', JSON_HEADERS);

    expect(response.status()).toBe(400);
  });

  test('DEFECT D3: missing required fields should be rejected with 400, not 500', async ({ bookingClient }) => {
    test.fail(true, 'D3: the API answers 500 Internal Server Error when fields are missing');

    const response = await bookingClient.createRaw(JSON.stringify({ firstname: 'Only' }), JSON_HEADERS);

    expect(response.status()).toBe(400);
  });

  test('DEFECT D5: non-numeric totalprice should be rejected with 400', async ({
    bookingClient,
    bookingFactory,
    trackBooking,
  }) => {
    test.fail(true, 'D5: the API accepts the request and stores totalprice as null');
    const body = JSON.stringify({ ...bookingFactory(), totalprice: 'not-a-number' });

    const response = await bookingClient.createRaw(body, JSON_HEADERS);
    // eslint-disable-next-line playwright/no-conditional-in-test -- only the defect path creates a record
    if (response.ok()) {
      // The defect path creates a record, so remove it.
      trackBooking(((await response.json()) as { bookingid: number }).bookingid);
    }

    expect(response.status()).toBe(400);
  });
});

test.describe('wrong content type', () => {
  test('a text/plain body does not create a booking', async ({ bookingClient, bookingFactory }) => {
    const response = await bookingClient.createRaw(JSON.stringify(bookingFactory()), { 'Content-Type': 'text/plain' });

    expect(response.ok()).toBe(false);
  });

  test('DEFECT D4: text/plain should return 415 or 400, not 500', async ({ bookingClient, bookingFactory }) => {
    test.fail(true, 'D4: the API answers 500 Internal Server Error for an unsupported content type');

    const response = await bookingClient.createRaw(JSON.stringify(bookingFactory()), { 'Content-Type': 'text/plain' });

    expect([400, 415]).toContain(response.status());
  });
});
