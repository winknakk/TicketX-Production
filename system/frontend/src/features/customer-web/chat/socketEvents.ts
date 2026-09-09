/**
 * The one place a raw WebSocket payload becomes something the UI understands.
 *
 * Before this module every frame carrying `event: "message"` was turned into a
 * chat bubble with no inspection of what it contained. That is how
 * `handled_by_human` — a routing sentinel the PromptX Main AI Core Flow returns
 * on its human-takeover branch (`step_7`/`step_7_b`, `"reply_text":
 * "handled_by_human"`) — ended up rendered as something the assistant had said.
 * The backend forwards `reply_text` verbatim (`server.ts:630-654`: any
 * non-empty string is published to `webchat:outbound` as `text`), so the value
 * reaches the browser indistinguishable from real content.
 *
 * That is a backend/flow contract defect, recorded in
 * docs/WEBCHAT_FRONTEND_ATTACHMENT_REPORT.md. This module does not pretend it
 * is fixed: it classifies the payload for what it is, so a control value drives
 * a takeover notice instead of impersonating the assistant, and so an
 * unrecognised frame is dropped rather than rendered.
 */

import type { CustomerChatAction, CustomerChatMessage, CustomerMessageAttachment } from '../types';

/** Every shape the customer socket can produce, after classification. */
export type CustomerSocketEvent =
  | { type: 'CHAT_MESSAGE'; message: CustomerChatMessage }
  | { type: 'TAKEOVER_EVENT'; event: 'started' | 'released'; at: string }
  | { type: 'SYSTEM_EVENT'; code: string; text: string; at: string }
  | { type: 'PROJECT_EVENT'; data: Record<string, unknown> }
  | { type: 'TICKET_EVENT'; event: 'created' | 'updated'; data: Record<string, unknown> }
  | { type: 'TYPING_EVENT'; isTyping: boolean }
  | { type: 'ERROR_EVENT'; message: string }
  | { type: 'IGNORED'; reason: string };

/**
 * Values that are routing state, never prose.
 *
 * `handled_by_human` is the one observed in production. The rest are the other
 * literals the same flow branch and the backend worker can emit; they are
 * listed so a near-miss variant cannot slip through as a bubble, not because
 * each has been seen.
 */
const CONTROL_SENTINELS: Record<string, CustomerSocketEvent | 'IGNORE'> = {
  handled_by_human: { type: 'TAKEOVER_EVENT', event: 'started', at: '' },
  takeover_started: { type: 'TAKEOVER_EVENT', event: 'started', at: '' },
  human_takeover: { type: 'TAKEOVER_EVENT', event: 'started', at: '' },
  handled_by_ai: { type: 'TAKEOVER_EVENT', event: 'released', at: '' },
  takeover_released: { type: 'TAKEOVER_EVENT', event: 'released', at: '' },
  ai_resumed: { type: 'TAKEOVER_EVENT', event: 'released', at: '' },
  suppress_reply: 'IGNORE',
  no_reply: 'IGNORE',
  null: 'IGNORE',
  undefined: 'IGNORE',
};

/** Normalised form used for sentinel lookup: a sentinel is a bare token. */
function sentinelKey(content: string): string | null {
  const trimmed = content.trim();
  // A real reply is prose. Anything with whitespace or sentence punctuation is
  // treated as content even if it happens to contain a sentinel substring —
  // filtering on substrings would eat legitimate messages.
  if (!trimmed || /\s/.test(trimmed)) return null;
  const key = trimmed.toLowerCase();
  return Object.prototype.hasOwnProperty.call(CONTROL_SENTINELS, key) ? key : null;
}

/**
 * The server's timestamp, or null.
 *
 * This used to fall back to the receive time whenever the payload had no
 * usable `createdAt`. That is worse than showing nothing: a history row with a
 * bad timestamp was silently stamped "now", which sorted it to the bottom of
 * the transcript and made a months-old message look like it had just arrived,
 * with nothing anywhere to say the data was wrong.
 */
function readTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function normalizeAttachments(raw: unknown): CustomerMessageAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any): CustomerMessageAttachment | null => {
      const fileUrl = typeof a?.fileUrl === 'string' ? a.fileUrl : typeof a?.file_url === 'string' ? a.file_url : '';
      const fileName =
        typeof a?.fileName === 'string' ? a.fileName : typeof a?.file_name === 'string' ? a.file_name : '';
      if (!fileUrl && !fileName) return null;
      const fileType =
        typeof a?.fileType === 'string' ? a.fileType : typeof a?.file_type === 'string' ? a.file_type : undefined;
      const fileSize =
        typeof a?.fileSize === 'number' ? a.fileSize : typeof a?.file_size === 'number' ? a.file_size : undefined;
      return {
        fileUrl,
        fileName: fileName || 'attachment',
        fileType,
        fileSize,
        status: fileUrl ? 'ready' : 'failed',
      };
    })
    .filter((a): a is CustomerMessageAttachment => a !== null);
}

function normalizeRole(role: unknown): CustomerChatMessage['role'] {
  if (role === 'customer') return 'customer';
  if (role === 'human' || role === 'human_operator' || role === 'operator') return 'human';
  return 'ai';
}

function normalizeActions(raw: unknown): CustomerChatAction[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const actions = raw
    .filter((a: any) => a && typeof a.label === 'string' && typeof a.value === 'string')
    .map((a: any) => ({ label: a.label, value: a.value, style: a.style === 'primary' ? 'primary' : undefined }));
  return actions.length > 0 ? (actions as CustomerChatAction[]) : undefined;
}

/**
 * Classify one parsed socket payload.
 *
 * `receivedAt` is injected rather than read from the clock inside so the same
 * input always produces the same output, which is what makes this testable.
 */
export function normalizeSocketEvent(payload: unknown, receivedAt: string): CustomerSocketEvent {
  if (!payload || typeof payload !== 'object') {
    return { type: 'IGNORED', reason: 'payload is not an object' };
  }

  const p = payload as Record<string, any>;

  // The gateway answers a malformed frame with a bare {error, message} object
  // and no `event`. That used to fall through the final `else` and vanish, so a
  // rejected send looked to the customer like nothing had happened.
  if (typeof p.error === 'string' && p.event === undefined) {
    return { type: 'ERROR_EVENT', message: typeof p.message === 'string' ? p.message : p.error };
  }

  // Typed control events. None of these is emitted by the backend today — the
  // takeover signal currently arrives disguised as chat text. They are matched
  // first so that when the contract is fixed the correct path is already live
  // and the sentinel fallback below simply stops firing.
  const explicitType = typeof p.type === 'string' ? p.type : typeof p.event === 'string' ? p.event : '';
  if (explicitType === 'takeover_started' || explicitType === 'takeover_change') {
    const status = String(p.data?.status ?? p.status ?? '').toUpperCase();
    const released = status === 'ACTIVE_AI' || status === 'RELEASED';
    return { type: 'TAKEOVER_EVENT', event: released ? 'released' : 'started', at: receivedAt };
  }
  if (explicitType === 'takeover_released') {
    return { type: 'TAKEOVER_EVENT', event: 'released', at: receivedAt };
  }

  if (p.event === 'typing') {
    return { type: 'TYPING_EVENT', isTyping: !!p.data?.isTyping };
  }

  if (p.event === 'project_switched' && p.data && typeof p.data === 'object') {
    return { type: 'PROJECT_EVENT', data: p.data as Record<string, unknown> };
  }

  if (p.event === 'ticket_created' || p.event === 'ticket_updated') {
    const data = (p.data && typeof p.data === 'object' ? p.data : {}) as Record<string, unknown>;
    const eventType = p.event === 'ticket_created' ? 'created' : 'updated';
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent(`ticketx:${p.event}`, { detail: data }));
      } catch {}
    }
    return { type: 'TICKET_EVENT', event: eventType, data };
  }

  if (p.event === 'message' && p.data && typeof p.data === 'object') {
    const data = p.data as Record<string, any>;
    const content = typeof data.content === 'string' ? data.content : '';
    const attachments = normalizeAttachments(data.attachments);

    const key = sentinelKey(content);
    if (key && attachments.length === 0) {
      const mapped = CONTROL_SENTINELS[key];
      if (mapped === 'IGNORE') {
        return { type: 'IGNORED', reason: `control sentinel "${key}"` };
      }
      return { ...mapped, at: receivedAt } as CustomerSocketEvent;
    }

    if (!content && attachments.length === 0) {
      return { type: 'IGNORED', reason: 'empty message' };
    }

    // `externalId` is the stable backend identity when the payload carries one.
    // Outbound AI replies currently do not, which is why dedupe has to fall
    // back to `id` — see the store.
    const rawExternalId = data.externalId ?? data.external_id;
    const externalId =
      rawExternalId !== undefined && rawExternalId !== null
        ? String(rawExternalId)
        : undefined;

    const rawId = data.id;
    const resolvedId =
      rawId !== undefined && rawId !== null && String(rawId).trim() !== ''
        ? String(rawId)
        : `msg_${receivedAt}`;

    return {
      type: 'CHAT_MESSAGE',
      message: {
        kind: 'chat',
        id: resolvedId,
        externalId,
        role: normalizeRole(data.role),
        content,
        createdAt: readTimestamp(data.createdAt),
        attachments,
        actions: normalizeActions(data.actions),
        deliveryStatus: 'delivered',
      },
    };
  }

  return { type: 'IGNORED', reason: `unrecognised frame ${JSON.stringify(Object.keys(p)).slice(0, 60)}` };
}

/**
 * Classify rows from `GET /api/v1/webchat/messages`.
 *
 * History goes through the same classifier as the socket, for two reasons: a
 * sentinel that was persisted to `messages` must not reappear as a bubble after
 * a refresh, and history rows carry the database id — the only stable identity
 * this channel has — which the store prefers over the random UUID the socket
 * attaches.
 */
export function normalizeHistoryEntries(rows: unknown, receivedAt: string): CustomerChatMessage[] {
  if (!Array.isArray(rows)) return [];
  const out: CustomerChatMessage[] = [];
  for (const row of rows) {
    const event = normalizeSocketEvent({ event: 'message', data: row }, receivedAt);
    if (event.type === 'CHAT_MESSAGE') {
      // A history row's id comes from the database, so it is stable across
      // reloads and across transports. Promote it to externalId so a later
      // socket frame for the same message can be recognised.
      out.push({ ...event.message, externalId: event.message.externalId ?? event.message.id });
    }
  }
  return out;
}

/** Exposed for tests so the sentinel list cannot drift from its assertions. */
export const CONTROL_SENTINEL_KEYS = Object.keys(CONTROL_SENTINELS);
