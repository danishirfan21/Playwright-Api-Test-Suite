# Restful-Booker API test suite

[![CI](https://github.com/danishirfan21/Playwright-Api-Test-Suite/actions/workflows/ci.yml/badge.svg)](https://github.com/danishirfan21/Playwright-Api-Test-Suite/actions/workflows/ci.yml)

API tests for [Restful-Booker](https://restful-booker.herokuapp.com) written in TypeScript with Playwright's `APIRequestContext`. No browser is involved.

## What is covered

| Area | Spec | Cases |
|---|---|---|
| Auth | `tests/auth.spec.ts` | Valid credentials return a token. Wrong password returns a rejection body. |
| CRUD | `tests/bookings.crud.spec.ts` | Create, read one, read all, filter by name, filter by dates, empty filter result, full update, partial update, delete. |
| Flow | `tests/bookings.flow.spec.ts` | Create, read, PUT, PATCH, delete and 404 on re-read, all in one test. |
| Negative | `tests/bookings.negative.spec.ts` | Missing or invalid token on PUT, PATCH and DELETE. Nonexistent id. Malformed JSON. Missing field. Empty and incomplete create. Wrong content type. |

## Coverage strategy

- Every response body is validated against an Ajv schema with `additionalProperties: false`, so an added, renamed or retyped field fails the test.
- Values are asserted as well as shape: a created booking must echo the payload, a PUT must replace every field, a PATCH must change only the supplied ones, and the change must be visible on a follow-up GET.
- Rejected writes are checked for side effects: after a 403 the booking is read back and must be unchanged.
- Error bodies from this API are plain text, so error cases assert status codes only.
- Nothing is asserted that was not observed first. See [docs/api-behavior.md](docs/api-behavior.md) for the probe results.
- Each test creates its own booking through a fixture and the fixture deletes it in teardown. No test relies on another test or on seeded data, so periodic resets of the public server are harmless and tests run in parallel.

## Run it

```bash
npm ci
npm test
npm run test:report
npm run check
```

Optional configuration goes in `.env` (see `.env.example`): `BASE_URL`, `API_USERNAME`, `API_PASSWORD`.

## Layout

```
clients/      thin wrappers over APIRequestContext (AuthClient, BookingClient, types)
fixtures/     test.extend fixtures: clients, token, createdBooking, trackBooking, bookingFactory
schemas/      Ajv JSON schemas
test-data/    Faker booking factory
utils/        env config, expectMatchesSchema
tests/        specs
docs/         observed API behavior
.github/      CI workflow
```

## Architecture decisions

| Decision | Alternative rejected | Reason |
|---|---|---|
| Client classes returning raw `APIResponse` | Calling `request` directly in specs | Endpoints and headers live in one place, and specs still control which status they expect, including error cases. |
| Fixtures own creation and cleanup | `beforeEach` and `afterEach` hooks | Cleanup runs even when a test fails, and each test requests only the data it needs. |
| Ajv schemas with `additionalProperties: false` | Spot checks on a few fields | Catches contract drift in fields nobody thought to assert. |
| Faker for test data | Hard-coded payloads | Avoids collisions between parallel tests and runs. Filter tests add a unique name so results contain only their own booking. |
| Status-only checks on text errors | Parsing error bodies | The API returns plain text such as `Forbidden`, so there is no structure to validate. |
| `test.fail(true, reason)` for known defects | `test.skip` or asserting the buggy behavior | The test states the correct behavior, passes while the bug exists, and turns red when it is fixed so the marker gets removed. |
| Exact pinned dependencies | Caret ranges | Reproducible installs. TypeScript is held at 6.0.3 because typescript-eslint does not yet support 6.1 or later. |
| Lint rule banning URL literals in specs | Trusting review | Specs go through the base URL setting, so the target environment can be switched. |

## Documented API defects

Each is asserted with the correct behavior and `test.fail`. The test passes while the defect exists.

| Id | Observed | Expected |
|---|---|---|
| D1 | Wrong credentials on POST /auth return 200 with `{ reason }` | 401 |
| D2 | Successful DELETE returns 201 `Created` | 200 or 204 |
| D3 | Empty object or missing fields on POST /booking return 500 | 400 |
| D4 | Unsupported content type on POST /booking returns 500 | 415 or 400 |
| D5 | Non-numeric `totalprice` is accepted and stored as null | 400 |
| D6 | PUT, PATCH and DELETE on a nonexistent id return 405 | 404 |

## CI

`.github/workflows/ci.yml` runs on pull requests, pushes to main, manual dispatch, and nightly at 03:00 UTC. The nightly run exists because the target is a public API: when Restful-Booker fixes a documented defect, its `test.fail` test turns red and the marker can be removed. The lint and typecheck job runs first, then the test job. The HTML report is uploaded as an artifact when the test job fails.
