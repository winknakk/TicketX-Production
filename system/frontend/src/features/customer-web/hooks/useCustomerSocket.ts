import { useEffect, useRef, useReducer, useCallback, useState } from 'react';
import { API_BASE_URL } from '../../../lib/apiBaseUrl';
import type { CustomerMessageAttachment } from '../types';
import { useCustomerSession } from '../auth/CustomerSessionContext';
import { customerApi } from '../api/customerApi';
import { setCustomerToken } from '../auth/customerSession';
import { normalizeSocketEvent, normalizeHistoryEntries } from '../chat/socketEvents';
import { chatReducer, initialChatState } from '../chat/chatStore';

/** Reconnect backoff. Bounded — the previous fixed 3s retry never gave up. */
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30_000;
const MAX_TICKET_ATTEMPTS = 5;

const ACK_TIMEOUT_MS = 15_000;

/**
 * Owns the customer's socket and the single chat store.
 *
 * Intended to be instantiated exactly once, by `CustomerChatProvider`. It used
 * to be called from `CustomerHomePage`, which meant the connection was torn
 * down whenever the customer opened their tickets — and `project_switched`,
 * which is delivered over this socket, was silently lost if it arrived while
 * they were on any other route.
 */
export function useCustomerSocket() {
  const { token, isLoading: isAuthLoading } = useCustomerSession();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  /** The action value currently in flight, so the chips can disable themselves. */
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  /**
   * Guards against a slow history fetch landing after a newer one. Without it a
   * response for the previous session could overwrite the current transcript.
   */
  const loadGenerationRef = useRef(0);
  /**
   * Payloads of sends that failed, keyed by the optimistic bubble's id, so the
   * customer can retry without retyping or re-picking the file. Cleared once a
   * retry succeeds; the object URLs held in the optimistic bubble are revoked
   * at the same time so a repeatedly-failing send does not leak blobs.
   */
  const failedSendsRef = useRef<Map<string, { text: string; files: File[]; previewUrls: string[] }>>(new Map());
  const retryingIdsRef = useRef<Set<string>>(new Set());
  /**
   * Timers for messages currently in flight awaiting an authoritative server ACK.
   * If the server does not emit an ACK frame before ACK_TIMEOUT_MS, or if the
   * socket closes before ACK, the message transitions to 'failed'.
   */
  const ackTimersRef = useRef<Map<string, number>>(new Map());

  const revokePreviews = useCallback((urls: string[]) => {
    urls.forEach((u) => {
      if (u.startsWith('blob:')) URL.revokeObjectURL(u);
    });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    const generation = ++loadGenerationRef.current;
    try {
      const res = await customerApi.getMessages();
      if (generation !== loadGenerationRef.current) return;
      dispatch({
        type: 'HISTORY_LOADED',
        conversationId: res.conversationId,
        messages: normalizeHistoryEntries(res.messages, new Date().toISOString()),
      });
    } catch {
      // Non-blocking: an empty transcript is better than a broken screen, and
      // the socket still delivers everything that arrives from now on.
    }
  }, [token]);

  useEffect(() => {
    if (token) loadMessages();
  }, [token, loadMessages]);

  // Socket lifecycle.
  useEffect(() => {
    if (!token || isAuthLoading) return;

    let isDisposed = false;
    let ticketAttempts = 0;
    let closeAttempts = 0;

    const scheduleReconnect = (delay: number) => {
      if (isDisposed) return;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    const connect = async () => {
      if (isDisposed) return;

      // A socket from a previous attempt must be gone before another is opened,
      // or React StrictMode's double invocation leaves two live connections and
      // every server message is handled twice.
      if (socketRef.current) {
        const stale = socketRef.current;
        socketRef.current = null;
        stale.onopen = null;
        stale.onmessage = null;
        stale.onclose = null;
        stale.onerror = null;
        stale.close();
      }

      let ticket: string;
      try {
        ticket = await customerApi.getWsTicket();
        ticketAttempts = 0;
      } catch (err: any) {
        if (isDisposed || err?.isGuestError) return;
        // A 401 means the token itself is dead; retrying with it can only 401
        // again. Re-authenticating belongs to CustomerSessionContext.
        if (err?.status === 401) return;
        ticketAttempts += 1;
        if (ticketAttempts > MAX_TICKET_ATTEMPTS) return;
        scheduleReconnect(Math.min(RECONNECT_MAX_MS, 2000 * 2 ** (ticketAttempts - 1)));
        return;
      }

      if (isDisposed) return;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsBase = API_BASE_URL;
      if (wsBase.startsWith('http://')) {
        wsBase = wsBase.replace('http://', 'ws://');
      } else if (wsBase.startsWith('https://')) {
        wsBase = wsBase.replace('https://', 'wss://');
      } else {
        wsBase = `${wsProtocol}//${window.location.host}`;
      }

      // Secure contract: the URL carries the single-use opaque ticket, never the customer JWT.
      const socketUrl = `${wsBase}/api/v1/webchat/socket?ticket=${encodeURIComponent(ticket)}`;

      try {
        const ws = new WebSocket(socketUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isDisposed) {
            ws.close();
            return;
          }
          closeAttempts = 0;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (isDisposed || socketRef.current !== ws) return;
          let payload: unknown;
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }

          const normalized = normalizeSocketEvent(payload, new Date().toISOString());

          switch (normalized.type) {
            case 'CHAT_MESSAGE': {
              dispatch({ type: 'MESSAGE_RECEIVED', message: normalized.message });
              if (normalized.message.role === 'customer') {
                // Authoritative ACK arrived!
                const extId = normalized.message.externalId;
                const msgId = normalized.message.id;
                for (const [tempId, timer] of ackTimersRef.current.entries()) {
                  if (tempId === extId || tempId === msgId || (extId && extId === tempId)) {
                    window.clearTimeout(timer);
                    ackTimersRef.current.delete(tempId);
                    const payload = failedSendsRef.current.get(tempId);
                    if (payload) {
                      revokePreviews(payload.previewUrls);
                      failedSendsRef.current.delete(tempId);
                    }
                  }
                }
                setIsSending(false);
              } else {
                // The answer to a tapped chip has arrived; re-enable the chips.
                setPendingAction(null);
              }
              break;
            }

            case 'TAKEOVER_EVENT':
              dispatch({ type: 'TAKEOVER', event: normalized.event, at: normalized.at });
              break;

            case 'SYSTEM_EVENT':
              dispatch({
                type: 'NOTICE',
                notice: {
                  kind: 'system',
                  id: `system:${normalized.code}`,
                  code: normalized.code,
                  text: normalized.text,
                  createdAt: normalized.at,
                  tone: 'info',
                },
              });
              break;

            case 'TYPING_EVENT':
              dispatch({ type: 'TYPING', isTyping: normalized.isTyping });
              if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = window.setTimeout(() => dispatch({ type: 'TYPING', isTyping: false }), 4000);
              break;

            case 'ERROR_EVENT': {
              for (const [tempId, timer] of ackTimersRef.current.entries()) {
                window.clearTimeout(timer);
                dispatch({
                  type: 'OPTIMISTIC_SETTLED',
                  tempId,
                  delivered: false,
                  error: 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ',
                });
              }
              ackTimersRef.current.clear();
              setIsSending(false);
              dispatch({
                type: 'NOTICE',
                notice: {
                  kind: 'system',
                  // Keyed by text so the same refusal repeated does not stack.
                  id: `system:error:${normalized.message}`,
                  code: 'socket_error',
                  text: 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ',
                  createdAt: new Date().toISOString(),
                  tone: 'error',
                },
              });
              break;
            }

            case 'PROJECT_EVENT': {
              const data = normalized.data as { token?: string };
              if (typeof data.token === 'string' && data.token) {
                setCustomerToken(data.token, 'customer');
              }
              window.dispatchEvent(new CustomEvent('ticketx:project_switched', { detail: normalized.data }));
              break;
            }

            case 'IGNORED':
            default:
              break;
          }
        };

        ws.onclose = () => {
          if (socketRef.current === ws) socketRef.current = null;
          setIsConnected(false);
          setIsSending(false);

          // Socket closed before ACK: transition all in-flight unacknowledged sends to failed
          for (const [tempId, timer] of ackTimersRef.current.entries()) {
            window.clearTimeout(timer);
            dispatch({
              type: 'OPTIMISTIC_SETTLED',
              tempId,
              delivered: false,
              error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
            });
          }
          ackTimersRef.current.clear();

          if (isDisposed) return;
          closeAttempts += 1;
          scheduleReconnect(Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(closeAttempts - 1, 5)));
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch {
        scheduleReconnect(RECONNECT_MAX_MS);
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      for (const timer of ackTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      ackTimersRef.current.clear();
      const ws = socketRef.current;
      socketRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [token, isAuthLoading]);

  /**
   * Send one customer turn: text, files, or both, as a single logical message.
   *
   * Files are uploaded before the text is sent so the conversation only ever
   * references a URL the server issued. When the upload fails the text is still
   * delivered — losing the customer's words because their screenshot failed
   * would be the worse outcome — and the attachment is marked failed on the
   * bubble rather than being drawn as though it had arrived.
   */
  const sendMessage = useCallback(
    async (text: string, files?: File[], existingTempId?: string) => {
      const trimmed = text.trim();
      const fileList = files ?? [];
      if (!trimmed && fileList.length === 0) return;

      // A resend for a message that is still awaiting its ACK is a duplicate,
      // not a retry.
      //
      // `retrySend` already holds a ref guard, but it releases in a `finally`
      // that runs as soon as this function returns — and this function returns
      // the moment it hands bytes to the socket, long before the message
      // settles. A rapid triple-tap of "ลองส่งอีกครั้ง" therefore produced
      // three network attempts. `ackTimersRef` holds exactly the sends that are
      // in flight and unacknowledged, so it is the synchronous, render-free
      // answer to "is this one still pending?" — unlike the component's
      // `retrying` state, which several clicks in one tick all read as stale.
      //
      // It is cleared on ACK, on ACK timeout and on socket close, so a genuinely
      // failed message is always retryable.
      if (existingTempId && ackTimersRef.current.has(existingTempId)) return;

      const tempId = existingTempId || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let localPreviews: CustomerMessageAttachment[] = [];

      if (existingTempId) {
        dispatch({ type: 'OPTIMISTIC_RETRY', tempId });
      } else {
        localPreviews = fileList.map((file) => ({
          fileUrl: URL.createObjectURL(file),
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          status: 'uploading',
        }));

        dispatch({
          type: 'OPTIMISTIC_ADDED',
          message: {
            kind: 'chat',
            id: tempId,
            role: 'customer',
            content: trimmed,
            createdAt: new Date().toISOString(),
            attachments: localPreviews,
            deliveryStatus: 'sending',
            pending: true,
          },
        });
      }
      setIsSending(true);

      const uploaded: CustomerMessageAttachment[] = [];
      if (fileList.length > 0) {
        const settled = await Promise.all(
          fileList.map(async (file, index): Promise<CustomerMessageAttachment> => {
            try {
              const result = await customerApi.uploadAttachment(file);
              return { ...result, status: 'ready' };
            } catch (err: any) {
              return {
                ...(localPreviews[index] || {
                  fileUrl: '',
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                }),
                status: 'failed',
                error: err?.message || 'อัปโหลดไฟล์ไม่สำเร็จ',
              };
            }
          })
        );
        uploaded.push(...settled);
        dispatch({ type: 'ATTACHMENTS_UPDATED', tempId, attachments: uploaded });
      }

      const deliverable = uploaded.filter((a) => a.status === 'ready');

      // The gateway rejects an empty `text`, so a message that is only a failed
      // attachment has nothing left to send. Settling it as failed is honest;
      // sending a placeholder in the customer's name would not be.
      if (!trimmed && deliverable.length === 0) {
        setIsSending(false);
        const existingPayload = failedSendsRef.current.get(tempId);
        failedSendsRef.current.set(tempId, {
          text: trimmed,
          files: fileList,
          previewUrls: existingPayload?.previewUrls || localPreviews.map((p) => p.fileUrl),
        });
        dispatch({
          type: 'OPTIMISTIC_SETTLED',
          tempId,
          delivered: false,
          error: 'ยังส่งไฟล์แนบไม่ได้ในขณะนี้ กรุณาพิมพ์อธิบายอาการ หรือแนบไฟล์ผ่านการเปิดตั๋วค่ะ',
        });
        return;
      }

      try {
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
          const existingPayload = failedSendsRef.current.get(tempId);
          failedSendsRef.current.set(tempId, {
            text: trimmed,
            files: fileList,
            previewUrls: existingPayload?.previewUrls || localPreviews.map((p) => p.fileUrl),
          });

          // Set bounded ACK timeout: if no authoritative server echo arrives within 15s, fail message
          if (ackTimersRef.current.has(tempId)) {
            window.clearTimeout(ackTimersRef.current.get(tempId));
          }
          ackTimersRef.current.set(
            tempId,
            window.setTimeout(() => {
              ackTimersRef.current.delete(tempId);
              dispatch({
                type: 'OPTIMISTIC_SETTLED',
                tempId,
                delivered: false,
                error: 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ',
              });
              setIsSending(false);
            }, ACK_TIMEOUT_MS)
          );

          socket.send(
            JSON.stringify({
              text: trimmed,
              tempId,
              // Forward-compatible: the gateway's inbound schema currently
              // ignores this field. It is sent so the portal needs no change on
              // the day the backend starts accepting it.
              attachments: deliverable.length > 0 ? deliverable : undefined,
            })
          );
          // Invariant: socket.send() returning does NOT mean the message is delivered.
          // The message remains in deliveryStatus: 'sending' ("· กำลังส่ง…") until
          // the authoritative server ACK frame arrives over the WebSocket!
        } else {
          const existingPayload = failedSendsRef.current.get(tempId);
          failedSendsRef.current.set(tempId, {
            text: trimmed,
            files: fileList,
            previewUrls: existingPayload?.previewUrls || localPreviews.map((p) => p.fileUrl),
          });
          dispatch({
            type: 'OPTIMISTIC_SETTLED',
            tempId,
            delivered: false,
            error: 'การเชื่อมต่อหลุด กรุณาลองส่งอีกครั้งค่ะ',
          });
          setIsSending(false);
        }
      } catch {
        const timer = ackTimersRef.current.get(tempId);
        if (timer) {
          window.clearTimeout(timer);
          ackTimersRef.current.delete(tempId);
        }
        const existingPayload = failedSendsRef.current.get(tempId);
        failedSendsRef.current.set(tempId, {
          text: trimmed,
          files: fileList,
          previewUrls: existingPayload?.previewUrls || localPreviews.map((p) => p.fileUrl),
        });
        dispatch({ type: 'OPTIMISTIC_SETTLED', tempId, delivered: false, error: 'ส่งข้อความไม่สำเร็จค่ะ' });
        setIsSending(false);
      }
    },
    [revokePreviews]
  );

  /**
   * Send a tapped quick action. No optimistic bubble: a chip is not something
   * the customer "said", and the backend answers it directly rather than
   * echoing it back through the conversation room.
   */
  const sendPostback = useCallback((value: string) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    // Marked in flight so every chip disables itself: without this a second tap
    // sent the same choice twice, and the customer saw two answers.
    setPendingAction(value);
    socket.send(JSON.stringify({ postback: value }));
    // Cleared on the reply, or after a bounded wait if none arrives, so a lost
    // response cannot leave the chips disabled forever.
    window.setTimeout(() => setPendingAction((cur) => (cur === value ? null : cur)), 8000);
    return true;
  }, []);

  /**
   * Re-send a message whose delivery failed, updating the existing bubble
   * in-place using the payload kept from the original attempt.
   */
  const retrySend = useCallback(
    async (tempId: string) => {
      if (retryingIdsRef.current.has(tempId)) return;
      const payload = failedSendsRef.current.get(tempId);
      if (!payload) return;

      retryingIdsRef.current.add(tempId);
      try {
        await sendMessage(payload.text, payload.files.length > 0 ? payload.files : undefined, tempId);
      } finally {
        retryingIdsRef.current.delete(tempId);
      }
    },
    [sendMessage]
  );

  return {
    entries: state.entries,
    conversationId: state.conversationId,
    isTyping: state.isTyping,
    isHumanTakeover: state.isHumanTakeover,
    isConnected,
    isSending,
    sendMessage,
    sendPostback,
    retrySend,
    pendingAction,
    reloadMessages: loadMessages,
  };
}

export type CustomerChatController = ReturnType<typeof useCustomerSocket>;
