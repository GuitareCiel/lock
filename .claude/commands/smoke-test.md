# Smoke Test: Production API + UX

Run a full smoke test against Lock production — both API endpoints and web dashboard UX. Tests auth, CRUD, lock lifecycle, integration status, and key UI flows.

## Setup

1. Read `.env` from the project root and extract:
   - `LOCK_TEST_API_URL` (production API, e.g. `https://api.uselock.ai`)
   - `LOCK_TEST_API_KEY` (an `lk_...` API key)
   - `LOCK_TEST_EMAIL` and `LOCK_TEST_PASSWORD` (login credentials)
   - Derive `LOCK_TEST_WEB_URL` from the API URL: replace `api.` with `app.` (e.g. `https://app.uselock.ai`)
2. Generate a unique test slug: `_smoketest-{unix_timestamp}`
3. Track results in a list: test name, PASS/FAIL, details

---

## Part A: API Tests

Run these with `curl` via Bash. Use `printf '...' | curl ... -d @-` for JSON bodies (avoids shell escaping issues).

### Phase 1: Auth (2 tests)

**Test 1 — Health Check**
```
GET $LOCK_TEST_API_URL/health
```
Expect: HTTP 200.

**Test 2 — Session Login + /auth/me**
```
POST $LOCK_TEST_API_URL/auth/login
Body: { "email": "$LOCK_TEST_EMAIL", "password": "$LOCK_TEST_PASSWORD" }
```
Save cookies to `/tmp/lock_smoke_cookies` with `-c` flag. Extract `lock_session` cookie.

Then verify: `GET $LOCK_TEST_API_URL/auth/me` with `-b /tmp/lock_smoke_cookies`.
Expect: HTTP 200 with user object.

### Phase 2: Product CRUD (3 tests)

Use `Authorization: Bearer $LOCK_TEST_API_KEY` for all API tests from here.

**Test 3 — Create Product**: `POST /api/v1/products` with `{ "slug": "_smoketest-{ts}", "name": "Smoke Test {ts}" }` → 201

**Test 4 — List Products**: `GET /api/v1/products` → 200, verify slug appears

**Test 5 — Update Product**: `PATCH /api/v1/products/_smoketest-{ts}` with `{ "description": "Automated smoke test product" }` → 200

### Phase 3: Feature CRUD (2 tests)

**Test 6 — Create Feature**: `POST /api/v1/features` with `{ "slug": "smoke-feature", "name": "Smoke Feature", "product": "_smoketest-{ts}" }` → 201

**Test 7 — List Features**: `GET /api/v1/features?product=_smoketest-{ts}` → 200, verify `smoke-feature` appears

### Phase 4: Lock Lifecycle (6 tests)

**Test 8 — Commit Lock**: `POST /api/v1/locks` with:
```json
{
  "message": "Smoke test: use UTC timestamps for all API responses",
  "product": "_smoketest-{ts}",
  "feature": "smoke-feature",
  "scope": "minor",
  "tags": ["smoke-test"],
  "decision_type": "technical",
  "author": { "type": "agent", "id": "smoke-test-agent", "name": "Smoke Test Agent", "source": "api" },
  "source": { "type": "api", "ref": "smoke-test-run", "context": "Automated production smoke test" }
}
```
Expect: 201. Capture `data.lock.short_id`.

**Test 9 — Get Lock**: `GET /api/v1/locks/{short_id}` → 200

**Test 10 — Update Lock**: `PATCH /api/v1/locks/{short_id}` with `{ "scope": "major", "tags": ["smoke-test", "updated"] }` → 200

**Test 11 — Add Link**: `POST /api/v1/locks/{short_id}/link` with `{ "link_type": "github", "link_ref": "https://github.com/uselock/lock/pull/1" }` → 200/201

**Test 12 — Revert Lock**: `POST /api/v1/locks/{short_id}/revert` with:
```json
{
  "message": "Reverting smoke test decision",
  "author": { "type": "agent", "id": "smoke-test-agent", "name": "Smoke Test Agent", "source": "api" }
}
```
Expect: 200.

**Test 13 — Search**: `POST /api/v1/locks/search` with `{ "query": "UTC timestamps API responses", "product": "_smoketest-{ts}" }` → 200 (empty results OK)

### Phase 5: Integration Status (2 tests)

Use session cookie (`-b /tmp/lock_smoke_cookies`) for these.

**Test 14 — Slack Status**: `GET /api/v1/integrations/slack/status` → 200, has `connected` field

**Test 15 — Linear Status**: `GET /api/v1/integrations/linear/status` → 200, has `connected` field

---

## Part B: UX Tests

Use Playwright to open the production web app in a headless browser, log in with the test account, and verify key pages render correctly.

### How to run Playwright commands

Run all Playwright scripts from the `packages/web/` directory using:
```bash
cd /Users/pheb/lock/packages/web && npx playwright test --config=- <<'SCRIPT'
...
SCRIPT
```

Alternatively, write a temporary test file and run it:
```bash
cat > /tmp/lock_smoke_ux.spec.ts << 'EOF'
// test content here
EOF
cd /Users/pheb/lock/packages/web && npx playwright test /tmp/lock_smoke_ux.spec.ts --config playwright.config.ts
```

**Important:** For production testing, do NOT use the `webServer` config (that starts local dev servers). Override with `--config=-` or pass env vars to point at production.

### UX Setup — Login via API, inject session cookie

Before each UX test, authenticate by calling the login API and injecting the session cookie into the browser context:

```typescript
import { chromium } from '@playwright/test';

const API_URL = process.env.LOCK_TEST_API_URL;    // https://api.uselock.ai
const WEB_URL = process.env.LOCK_TEST_WEB_URL;    // https://app.uselock.ai
const EMAIL = process.env.LOCK_TEST_EMAIL;
const PASSWORD = process.env.LOCK_TEST_PASSWORD;

// Login via API
const loginRes = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const setCookie = loginRes.headers.getSetCookie();
const sessionCookie = setCookie
  .find(c => c.startsWith('lock_session='))
  ?.split(';')[0]
  ?.split('=')
  .slice(1)
  .join('=');

// Create browser with cookie
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies([{
  name: 'lock_session',
  value: sessionCookie,
  domain: '.uselock.ai',
  path: '/',
}]);
const page = await context.newPage();
```

### UX Test 16 — Login Page Loads

Navigate to `$WEB_URL/login`. Verify:
- Page loads without error (no 500, no blank screen)
- Login form is visible (email input, password input, submit button)
- Page title or heading contains "Log in" or "Sign in"

### UX Test 17 — Dashboard Loads After Auth

Navigate to `$WEB_URL/decisions` with the session cookie. Verify:
- Page loads and shows the "Decisions" heading
- Sidebar navigation is visible with links: Decisions, Products, Features, Settings
- No error banners or blank screens

### UX Test 18 — Products Page

Navigate to `$WEB_URL/products`. Verify:
- "Products" heading is visible
- "New product" button is visible
- The smoke test product `_smoketest-{ts}` appears in the list (it was created in Part A)
- Product card shows the name and description

### UX Test 19 — Decision Detail Page

Navigate to `$WEB_URL/decisions`. Verify:
- The smoke test decision ("Smoke test: use UTC timestamps...") appears
- Click on it → navigates to `/decisions/l-{short_id}`
- Detail page shows: message, scope badge, status, tags, the github link added in Test 11
- The "reverted" status badge is visible (since we reverted in Test 12)

### UX Test 20 — Settings / Integrations Page

Navigate to `$WEB_URL/settings/integrations`. Verify:
- "Integrations" heading is visible
- **Connections section** exists with separator lines between items
- **Slack row**: icon + name visible, shows either "Connected to {name}" or a "Connect" button
- **Linear row**: icon + name visible, shows either "Connected to {name}" or a "Connect" button
- **Developer tools section** exists with CLI row
- No MCP Server card/row (it was removed)
- Layout matches the list style (not card grid) — rows with divider lines, buttons on the right

### UX Test 21 — Settings Sub-Navigation

Navigate to `$WEB_URL/settings`. Verify all settings tabs are present and navigable:
- General, Team, Integrations, API Keys, Billing
- Click each tab → URL changes correctly → heading matches

### UX Test 22 — Search Page

Navigate to `$WEB_URL/decisions` and use the search functionality:
- Locate the search input
- Type "UTC timestamps"
- Verify the search triggers (either inline filter or navigation to search results)
- No errors

### UX Test 23 — Responsive Layout

Test the dashboard at mobile viewport (375x667):
- Navigate to `$WEB_URL/decisions`
- Sidebar should collapse or be hidden behind a hamburger menu
- Content should not overflow horizontally
- Text should be readable (no overlapping elements)

---

## Part C: Cleanup

### Cleanup — Delete Test Product
```
DELETE $LOCK_TEST_API_URL/api/v1/products/_smoketest-{ts}
Authorization: Bearer $LOCK_TEST_API_KEY
```
Expect: HTTP 200. Cascades all test data.

Clean up temp files: `rm -f /tmp/lock_smoke_cookies /tmp/lock_smoke_ux.spec.ts`

---

## Results

Print a combined summary table:

```
=== SMOKE TEST RESULTS ===
Run ID: _smoketest-{ts}
API: $LOCK_TEST_API_URL
Web: $LOCK_TEST_WEB_URL

  # | Test                              | Result | Details
----+-----------------------------------+--------+----------
    | --- API TESTS ---                 |        |
  1 | Health check                      | PASS   | 200
  2 | Login + /auth/me                  | PASS   | 200
  3 | Create product                    | PASS   | 201
  4 | List products                     | PASS   | 200
  5 | Update product                    | PASS   | 200
  6 | Create feature                    | PASS   | 201
  7 | List features                     | PASS   | 200
  8 | Commit lock                       | PASS   | 201
  9 | Get lock                          | PASS   | 200
 10 | Update lock                       | PASS   | 200
 11 | Add link                          | PASS   | 201
 12 | Revert lock                       | PASS   | 200
 13 | Search                            | PASS   | 200
 14 | Slack status                      | PASS   | 200
 15 | Linear status                     | PASS   | 200
    | --- UX TESTS ---                  |        |
 16 | Login page loads                  | PASS   |
 17 | Dashboard loads                   | PASS   |
 18 | Products page                     | PASS   |
 19 | Decision detail                   | PASS   |
 20 | Integrations page                 | PASS   |
 21 | Settings navigation               | PASS   |
 22 | Search                            | PASS   |
 23 | Responsive layout                 | PASS   |
----+-----------------------------------+--------+----------
    | CLEANUP                           | PASS   | 200

Result: 23/23 passed
```

---

## Error Handling

- If `.env` is missing any required variable, stop and report which ones are missing.
- If login fails (Phase 1), skip Phase 5 and all UX tests.
- If product creation fails (Phase 2), skip tests that depend on test data but still run UX tests for existing pages.
- Always run cleanup at the end, even if tests fail.
- If a UX test fails, take a screenshot with `page.screenshot({ path: '/tmp/lock_smoke_fail_{test_number}.png' })` and read it to report what went wrong visually.
- If Playwright is not available, skip Part B and report only API results.
- If cleanup fails, warn: manual cleanup needed via `DELETE /api/v1/products/_smoketest-{ts}`.

## Important Notes

- Run UX tests **after** API tests so the test product/decision data is available for the UI to display.
- Run cleanup **after** UX tests so the data is still visible during UI verification.
- For UX tests, the session cookie domain should be `.uselock.ai` (covers both `app.uselock.ai` and `api.uselock.ai`).
- UX tests should use `{ headless: true }` — no visible browser window needed.
- If a page takes more than 10 seconds to load, consider it a failure.
