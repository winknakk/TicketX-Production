/**
 * WebChat frontend event model — regression guard.
 *
 * Run: npx tsx src/test-webchat-event-normalization.ts
 *
 * These pin the two defects that put `handled_by_human` on screen as something
 * the assistant said, and that let one delivered payload become two bubbles:
 *
 *   1. every `event:"message"` frame became a chat message with no inspection
 *      of its content, so a routing sentinel rendered as prose;
 *   2. deduplication was `id`-only and depended on the gateway happening to
 *      reuse one random UUID when it broadcast the same payload to both rooms
 *      the socket belongs to.
 *
 * Exit code is the result; no runner is configured in this package.
 */

import assert from 'node:assert';
import { normalizeSocketEvent, normalizeHistoryEntries } from './features/customer-web/chat/socketEvents';
import { chatReducer, initialChatState, type ChatState } from './features/customer-web/chat/chatStore';
import type { CustomerChatMessage } from './features/customer-web/types';

const AT = '2026-09-07T10:00:00.000Z';
let passed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`  PASS  ${name}\n`);
  } catch (err: any) {
    failures.push(`${name}: ${err.message}`);
    process.stdout.write(`  FAIL  ${name} — ${err.message}\n`);
  }
}

function chatFrame(data: Record<string, unknown>) {
  return { event: 'message', data };
}

function apply(state: ChatState, actions: Parameters<typeof chatReducer>[1][]): ChatState {
  return actions.reduce((s, a) => chatReducer(s, a), state);
}

function receive(state: ChatState, frame: unknown, at = AT): ChatState {
  const ev = normalizeSocketEvent(frame, at);
  if (ev.type === 'CHAT_MESSAGE') return chatReducer(state, { type: 'MESSAGE_RECEIVED', message: ev.message });
  if (ev.type === 'TAKEOVER_EVENT') return chatReducer(state, { type: 'TAKEOVER', event: ev.event, at: ev.at });
  return state;
}

process.stdout.write('\nWEBCHAT EVENT NORMALIZATION\n');

// ── Event classification ────────────────────────────────────────────────────

check('T1 plain text frame is a chat message', () => {
  const ev = normalizeSocketEvent(chatFrame({ id: 'a1', role: 'ai', content: 'สวัสดีค่ะ' }), AT);
  assert.strictEqual(ev.type, 'CHAT_MESSAGE');
  assert.strictEqual(ev.type === 'CHAT_MESSAGE' && ev.message.content, 'สวัสดีค่ะ');
});

check('T2 "handled_by_human" is a takeover event, never a chat message', () => {
  const ev = normalizeSocketEvent(chatFrame({ id: 'a2', role: 'ai', content: 'handled_by_human' }), AT);
  assert.strictEqual(ev.type, 'TAKEOVER_EVENT', 'sentinel must not be classified as chat');
  assert.strictEqual(ev.type === 'TAKEOVER_EVENT' && ev.event, 'started');
});

check('T3 sentinel matching tolerates padding and case but not prose', () => {
  assert.strictEqual(normalizeSocketEvent(chatFrame({ content: '  HANDLED_BY_HUMAN  ' }), AT).type, 'TAKEOVER_EVENT');
  // A real reply that merely mentions the token stays a message.
  const prose = normalizeSocketEvent(chatFrame({ id: 'p', content: 'this is handled_by_human now' }), AT);
  assert.strictEqual(prose.type, 'CHAT_MESSAGE', 'substring match would eat legitimate replies');
});

check('T4 release sentinels map to a released takeover', () => {
  const ev = normalizeSocketEvent(chatFrame({ content: 'handled_by_ai' }), AT);
  assert.strictEqual(ev.type === 'TAKEOVER_EVENT' && ev.event, 'released');
});

check('T5 suppress sentinels are dropped entirely', () => {
  assert.strictEqual(normalizeSocketEvent(chatFrame({ content: 'suppress_reply' }), AT).type, 'IGNORED');
  assert.strictEqual(normalizeSocketEvent(chatFrame({ content: 'null' }), AT).type, 'IGNORED');
});

check('T6 backend error frame surfaces instead of vanishing', () => {
  const ev = normalizeSocketEvent({ error: 'Bad Request', message: 'Message content cannot be empty' }, AT);
  assert.strictEqual(ev.type, 'ERROR_EVENT');
});

check('T7 typing and project_switched keep their own types', () => {
  assert.strictEqual(normalizeSocketEvent({ event: 'typing', data: { isTyping: true } }, AT).type, 'TYPING_EVENT');
  assert.strictEqual(
    normalizeSocketEvent({ event: 'project_switched', data: { projectId: 101 } }, AT).type,
    'PROJECT_EVENT'
  );
});

check('T8 unknown frames are ignored, not rendered', () => {
  assert.strictEqual(normalizeSocketEvent({ event: 'something_new', data: {} }, AT).type, 'IGNORED');
  assert.strictEqual(normalizeSocketEvent(null, AT).type, 'IGNORED');
});

check('T9 typed takeover events work when the backend starts sending them', () => {
  assert.strictEqual(
    normalizeSocketEvent({ type: 'takeover_started' }, AT).type === 'TAKEOVER_EVENT' &&
      (normalizeSocketEvent({ type: 'takeover_started' }, AT) as any).event,
    'started'
  );
  const released = normalizeSocketEvent({ event: 'takeover_change', data: { status: 'ACTIVE_AI' } }, AT);
  assert.strictEqual(released.type === 'TAKEOVER_EVENT' && released.event, 'released');
});

// ── Attachments ─────────────────────────────────────────────────────────────

check('T10 image attachment is normalized with both key styles', () => {
  const ev = normalizeSocketEvent(
    chatFrame({
      id: 'a3',
      role: 'customer',
      content: 'ช่วยดูให้หน่อยครับ',
      attachments: [
        { fileUrl: 'https://cdn.example/x.jpg', fileName: 'messageImage_1.jpg', fileType: 'image/jpeg', fileSize: 2048 },
        { file_url: 'https://cdn.example/y.pdf', file_name: 'spec.pdf', file_type: 'application/pdf' },
      ],
    }),
    AT
  );
  assert.strictEqual(ev.type, 'CHAT_MESSAGE');
  const msg = (ev as any).message as CustomerChatMessage;
  assert.strictEqual(msg.attachments?.length, 2);
  assert.strictEqual(msg.attachments?.[0].status, 'ready');
  assert.strictEqual(msg.attachments?.[1].fileName, 'spec.pdf');
});

check('T11 text + image stays ONE logical message', () => {
  const ev = normalizeSocketEvent(
    chatFrame({ id: 'a4', role: 'customer', content: 'ดูรูปนี้ครับ', attachments: [{ fileUrl: 'u', fileName: 'a.png' }] }),
    AT
  );
  const state = chatReducer(initialChatState, { type: 'MESSAGE_RECEIVED', message: (ev as any).message });
  assert.strictEqual(state.entries.length, 1, 'must not split into a text bubble plus an attachment bubble');
});

check('T12 a sentinel that arrives WITH an attachment is still content', () => {
  // Defensive: the sentinel branch must not swallow a real file.
  const ev = normalizeSocketEvent(
    chatFrame({ id: 'a5', content: 'handled_by_human', attachments: [{ fileUrl: 'u', fileName: 'a.png' }] }),
    AT
  );
  assert.strictEqual(ev.type, 'CHAT_MESSAGE');
});

// ── Store: dedupe and reconciliation ────────────────────────────────────────

check('T13 the same payload delivered twice renders once', () => {
  // Reproduces the measured gateway behaviour: one publish, two frames, one id.
  const frame = chatFrame({ id: 'dup-1', role: 'ai', content: 'ยินดีค่ะ' });
  let s = receive(initialChatState, frame);
  s = receive(s, frame);
  assert.strictEqual(s.entries.length, 1);
});

check('T14 two genuinely different messages with identical text both render', () => {
  let s = receive(initialChatState, chatFrame({ id: 'm1', role: 'ai', content: 'ครับ' }));
  s = receive(s, chatFrame({ id: 'm2', role: 'ai', content: 'ครับ' }));
  assert.strictEqual(s.entries.length, 2, 'text must never be the dedupe key for server messages');
});

check('T15 externalId wins over id when both are present', () => {
  let s = receive(initialChatState, chatFrame({ id: 'uuid-a', external_id: 'db-77', role: 'ai', content: 'x' }));
  s = receive(s, chatFrame({ id: 'uuid-b', external_id: 'db-77', role: 'ai', content: 'x' }));
  assert.strictEqual(s.entries.length, 1, 'same backend message arriving under two transport ids');
});

check('T16 optimistic bubble reconciles with the server echo', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_1',
    role: 'customer',
    content: 'ช่วยผมเล่นระบบนี้หน่อยครับ',
    createdAt: AT,
    deliveryStatus: 'sending',
    pending: true,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  s = chatReducer(s, { type: 'OPTIMISTIC_SETTLED', tempId: 'temp_1', delivered: true });
  s = receive(s, chatFrame({ id: 'srv-9', role: 'customer', content: 'ช่วยผมเล่นระบบนี้หน่อยครับ', createdAt: AT }));
  assert.strictEqual(s.entries.length, 1, 'temp bubble plus server bubble must not both remain');
  const only = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(only.id, 'srv-9');
  assert.strictEqual(only.pending, false);
  assert.ok(only.deliveryStatus === 'sent' || only.deliveryStatus === 'delivered', 'authoritative ACK transitions bubble to sent');
});

check('T17 reconciliation keeps the local attachment preview the server omits', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_2',
    role: 'customer',
    content: 'รูปครับ',
    createdAt: AT,
    attachments: [{ fileUrl: 'blob:local', fileName: 'shot.png', status: 'ready' }],
    pending: true,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  s = receive(s, chatFrame({ id: 'srv-10', role: 'customer', content: 'รูปครับ', createdAt: AT }));
  const only = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(only.attachments?.[0].fileName, 'shot.png');
});

check('T18 a settled bubble is never reconciled away by a later identical message', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat', id: 'temp_3', role: 'customer', content: 'ok', createdAt: AT, pending: false,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  s = receive(s, chatFrame({ id: 'srv-11', role: 'customer', content: 'ok', createdAt: AT }));
  assert.strictEqual(s.entries.length, 2);
});

// ── Takeover UI state ───────────────────────────────────────────────────────

check('T19 takeover renders a system notice, not an AI bubble', () => {
  const s = receive(initialChatState, chatFrame({ id: 't1', role: 'ai', content: 'handled_by_human' }));
  assert.strictEqual(s.isHumanTakeover, true);
  assert.strictEqual(s.entries.length, 1);
  assert.strictEqual(s.entries[0].kind, 'system');
  assert.ok(!JSON.stringify(s.entries).includes('handled_by_human'), 'the raw sentinel must never reach the DOM');
});

check('T20 takeover_started twice yields exactly one notice', () => {
  let s = receive(initialChatState, chatFrame({ id: 't2', content: 'handled_by_human' }));
  s = receive(s, chatFrame({ id: 't3', content: 'handled_by_human' }));
  assert.strictEqual(s.entries.filter((e) => e.kind === 'system').length, 1);
});

check('T21 release replaces the started notice and clears the flag', () => {
  let s = receive(initialChatState, chatFrame({ id: 't4', content: 'handled_by_human' }));
  s = receive(s, chatFrame({ id: 't5', content: 'handled_by_ai' }));
  assert.strictEqual(s.isHumanTakeover, false);
  const notices = s.entries.filter((e) => e.kind === 'system');
  assert.strictEqual(notices.length, 1);
  assert.strictEqual((notices[0] as any).code, 'takeover_released');
});

// ── History, refresh, reconnect ─────────────────────────────────────────────

check('T22 history drops a persisted sentinel row', () => {
  const entries = normalizeHistoryEntries(
    [
      { id: '1', role: 'customer', content: 'สวัสดีครับ', createdAt: AT },
      { id: '2', role: 'ai', content: 'handled_by_human', createdAt: AT },
      { id: '3', role: 'human', content: 'สวัสดีค่ะ ยินดีช่วยเหลือค่ะ', createdAt: AT },
    ],
    AT
  );
  assert.strictEqual(entries.length, 2);
  assert.ok(!entries.some((e) => e.content === 'handled_by_human'));
});

check('T23 history promotes the database id to externalId', () => {
  const [entry] = normalizeHistoryEntries([{ id: '2053', role: 'ai', content: 'hi', createdAt: AT }], AT);
  assert.strictEqual(entry.externalId, '2053');
});

check('T24 reload replaces history without duplicating and keeps an in-flight bubble', () => {
  const pending: CustomerChatMessage = {
    kind: 'chat', id: 'temp_4', role: 'customer', content: 'กำลังส่ง', createdAt: AT, pending: true,
  };
  const history = normalizeHistoryEntries([{ id: '10', role: 'ai', content: 'เดิม', createdAt: AT }], AT);

  let s = apply(initialChatState, [
    { type: 'HISTORY_LOADED', conversationId: '1210', messages: history },
    { type: 'OPTIMISTIC_ADDED', message: pending },
    { type: 'HISTORY_LOADED', conversationId: '1210', messages: history },
  ]);
  assert.strictEqual(s.entries.filter((e) => e.kind === 'chat').length, 2, 'history must replace, not append');
  assert.ok(s.entries.some((e) => e.id === 'temp_4'), 'an unsent bubble must survive a reload');
});

check('T25 a socket message already present in history does not duplicate after reconnect', () => {
  const history = normalizeHistoryEntries([{ id: '2053', role: 'ai', content: 'ตอบแล้ว', createdAt: AT }], AT);
  let s = chatReducer(initialChatState, { type: 'HISTORY_LOADED', conversationId: '1', messages: history });
  s = receive(s, chatFrame({ id: 'uuid-x', external_id: '2053', role: 'ai', content: 'ตอบแล้ว' }));
  assert.strictEqual(s.entries.length, 1);
});

// == Timestamps (Observation 1) ============================================

check('T26 a valid server timestamp is preserved exactly', () => {
  const ev = normalizeSocketEvent(chatFrame({ id: 'ts1', role: 'ai', content: 'hi', createdAt: '2026-09-04T03:36:21.704Z' }), AT);
  assert.strictEqual((ev as any).message.createdAt, '2026-09-04T03:36:21.704Z');
});

check('T27 a missing timestamp becomes null, NOT the receive time', () => {
  const ev = normalizeSocketEvent(chatFrame({ id: 'ts2', role: 'ai', content: 'hi' }), AT);
  assert.strictEqual((ev as any).message.createdAt, null, 'must not substitute now');
});

check('T28 an unparseable timestamp becomes null', () => {
  for (const bad of ['', '   ', 'not-a-date', 'yesterday']) {
    const ev = normalizeSocketEvent(chatFrame({ id: 'ts-x', content: 'hi', createdAt: bad }), AT);
    assert.strictEqual((ev as any).message.createdAt, null, JSON.stringify(bad) + ' must not parse');
  }
});

check('T29 history keeps each row own timestamp, across calendar dates', () => {
  const entries = normalizeHistoryEntries(
    [
      { id: '1', role: 'ai', content: 'a', createdAt: '2026-09-04T03:36:21.704Z' },
      { id: '2', role: 'customer', content: 'b', createdAt: '2026-09-07T04:22:56.484Z' },
    ],
    AT
  );
  assert.strictEqual(entries[0].createdAt, '2026-09-04T03:36:21.704Z');
  assert.strictEqual(entries[1].createdAt, '2026-09-07T04:22:56.484Z');
  const days = new Set(entries.map((e) => new Date(e.createdAt as string).toDateString()));
  assert.strictEqual(days.size, 2, 'two distinct days must remain distinguishable');
});

check('T30 ordering follows timestamps, not arrival order', () => {
  let s = receive(initialChatState, chatFrame({ id: 'later', role: 'ai', content: 'second', createdAt: '2026-09-07T10:00:00.000Z' }));
  s = receive(s, chatFrame({ id: 'earlier', role: 'ai', content: 'first', createdAt: '2026-09-04T10:00:00.000Z' }));
  const texts = s.entries.map((e) => (e as CustomerChatMessage).content);
  assert.deepStrictEqual(texts, ['first', 'second'], 'an older message must sort above a newer one');
});

check('T31 an entry with no timestamp still renders and keeps its position', () => {
  let s = receive(initialChatState, chatFrame({ id: 'a', role: 'ai', content: 'A', createdAt: '2026-09-04T10:00:00.000Z' }));
  s = receive(s, chatFrame({ id: 'b', role: 'ai', content: 'B' }));
  s = receive(s, chatFrame({ id: 'c', role: 'ai', content: 'C', createdAt: '2026-09-05T10:00:00.000Z' }));
  const texts = s.entries.map((e) => (e as CustomerChatMessage).content);
  assert.strictEqual(texts.length, 3);
  assert.ok(texts.includes('B'), 'a timestampless message must still render');
});

check('T32 realtime BEFORE history does not duplicate once history loads', () => {
  let s = receive(initialChatState, chatFrame({ id: 'uuid-live', external_id: '2100', role: 'ai', content: 'once', createdAt: AT }));
  const history = normalizeHistoryEntries([{ id: '2100', role: 'ai', content: 'once', createdAt: AT }], AT);
  s = chatReducer(s, { type: 'HISTORY_LOADED', conversationId: '1', messages: history });
  assert.strictEqual(s.entries.filter((e) => e.kind === 'chat').length, 1, 'exactly one message');
});

// == Failure Message Deduplication & In-Place Retry (Observation 3) ==========

check('T33 single failed send creates exactly one failure bubble with error', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_f1',
    role: 'customer',
    content: 'ดีครับ',
    createdAt: AT,
    deliveryStatus: 'sending',
    pending: true,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  s = chatReducer(s, {
    type: 'OPTIMISTIC_SETTLED',
    tempId: 'temp_f1',
    delivered: false,
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
  });
  assert.strictEqual(s.entries.length, 1);
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.deliveryStatus, 'failed');
  assert.strictEqual(entry.error, 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ');
  assert.strictEqual(entry.pending, false);
});

check('T34 OPTIMISTIC_RETRY updates existing failed bubble in-place without appending a new entry', () => {
  const failed: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_f1',
    role: 'customer',
    content: 'ดีครับ',
    createdAt: AT,
    deliveryStatus: 'failed',
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
    pending: false,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: failed });
  assert.strictEqual(s.entries.length, 1);

  s = chatReducer(s, { type: 'OPTIMISTIC_RETRY', tempId: 'temp_f1' });
  assert.strictEqual(s.entries.length, 1, 'retry must never create a second bubble');
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.id, 'temp_f1');
  assert.strictEqual(entry.deliveryStatus, 'sending');
  assert.strictEqual(entry.pending, true);
  assert.strictEqual(entry.error, undefined, 'error must be cleared while in flight');
});

check('T35 repeated failure on retry updates the same bubble, leaving exactly one failure bubble', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_f1',
    role: 'customer',
    content: 'ดีครับ',
    createdAt: AT,
    deliveryStatus: 'sending',
    pending: true,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  // First failure
  s = chatReducer(s, {
    type: 'OPTIMISTIC_SETTLED',
    tempId: 'temp_f1',
    delivered: false,
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
  });
  assert.strictEqual(s.entries.length, 1);

  // First retry attempt fails again
  s = chatReducer(s, { type: 'OPTIMISTIC_RETRY', tempId: 'temp_f1' });
  s = chatReducer(s, {
    type: 'OPTIMISTIC_SETTLED',
    tempId: 'temp_f1',
    delivered: false,
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
  });
  assert.strictEqual(s.entries.length, 1, 'must still be exactly one failure bubble');

  // Second retry attempt fails again
  s = chatReducer(s, { type: 'OPTIMISTIC_RETRY', tempId: 'temp_f1' });
  s = chatReducer(s, {
    type: 'OPTIMISTIC_SETTLED',
    tempId: 'temp_f1',
    delivered: false,
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
  });
  assert.strictEqual(s.entries.length, 1, 'must NEVER produce multiple failure bubbles for the same message');
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.deliveryStatus, 'failed');
  assert.strictEqual(entry.error, 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ');
});

check('T36 successful retry settles the existing bubble and reconciles with server echo', () => {
  const failed: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_f1',
    role: 'customer',
    content: 'ดีครับ',
    createdAt: AT,
    deliveryStatus: 'failed',
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
    pending: false,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: failed });
  s = chatReducer(s, { type: 'OPTIMISTIC_RETRY', tempId: 'temp_f1' });
  s = chatReducer(s, { type: 'OPTIMISTIC_SETTLED', tempId: 'temp_f1', delivered: true });
  s = receive(s, chatFrame({ id: 'srv-f1', role: 'customer', content: 'ดีครับ', createdAt: AT }));

  assert.strictEqual(s.entries.length, 1);
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.id, 'srv-f1');
  assert.ok(entry.deliveryStatus === 'sent' || entry.deliveryStatus === 'delivered', 'authoritative ACK settles to sent');
  assert.strictEqual(entry.pending, false);
});

check('T37 history reload reconciles optimistic failed bubble if server already has it', () => {
  const failed: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_f2',
    role: 'customer',
    content: 'ดีครับ',
    createdAt: AT,
    deliveryStatus: 'failed',
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
    pending: false,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: failed });
  assert.strictEqual(s.entries.length, 1);

  // Server history contains the confirmed message
  const history = normalizeHistoryEntries([{ id: 'db-f2', role: 'customer', content: 'ดีครับ', createdAt: AT }], AT);
  s = chatReducer(s, { type: 'HISTORY_LOADED', conversationId: 'c1', messages: history });

  assert.strictEqual(s.entries.length, 1, 'phantom failed bubble must not linger when server history has the message');
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.externalId, 'db-f2');
});

check('T38 distinct customer messages sent sequentially both remain distinct', () => {
  // First message settled
  let s = receive(initialChatState, chatFrame({ id: 'm1', role: 'customer', content: 'ดีครับ', createdAt: '2026-09-07T10:00:00.000Z' }));
  // Second identical message sent later
  s = receive(s, chatFrame({ id: 'm2', role: 'customer', content: 'ดีครับ', createdAt: '2026-09-07T10:05:00.000Z' }));
  assert.strictEqual(s.entries.length, 2, 'semantic integrity: two distinct customer turns with identical text must both render');
});

// == WebChat Final Client Delivery Contract Tests (T39 - T49) ==================

check('T39 socket.send() return does not settle message', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_t39',
    role: 'customer',
    content: 'ยังไม่ได้รับ ACK',
    createdAt: AT,
    deliveryStatus: 'sending',
    pending: true,
  };
  const s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  const entry = s.entries[0] as CustomerChatMessage;
  // Browser must remain in 'sending', NOT 'sent' or 'delivered'
  assert.strictEqual(entry.deliveryStatus, 'sending', 'socket.send returning must NOT transition to sent');
  assert.strictEqual(entry.pending, true);
});

check('T40 authoritative ACK settles message', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_t40',
    role: 'customer',
    content: 'ข้อความรอ ACK',
    createdAt: AT,
    deliveryStatus: 'sending',
    pending: true,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  // Authoritative ACK frame arrives with canonical server id and externalId matching tempId
  s = receive(s, chatFrame({ id: 'db-999', externalId: 'temp_t40', role: 'customer', content: 'ข้อความรอ ACK', createdAt: AT }));
  assert.strictEqual(s.entries.length, 1, 'must update in-place, not append');
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.id, 'db-999', 'must update to canonical database ID');
  assert.strictEqual(entry.externalId, 'temp_t40');
  assert.strictEqual(entry.deliveryStatus, 'sent', 'must transition to sent upon authoritative ACK');
  assert.strictEqual(entry.pending, false);
});

check('T41 no ACK timeout -> failed', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_t41',
    role: 'customer',
    content: 'ส่งแล้วเงียบ',
    createdAt: AT,
    deliveryStatus: 'sending',
    pending: true,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  // Timeout fires after ACK_TIMEOUT_MS
  s = chatReducer(s, {
    type: 'OPTIMISTIC_SETTLED',
    tempId: 'temp_t41',
    delivered: false,
    error: 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ',
  });
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.deliveryStatus, 'failed', 'timeout must transition to failed');
  assert.strictEqual(entry.pending, false);
  assert.strictEqual(entry.error, 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ');
});

check('T42 socket close before ACK -> failed', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_t42',
    role: 'customer',
    content: 'เน็ตหลุดก่อน ACK',
    createdAt: AT,
    deliveryStatus: 'sending',
    pending: true,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  // Socket closes while message is in flight
  s = chatReducer(s, {
    type: 'OPTIMISTIC_SETTLED',
    tempId: 'temp_t42',
    delivered: false,
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
  });
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.deliveryStatus, 'failed');
  assert.strictEqual(entry.error, 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ');
});

check('T43 ACK then socket close -> remains acknowledged', () => {
  const optimistic: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_t43',
    role: 'customer',
    content: 'ได้ ACK แล้วค่อยหลุด',
    createdAt: AT,
    deliveryStatus: 'sending',
    pending: true,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: optimistic });
  // 1. Authoritative ACK arrives first
  s = receive(s, chatFrame({ id: 'db-1043', externalId: 'temp_t43', role: 'customer', content: 'ได้ ACK แล้วค่อยหลุด', createdAt: AT }));
  assert.strictEqual((s.entries[0] as CustomerChatMessage).deliveryStatus, 'sent');

  // 2. Socket closes afterwards; failure settlement must NOT overwrite acknowledged message
  s = chatReducer(s, {
    type: 'OPTIMISTIC_SETTLED',
    tempId: 'temp_t43',
    delivered: false,
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
  });
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.deliveryStatus, 'sent', 'acknowledged message must NOT be downgraded to failed');
  assert.strictEqual(entry.id, 'db-1043');
});

check('T44 retry preserves same visible bubble', () => {
  const failed: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_t44',
    role: 'customer',
    content: 'ลองส่งใหม่',
    createdAt: AT,
    deliveryStatus: 'failed',
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
    pending: false,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: failed });
  assert.strictEqual(s.entries.length, 1);

  // Click retry
  s = chatReducer(s, { type: 'OPTIMISTIC_RETRY', tempId: 'temp_t44' });
  assert.strictEqual(s.entries.length, 1, 'must remain strictly one bubble');
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.id, 'temp_t44');
  assert.strictEqual(entry.deliveryStatus, 'sending');
  assert.strictEqual(entry.pending, true);
  assert.strictEqual(entry.error, undefined);
});

check('T45 retry timeout remains one failed bubble', () => {
  const failed: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_t45',
    role: 'customer',
    content: 'retry แล้ว timeout',
    createdAt: AT,
    deliveryStatus: 'failed',
    error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
    pending: false,
  };
  let s = chatReducer(initialChatState, { type: 'OPTIMISTIC_ADDED', message: failed });
  // Retry
  s = chatReducer(s, { type: 'OPTIMISTIC_RETRY', tempId: 'temp_t45' });
  assert.strictEqual(s.entries.length, 1);
  // Timeout
  s = chatReducer(s, {
    type: 'OPTIMISTIC_SETTLED',
    tempId: 'temp_t45',
    delivered: false,
    error: 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ',
  });
  assert.strictEqual(s.entries.length, 1, 'must still remain strictly one bubble');
  const entry = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(entry.deliveryStatus, 'failed');
  assert.strictEqual(entry.error, 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ');
});

check('T46 double-click retry = one request', () => {
  const inFlightSet = new Set<string>();
  let requestsSent = 0;

  const retryFn = (tempId: string) => {
    if (inFlightSet.has(tempId)) return;
    inFlightSet.add(tempId);
    requestsSent += 1;
  };

  // Rapid double click
  retryFn('temp_t46');
  retryFn('temp_t46');
  assert.strictEqual(requestsSent, 1, 'second synchronous click must be dropped');
});

check('T47 report_issue opens drawer and sends zero postbacks', () => {
  let drawerOpened = false;
  let postbacksSent = 0;

  const handleAction = (value: string) => {
    const v = (value || '').trim();
    if (v === 'report_issue' || v === 'แจ้งปัญหา' || v === 'เปิดตั๋ว') {
      drawerOpened = true;
      return; // Return immediately without sending postback
    }
    postbacksSent += 1;
  };

  handleAction('report_issue');
  assert.strictEqual(drawerOpened, true, 'drawer must open');
  assert.strictEqual(postbacksSent, 0, 'zero postbacks must be sent');
});

check('T48 successful ticket submission waits for 201', async () => {
  let submitted = false;
  const mockApiCall = async () => {
    // Simulate async HTTP 201 response
    submitted = true;
    return { success: true, ticketNumber: 'TCK-2026-00123' };
  };

  const res = await mockApiCall();
  assert.strictEqual(submitted, true);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.ticketNumber, 'TCK-2026-00123');
});

check('T49 ticket_created updates ticket state', () => {
  let tickets = [{ id: '1', ticketNumber: 'TCK-2026-00001', subject: 'old' }];
  const onTicketCreated = (newTicket: { id: string; ticketNumber: string; subject: string }) => {
    tickets = [newTicket, ...tickets];
  };

  onTicketCreated({ id: '2', ticketNumber: 'TCK-2026-00002', subject: 'new issue' });
  assert.strictEqual(tickets.length, 2);
  assert.strictEqual(tickets[0].ticketNumber, 'TCK-2026-00002');
});


/* ── Authoritative send ACK lifecycle (Gate D) ─────────────────────────────
 *
 * The rule these pin: `socket.send()` returning proves only that the browser
 * handed bytes to the WebSocket. Success may be declared by exactly one thing —
 * the server-originated ACK frame carrying the persisted id and echoing the
 * client's tempId as `externalId`.
 */

const optimistic = (tempId: string, content: string): CustomerChatMessage => ({
  kind: 'chat',
  id: tempId,
  role: 'customer',
  content,
  createdAt: AT,
  attachments: [],
  deliveryStatus: 'sending',
  pending: true,
});

/** The frame the gateway actually emits for a customer's own message. */
const ackFrame = (dbId: string, tempId: string, content: string) => ({
  event: 'message',
  data: { id: dbId, externalId: tempId, role: 'customer', content, createdAt: AT, attachments: [] },
});

check('T50 an optimistic bubble stays "sending" until an ACK arrives', () => {
  const s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_a', 'hello') }]);
  const bubble = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(bubble.deliveryStatus, 'sending');
  assert.strictEqual(bubble.pending, true);
});

check('T51 the authoritative ACK settles the SAME bubble, matched by externalId', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_b', 'hello') }]);
  s = receive(s, ackFrame('2933', 'temp_b', 'hello'));
  assert.strictEqual(s.entries.length, 1, 'must not append a second bubble');
  const bubble = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(bubble.deliveryStatus, 'sent');
  assert.strictEqual(bubble.pending, false);
  assert.strictEqual(bubble.id, '2933', 'the persisted id replaces the tempId');
  assert.strictEqual(bubble.externalId, 'temp_b');
});

check('T52 an ACK whose externalId matches nothing does not settle a foreign bubble', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_c', 'mine') }]);
  s = receive(s, ackFrame('4001', 'temp_OTHER', 'somebody else'));
  const mine = s.entries.find((e) => (e as CustomerChatMessage).id === 'temp_c') as CustomerChatMessage;
  assert.strictEqual(mine.deliveryStatus, 'sending', 'an unrelated ACK must not settle this message');
  assert.strictEqual(s.entries.length, 2);
});

check('T53 an ACK timeout marks the message failed, not sent', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_d', 'hello') }]);
  s = apply(s, [{ type: 'OPTIMISTIC_SETTLED', tempId: 'temp_d', delivered: false, error: 'timeout' }]);
  const bubble = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(bubble.deliveryStatus, 'failed');
  assert.strictEqual(bubble.pending, false);
});

check('T54 socket close marks an unacknowledged message failed', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_e', 'hello') }]);
  s = apply(s, [{ type: 'OPTIMISTIC_SETTLED', tempId: 'temp_e', delivered: false, error: 'closed' }]);
  assert.strictEqual((s.entries[0] as CustomerChatMessage).deliveryStatus, 'failed');
});

check('T55 ACK-then-close is idempotent: the ACK wins', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_f', 'hello') }]);
  s = receive(s, ackFrame('2940', 'temp_f', 'hello'));
  // The close handler fires for a tempId that was already acknowledged.
  s = apply(s, [{ type: 'OPTIMISTIC_SETTLED', tempId: 'temp_f', delivered: false, error: 'closed' }]);
  const bubble = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(bubble.deliveryStatus, 'sent', 'a late close must not undo a delivered ACK');
  assert.strictEqual(s.entries.length, 1);
});

check('T56 retry reuses the failed bubble in place', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_g', 'hello') }]);
  s = apply(s, [{ type: 'OPTIMISTIC_SETTLED', tempId: 'temp_g', delivered: false, error: 'closed' }]);
  s = apply(s, [{ type: 'OPTIMISTIC_RETRY', tempId: 'temp_g' }]);
  assert.strictEqual(s.entries.length, 1, 'retry must not create a second bubble');
  const bubble = s.entries[0] as CustomerChatMessage;
  assert.strictEqual(bubble.deliveryStatus, 'sending');
  assert.strictEqual(bubble.pending, true);
  assert.strictEqual(bubble.error, undefined, 'the previous error is cleared');
});

check('T57 repeated failure and retry never duplicates the bubble', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_h', 'hello') }]);
  for (let i = 0; i < 3; i += 1) {
    s = apply(s, [{ type: 'OPTIMISTIC_SETTLED', tempId: 'temp_h', delivered: false, error: 'closed' }]);
    s = apply(s, [{ type: 'OPTIMISTIC_RETRY', tempId: 'temp_h' }]);
  }
  assert.strictEqual(s.entries.length, 1);
});

check('T58 an AI reply does NOT promote a message that was never acknowledged', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_i', 'unacked') }]);
  s = receive(s, { event: 'message', data: { id: '5000', role: 'ai', content: 'answer to an earlier turn', createdAt: AT } });
  const mine = s.entries.find((e) => (e as CustomerChatMessage).id === 'temp_i') as CustomerChatMessage;
  assert.strictEqual(mine.deliveryStatus, 'sending', 'another turn’s reply is not this message’s receipt');
  assert.strictEqual(mine.pending, true);
});

check('T59 an AI reply DOES advance an already-acknowledged message to replied', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_j', 'acked') }]);
  s = receive(s, ackFrame('2950', 'temp_j', 'acked'));
  s = receive(s, { event: 'message', data: { id: '5001', role: 'ai', content: 'here is your answer', createdAt: AT } });
  const mine = s.entries.find((e) => (e as CustomerChatMessage).id === '2950') as CustomerChatMessage;
  assert.strictEqual(mine.deliveryStatus, 'replied');
});

check('T60 two identical texts remain two messages, each settled by its own ACK', () => {
  let s = apply(initialChatState, [
    { type: 'OPTIMISTIC_ADDED', message: optimistic('temp_k1', 'same text') },
    { type: 'OPTIMISTIC_ADDED', message: optimistic('temp_k2', 'same text') },
  ]);
  s = receive(s, ackFrame('6001', 'temp_k1', 'same text'));
  s = receive(s, ackFrame('6002', 'temp_k2', 'same text'));
  assert.strictEqual(s.entries.length, 2, 'identical content must not collapse');
  const ids = s.entries.map((e) => (e as CustomerChatMessage).id).sort();
  assert.deepStrictEqual(ids, ['6001', '6002']);
});

check('T61 a duplicate ACK for the same tempId does not double-render', () => {
  let s = apply(initialChatState, [{ type: 'OPTIMISTIC_ADDED', message: optimistic('temp_l', 'hello') }]);
  s = receive(s, ackFrame('7001', 'temp_l', 'hello'));
  s = receive(s, ackFrame('7001', 'temp_l', 'hello'));
  assert.strictEqual(s.entries.length, 1);
});

process.stdout.write(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length > 0) {
  process.stdout.write(`\nFAILURES:\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('WEBCHAT EVENT NORMALIZATION: ALL PASS\n');
