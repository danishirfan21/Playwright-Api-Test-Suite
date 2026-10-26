import { expect, type APIResponse } from '@playwright/test';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

/**
 * Asserts the response body is JSON that satisfies the schema. On failure the
 * message lists every violated path, not just the first.
 */
export async function expectMatchesSchema(response: APIResponse, schema: object): Promise<void> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Response body is not JSON (status ${response.status()}): ${await response.text()}`);
  }
  const validate = ajv.compile(schema);
  const valid = validate(body);
  const details = (validate.errors ?? [])
    .map((e) => `${e.instancePath || '(root)'} ${e.message ?? ''}`.trim())
    .join('\n');
  expect(valid, `Schema violations:\n${details}\nBody: ${JSON.stringify(body)}`).toBe(true);
}
