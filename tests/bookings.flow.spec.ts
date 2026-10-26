import { test, expect } from '../fixtures';
import { bookingSchema, createdBookingSchema } from '../schemas';
import { expectMatchesSchema } from '../utils/expectMatchesSchema';

test('booking lifecycle: create, read, update, patch, delete', async ({
  bookingClient,
  bookingFactory,
  token,
  trackBooking,
}) => {
  const original = bookingFactory();

  const createResponse = await bookingClient.create(original);
  expect(createResponse.status()).toBe(200);
  await expectMatchesSchema(createResponse, createdBookingSchema);
  const { bookingid } = (await createResponse.json()) as { bookingid: number };
  // Registered at once so a failure midway still cleans up.
  trackBooking(bookingid);

  const readResponse = await bookingClient.get(bookingid);
  expect(readResponse.status()).toBe(200);
  expect(await readResponse.json()).toEqual(original);

  const replacement = bookingFactory();
  const putResponse = await bookingClient.update(bookingid, replacement, token);
  expect(putResponse.status()).toBe(200);
  await expectMatchesSchema(putResponse, bookingSchema);
  expect(await putResponse.json()).toEqual(replacement);

  const patchResponse = await bookingClient.partialUpdate(bookingid, { lastname: 'Flowed' }, token);
  expect(patchResponse.status()).toBe(200);
  expect(await patchResponse.json()).toEqual({ ...replacement, lastname: 'Flowed' });

  const afterPatch = await bookingClient.get(bookingid);
  expect(await afterPatch.json()).toEqual({ ...replacement, lastname: 'Flowed' });

  const deleteResponse = await bookingClient.delete(bookingid, token);
  expect([200, 201, 204]).toContain(deleteResponse.status());

  const afterDelete = await bookingClient.get(bookingid);
  expect(afterDelete.status()).toBe(404);
});
