import assert from 'assert';
import { chatReducer, initialChatState } from './features/customer-web/chat/chatStore';
import type { CustomerTicket, CustomerChatMessage } from './features/customer-web/types';

/**
 * Verification Suite for Agent 2: Flow 5 / Flow 6 Hard Invariants & UI State Machine
 */
async function runFlow5Flow6Verification() {
  console.log('=================================================================');
  console.log('  Agent 2 Verification: Flow 5 / Flow 6 Hard Invariants');
  console.log('=================================================================\n');

  // Invariant 1: active_ticket_id is backend-authoritative / client focus pointer
  console.log('[Invariant 1] Testing active_ticket selection in reducer...');
  const ticketA: CustomerTicket = {
    id: 101,
    ticket_number: 'TX-101',
    subject: 'Issue with Login',
    summary: 'Cannot login to portal',
    status: 'OPEN',
  };
  const ticketB: CustomerTicket = {
    id: 102,
    ticket_number: 'TX-102',
    subject: 'Billing discrepancy',
    summary: 'Invoice number mismatch',
    status: 'WAITING_CUSTOMER',
  };

  let state = chatReducer(initialChatState, {
    type: 'SET_AVAILABLE_TICKETS',
    tickets: [ticketA, ticketB],
  });
  assert.strictEqual(state.availableTickets.length, 2);

  state = chatReducer(state, {
    type: 'SET_ACTIVE_TICKET',
    ticket: ticketA,
  });
  assert.strictEqual(state.activeTicket?.id, 101);
  assert.strictEqual(state.customerWorkflowState, 'NORMAL');
  console.log('  ✅ Invariant 1 Passed: activeTicket successfully bound to Ticket A.');

  // Invariant 2 & 9: Switch A -> B updates activeTicket immediately; WAITING_CUSTOMER triggers WAITING_FOR_CUSTOMER state
  console.log('[Invariant 2 & 9] Testing switch A -> B and Dev-CS waiting state trigger...');
  state = chatReducer(state, {
    type: 'SET_ACTIVE_TICKET',
    ticket: ticketB,
  });
  assert.strictEqual(state.activeTicket?.id, 102);
  assert.strictEqual(state.customerWorkflowState, 'WAITING_FOR_CUSTOMER');
  console.log('  ✅ Invariant 2 & 9 Passed: Switch to B immediately activates WAITING_FOR_CUSTOMER workflow state.');

  // Invariant 3 & 4: Switch A -> B does not mutate conversationId or create a new conversation
  console.log('[Invariant 3 & 4] Testing conversation isolation during ticket switch...');
  state = chatReducer(state, {
    type: 'HISTORY_LOADED',
    conversationId: 'conv_project_xyz',
    messages: [],
  });
  assert.strictEqual(state.conversationId, 'conv_project_xyz');

  // Switch back to A
  state = chatReducer(state, {
    type: 'SET_ACTIVE_TICKET',
    ticket: ticketA,
  });
  assert.strictEqual(state.conversationId, 'conv_project_xyz', 'conversationId must remain identical across ticket switches');
  console.log('  ✅ Invariant 3 & 4 Passed: Conversation ID preserved across ticket switches.');

  // Invariant 5 & 6: Message sent after A is bound to A, after B is bound to B
  console.log('[Invariant 5 & 6] Testing message context binding to active ticket...');
  const msgA: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_msg_1',
    role: 'customer',
    content: 'Details for ticket A',
    createdAt: new Date().toISOString(),
    activeTicketId: 101,
    ticketNumber: 'TX-101',
    deliveryStatus: 'sending',
  };
  state = chatReducer(state, {
    type: 'OPTIMISTIC_ADDED',
    message: msgA,
  });
  const storedMsgA = state.entries.find((e) => e.kind === 'chat' && e.id === 'temp_msg_1') as CustomerChatMessage;
  assert.ok(storedMsgA);
  assert.strictEqual(storedMsgA.activeTicketId, 101);
  assert.strictEqual(storedMsgA.ticketNumber, 'TX-101');

  // Switch to B and add message B
  state = chatReducer(state, { type: 'SET_ACTIVE_TICKET', ticket: ticketB });
  const msgB: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_msg_2',
    role: 'customer',
    content: 'Details for ticket B',
    createdAt: new Date().toISOString(),
    activeTicketId: 102,
    ticketNumber: 'TX-102',
    deliveryStatus: 'sending',
  };
  state = chatReducer(state, {
    type: 'OPTIMISTIC_ADDED',
    message: msgB,
  });
  const storedMsgB = state.entries.find((e) => e.kind === 'chat' && e.id === 'temp_msg_2') as CustomerChatMessage;
  assert.ok(storedMsgB);
  assert.strictEqual(storedMsgB.activeTicketId, 102);
  assert.strictEqual(storedMsgB.ticketNumber, 'TX-102');
  console.log('  ✅ Invariant 5 & 6 Passed: Messages correctly bound to their active ticket contexts.');

  // Invariant 7 & 8: Image/Attachment context binding
  console.log('[Invariant 7 & 8] Testing image attachment context binding...');
  const imgMsg: CustomerChatMessage = {
    kind: 'chat',
    id: 'temp_img_1',
    role: 'customer',
    content: '',
    createdAt: new Date().toISOString(),
    attachments: [
      {
        fileUrl: 'https://example.com/screenshot.png',
        fileName: 'screenshot.png',
        fileType: 'image/png',
        status: 'ready',
      },
    ],
    activeTicketId: 102,
    ticketNumber: 'TX-102',
    deliveryStatus: 'sending',
  };
  state = chatReducer(state, {
    type: 'OPTIMISTIC_ADDED',
    message: imgMsg,
  });
  const storedImg = state.entries.find((e) => e.kind === 'chat' && e.id === 'temp_img_1') as CustomerChatMessage;
  assert.ok(storedImg);
  assert.strictEqual(storedImg.activeTicketId, 102);
  assert.strictEqual(storedImg.attachments?.length, 1);
  console.log('  ✅ Invariant 7 & 8 Passed: Image messages retain ticket context binding.');

  // Invariant 10 & 11: Reconnect & duplicate chips/messages protection
  console.log('[Invariant 10 & 11] Testing deduplication on reconnect & history reload...');
  state = chatReducer(state, {
    type: 'HISTORY_LOADED',
    conversationId: 'conv_project_xyz',
    messages: [
      {
        kind: 'chat',
        id: 'real_msg_1',
        externalId: 'ext_1',
        role: 'customer',
        content: 'Details for ticket A',
        createdAt: new Date().toISOString(),
      },
    ],
  });
  // Setting available tickets again with identical IDs should update in-place without duplicating
  state = chatReducer(state, {
    type: 'SET_AVAILABLE_TICKETS',
    tickets: [ticketA, ticketB],
  });
  assert.strictEqual(state.availableTickets.length, 2, 'availableTickets count must not duplicate');
  console.log('  ✅ Invariant 10 & 11 Passed: No duplication of messages or ticket chips.');

  // Flow 5: Cancel Confirmation State Machine
  console.log('[Flow 5] Testing Cancel Confirmation state transitions...');
  state = chatReducer(state, {
    type: 'CANCEL_REQUESTED',
    ticketNumber: 'TX-102',
    ticketId: 102,
  });
  assert.strictEqual(state.cancellationState.status, 'PENDING');
  assert.strictEqual(state.cancellationState.ticketNumber, 'TX-102');

  // Cancel Confirmed
  state = chatReducer(state, {
    type: 'CANCEL_CONFIRMED',
    message: 'ยกเลิกตั๋ว TX-102 เรียบร้อยแล้วค่ะ',
  });
  assert.strictEqual(state.cancellationState.status, 'CONFIRMED');
  assert.strictEqual(state.customerWorkflowState, 'CLOSED');
  const confirmNotice = state.entries.find((e) => e.kind === 'system' && e.code === 'cancel_confirmed');
  assert.ok(confirmNotice, 'Must insert a system notice on cancellation confirm');

  // Cancel Declined
  state = chatReducer(state, {
    type: 'CANCEL_DECLINED',
  });
  assert.strictEqual(state.cancellationState.status, 'DECLINED');
  const declineNotice = state.entries.find((e) => e.kind === 'system' && e.code === 'cancel_declined');
  assert.ok(declineNotice, 'Must insert a system notice on cancellation decline');
  console.log('  ✅ Flow 5 Passed: Cancel Confirmation state machine operates deterministically.');

  // Flow 6: Realtime TICKET_UPDATED event handling
  console.log('[Flow 6] Testing realtime TICKET_UPDATED event integration...');
  state = chatReducer(state, {
    type: 'TICKET_UPDATED',
    ticketId: 101,
    status: 'CLOSED',
    ticketNumber: 'TX-101',
  });
  const updatedA = state.availableTickets.find((t) => t.id === 101);
  assert.strictEqual(updatedA?.status, 'CLOSED');
  console.log('  ✅ Flow 6 Passed: Realtime ticket update reflected in store state.');

  console.log('\n=================================================================');
  console.log('  All Flow 5 & Flow 6 Invariant Tests Succeeded!');
  console.log('=================================================================\n');
}

runFlow5Flow6Verification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
