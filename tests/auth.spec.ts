import { test, expect } from '../fixtures';
import { authRejectedSchema, authTokenSchema } from '../schemas';
import { env } from '../utils/env';
import { expectKnownDefect } from '../utils/knownDefect';
import { expectMatchesSchema } from '../utils/expectMatchesSchema';

test.describe('POST /auth', () => {
  test('valid credentials return a token', async ({ authClient }) => {
    const response = await authClient.login(env.username, env.password);

    expect(response.status()).toBe(200);
    await expectMatchesSchema(response, authTokenSchema);
  });

  test('wrong password is rejected with a reason and no token', async ({ authClient }) => {
    const response = await authClient.login(env.username, 'not-the-password');

    await expectMatchesSchema(response, authRejectedSchema);
    expect(await response.json()).toEqual({ reason: 'Bad credentials' });
  });

  test('D1: rejected credentials return 200 instead of 401', async ({ authClient }) => {
    const response = await authClient.login(env.username, 'not-the-password');

    // The body is covered by the previous test, so only the status is the defect here.
    await expectKnownDefect(response, { id: 'D1', observedStatus: 200, expectedStatuses: [400, 401] });
  });
});
