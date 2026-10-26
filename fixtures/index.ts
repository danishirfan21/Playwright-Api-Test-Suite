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
    // Teardown tolerates ids a test already deleted (the API answers 405 for those).
    for (const id of ids) {
      await bookingClient.delete(id, token);
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
