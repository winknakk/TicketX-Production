/**
 * The single authoritative customer chat store.
 *
 * Everything that can add to the conversation goes through this reducer: the
 * socket, the history fetch, and the composer's optimistic bubble. Nothing
 * appends to the transcript directly. That is what makes deduplication and
 * optimistic reconciliation possible at all — while three components each held
 * their own array, "already have this one" was not a question anyone could
 * answer.
 */

import type {
  CustomerChatEntry,
  CustomerChatMessage,
  CustomerMessageAttachment,
  CustomerSystemNotice,
  CustomerTicket,
  CustomerCancellationState,
  CustomerWorkflowState,
} from '../types';

export interface ChatState {
  entries: CustomerChatEntry[];
  isTyping: boolean;
  /** True while an operator holds the conversation. */
  isHumanTakeover: boolean;
  conversationId: string | null;
  /** Currently focused ticket in the conversation session */
  activeTicket: CustomerTicket | null;
  /** List of customer tickets available for selection */
  availableTickets: CustomerTicket[];
  /** Typed customer cancellation flow state */
  cancellationState: CustomerCancellationState;
  /** Dev-CS / Customer workflow interaction state */
  customerWorkflowState: CustomerWorkflowState;
  /** Canonical request detail when waiting for customer */
  waitingRequestDetail?: string;
  /** Pending action identifier */
  pendingAction: string | null;
}

export const initialChatState: ChatState = {
  entries: [],
  isTyping: false,
  isHumanTakeover: false,
  conversationId: null,
  activeTicket: null,
  availableTickets: [],
  cancellationState: { status: 'IDLE' },
  customerWorkflowState: 'NORMAL',
  waitingRequestDetail: undefined,
  pendingAction: null,
};

export type ChatAction =
  | { type: 'HISTORY_LOADED'; conversationId: string | null; messages: CustomerChatMessage[] }
  | { type: 'MESSAGE_RECEIVED'; message: CustomerChatMessage }
  | { type: 'OPTIMISTIC_ADDED'; message: CustomerChatMessage }
  | { type: 'OPTIMISTIC_RETRY'; tempId: string }
  | { type: 'OPTIMISTIC_SETTLED'; tempId: string; delivered: boolean; error?: string }
  | { type: 'ATTACHMENTS_UPDATED'; tempId: string; attachments: CustomerMessageAttachment[] }
  | { type: 'TYPING'; isTyping: boolean }
  | { type: 'TAKEOVER'; event: 'started' | 'released'; at: string }
  | { type: 'NOTICE'; notice: CustomerSystemNotice }
  | { type: 'SET_ACTIVE_TICKET'; ticket: CustomerTicket | null }
  | { type: 'SET_AVAILABLE_TICKETS'; tickets: CustomerTicket[] }
  | { type: 'CANCEL_REQUESTED'; ticketNumber: string; ticketId?: number | string }
  | { type: 'CANCEL_CONFIRMED'; message?: string }
  | { type: 'CANCEL_DECLINED'; message?: string }
  | { type: 'CANCEL_FAILED'; error: string }
  | { type: 'SET_WORKFLOW_STATE'; state: CustomerWorkflowState; detail?: string }
  | { type: 'SET_PENDING_ACTION'; action: string | null }
  | { type: 'TICKET_UPDATED'; ticketId: number | string; status: string; ticketNumber?: string; detail?: string }
  | { type: 'RESET' };

function isChat(entry: CustomerChatEntry): entry is CustomerChatMessage {
  return entry.kind === 'chat';
}

/**
 * The identity two copies of one message share.
 *
 * `externalId` first, because it is the backend's own id and survives both a
 * refresh and a change of transport. `id` is the fallback: outbound AI replies
 * carry no external id today, only a UUID the gateway generates per published
 * payload. That UUID is generated once and reused for both rooms the socket
 * belongs to, which is the only reason the previous id-only dedupe held —
 * see the report for the measurement.
 */
function identityOf(message: CustomerChatMessage): string {
  return message.externalId ? `x:${message.externalId}` : `i:${message.id}`;
}

/**
 * Find an optimistic bubble that this server message is the confirmation of.
 *
 * Content matching is deliberately confined to this function. Two identical
 * messages from the server are legitimately two messages and must both render;
 * but the customer's own echo has no id in common with the bubble drawn for it,
 * so pairing them needs some other signal. The match is therefore narrowed to
 * pending customer bubbles inside a short window, which cannot collapse two
 * genuine server messages because a settled bubble is never a candidate.
 */
const RECONCILE_WINDOW_MS = 120_000;

function findOptimisticTwin(entries: CustomerChatEntry[], incoming: CustomerChatMessage): number {
  if (incoming.role !== 'customer') return -1;

  // 1. Authoritative identity match: incoming externalId matches optimistic entry.id (tempId)
  if (incoming.externalId) {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (
        isChat(entry) &&
        entry.role === 'customer' &&
        (entry.id === incoming.externalId || entry.externalId === incoming.externalId)
      ) {
        return i;
      }
    }
  }

  // 2. Fallback: match pending in-flight customer bubble within time window
  const incomingAt = timeOf(incoming);
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!isChat(entry) || entry.role !== 'customer') continue;
    // An optimistic bubble candidate must be pending or in flight (sending/sent/processing),
    // but not already confirmed as 'delivered' or 'replied' or explicitly not pending from creation.
    const isInFlight = entry.pending || (entry.deliveryStatus && ['sending', 'sent', 'processing'].includes(entry.deliveryStatus) && entry.id.startsWith('temp_'));
    if (!isInFlight) continue;
    if (entry.content.trim() !== incoming.content.trim()) continue;
    const entryAt = timeOf(entry);
    if (incomingAt !== null && entryAt !== null && Math.abs(incomingAt - entryAt) > RECONCILE_WINDOW_MS) {
      continue;
    }
    return i;
  }
  return -1;
}

function takeoverNotice(event: 'started' | 'released', at: string): CustomerSystemNotice {
  return event === 'started'
    ? {
        kind: 'system',
        // Deterministic id: a takeover repeated for the same conversation is
        // one state, not two events, so a duplicate frame collapses onto the
        // notice already on screen.
        id: 'system:takeover:started',
        code: 'takeover_started',
        text: 'เจ้าหน้าที่กำลังเข้ามาช่วยเหลือคุณ ข้อความต่อจากนี้จะถูกส่งถึงเจ้าหน้าที่โดยตรงค่ะ',
        createdAt: at,
        tone: 'info',
      }
    : {
        kind: 'system',
        id: 'system:takeover:released',
        code: 'takeover_released',
        text: 'เจ้าหน้าที่ส่งการสนทนากลับให้ผู้ช่วย AI แล้วค่ะ',
        createdAt: at,
        tone: 'info',
      };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'HISTORY_LOADED': {
      // Merge history with existing entries rather than wiping them out,
      // deduplicating by stable identity, preserving system notices and in-flight bubbles.
      const existingEntries = state.entries;
      const seen = new Set<string>();
      const merged: CustomerChatEntry[] = [];

      // 1. Add all history messages first
      for (const msg of action.messages) {
        const idKey = identityOf(msg);
        if (!seen.has(idKey)) {
          seen.add(idKey);
          merged.push(msg);
        }
      }

      // 2. Keep existing messages that weren't in this history batch (e.g. earlier loaded history or pending items)
      for (const entry of existingEntries) {
        if (isChat(entry)) {
          const idKey = identityOf(entry);
          if (!seen.has(idKey)) {
            // Check if it's an optimistic duplicate of an already received history message
            const isTwin =
              (entry.pending || ['sending', 'sent', 'processing', 'failed'].includes(entry.deliveryStatus || '')) &&
              entry.id.startsWith('temp_') &&
              merged.some((m) => isChat(m) && m.role === 'customer' && m.content.trim() === entry.content.trim());
            if (!isTwin) {
              seen.add(idKey);
              merged.push(entry);
            }
          }
        } else {
          // System notice
          if (!seen.has(`sys:${entry.id}`)) {
            seen.add(`sys:${entry.id}`);
            merged.push(entry);
          }
        }
      }

      return {
        ...state,
        conversationId: action.conversationId,
        entries: sortEntries(merged),
      };
    }

    case 'MESSAGE_RECEIVED': {
      const incoming = action.message;

      // Reject a message that belongs to a different conversation.
      //
      // A conversation belongs to exactly one project, so this is the project
      // boundary in the client. It matters because outbound is also delivered to
      // the identity-scoped `recipient:<channelRef>` room, and one identity
      // legitimately spans several projects — so after switching to project B a
      // socket still receives project A's messages.
      //
      // Only enforced when BOTH sides are known: a payload without a
      // conversation id (older gateway build) is kept rather than silently
      // dropped, and nothing is filtered before the transcript has loaded.
      if (
        state.conversationId &&
        incoming.conversationId &&
        String(incoming.conversationId) !== String(state.conversationId)
      ) {
        return state;
      }

      const identity = identityOf(incoming);

      if (state.entries.some((e) => isChat(e) && identityOf(e) === identity)) {
        return state;
      }

      // If an AI or human operator reply arrives, any pending customer messages
      // are confirmed received and replied to by the backend.
      let updatedEntries = state.entries;
      if (incoming.role !== 'customer') {
        updatedEntries = updatedEntries.map((e) => {
          // Only a message the server has ALREADY acknowledged may advance to
          // "replied". A bubble still in `sending` has no authoritative ACK, so
          // an AI reply — which may answer an earlier turn entirely — is not
          // evidence that this one was received. Promoting it here would be the
          // same invented success that settling on `socket.send()` was: the
          // customer would be told their message arrived because somebody
          // else's did. Such a bubble stays `sending` until its own ACK lands,
          // its ACK timer expires, or the socket closes.
          if (
            isChat(e) &&
            e.role === 'customer' &&
            (e.deliveryStatus === 'sent' || e.deliveryStatus === 'processing')
          ) {
            return {
              ...e,
              pending: false,
              deliveryStatus: 'replied' as const,
            };
          }
          return e;
        });
      }

      const twinIndex = findOptimisticTwin(updatedEntries, incoming);
      if (twinIndex >= 0) {
        const twin = updatedEntries[twinIndex] as CustomerChatMessage;
        const entries = updatedEntries.slice();
        entries[twinIndex] = {
          ...incoming,
          // The server does not echo attachments back, so the local preview is
          // the only record of them; keep it rather than blanking the bubble.
          attachments: incoming.attachments?.length ? incoming.attachments : twin.attachments,
          pending: false,
          deliveryStatus: 'sent',
        };
        return { ...state, entries, isTyping: false };
      }

      // Preserve chronological append: if server timestamp is missing or skewed earlier
      // than the user's optimistic bubble, append at bottom.
      return { ...state, entries: sortEntries([...updatedEntries, incoming]), isTyping: false };
    }

    case 'OPTIMISTIC_ADDED':
      return { ...state, entries: [...state.entries, action.message] };

    case 'OPTIMISTIC_RETRY':
      return {
        ...state,
        entries: state.entries.map((e) =>
          isChat(e) && e.id === action.tempId
            ? {
                ...e,
                pending: true,
                deliveryStatus: 'sending',
                error: undefined,
              }
            : e
        ),
      };

    case 'OPTIMISTIC_SETTLED':
      return {
        ...state,
        entries: state.entries.map((e) => {
          if (!isChat(e) || e.id !== action.tempId) return e;
          // Guard: if already acknowledged by authoritative ACK or reply, do not turn into failed
          if (
            !action.delivered &&
            (e.deliveryStatus === 'sent' ||
              e.deliveryStatus === 'processing' ||
              e.deliveryStatus === 'replied' ||
              e.deliveryStatus === 'delivered')
          ) {
            return e;
          }
          return {
            ...e,
            pending: false,
            deliveryStatus: action.delivered ? 'sent' : 'failed',
            error: action.error,
          };
        }),
      };

    case 'ATTACHMENTS_UPDATED':
      return {
        ...state,
        entries: state.entries.map((e) =>
          isChat(e) && e.id === action.tempId ? { ...e, attachments: action.attachments } : e
        ),
      };

    case 'TYPING':
      return { ...state, isTyping: action.isTyping };

    case 'TAKEOVER': {
      const isStarted = action.event === 'started';
      if (state.isHumanTakeover === isStarted) {
        // Same state repeated — a duplicate frame, or the second delivery of
        // one payload to a socket that is in two rooms. Nothing changed, so
        // nothing is appended.
        return state;
      }
      const notice = takeoverNotice(action.event, action.at);
      const withoutOpposite = state.entries.filter(
        (e) => !(e.kind === 'system' && (e.id === 'system:takeover:started' || e.id === 'system:takeover:released'))
      );
      return { ...state, isHumanTakeover: isStarted, entries: [...withoutOpposite, notice] };
    }

    case 'NOTICE': {
      if (state.entries.some((e) => e.kind === 'system' && e.id === action.notice.id)) return state;
      return { ...state, entries: [...state.entries, action.notice] };
    }

    case 'SET_ACTIVE_TICKET': {
      const ticket = action.ticket;
      console.log('[chatStore] SET_ACTIVE_TICKET:', ticket?.id, ticket?.ticket_number);
      const isWaiting = ticket?.status?.toUpperCase() === 'WAITING_CUSTOMER';
      const isClosed = ['CLOSED', 'CANCELLED'].includes(ticket?.status?.toUpperCase() || '');
      return {
        ...state,
        activeTicket: ticket,
        customerWorkflowState: isWaiting
          ? 'WAITING_FOR_CUSTOMER'
          : isClosed
            ? 'CLOSED'
            : state.customerWorkflowState === 'WAITING_FOR_CUSTOMER'
              ? 'NORMAL'
              : state.customerWorkflowState,
        waitingRequestDetail: isWaiting ? ticket?.summary || state.waitingRequestDetail : state.waitingRequestDetail,
      };
    }

    case 'SET_AVAILABLE_TICKETS': {
      let updatedActive = state.activeTicket;
      if (updatedActive) {
        const found = action.tickets.find((t) => String(t.id) === String(updatedActive?.id));
        if (found) {
          updatedActive = found;
        }
      }
      return {
        ...state,
        availableTickets: action.tickets,
        activeTicket: updatedActive,
      };
    }

    case 'CANCEL_REQUESTED': {
      return {
        ...state,
        cancellationState: {
          status: 'PENDING',
          ticketNumber: action.ticketNumber,
          ticketId: action.ticketId,
          error: undefined,
        },
      };
    }

    case 'CANCEL_CONFIRMED': {
      const num = state.cancellationState.ticketNumber || (state.activeTicket?.ticket_number ? String(state.activeTicket.ticket_number) : '');
      const confirmNotice: CustomerSystemNotice = {
        kind: 'system',
        id: `system:cancel:confirmed:${Date.now()}`,
        code: 'cancel_confirmed',
        text: action.message || `รับเรื่องยกเลิกเคส ${num} แล้วค่ะ`,
        createdAt: new Date().toISOString(),
        tone: 'info',
      };
      return {
        ...state,
        cancellationState: {
          ...state.cancellationState,
          status: 'CONFIRMED',
          error: undefined,
        },
        customerWorkflowState: 'CLOSED',
        entries: [...state.entries, confirmNotice],
      };
    }

    case 'CANCEL_DECLINED': {
      const num = state.cancellationState.ticketNumber || (state.activeTicket?.ticket_number ? String(state.activeTicket.ticket_number) : '');
      const declineNotice: CustomerSystemNotice = {
        kind: 'system',
        id: `system:cancel:declined:${Date.now()}`,
        code: 'cancel_declined',
        text: action.message || `ยกเลิกการยืนยันค่ะ เคส ${num} ยังดำเนินการต่อ`,
        createdAt: new Date().toISOString(),
        tone: 'info',
      };
      return {
        ...state,
        cancellationState: {
          ...state.cancellationState,
          status: 'DECLINED',
          error: undefined,
        },
        entries: [...state.entries, declineNotice],
      };
    }

    case 'CANCEL_FAILED': {
      return {
        ...state,
        cancellationState: {
          ...state.cancellationState,
          error: action.error,
        },
      };
    }

    case 'SET_WORKFLOW_STATE': {
      return {
        ...state,
        customerWorkflowState: action.state,
        waitingRequestDetail: action.detail !== undefined ? action.detail : state.waitingRequestDetail,
      };
    }

    case 'SET_PENDING_ACTION': {
      return {
        ...state,
        pendingAction: action.action,
      };
    }

    case 'TICKET_UPDATED': {
      const { ticketId, status, ticketNumber, detail } = action;
      const st = String(status || '').toUpperCase();
      const updatedList = state.availableTickets.map((t) =>
        String(t.id) === String(ticketId) ? { ...t, status: st } : t
      );
      let updatedActive = state.activeTicket;
      let newWorkflowState = state.customerWorkflowState;
      let waitingDetail = state.waitingRequestDetail;

      if (updatedActive && (String(updatedActive.id) === String(ticketId) || updatedActive.ticket_number === ticketNumber)) {
        updatedActive = { ...updatedActive, status: st };
        if (st === 'WAITING_CUSTOMER') {
          newWorkflowState = 'WAITING_FOR_CUSTOMER';
          if (detail) waitingDetail = detail;
        } else if (st === 'CLOSED' || st === 'CANCELLED') {
          newWorkflowState = 'CLOSED';
        } else if (newWorkflowState === 'WAITING_FOR_CUSTOMER') {
          newWorkflowState = 'NORMAL';
        }
      }

      return {
        ...state,
        availableTickets: updatedList,
        activeTicket: updatedActive,
        customerWorkflowState: newWorkflowState,
        waitingRequestDetail: waitingDetail,
      };
    }

    case 'RESET':
      return initialChatState;

    default:
      return state;
  }
}

/**
 * Order by timestamp, keeping insertion order for equal stamps.
 *
 * History arrives in one batch while live frames arrive one at a time; without
 * this a reconnect could interleave an older row after a newer one.
 */
function sortEntries(entries: CustomerChatEntry[]): CustomerChatEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const at = timeOf(a.entry);
      const bt = timeOf(b.entry);
      // An entry the server gave no usable timestamp for keeps its arrival
      // position rather than being sorted by a value nobody supplied. Treating
      // null as 0 would bury it at the top of the transcript; treating it as
      // "now" is the fabrication this change removed.
      if (at === null || bt === null) return a.index - b.index;
      if (at !== bt) return at - bt;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/** Milliseconds, or null when the server supplied no usable timestamp. */
export function timeOf(entry: { createdAt: string | null }): number | null {
  if (!entry.createdAt) return null;
  const ms = Date.parse(entry.createdAt);
  return Number.isFinite(ms) ? ms : null;
}
