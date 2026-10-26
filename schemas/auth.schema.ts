export const authTokenSchema = {
  type: 'object',
  properties: { token: { type: 'string', minLength: 1 } },
  required: ['token'],
  additionalProperties: false,
} as const;

/** Body observed for wrong credentials (the API returns it with HTTP 200). */
export const authRejectedSchema = {
  type: 'object',
  properties: { reason: { type: 'string', minLength: 1 } },
  required: ['reason'],
  additionalProperties: false,
} as const;
