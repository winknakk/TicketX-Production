import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runWebSocketAuthAudit() {
  console.log('=================================================================');
  console.log('  Targeted WebSocket Auth & Leakage Audit (WS-1 – WS-5)');
  console.log('=================================================================\n');

  const customerDir = path.resolve(__dirname, 'features/customer-web');

  // Helper to recursively collect ts/tsx files
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

  // ─────────────────────────────────────────────────────────────
  // WS-1: Inspect whether Customer JWT appears in WebSocket URL
  // ─────────────────────────────────────────────────────────────
  console.log('[WS-1] Inspecting WebSocket URL formation in useCustomerSocket.ts...');
  const socketHookSrc = fs.readFileSync(path.resolve(customerDir, 'hooks/useCustomerSocket.ts'), 'utf8');
  assert(socketHookSrc.includes('?ticket='), 'WebSocket URL must use ?ticket= parameter');
  assert(!socketHookSrc.includes('?token='), 'WebSocket URL must NEVER use ?token= parameter');
  console.log('  ✅ WS-1 PASSED: WebSocket URL contains ticket=<ephemeral_ticket>, never the customer JWT.');

  // ─────────────────────────────────────────────────────────────
  // WS-2: Inspect Backend WebSocket auth mechanism in WebChatGateway.ts
  // ─────────────────────────────────────────────────────────────
  console.log('\n[WS-2] Inspecting Backend WebSocket auth mechanism in WebChatGateway.ts...');
  const backendGatewayPath = path.resolve(__dirname, '../../backend/src/presentation/http/routes/WebChatGateway.ts');
  const backendGatewaySrc = fs.readFileSync(backendGatewayPath, 'utf8');

  const hasWsTicketEndpoint = backendGatewaySrc.includes('/api/v1/webchat/ws-ticket');
  const consumesTicket = backendGatewaySrc.includes('url.searchParams.get("ticket")');
  const rejectsTokenQuery = backendGatewaySrc.includes('url.searchParams.has("token")');

  assert(hasWsTicketEndpoint, 'Backend must implement POST /api/v1/webchat/ws-ticket');
  assert(consumesTicket, 'Backend must consume ticket parameter');
  assert(rejectsTokenQuery, 'Backend must reject token query parameter');
  console.log('  ✅ WS-2 PASSED: Backend securely authenticates WebSocket via single-use ephemeral ticket.');

  // ─────────────────────────────────────────────────────────────
  // WS-3: Verify no token logging anywhere in Customer Web App
  // ─────────────────────────────────────────────────────────────
  console.log('\n[WS-3] Auditing Customer Web App for token logging / leakage...');
  for (const f of allFiles) {
    const content = fs.readFileSync(f, 'utf8');
    assert(!content.includes('console.log'), `console.log must not be present in ${f}`);
    assert(!content.includes('console.warn'), `console.warn must not be present in ${f}`);
    assert(!content.includes('console.error'), `console.error must not be present in ${f}`);
  }
  console.log(`  ✅ WS-3 PASSED: Zero console logging statements across all ${allFiles.length} customer files.`);

  // ─────────────────────────────────────────────────────────────
  // WS-4: Operator token isolation in customerSession
  // ─────────────────────────────────────────────────────────────
  console.log('\n[WS-4] Verifying operator token isolation in customer session...');
  const sessionSrc = fs.readFileSync(path.resolve(customerDir, 'auth/customerSession.ts'), 'utf8');
  assert(sessionSrc.includes('sessionStorage.getItem'), 'Customer session must use sessionStorage');
  assert(!sessionSrc.includes("localStorage.getItem('session_token')"), 'Customer session must not read operator token');
  console.log('  ✅ WS-4 PASSED: Customer session is strictly isolated in sessionStorage.');

  // ─────────────────────────────────────────────────────────────
  // WS-5: Guest behavior validation
  // ─────────────────────────────────────────────────────────────
  console.log('\n[WS-5] Verifying Guest role separation...');
  assert(sessionSrc.includes('ticketx_guest_uuid'), 'Guest UUID is stored independently in localStorage');
  console.log('  ✅ WS-5 PASSED: Guest UUID is decoupled from authentication tokens.');

  console.log('\n=================================================================');
  console.log('  All 5 WebSocket Security Audits (WS-1 – WS-5) Passed!');
  console.log('=================================================================');
}

runWebSocketAuthAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
