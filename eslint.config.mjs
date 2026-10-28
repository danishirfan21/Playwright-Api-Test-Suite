import js from '@eslint/js';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', fetch: 'readonly', setTimeout: 'readonly' },
    },
  },
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['expect', 'expectKnownDefect', 'expectMatchesSchema'] }],
      // Specs must go through clients and fixtures, never raw request plumbing.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^https?:\\/\\//]',
          message: 'No raw URLs in specs. Use a client from /clients.',
        },
      ],
    },
  },
);
