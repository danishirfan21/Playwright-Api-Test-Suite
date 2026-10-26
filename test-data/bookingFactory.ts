import { faker } from '@faker-js/faker';
import type { Booking } from '../clients/types';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Builds a valid booking with realistic random data; checkout is always after checkin. */
export function buildBooking(overrides: Partial<Booking> = {}): Booking {
  const checkin = faker.date.soon({ days: 365 });
  const checkout = new Date(checkin.getTime() + faker.number.int({ min: 1, max: 14 }) * 86_400_000);
  return {
    firstname: faker.person.firstName(),
    lastname: faker.person.lastName(),
    totalprice: faker.number.int({ min: 50, max: 2000 }),
    depositpaid: faker.datatype.boolean(),
    bookingdates: { checkin: isoDate(checkin), checkout: isoDate(checkout) },
    additionalneeds: faker.helpers.arrayElement(['Breakfast', 'Parking', 'Late checkout', 'None']),
    ...overrides,
  };
}
