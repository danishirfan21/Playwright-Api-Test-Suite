import { test, expect } from '../fixtures';
import { authRejectedSchema, authTokenSchema } from '../schemas';
import { env } from '../utils/env';
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

  test('DEFECT D1: rejected credentials should return 401, not 200', async ({ authClient }) => {
    test.fail(true, 'D1: the API answers 200 with {reason} for bad credentials');

    const response = await authClient.login(env.username, 'not-the-password');

    expect(response.status()).toBe(401);
  });
});
