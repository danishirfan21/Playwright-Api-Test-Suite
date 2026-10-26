export const bookingSchema = {
  type: 'object',
  properties: {
    firstname: { type: 'string' },
    lastname: { type: 'string' },
    totalprice: { type: 'integer' },
    depositpaid: { type: 'boolean' },
    bookingdates: {
      type: 'object',
      properties: {
        checkin: { type: 'string', format: 'date' },
        checkout: { type: 'string', format: 'date' },
      },
      required: ['checkin', 'checkout'],
      additionalProperties: false,
    },
    additionalneeds: { type: 'string' },
  },
  required: ['firstname', 'lastname', 'totalprice', 'depositpaid', 'bookingdates'],
  additionalProperties: false,
} as const;

export const createdBookingSchema = {
  type: 'object',
  properties: {
    bookingid: { type: 'integer', minimum: 1 },
    booking: bookingSchema,
  },
  required: ['bookingid', 'booking'],
  additionalProperties: false,
} as const;

export const bookingIdListSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: { bookingid: { type: 'integer', minimum: 1 } },
    required: ['bookingid'],
    additionalProperties: false,
  },
} as const;
