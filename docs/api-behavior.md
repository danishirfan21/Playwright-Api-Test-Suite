# Restful-Booker observed behavior

Every row below comes from a real request against https://restful-booker.herokuapp.com, made before any test was written. The original `probe.mjs` was never committed and cannot be recovered. [scripts/probe.mjs](../scripts/probe.mjs) is a reproducible replacement (not the original) that re-observes the D1 to D6 rows. Rows outside D1 to D6 come from the original investigation and are exercised by the test suite itself. Nothing here is taken from the docs alone. Auth for write calls is `Cookie: token=<token>` (Basic auth also worked).

## Observed responses

| Operation | Case | Status | Content-Type | Body shape |
|---|---|---|---|---|
| POST /auth | valid credentials | 200 | json | `{ token: string }` |
| POST /auth | wrong password | 200 | json | `{ reason: "Bad credentials" }` |
| POST /auth | missing fields | 200 | json | `{ reason: "Bad credentials" }` |
| POST /auth | wrong content type | 200 | json | `{ reason: "Bad credentials" }` |
| POST /booking | valid | 200 | json | `{ bookingid: int, booking: Booking }` |
| POST /booking | malformed JSON | 400 | text | `Bad Request` |
| POST /booking | empty object | 500 | text | `Internal Server Error` |
| POST /booking | missing fields | 500 | text | `Internal Server Error` |
| POST /booking | wrong type for totalprice | 200 | json | accepted, `totalprice` stored as `null` |
| POST /booking | text/plain, no content type, XML | 500 | text | `Internal Server Error` |
| GET /booking/:id | existing | 200 | json | `Booking` |
| GET /booking/:id | nonexistent or non-numeric | 404 | text | `Not Found` |
| GET /booking | no filter | 200 | json | `[{ bookingid }]` |
| GET /booking | firstname and lastname filter | 200 | json | matching id list |
| GET /booking | checkin and checkout filter | 200 | json | matching id list |
| GET /booking | no match | 200 | json | `[]` |
| PUT /booking/:id | valid token | 200 | json | full `Booking` |
| PUT /booking/:id | no token or bad token | 403 | text | `Forbidden` |
| PUT /booking/:id | missing field | 400 | text | `Bad Request` |
| PUT /booking/:id | nonexistent id | 405 | text | `Method Not Allowed` |
| PATCH /booking/:id | valid token | 200 | json | full updated `Booking` |
| PATCH /booking/:id | no token or bad token | 403 | text | `Forbidden` |
| PATCH /booking/:id | nonexistent id | 405 | text | `Method Not Allowed` |
| DELETE /booking/:id | valid token | 201 | text | `Created` |
| DELETE /booking/:id | no token or bad token | 403 | text | `Forbidden` |
| DELETE /booking/:id | already deleted or nonexistent | 405 | text | `Method Not Allowed` |
| GET /booking/:id | after delete | 404 | text | `Not Found` |

## Known issues D1 to D6: classification

The vendor's API documentation page is rendered by JavaScript and could not be read during this review, so nothing below is claimed to violate a vendor contract. The items are classified by what can be defended on technical grounds:

| Id | Observed | Recommended | Classification | Why |
|---|---|---|---|---|
| D1 | Wrong credentials on POST /auth return 200 `{ reason }` | 401 (or 400) | Design weakness, tester recommendation | HTTP does not forbid 200 with an error body, but a client that checks status alone treats a failed login as success. |
| D2 | Successful DELETE returns 201 `Created` | 200 or 204 | Semantic oddity, tester recommendation | 201 means a resource was created, yet nothing is. The delete itself works (404 on re-read). Low impact. |
| D3 | Empty object or missing fields on POST /booking return 500 | 400 (or 422) | Defect: robustness | A 5xx for bad client input is an unhandled exception. Malformed JSON and a PUT with a missing field do get 400, so the API is inconsistent with itself. |
| D4 | text/plain on POST /booking returns 500 | 415 (or 400) | Defect: robustness | Same reasoning as D3. |
| D5 | `totalprice: "abc"` returns 200 and is stored as `null` | 400 (or 422) | Defect: data integrity | The stored record contradicts the numeric type of every valid record. The test reads the booking back to prove the null is persisted. |
| D6 | PUT, PATCH, DELETE on a nonexistent id return 405 with no `Allow` header | 404 | Defect: protocol misuse | RFC 9110 defines 405 as the target resource not supporting the method and requires an `Allow` header. The probe saw none. GET on the same id returns 404, so the API is inconsistent with itself. |

D3 to D6 are defects in the strict sense. D1 and D2 are regression pins: not wrong enough to insist on, but a change would be a visible behavior change.

## Expected-failure strategy

These tests used `test.fail(true, reason)`, which passes on any thrown error, so a 503 outage would have counted as reproducing D3. They now use `expectKnownDefect` ([utils/knownDefect.ts](../utils/knownDefect.ts)):

| Response | Result | Meaning |
|---|---|---|
| Matches the recorded status (and body, where recorded) | Pass, annotated `known-defect` | Defect reproduced. |
| A corrected status (for example 400 for D3) | Fail, "looks FIXED" | The API improved: update this document and the test. |
| Anything else (503, 429, a changed body) | Fail | Unrelated problem, not hidden. |

Prerequisites that are not part of the defect (the delete succeeding, the record being gone, the stored `null` for D5) are asserted normally outside the helper.

Limitations:

- The signature is status plus body text, so a different bug returning the same 500 text is indistinguishable.
- D1 and D5 record no body in the helper: D1's body is asserted by its own test, and D5's is JSON containing a random id.
- CI retries (2) can mask a flaky first attempt.
- The "fixed" statuses are the tester's recommendation. An API fixed to some other sensible status shows up as the "unrelated" failure and needs a human decision.

## Notes

- Error bodies are plain text, so they are asserted by status (and exact text where recorded), not against a JSON schema.
- Data resets periodically, so each test creates and removes its own booking.
- Re-observe D1 to D6 with `npm run probe`: about 15 sequential requests, read-only except for disposable bookings that it deletes, and it prints no tokens or credentials.
- A probe run on 2026-10-29 matched every D1 to D6 row above. No `Allow` header was present on any 405.
