import { config } from 'dotenv';

config({ quiet: true });

export interface Env {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
  readonly isCI: boolean;
}

function read(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value.trim() !== '' ? value.trim() : fallback;
}

export const env: Env = {
  baseUrl: read('BASE_URL', 'https://restful-booker.herokuapp.com').replace(/\/+$/, ''),
  username: read('API_USERNAME', 'admin'),
  password: read('API_PASSWORD', 'password123'),
  isCI: Boolean(process.env['CI']),
};
