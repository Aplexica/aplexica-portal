// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Per-route accessibility audit. Each local-mode
 * route is loaded behind the standard bootstrap-token flow, axe-core
 * is injected, and we assert that no `critical` or `serious` WCAG
 * 2.1 AA violations are present.
 *
 * `incomplete` violations are not asserted — they require manual
 * judgment per axe-core docs and are surfaced in the report attached
 * to the test run.
 *
 */

async function bootstrappedGoto(page: Page, path: string) {
  const url = path.includes('?')
    ? `${path}&bootstrap=e2e-token`
    : `${path}?bootstrap=e2e-token`;
  await page.goto(url);
  // Wait for the DOM to be parsed and the SPA shell to mount its
  // <main> region (AppShell renders one on every route, regardless
  // of whether the route renders a loading/empty/error fallback).
  // We deliberately avoid `networkidle` because the local-mode SSE
  // stream (`/api/events/stream`) and ws-style keepalives hold
  // connections open indefinitely, which would deadlock the wait.
  await page.waitForLoadState('domcontentloaded');
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * Runs axe-core against the current page and asserts no violations at
 * severity `critical` or `serious`. WCAG 2.1 AA tags are the V1 budget;
 * we'll tighten to AAA selectively for high-contrast surfaces if a
 * compliance customer requests it.
 */
async function assertAxeClean(page: Page) {
  // Disable entry animations/transitions before scanning. The portal's
  // `apx-rise` route-entry animation fades content in (opacity 0→1), and
  // axe computes color-contrast from the element's CURRENT opacity — a
  // scan landing mid-fade falsely fails contrast on ALL text (even
  // high-contrast headings), which is non-deterministic across chromium
  // builds. Jump animations to their end state and flush two frames so
  // we measure the settled page.
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;}',
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))),
      ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockers = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  if (blockers.length > 0) {
    const summary = blockers
      .map((v) => {
        // Include the offending selector + brief HTML for each node so
        // CI logs point straight at the failing element without having
        // to open the HTML report attachment.
        const nodeDetail = v.nodes
          .map(
            (n) =>
              `    target=${JSON.stringify(n.target)} html=${n.html.slice(0, 200)}`,
          )
          .join('\n');
        return `- ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)\n${nodeDetail}`;
      })
      .join('\n');
    throw new Error(`axe violations:\n${summary}`);
  }
  // Minor + moderate violations are reported but not failed — they
  // surface in the Playwright HTML report and become tickets if
  // they aggregate.
  expect(blockers).toHaveLength(0);
}

test.describe('local-mode accessibility', () => {
  const routes: Array<{ path: string; name: string }> = [
    { path: '/', name: 'Dashboard' },
    { path: '/agents', name: 'Agents' },
    { path: '/agents/claude-code', name: 'AgentDetail' },
    { path: '/events', name: 'Events' },
    { path: '/rules', name: 'Rules' },
    // RuleDetail target id matches a fixture rule from the stub daemon.
    { path: '/rules/example-rule', name: 'RuleDetail' },
    { path: '/conflicts', name: 'Conflicts' },
    // ConflictDetail similarly takes a fixture artifact id.
    { path: '/conflicts/fixture-conflict-1', name: 'ConflictDetail' },
    { path: '/pending', name: 'PendingProjects' },
    { path: '/settings', name: 'Settings' },
    { path: '/settings/transport', name: 'SettingsTransport' },
    { path: '/help', name: 'Help' },
    { path: '/onboarding', name: 'Onboarding' },
  ];

  for (const r of routes) {
    test(`${r.name} (${r.path}) passes axe critical+serious`, async ({ page }) => {
      await bootstrappedGoto(page, r.path);
      await assertAxeClean(page);
    });
  }
});

test.describe('local-mode DNS rebinding', () => {
  /**
   * Confirms the daemon's Host-header allowlist rejects requests with
   * attacker-controlled domains regardless of where the connection
   * landed. The browser would normally never send a wrong Host
   * because the URL bar dictates it; this test exercises the
   * defense-in-depth at the listener level by going through
   * Playwright's request API (which lets us override Host) instead of
   * the browser.
   *
   * The daemon test suite covers the same surface at the server level; this
   * Playwright test confirms the
   * production build of the daemon (running behind the full
   * middleware stack) honors the same contract end-to-end.
   */
  test('rejects evil.example.com Host header with 421', async ({ playwright, baseURL }) => {
    const apiContext = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Host: 'evil.example.com' },
    });
    // /healthz is unauthenticated and otherwise reachable; if the Host
    // allowlist were absent, this would return 200. The 421 confirms
    // the middleware ran.
    const resp = await apiContext.get('/healthz');
    expect(resp.status()).toBe(421);
    await apiContext.dispose();
  });

  test('rejects suffix-attack hostname (127.0.0.1.evil.com) with 421', async ({
    playwright,
    baseURL,
  }) => {
    const apiContext = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Host: '127.0.0.1.evil.com' },
    });
    const resp = await apiContext.get('/healthz');
    expect(resp.status()).toBe(421);
    await apiContext.dispose();
  });

  test('rejects port-mismatch Host (localhost:80) with 421', async ({
    playwright,
    baseURL,
  }) => {
    const apiContext = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Host: 'localhost:80' },
    });
    const resp = await apiContext.get('/healthz');
    expect(resp.status()).toBe(421);
    await apiContext.dispose();
  });
});
