# Restful-Booker observed behavior

Every row below comes from a real request against https://restful-booker.herokuapp.com, made with `probe.mjs` before any test was written. Nothing here is taken from the docs alone. Auth for write calls is `Cookie: token=<token>` (Basic auth also worked).

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

## Documented defects (to be asserted with `test.fail(true, reason)` in Stage 2)

| Id | Observed | Expected |
|---|---|---|
| D1 | Wrong credentials on POST /auth return 200 with `{ reason }` | 401 |
| D2 | DELETE success returns 201 `Created` | 200 or 204 |
| D3 | Empty object or missing fields on POST /booking return 500 | 400 |
| D4 | Wrong content type on POST /booking returns 500 | 415 or 400 |
| D5 | Non-numeric `totalprice` is accepted and stored as null | 400 |
| D6 | PUT, PATCH and DELETE on a nonexistent id return 405 | 404 |

## Notes

- Error bodies are plain text, so they are asserted by status only, not against a JSON schema.
- Data resets periodically, so each test creates and removes its own booking.
