import { expect, test, type APIResponse } from '@playwright/test';

export interface KnownDefect {
  /** Id from docs/api-behavior.md, for example `D3`. */
  id: string;
  /** The status the API returns today. Anything else is not this defect. */
  observedStatus: number;
  /** Exact text body that comes with the observed status, when it has one. */
  observedBody?: string;
  /** Statuses a corrected API would return. Seeing one means the defect is fixed. */
  expectedStatuses: number[];
}

/**
 * Replaces a blanket `test.fail()`. The test passes only when the response
 * matches the documented defect signature (status and body). It fails, with a
 * different message each time, when:
 *  - the API now returns an expected status: the defect is fixed, update the docs and tests;
 *  - the response is anything else (503, 429, a changed body): unrelated, needs investigation.
 */
export async function expectKnownDefect(response: APIResponse, defect: KnownDefect): Promise<void> {
  const status = response.status();
  const bodyText = await response.text();

  expect(
    defect.expectedStatuses,
    `${defect.id} looks FIXED: got ${status}, which is the correct behavior. Remove this known-defect check.`,
  ).not.toContain(status);

  expect(status, `${defect.id}: status is neither the known defect (${defect.observedStatus}) nor a fixed value. Body: ${bodyText}`).toBe(
    defect.observedStatus,
  );
  if (defect.observedBody !== undefined) {
    expect(bodyText, `${defect.id}: status matches but the body signature changed`).toBe(defect.observedBody);
  }

  test.info().annotations.push({
    type: 'known-defect',
    description: `${defect.id} reproduced: ${status} (expected ${defect.expectedStatuses.join(' or ')})`,
  });
}
