import type { APIRequestContext, APIResponse } from '@playwright/test';

export class AuthClient {
  constructor(private readonly request: APIRequestContext) {}

  /** POST /auth. Returns the raw response so specs can assert status and body. */
  login(username: string, password: string): Promise<APIResponse> {
    return this.request.post('/auth', { data: { username, password } });
  }

  /** Logs in and returns the token string, failing loudly if none is issued. */
  async getToken(username: string, password: string): Promise<string> {
    const response = await this.login(username, password);
    if (!response.ok()) {
      throw new Error(`Auth failed with status ${response.status()}`);
    }
    const body = (await response.json()) as { token?: string; reason?: string };
    if (!body.token) {
      throw new Error(`Auth returned no token: ${JSON.stringify(body)}`);
    }
    return body.token;
  }
}
