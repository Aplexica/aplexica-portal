// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect, type Page } from '@playwright/test';

/**
 * Bootstrap helper. Every test starts at `/?bootstrap=<token>` so the
 * SPA's useBootstrap effect exchanges the token, the fixture daemon
 * mints cookies, and subsequent /api/* requests succeed.
 */
async function bootstrappedGoto(page: Page, path: string) {
  const url = path.includes('?') ? `${path}&bootstrap=e2e-token` : `${path}?bootstrap=e2e-token`;
  await page.goto(url);
}

test.describe('local-mode routes', () => {
  test('fresh bootstrap exchanges exactly once before any route query starts', async ({ page }) => {
    const bootstrapRequests: string[] = [];
    const preSessionRequests: string[] = [];
    const failedResponses: string[] = [];
    const consoleProblems: string[] = [];
    let bootstrapSettled = false;

    await page.route('**/api/auth/bootstrap', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/auth/bootstrap') {
        bootstrapRequests.push(`${request.method()} ${url.pathname}`);
      } else if (url.pathname.startsWith('/api/') && !bootstrapSettled) {
        preSessionRequests.push(`${request.method()} ${url.pathname}`);
      }
    });
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname === '/api/auth/bootstrap' && response.ok()) bootstrapSettled = true;
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${url.pathname}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text());
    });

    await page.goto('/?bootstrap=fresh-query-bootstrap');
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
    await expect.poll(() => bootstrapRequests.length).toBe(1);
    expect(bootstrapRequests).toEqual(['POST /api/auth/bootstrap']);
    expect(preSessionRequests).toEqual([]);
    expect(failedResponses).toEqual([]);
    expect(consoleProblems).toEqual([]);
  });

  test('failed bootstrap remains fail-closed without protected API requests', async ({ page }) => {
    const bootstrapRequests: string[] = [];
    const protectedRequests: string[] = [];
    const failedResponses: string[] = [];
    const consoleProblems: string[] = [];

    await page.route('**/api/auth/bootstrap', async (route) => {
      bootstrapRequests.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'fixture detail must not render', code: 'auth' }),
      });
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/bootstrap') {
        protectedRequests.push(`${request.method()} ${url.pathname}`);
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text());
    });

    await page.goto('/?bootstrap=invalid-query-bootstrap');
    const alert = page.getByRole('alert');
    await expect(alert.getByRole('heading', { name: /Couldn't establish a local session/i })).toBeVisible();
    await expect(page).not.toHaveURL(/bootstrap=/);
    await expect(alert).not.toContainText('fixture detail');
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toHaveCount(0);
    expect(bootstrapRequests).toEqual(['POST /api/auth/bootstrap']);
    expect(protectedRequests).toEqual([]);
    expect(failedResponses).toEqual(['401 /api/auth/bootstrap']);
    expect(consoleProblems).toHaveLength(1);
    expect(consoleProblems[0]).toMatch(/401 \(Unauthorized\)/);
    expect(consoleProblems[0]).not.toContain('fixture detail');

    await alert.getByRole('button', { name: /^Try again$/ }).click();
    await expect.poll(() => bootstrapRequests.length).toBe(2);
    await expect(alert.getByRole('heading', { name: /Couldn't establish a local session/i })).toBeVisible();
    expect(protectedRequests).toEqual([]);
    expect(failedResponses).toEqual(['401 /api/auth/bootstrap', '401 /api/auth/bootstrap']);
    expect(consoleProblems.every((message) => /401 \(Unauthorized\)/.test(message))).toBe(true);
    expect(consoleProblems.join('\n')).not.toContain('fixture detail');
  });

  test('daemon fixture enforces response headers and the document console is clean', async ({ page }) => {
    const consoleProblems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(message.text());
    });
    const bootstrap = await page.request.post('/api/auth/bootstrap', { data: { token: 'console-test' } });
    expect(bootstrap.ok()).toBe(true);
    expect(bootstrap.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(bootstrap.headers()['x-frame-options']).toBe('DENY');
    expect(bootstrap.headers()['x-content-type-options']).toBe('nosniff');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
    const metaPolicy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(metaPolicy).not.toContain('frame-ancestors');
    expect(consoleProblems).toEqual([]);
  });

  test('/ Dashboard renders daemon, agents, and live events', async ({ page }) => {
    await bootstrappedGoto(page, '/');
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
    // Daemon card shows the fixture version.
    await expect(page.getByText('v0.0.0-fixture')).toBeVisible();
    // At least one agent card renders (cards show the display name "Claude Code").
    await expect(page.getByRole('link', { name: /Claude Code/i })).toBeVisible();
  });

  test('/agents lists the fixture adapters', async ({ page }) => {
    await bootstrappedGoto(page, '/agents');
    await expect(page.getByRole('heading', { level: 1, name: /^Agents$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Claude Code/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Codex/i })).toBeVisible();
  });

  test('/agents/:name shows namespaces + recent events', async ({ page }) => {
    await bootstrappedGoto(page, '/agents/claude-code');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Claude Code');
    await expect(page.getByText('Namespaces')).toBeVisible();
    await expect(page.getByText('core')).toBeVisible();
  });

  test('/events shows live status badge + backfill', async ({ page }) => {
    await bootstrappedGoto(page, '/events');
    await expect(page.getByRole('heading', { level: 1, name: /Event stream/i })).toBeVisible();
    // The agent filter <select> exists.
    await expect(page.getByLabel('Filter by agent')).toBeVisible();
  });

  test('/rules lists the fixture rule', async ({ page }) => {
    await bootstrappedGoto(page, '/rules');
    await expect(page.getByRole('heading', { level: 1, name: /Routing rules/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'default-skills' })).toBeVisible();
  });

  test('/rules shows scheduled-sync interval for scheduled rules', async ({ page }) => {
    await bootstrappedGoto(page, '/rules');
    await page.getByRole('button', { name: /^Add rule$/ }).click();
    await expect(page.getByText(/Scheduled-sync interval/i)).toHaveCount(0);

    await page.getByLabel('Mode').selectOption('scheduled');
    const interval = page.getByLabel('Scheduled-sync interval (seconds)');
    await expect(interval).toBeVisible();
    await expect(interval).toHaveValue('900');
  });

  test('/rules/:id pre-fills the edit form', async ({ page }) => {
    await bootstrappedGoto(page, '/rules/default-skills');
    await expect(page.getByRole('heading', { level: 1, name: 'default-skills' })).toBeVisible();
  });

  test('/rules/:id edits a rule and saves', async ({ page }) => {
    await bootstrappedGoto(page, '/rules/example-rule');
    await expect(page.getByRole('heading', { level: 1, name: 'example-rule' })).toBeVisible();
    // Name is disabled (rename requires delete + re-create).
    const name = page.getByLabel('Name');
    await expect(name).toBeDisabled();
    // Edit the target agents (checkbox multi-select) and save: example-rule
    // routes to claude-code only, so also tick Codex.
    const agentsGroup = page.getByRole('group', { name: /Target agents/i });
    await agentsGroup.getByRole('checkbox', { name: 'Codex' }).check();
    await page.getByRole('button', { name: /Save changes/i }).click();
    // The PATCH succeeds → success toast.
    await expect(page.getByText(/Rule updated/i)).toBeVisible();
  });

  test('/rules add-from-preset adds a preset rule to the list', async ({ page }) => {
    await bootstrappedGoto(page, '/rules');
    await page.getByRole('button', { name: /Add from preset/i }).click();
    // The preset panel lists the classic defaults.
    await expect(page.getByText('Sync everything everywhere', { exact: true })).toBeVisible();
    // Add the private-stays-local preset (single rule) and confirm the
    // new rule lands in the list.
    const privateRow = page
      .locator('li')
      .filter({ hasText: 'Private artifacts never leave this device' });
    await privateRow.getByRole('button', { name: /^Add$/ }).click();
    await expect(page.getByText(/Preset added/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'private-stays-local' })).toBeVisible();
  });

  test('/conflicts lists the fixture conflict', async ({ page }) => {
    await bootstrappedGoto(page, '/conflicts');
    await expect(page.getByRole('heading', { level: 1, name: /^Conflicts$/ })).toBeVisible();
    await expect(page.getByText('memory-team-onboarding')).toBeVisible();
  });

  test('/conflicts/:id shows both heads', async ({ page }) => {
    await bootstrappedGoto(page, '/conflicts/memory-team-onboarding');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('memory-team-onboarding');
    await expect(page.getByRole('heading', { name: 'Head A' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Head B' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Keep Head A/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Keep Head B/i })).toBeVisible();
  });

  test('/backups lists native backup controls and history', async ({ page }) => {
    await bootstrappedGoto(page, '/backups');
    await expect(page.getByRole('heading', { level: 1, name: /^Backups$/ })).toBeVisible();
    await expect(page.getByText('Safety status')).toBeVisible();
    await expect(page.getByText('Back up now')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'History limits' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Local$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Cloud$/ }).first()).toBeVisible();
    await expect(page.getByLabel('Type')).toBeVisible();
    await expect(page.getByLabel('Location')).toBeVisible();

    // The fixture snapshots render in the compact history table.
    const safetyRow = page.getByRole('row', { name: /Safety snapshot.*claude-code, codex.*5\.0 MB.*42/i });
    await expect(safetyRow).toBeVisible();
    await expect(safetyRow.getByRole('combobox')).toContainText('Restore all');
    await expect(safetyRow.getByRole('button', { name: /^Restore$/ })).toBeVisible();

    const manualRow = page.getByRole('row', { name: /Manual snapshot.*claude-code.*2\.0 MB.*16/i });
    await expect(manualRow).toBeVisible();
    await expect(manualRow.getByRole('button', { name: /^Restore$/ })).toBeVisible();
  });

  test('/backups confirm modal gates the destructive restore', async ({ page }) => {
    await bootstrappedGoto(page, '/backups');
    const safetyRow = page.getByRole('row', { name: /Safety snapshot.*claude-code, codex/i });
    const restoreButton = safetyRow.getByRole('button', { name: /^Restore$/ });
    await restoreButton.click();
    // The destructive confirm modal opens.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#root')).toHaveAttribute('inert', '');
    await expect(page.locator('#root')).toHaveAttribute('aria-hidden', 'true');
    // The confirm button is gated (disabled) until the phrase is typed.
    const confirm = dialog.getByRole('button', { name: /^Restore$/ });
    await expect(confirm).toBeDisabled();
    // A wrong phrase keeps it disabled.
    const input = dialog.getByLabel(/Confirmation phrase/i);
    await expect(input).toBeFocused();
    // Reverse-tab at the first control wraps to Cancel, never the retention
    // spinbutton behind the dialog. Tab then wraps forward to the input.
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: /^Cancel$/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    await input.fill('nope');
    await expect(confirm).toBeDisabled();
    // Typing the exact phrase arms the action.
    await input.fill('restore');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    // The restore POST succeeds → success toast.
    await expect(page.getByText(/Restored 2 files to pre-Aplexica state/i)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(restoreButton).toBeFocused();
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
    await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true');
  });

  test('/backups restore modal closes with Escape or Cancel and restores its invoker', async ({ page }) => {
    await bootstrappedGoto(page, '/backups');
    const safetyRow = page.getByRole('row', { name: /Safety snapshot.*claude-code, codex/i });
    const restoreButton = safetyRow.getByRole('button', { name: /^Restore$/ });

    await restoreButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(restoreButton).toBeFocused();

    await restoreButton.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /^Cancel$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(restoreButton).toBeFocused();
  });

  test('/connect renders the fixture default without exposing a raw route error', async ({ page }) => {
    await bootstrappedGoto(page, '/connect');

    await expect(page.getByText('Cloud plugin not installed', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(/no route:/i)).toHaveCount(0);
  });

  test('/connect pairing wizard advances for an unpaired configured daemon', async ({ page }) => {
    await page.route('**/api/remote/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          configured: true,
          enabled: true,
          paired: false,
          device_id: '',
          account_id: '',
          conn_state: 'disconnected',
          restart_count: 0,
        }),
      });
    });
    await bootstrappedGoto(page, '/connect');

    await expect(page.getByRole('heading', { name: 'Get a pairing code' })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Paste the code' })).toBeVisible();
    await page.getByLabel('Pairing code').fill('fixture-pairing-code');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Pair this device' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pair this device' })).toBeEnabled();
  });

  test('/connect replaces daemon status details with safe user-facing copy', async ({ page }) => {
    await page.route('**/api/remote/status', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'private daemon implementation detail', code: 'internal' }),
      });
    });
    await bootstrappedGoto(page, '/connect');

    await expect(page.getByRole('alert')).toHaveText("Couldn't load the cloud connection status.");
    await expect(page.getByText(/private daemon implementation detail/i)).toHaveCount(0);
  });

  test('/pending lists the unlinked project', async ({ page }) => {
    await bootstrappedGoto(page, '/pending');
    await expect(page.getByRole('heading', { level: 1, name: /Pending projects/i })).toBeVisible();
    await expect(page.getByText('/home/dev/code/sample/CLAUDE.md')).toBeVisible();
  });

  test('/settings hydrates from /api/config', async ({ page }) => {
    await bootstrappedGoto(page, '/settings');
    await expect(page.getByRole('heading', { level: 1, name: /^Settings$/ })).toBeVisible();
    await expect(page.getByText(/Hermes watch interval/i)).toBeVisible();
    await expect(page.getByText(/Scheduled-sync interval/i)).toHaveCount(0);
    await expect(page.getByText(/System tray app enabled/i)).toHaveCount(0);
    await expect(page.getByText(/Local web UI enabled/i)).toHaveCount(0);
    // The submit button is present.
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeVisible();
  });

  test('/settings/transport renders the mode + BYO form', async ({ page }) => {
    await bootstrappedGoto(page, '/settings/transport');
    await expect(page.getByRole('heading', { level: 1, name: /^Transport$/ })).toBeVisible();
    await expect(page.getByText(/Bring-your-own relay/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /BYO unavailable/i })).toBeDisabled();
  });

  test('/help renders the static link cards', async ({ page }) => {
    await bootstrappedGoto(page, '/help');
    await expect(page.getByRole('heading', { level: 1, name: /^Help$/ })).toBeVisible();
    await expect(page.getByText(/Documentation/i)).toBeVisible();
  });

  test('/onboarding shows the welcome wizard', async ({ page }) => {
    await bootstrappedGoto(page, '/onboarding');
    await expect(page.getByRole('heading', { level: 1, name: /Welcome to Aplexica/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Next/i })).toBeVisible();
  });

  test('local shell does not render a marketing footer', async ({ page }) => {
    await bootstrappedGoto(page, '/');
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.getByText(/APLEXICA™/)).toHaveCount(0);
  });
});

test.describe('local-mode mobile shell', () => {
  for (const width of [360, 443]) {
    test(`Dashboard starts usable with navigation closed at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 840 });
      await bootstrappedGoto(page, '/');

      const main = page.getByRole('main');
      const heading = page.getByRole('heading', { level: 1, name: /Dashboard/i });
      const sidebar = page.locator('#aplexica-sidebar');
      await expect(main).toBeVisible();
      await expect(heading).toBeVisible();
      await expect(sidebar).toHaveAttribute('aria-hidden', 'true');

      const layout = await page.evaluate(() => {
        const main = document.querySelector('main')?.getBoundingClientRect();
        const heading = document.querySelector('h1')?.getBoundingClientRect();
        return {
          viewport: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          main: main ? { left: main.left, right: main.right, width: main.width } : null,
          heading: heading ? { left: heading.left, right: heading.right } : null,
        };
      });
      expect(layout.main).not.toBeNull();
      expect(layout.main!.left).toBeGreaterThanOrEqual(0);
      expect(layout.main!.right).toBeLessThanOrEqual(layout.viewport);
      expect(layout.main!.width).toBeGreaterThanOrEqual(width - 1);
      expect(layout.heading).not.toBeNull();
      expect(layout.heading!.left).toBeGreaterThanOrEqual(0);
      expect(layout.heading!.right).toBeLessThanOrEqual(layout.viewport);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);

      const menu = page.getByRole('button', { name: /Toggle sidebar/i });
      await menu.click();
      await expect(sidebar).toHaveAttribute('role', 'dialog');
      await expect(sidebar).not.toHaveAttribute('aria-hidden', 'true');
      await expect(page.getByRole('button', { name: /Close navigation/i })).toBeFocused();
      await page.getByRole('button', { name: /Close navigation/i }).click();
      await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
      await expect(menu).toBeFocused();
    });
  }

  test('persisted expanded desktop preference cannot expose the rail on mobile', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('aplx_sidebar_collapsed', '0'));
    await page.setViewportSize({ width: 360, height: 840 });
    await bootstrappedGoto(page, '/');
    await expect(page.locator('#aplexica-sidebar')).toHaveAttribute('aria-hidden', 'true');
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      main: document.querySelector('main')?.getBoundingClientRect().toJSON(),
    }));
    expect(layout.main?.left).toBeGreaterThanOrEqual(0);
    expect(layout.main?.right).toBeLessThanOrEqual(layout.viewport);
    expect(layout.main?.width).toBeGreaterThanOrEqual(359);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
  });

  test('desktop to mobile resize closes navigation and preserves the viewport', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('aplx_sidebar_collapsed', '0'));
    await page.setViewportSize({ width: 1280, height: 840 });
    await bootstrappedGoto(page, '/');
    await expect(page.locator('#aplexica-sidebar')).not.toHaveAttribute('aria-hidden', 'true');
    await page.setViewportSize({ width: 360, height: 840 });
    await expect(page.locator('#aplexica-sidebar')).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const mainBounds = await page.getByRole('main').evaluate((element) => element.getBoundingClientRect().toJSON());
    expect(mainBounds.left).toBeGreaterThanOrEqual(0);
    expect(mainBounds.right).toBeLessThanOrEqual(360);
    expect(mainBounds.width).toBeGreaterThanOrEqual(359);
  });

  test('Rules keeps every rule field visible in mobile cards at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 840 });
    await bootstrappedGoto(page, '/rules');
    await expect(page.getByRole('table')).toBeHidden();
    const cards = page.getByRole('list', { name: /^Routing rules$/ });
    await expect(cards).toBeVisible();
    await expect(cards.getByRole('link', { name: 'default-skills' })).toBeVisible();
    for (const label of ['Matches', 'Routes to', 'Effect']) {
      await expect(cards.getByText(label, { exact: true }).first()).toBeVisible();
    }
    const layout = await cards.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        left: bounds.left,
        right: bounds.right,
      };
    });
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.viewport);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
  });
});
