import { test as base, expect } from '@playwright/test';
import { AuthClient } from '../clients/AuthClient';
import { BookingClient } from '../clients/BookingClient';
import type { CreatedBooking } from '../clients/types';
import { buildBooking } from '../test-data/bookingFactory';
import { env } from '../utils/env';

interface TestFixtures {
  authClient: AuthClient;
  bookingClient: BookingClient;
  /** Fresh token for this test. */
  token: string;
  /** Register an id created inside a test body so teardown deletes it. */
  trackBooking: (id: number) => void;
  /** A booking created through the client and deleted in teardown. */
  createdBooking: CreatedBooking;
  /** Faker-backed booking factory. */
  bookingFactory: typeof buildBooking;
}

export const test = base.extend<TestFixtures>({
  authClient: async ({ request }, use) => {
    await use(new AuthClient(request));
  },

  bookingClient: async ({ request }, use) => {
    await use(new BookingClient(request));
  },

  token: async ({ authClient }, use) => {
    await use(await authClient.getToken(env.username, env.password));
  },

  trackBooking: async ({ bookingClient, token }, use) => {
    const ids = new Set<number>();
    await use((id) => ids.add(id));
    // Teardown runs even when the test body failed. Ids a test already deleted are
    // fine (the API answers 405, see D6; 404 is accepted in case that gets fixed).
    // Any other outcome is reported as an annotation instead of failing an
    // otherwise valid test over cleanup, but it stays visible in the report.
    for (const id of ids) {
      try {
        const response = await bookingClient.delete(id, token);
        if (![200, 201, 204, 404, 405].includes(response.status())) {
          base.info().annotations.push({ type: 'cleanup-failed', description: `booking ${id}: HTTP ${response.status()}` });
        }
      } catch (error) {
        base.info().annotations.push({ type: 'cleanup-failed', description: `booking ${id}: ${String(error)}` });
      }
    }
  },

  createdBooking: async ({ bookingClient, trackBooking }, use) => {
    const response = await bookingClient.create(buildBooking());
    expect(response.status(), 'fixture could not create a booking').toBe(200);
    const created = (await response.json()) as CreatedBooking;
    trackBooking(created.bookingid);
    await use(created);
  },

  // eslint-disable-next-line no-empty-pattern
  bookingFactory: async ({}, use) => {
    await use(buildBooking);
  },
});

export { expect };
