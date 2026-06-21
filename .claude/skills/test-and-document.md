---
name: test-and-document
description: >
  For rl/* branches: write unit + e2e tests for every task, then update
  TESTING-CHECKLIST.md, THEORY-OF-OPERATION.md, and (when states or
  transitions change) STATE-TRANSITIONS.md.
triggers:
  - /test-and-document
---

# Skill: test-and-document

Run this skill on any `rl/*` branch after implementing a task. It covers:
1. Unit tests (Vitest, `src/**/*.test.ts`)
2. E2E tests (Playwright, `e2e/*.spec.ts`)
3. Doc updates: `docs/TESTING-CHECKLIST.md`, `docs/THEORY-OF-OPERATION.md`, and (if states/transitions changed) `docs/STATE-TRANSITIONS.md`

---

## Step 1 — Understand what changed

```
git diff main...HEAD --stat
git diff main...HEAD -- src/ e2e/ prisma/
```

Read every changed source file in full. Identify:
- New or modified **business logic** (lib/, hooks/, app/api/) — these need unit tests
- New or modified **UI flows** (app/(routes)/, components/) — these need E2E coverage
- New, renamed, or removed **order/load statuses** or **state transition rules** — flag for STATE-TRANSITIONS.md

---

## Step 2 — Write unit tests

**Location**: co-locate with the module — `src/lib/foo.test.ts` next to `src/lib/foo.ts`.

**Framework**: Vitest. Follow the existing style in `src/lib/order-transitions.test.ts` and `src/lib/checkout-line-items.test.ts`.

**Coverage targets per task**:
- Happy-path: the intended behavior succeeds
- Guard rails: invalid input or state is rejected with the right error
- Edge cases called out in the task description or business rules

Run and confirm tests pass:
```
npx vitest run --reporter=verbose
```

---

## Step 3 — Write E2E tests

**Location**: `e2e/<feature>.spec.ts`. Add to an existing spec file if the scenario naturally belongs there; create a new one if it's a distinct flow.

**Framework**: Playwright. Follow the style in `e2e/booking.spec.ts` and `e2e/auth.spec.ts`.

**Coverage targets per task**:
- The golden path a real user would take
- Any error / edge-case states visible in the UI (e.g. form validation, blocked transitions)
- Role-gated pages: confirm the right roles can access and the wrong ones are redirected

Run and confirm:
```
npx playwright test --reporter=list
```

---

## Step 4 — Update docs/TESTING-CHECKLIST.md

For each new E2E scenario:
- Add a checklist item under the appropriate section
- Mark it `[x] 🤖` with the spec file reference if covered by Playwright
- Mark it `[ ]` if it requires a manual pass

For removed or renamed flows:
- Remove or update any stale checklist items

---

## Step 5 — Update docs/THEORY-OF-OPERATION.md

Update this file when the task changes any of the following:
- A user-visible phase or flow (booking, pickup, wash, delivery, payment)
- Role permissions or redirects
- Pricing/tier logic
- Any new configuration knob exposed to admin

Keep the narrative tone already established in the document. Add or edit the relevant section; do not restructure sections that were not touched by the task.

---

## Step 6 — Update docs/STATE-TRANSITIONS.md (conditional)

**Only do this step if the task modified:**
- `OrderStatus` or `LoadStatus` enum values (added, removed, renamed)
- Transition logic in `src/lib/order-transitions.ts` or `src/lib/order-status.ts`
- Cascade rules between load status and order status
- Payment status flow

Changes to make:
- Update the status tables and flow diagram strings to match the new enum values
- Update or add API rows that trigger the affected transitions
- Update any cascade-rule prose that changed

---

## Checklist before marking complete

- [ ] All new/changed logic has a unit test
- [ ] All new/changed UI flows have a Playwright spec
- [ ] `npx vitest run` passes with no failures
- [ ] `npx playwright test` passes with no failures
- [ ] `docs/TESTING-CHECKLIST.md` reflects new automated coverage
- [ ] `docs/THEORY-OF-OPERATION.md` updated for any changed flows
- [ ] `docs/STATE-TRANSITIONS.md` updated *only if* enums or transition logic changed
