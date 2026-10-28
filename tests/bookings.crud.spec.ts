import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures';
import { bookingIdListSchema, bookingSchema, createdBookingSchema } from '../schemas';
import { expectKnownDefect } from '../utils/knownDefect';
import { expectMatchesSchema } from '../utils/expectMatchesSchema';

function shiftDay(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function uniqueName(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

test.describe('create', () => {
  test('creates a booking and echoes the payload', async ({ bookingClient, bookingFactory, trackBooking }) => {
    const booking = bookingFactory();

    const response = await bookingClient.create(booking);

    expect(response.status()).toBe(200);
    await expectMatchesSchema(response, createdBookingSchema);
    const created = (await response.json()) as { bookingid: number; booking: unknown };
    trackBooking(created.bookingid);
    expect(created.booking).toEqual(booking);
  });
});

test.describe('read one', () => {
  test('returns the stored booking', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.get(createdBooking.bookingid);

    expect(response.status()).toBe(200);
    await expectMatchesSchema(response, bookingSchema);
    expect(await response.json()).toEqual(createdBooking.booking);
  });
});

test.describe('read all', () => {
  test('lists ids and includes a new booking', async ({ bookingClient, createdBooking }) => {
    const response = await bookingClient.list();

    expect(response.status()).toBe(200);
    await expectMatchesSchema(response, bookingIdListSchema);
    const ids = ((await response.json()) as { bookingid: number }[]).map((b) => b.bookingid);
    expect(ids).toContain(createdBooking.bookingid);
  });

  test('filters by firstname and lastname', async ({ bookingClient, bookingFactory, trackBooking }) => {
    const booking = bookingFactory({ firstname: uniqueName('Fn'), lastname: uniqueName('Ln') });
    const created = (await (await bookingClient.create(booking)).json()) as { bookingid: number };
    trackBooking(created.bookingid);

    const response = await bookingClient.list({ firstname: booking.firstname, lastname: booking.lastname });

    expect(response.status()).toBe(200);
    await expectMatchesSchema(response, bookingIdListSchema);
    expect(await response.json()).toEqual([{ bookingid: created.bookingid }]);
  });

  test('filters by checkin and checkout dates', async ({ bookingClient, bookingFactory, trackBooking }) => {
    const booking = bookingFactory({ lastname: uniqueName('Ln') });
    const created = (await (await bookingClient.create(booking)).json()) as { bookingid: number };
    trackBooking(created.bookingid);

    // Same one day margin the probe used. The unique lastname keeps the result to this booking.
    const response = await bookingClient.list({
      lastname: booking.lastname,
      checkin: shiftDay(booking.bookingdates.checkin, -1),
      checkout: shiftDay(booking.bookingdates.checkout, 1),
    });

    expect(response.status()).toBe(200);
    await expectMatchesSchema(response, bookingIdListSchema);
    expect(await response.json()).toEqual([{ bookingid: created.bookingid }]);
  });

  test('returns an empty list when nothing matches', async ({ bookingClient }) => {
    const response = await bookingClient.list({ firstname: uniqueName('NoSuch') });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

test.describe('full update', () => {
  test('PUT replaces every field', async ({ bookingClient, bookingFactory, createdBooking, token }) => {
    const replacement = bookingFactory();

    const response = await bookingClient.update(createdBooking.bookingid, replacement, token);

    expect(response.status()).toBe(200);
    await expectMatchesSchema(response, bookingSchema);
    expect(await response.json()).toEqual(replacement);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(replacement);
  });
});

test.describe('partial update', () => {
  test('PATCH changes only the supplied fields', async ({ bookingClient, createdBooking, token }) => {
    const response = await bookingClient.partialUpdate(
      createdBooking.bookingid,
      { firstname: 'Patched', totalprice: 4321 },
      token,
    );

    const expected = { ...createdBooking.booking, firstname: 'Patched', totalprice: 4321 };
    expect(response.status()).toBe(200);
    await expectMatchesSchema(response, bookingSchema);
    expect(await response.json()).toEqual(expected);
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(await reread.json()).toEqual(expected);
  });
});

test.describe('delete', () => {
  test('removes the booking so it can no longer be read', async ({ bookingClient, createdBooking, token }) => {
    const response = await bookingClient.delete(createdBooking.bookingid, token);

    // The exact success status is the subject of D2 below. Here any success code is accepted.
    expect([200, 201, 204]).toContain(response.status());
    const reread = await bookingClient.get(createdBooking.bookingid);
    expect(reread.status()).toBe(404);
  });

  test('D2: successful delete returns 201 instead of 200 or 204', async ({ bookingClient, createdBooking, token }) => {
    const response = await bookingClient.delete(createdBooking.bookingid, token);

    await expectKnownDefect(response, { id: 'D2', observedStatus: 201, observedBody: 'Created', expectedStatuses: [200, 204] });
    // The delete itself must still work, otherwise this is not just a status quirk.
    expect((await bookingClient.get(createdBooking.bookingid)).status()).toBe(404);
  });
});
