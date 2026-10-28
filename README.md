# Restful-Booker API test suite

[![CI](https://github.com/danishirfan21/Playwright-Api-Test-Suite/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/danishirfan21/Playwright-Api-Test-Suite/actions/workflows/ci.yml)

See also: [Playwright-Automation-Framework](https://github.com/danishirfan21/Playwright-Automation-Framework), the SauceDemo UI automation suite.

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

## How this was built

- Probe first: assertions are based on real responses recorded in [docs/api-behavior.md](docs/api-behavior.md). The original probe script was lost, so `npm run probe` ([scripts/probe.mjs](scripts/probe.mjs)) is a reproducible replacement, not the original. It is sequential, low volume, prints no secrets and deletes what it creates.
- Known API issues are D1 to D6. See the policy below.
- Built with Claude Code, which is credited as co-author in the commit history.

## Run it

```bash
npm ci
npm test
npm run test:report
npm run check
npm run probe   # re-observe D1 to D6 against the live API
```

Optional configuration goes in `.env` (see `.env.example`): `BASE_URL`, `API_USERNAME`, `API_PASSWORD`, and `PROBE_DELAY_MS` for the probe.

## Layout

```
clients/      thin wrappers over APIRequestContext (AuthClient, BookingClient, types)
fixtures/     test.extend fixtures: clients, token, createdBooking, trackBooking, bookingFactory
schemas/      Ajv JSON schemas
scripts/      probe.mjs, the reproducible API investigation
test-data/    Faker booking factory
utils/        env config, expectMatchesSchema (validators compiled once), expectKnownDefect
tests/        specs
docs/         observed API behavior
.github/      CI workflow
```

## Architecture decisions

| Decision | Alternative rejected | Reason |
|---|---|---|
| Client classes returning raw `APIResponse` | Calling `request` directly in specs | Endpoints and headers live in one place, and specs still control which status they expect, including error cases. |
| Fixtures own creation and cleanup | `beforeEach` and `afterEach` hooks | Cleanup runs even when a test fails. Each test requests only the data it needs. |
| Ajv schemas with `additionalProperties: false` | Spot checks on a few fields | Catches contract drift in fields nobody thought to assert. |
| Faker for test data | Hard-coded payloads | Avoids collisions between parallel tests and runs. Filter tests add a unique name so results contain only their own booking. |
| Status-only checks on text errors | Parsing error bodies | The API returns plain text such as `Forbidden`, so there is no structure to validate. |
| `expectKnownDefect` for known issues | `test.fail` or `test.skip` | `test.fail` passes on any error, so an unrelated 503 would look like a reproduced defect. The helper matches the recorded status and body, goes red with a clear message when the API is fixed, and goes red on anything unrelated. |
| Exact pinned dependencies | Caret ranges | Reproducible installs. TypeScript is held at 6.0.3 because typescript-eslint does not yet support 6.1 or later. |
| Lint rule banning URL literals in specs | Trusting review | Specs go through the base URL setting, so the target environment can be switched. |

## Known-defect policy

| Id | Observed | Recommended | Class |
|---|---|---|---|
| D1 | Wrong credentials on POST /auth return 200 with `{ reason }` | 401 | Design weakness |
| D2 | Successful DELETE returns 201 `Created` | 200 or 204 | Semantic oddity |
| D3 | Empty object or missing fields on POST /booking return 500 | 400 | Defect (robustness) |
| D4 | Unsupported content type on POST /booking returns 500 | 415 or 400 | Defect (robustness) |
| D5 | Non-numeric `totalprice` is accepted and stored as null | 400 | Defect (data integrity) |
| D6 | PUT, PATCH and DELETE on a nonexistent id return 405 without `Allow` | 404 | Defect (protocol misuse) |

Reasoning and the limits of the approach are in [docs/api-behavior.md](docs/api-behavior.md). Each test passes while the recorded behavior is unchanged, fails with a "looks FIXED" message if the API is corrected, and fails on any unrelated response such as a 503.

## Endpoint coverage

| Endpoint | Happy path | Negative |
|---|---|---|
| POST /auth | valid login returns a token | wrong password, D1 |
| POST /booking | create, lifecycle flow | malformed JSON, D3, D4, D5, text/plain stores nothing |
| GET /booking | list, name filter, date filter, empty result | - |
| GET /booking/:id | read one, read after update and delete | missing id returns 404 |
| PUT /booking/:id | full update, lifecycle flow | no or invalid token, missing field, D6 |
| PATCH /booking/:id | partial update, lifecycle flow | no or invalid token, D6 |
| DELETE /booking/:id | delete, D2, lifecycle flow | no or invalid token, D6 |

Rejected writes also verify there was no side effect (booking unchanged, or nothing stored). Teardown deletes every tracked booking even when the test failed. Ids already deleted (405) are fine, and any other cleanup failure shows as a `cleanup-failed` annotation in the report.

## CI

`.github/workflows/ci.yml` runs on pull requests, pushes to main, manual dispatch, and nightly at 03:00 UTC. The nightly run exists because the target is a public API: when Restful-Booker fixes a documented defect, its known-defect test turns red with a "looks FIXED" message and can be updated. The lint and typecheck job runs first, then the test job. The HTML report is uploaded as an artifact when the test job fails.
