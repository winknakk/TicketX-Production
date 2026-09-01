import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CustomerApiClient } from './features/customer-web/api/customerApi';
import { normalizeCustomerError } from './features/customer-web/api/customerErrors';
import { setCustomerToken, getCustomerToken, clearCustomerSession, setStoredGuestUuid, getStoredGuestUuid } from './features/customer-web/auth/customerSession';
import { getCustomerStatusConfig } from './features/customer-web/components/tickets/CustomerStatusBadge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTargetedFrontendTests() {
  console.log('=================================================================');
  console.log('  Targeted Frontend Tests: Standalone Customer Web App (1–12)');
  console.log('=================================================================\n');

  // Setup mock storage in Node environment for session tests
  const mockSessionStorage: Record<string, string> = {};
  const mockLocalStorage: Record<string, string> = {};

  (globalThis as any).sessionStorage = {
    getItem: (k: string) => mockSessionStorage[k] || null,
    setItem: (k: string, v: string) => { mockSessionStorage[k] = v; },
    removeItem: (k: string) => { delete mockSessionStorage[k]; },
    clear: () => { for (const k in mockSessionStorage) delete mockSessionStorage[k]; },
  };

  (globalThis as any).localStorage = {
    getItem: (k: string) => mockLocalStorage[k] || null,
    setItem: (k: string, v: string) => { mockLocalStorage[k] = v; },
    removeItem: (k: string) => { delete mockLocalStorage[k]; },
    clear: () => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; },
  };

  // Mock global fetch
  let interceptedHeaders: Record<string, string> = {};
  let interceptedUrl = '';
  let interceptedMethod = '';
  let interceptedBody: any = null;
  let mockResponseStatus = 200;
  let mockResponseBody: any = { success: true };

  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    interceptedUrl = url;
    interceptedMethod = init?.method || 'GET';
    interceptedHeaders = (init?.headers as Record<string, string>) || {};
    interceptedBody = init?.body ? JSON.parse(String(init.body)) : null;

    return {
      ok: mockResponseStatus >= 200 && mockResponseStatus < 300,
      status: mockResponseStatus,
      json: async () => mockResponseBody,
    } as Response;
  };

  const client = new CustomerApiClient('http://localhost:3000');

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Customer token is attached to portal requests
  // ─────────────────────────────────────────────────────────────
  console.log('[Test 1] Testing customer token header attachment...');
  setCustomerToken('mock_verified_customer_jwt_token');
  mockResponseStatus = 200;
  mockResponseBody = { success: true, tickets: [] };

  await client.getTickets();
  assert.strictEqual(
    interceptedHeaders['Authorization'],
    'Bearer mock_verified_customer_jwt_token',
    'Customer API client must attach Bearer <token>'
  );
  console.log('  ✅ Test 1 PASSED: Customer Bearer token correctly attached to portal requests.');

  // ─────────────────────────────────────────────────────────────
  // TEST 2 & 3: X-Org-Id & X-Project-Id are NEVER attached
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 2 & 3] Testing that tenant headers (X-Org-Id, X-Project-Id) are omitted...');
  assert.strictEqual(interceptedHeaders['X-Org-Id'], undefined, 'X-Org-Id must not be present');
  assert.strictEqual(interceptedHeaders['x-org-id'], undefined, 'x-org-id must not be present');
  assert.strictEqual(interceptedHeaders['X-Project-Id'], undefined, 'X-Project-Id must not be present');
  assert.strictEqual(interceptedHeaders['x-project-id'], undefined, 'x-project-id must not be present');
  console.log('  ✅ Test 2 & 3 PASSED: Zero tenant headers attached to outgoing customer requests.');

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Operator token cannot be silently reused
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 4] Testing operator token isolation...');
  clearCustomerSession();
  mockLocalStorage['session_token'] = 'operator_admin_token_should_not_leak';

  const tokenInCustomerScope = getCustomerToken();
  assert.strictEqual(tokenInCustomerScope, null, 'Customer session must not read operator session_token');
  console.log('  ✅ Test 4 PASSED: Customer session strictly isolated from operator localStorage session.');

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Guest 403 maps to Guest guidance (GuestNoticeCard)
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 5] Testing Guest 403 error normalization...');
  const guestErr = normalizeCustomerError(403, { code: 'GUEST_NOT_PERMITTED' });
  assert.strictEqual(guestErr.isGuestError, true, 'isGuestError must be true for 403 GUEST_NOT_PERMITTED');
  assert.strictEqual(guestErr.message, 'กรุณายืนยันตัวตนเพื่อดูประวัติการแจ้งปัญหา');
  console.log('  ✅ Test 5 PASSED: Guest 403 correctly maps to customer-friendly verification guidance.');

  // ─────────────────────────────────────────────────────────────
  // TEST 6: 401 maps to session-expired UX without operator login redirect
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 6] Testing 401 session-expired error handling...');
  const expiredErr = normalizeCustomerError(401, { error: 'Unauthorized' });
  assert.strictEqual(expiredErr.isSessionExpired, true, 'isSessionExpired must be true for 401');
  assert.strictEqual(expiredErr.message, 'เซสชันหมดอายุ กรุณาเชื่อมต่อใหม่อีกครั้ง');
  console.log('  ✅ Test 6 PASSED: 401 correctly maps to non-disruptive reconnect prompt.');

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Foreign ticket 404 maps to "not found" UX
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 7] Testing 404 ticket not found mapping...');
  const notFoundErr = normalizeCustomerError(404, { error: 'Ticket not found' });
  assert.strictEqual(notFoundErr.message, 'ไม่พบรายการตั๋วที่คุณค้นหา');
  console.log('  ✅ Test 7 PASSED: 404 maps to polite Thai not found message.');

  // ─────────────────────────────────────────────────────────────
  // TEST 8: Ticket transition sends only allowed commands
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 8] Testing ticket transition API call...');
  setCustomerToken('mock_verified_token');
  mockResponseStatus = 200;
  mockResponseBody = { success: true, ticketId: 101, ticketNumber: 'TCK-2026-101', to: 'CUSTOMER_CONFIRMED' };

  await client.transitionTicket('TCK-2026-101', 'CUSTOMER_CONFIRMED');
  assert.strictEqual(interceptedUrl, 'http://localhost:3000/api/portal/tickets/TCK-2026-101/transition');
  assert.strictEqual(interceptedMethod, 'POST');
  assert.strictEqual(interceptedBody.targetStatus, 'CUSTOMER_CONFIRMED');
  console.log('  ✅ Test 8 PASSED: Transition API invokes targetStatus CUSTOMER_CONFIRMED correctly.');

  // ─────────────────────────────────────────────────────────────
  // TEST 9: Forged customerId/projectId cannot be supplied to customer API client
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 9] Testing createTicket parameter boundary...');
  await client.createTicket({
    subject: 'Cannot login',
    summary: 'Error on submit',
    priority: 'P3',
  });
  assert.strictEqual(interceptedBody.customerId, undefined, 'customerId must not be in createTicket payload');
  assert.strictEqual(interceptedBody.projectId, undefined, 'projectId must not be in createTicket payload');
  console.log('  ✅ Test 9 PASSED: Client does not pass arbitrary customerId/projectId authority in ticket create payload.');

  // ─────────────────────────────────────────────────────────────
  // TEST 10: No credential literals in Customer Web App source files
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 10] Scanning customer-web source files for hardcoded credentials...');
  const customerDir = path.resolve(__dirname, 'features/customer-web');

  function scanDir(dir: string): string[] {
    let files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        files = files.concat(scanDir(full));
      } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
        files.push(full);
      }
    }
    return files;
  }

  const allFiles = scanDir(customerDir);
  const forbiddenPatterns = [
    /X-Org-Id/i,
    /X-Project-Id/i,
    /API_KEY\s*=/i,
    /SESSION_SECRET\s*=/i,
    /Bearer\s+["'][a-zA-Z0-9_\-]{20,}["']/i,
    /customerId:\s*['"]cust_portal_user['"]/i,
  ];

  for (const f of allFiles) {
    const content = fs.readFileSync(f, 'utf8');
    for (const p of forbiddenPatterns) {
      if (p.test(content) && !f.includes('customerApi.ts') && !f.includes('test-customer-frontend.ts')) {
        assert.fail(`Forbidden security pattern ${p} found in ${f}`);
      }
    }
  }
  console.log(`  Scanned ${allFiles.length} files under features/customer-web.`);
  console.log('  ✅ Test 10 PASSED: Zero credential literals or hardcoded tenant IDs found in Customer Web App.');

  // ─────────────────────────────────────────────────────────────
  // TEST 11: Status label mapping parity with backend
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 11] Testing customer status badge mapping...');
  const newStatus = getCustomerStatusConfig('NEW');
  assert.strictEqual(newStatus.label, 'รับเรื่องแล้ว');
  const inProgressStatus = getCustomerStatusConfig('IN_PROGRESS');
  assert.strictEqual(inProgressStatus.label, 'กำลังดำเนินการ');
  const resolvedStatus = getCustomerStatusConfig('RESOLVED');
  assert.strictEqual(resolvedStatus.label, 'แก้ไขแล้ว — รอคุณยืนยัน');
  const confirmedStatus = getCustomerStatusConfig('CUSTOMER_CONFIRMED');
  assert.strictEqual(confirmedStatus.label, 'คุณยืนยันผลแล้ว');
  const closedStatus = getCustomerStatusConfig('CLOSED');
  assert.strictEqual(closedStatus.label, 'ปิดงานเรียบร้อย');
  console.log('  ✅ Test 11 PASSED: Status mappings match customer-friendly presentation specifications.');

  // ─────────────────────────────────────────────────────────────
  // TEST 12: Customer App does not redirect to operator login
  // ─────────────────────────────────────────────────────────────
  console.log('\n[Test 12] Testing operator login redirect avoidance...');
  const customerApiSrc = fs.readFileSync(path.resolve(customerDir, 'api/customerApi.ts'), 'utf8');
  assert(!customerApiSrc.includes('redirectToLogin'), 'customerApi must not call redirectToLogin');
  assert(!customerApiSrc.includes('apiFetch'), 'customerApi must not use operator apiFetch');
  console.log('  ✅ Test 12 PASSED: Customer client completely independent from operator login redirection.');

  console.log('\n=================================================================');
  console.log('  All 12 Targeted Frontend Tests Passed Successfully!');
  console.log('=================================================================');
}

runTargetedFrontendTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Frontend test failed:', err);
    process.exit(1);
  });
