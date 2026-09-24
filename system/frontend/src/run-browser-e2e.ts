import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// Load playwright from global npx cache
const playwrightPath = 'C:/Users/akkha/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(playwrightPath);

async function runBrowserE2E() {
  console.log('=================================================================');
  console.log('  Agent 2 Browser E2E: Real Chromium Verification (Flow 5 & Flow 6)');
  console.log('=================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  console.log(`[Browser Engine] Launching system Chrome at ${chromePath}...`);
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages & errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  try {
    // -------------------------------------------------------------
    // SETUP: Mock customer token and initial session in sessionStorage
    // -------------------------------------------------------------
    const validCustomerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiY3VzdG9tZXIiLCJraW5kIjoiY3VzdG9tZXIiLCJwcm9maWxlSWQiOiJwcm9mX2UyZV9jdXN0b21lciIsImlkZW50aXR5SWQiOiIxIiwicHJvamVjdElkIjoxLCJvcmdJZCI6Im9yZ19kZWZhdWx0IiwiZXhwIjoxNzg5NDU0Mjg2fQ.SbyY9TpB7uwP4c6SLgZrz7q43hx9gqh_ZWJoPluUeDE';

    await page.addInitScript((tok) => {
      window.sessionStorage.setItem('ticketx_customer_token', tok);
      window.sessionStorage.setItem('ticketx_customer_role', 'customer');
    }, validCustomerToken);

    console.log('[Step 1] Navigating to Customer Web App (http://localhost:5173/#portal)...');
    await page.goto('http://localhost:5173/#portal', { waitUntil: 'domcontentloaded' });

    // Wait for the primary chat stream to appear
    await page.waitForSelector('text=AI Support Agent', { timeout: 15000 });
    console.log('  ✅ Step 1: Customer Web App loaded successfully.');

    // -------------------------------------------------------------
    // E2E-1: Cancel Confirmation Card Flow (Flow 5)
    // -------------------------------------------------------------
    console.log('[Step 2] E2E-1: Testing Cancel Confirmation UI & buttons...');
    const cancelActionChip = page.locator('button:has-text("ขอยกเลิกตั๋ว")');
    await cancelActionChip.waitFor({ state: 'visible', timeout: 5000 });
    await cancelActionChip.click();

    // Verify Cancel Confirmation Card is rendered
    const cancelCard = page.locator('[data-testid="cancel-confirmation-card"]');
    await cancelCard.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✅ Cancel confirmation card rendered.');

    // Verify stable button IDs: #btn-confirm-cancel and #btn-decline-cancel
    const btnConfirm = page.locator('#btn-confirm-cancel');
    const btnDecline = page.locator('#btn-decline-cancel');
    assert.strictEqual(await btnConfirm.isVisible(), true, '#btn-confirm-cancel must be visible');
    assert.strictEqual(await btnDecline.isVisible(), true, '#btn-decline-cancel must be visible');

    // Test decline cancel
    await btnDecline.click();
    await page.waitForSelector('text=ไม่ยกเลิก (ดำเนินการต่อ)', { state: 'detached', timeout: 5000 });
    console.log('  ✅ Step 2: Cancel confirmation declined idempotently.');

    // -------------------------------------------------------------
    // E2E-2: Negative Security Test (Arbitrary ticket injection)
    // -------------------------------------------------------------
    console.log('[Step 3] Negative Security Test: Inject arbitrary ticket ID in sessionStorage...');
    await page.evaluate(() => {
      sessionStorage.setItem('ticketx_active_ticket_id', 'malicious_ticket_999999');
    });
    // Reload page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('text=AI Support Agent', { timeout: 15000 });
    // Allow loadAvailableTickets async validation against /api/portal/tickets to settle
    await page.waitForTimeout(1500);

    // Invariant: sessionStorage never grants authorization.
    // The backend does not return 999999 in /api/portal/tickets, so client discards it
    const storedActiveTicket = await page.evaluate(() => {
      return sessionStorage.getItem('ticketx_active_ticket_id');
    });
    assert.strictEqual(
      storedActiveTicket,
      null,
      'Arbitrary ticket ID injected into sessionStorage must be discarded on load'
    );
    console.log('  ✅ Step 3: Unauthorized ticket ID successfully rejected and discarded from sessionStorage.');

    // -------------------------------------------------------------
    // E2E-3: Composer and Chat message input
    // -------------------------------------------------------------
    console.log('[Step 4] Testing message input in composer...');
    const composerTextarea = page.locator('textarea[aria-label="ข้อความ"]');
    await composerTextarea.waitFor({ state: 'visible', timeout: 5000 });
    await composerTextarea.fill('Test message for E2E verification');
    const sendButton = page.locator('button[aria-label="ส่งข้อความ"]');
    await sendButton.click();

    // Verify optimistic bubble appeared in chat stream
    await page.waitForSelector('text=Test message for E2E verification', { timeout: 5000 });
    console.log('  ✅ Step 4: Outgoing customer message rendered optimistically in chat stream.');

    // -------------------------------------------------------------
    // Take screenshot as artifact evidence
    // -------------------------------------------------------------
    const screenshotPath = 'c:/Users/akkha/Downloads/TicketX_mian/system/frontend/customer-flow5-flow6-e2e.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  📸 Screenshot captured at ${screenshotPath}`);

    console.log('\n=================================================================');
    console.log('  Agent 2 Browser E2E Test Suite Passed 100% in Real Chromium!');
    console.log('=================================================================\n');
  } finally {
    await browser.close();
  }
}

runBrowserE2E().catch((err) => {
  console.error('Browser E2E Execution failed:', err);
  process.exit(1);
});
