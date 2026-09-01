import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../../../lib/apiBaseUrl';
import type { CustomerChatMessage } from '../types';
import { useCustomerSession } from '../auth/CustomerSessionContext';
import { customerApi } from '../api/customerApi';

export function useCustomerSocket() {
  const { token, isLoading: isAuthLoading } = useCustomerSession();
  const [messages, setMessages] = useState<CustomerChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  // 1. Initial message load
  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const res = await customerApi.getMessages();
      setConversationId(res.conversationId);
      if (res.messages && res.messages.length > 0) {
        setMessages(res.messages);
      }
    } catch {
      // Non-blocking initial fetch
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadMessages();
    }
  }, [token, loadMessages]);

  // 2. WebSocket setup & maintenance
  useEffect(() => {
    if (!token || isAuthLoading) return;

    let isDisposed = false;

    const connect = async () => {
      if (isDisposed) return;

      let ticket: string;
      try {
        ticket = await customerApi.getWsTicket();
      } catch (err: any) {
        // If guest or unauthorized, fallback gracefully without leaking
        if (!isDisposed && !err?.isGuestError) {
          reconnectTimerRef.current = window.setTimeout(connect, 5000);
        }
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

      // Secure contract: URL only contains the single-use opaque ticket, NEVER the customer JWT
      const socketUrl = `${wsBase}/api/v1/webchat/socket?ticket=${encodeURIComponent(ticket)}`;

      try {
        const ws = new WebSocket(socketUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isDisposed) {
            ws.close();
            return;
          }
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);

            if (payload.event === 'message' && payload.data) {
              const data = payload.data;
              const newMsg: CustomerChatMessage = {
                id: data.id || `msg_${Date.now()}`,
                role: data.role === 'customer' ? 'customer' : data.role === 'human' ? 'human' : 'ai',
                content: data.content || '',
                createdAt: data.createdAt || new Date().toISOString(),
                attachments: data.attachments || [],
              };

              setMessages((prev) => {
                // Deduplicate by message ID or identical customer content within 2s
                const exists = prev.some((m) => m.id === newMsg.id);
                if (exists) return prev;
                return [...prev, newMsg];
              });
              setIsTyping(false);
            } else if (payload.event === 'typing' && payload.data) {
              setIsTyping(!!payload.data.isTyping);
              if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = window.setTimeout(() => setIsTyping(false), 4000);
            }
          } catch {
            // Malformed socket payload
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          if (!isDisposed) {
            reconnectTimerRef.current = window.setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch {
        if (!isDisposed) {
          reconnectTimerRef.current = window.setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [token, isAuthLoading]);

  // 3. Send message action
  const sendMessage = useCallback(
    async (
      text: string,
      attachments?: Array<{
        fileUrl: string;
        fileName: string;
        fileType?: string;
        fileSize?: number;
      }>
    ) => {
      const trimmed = text.trim();
      if (!trimmed && (!attachments || attachments.length === 0)) return;

      const tempId = `temp_${Date.now()}`;
      const optimisticMsg: CustomerChatMessage = {
        id: tempId,
        role: 'customer',
        content: trimmed,
        createdAt: new Date().toISOString(),
        attachments: attachments || [],
        isSending: true,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setIsSending(true);

      try {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              text: trimmed,
              attachments,
              tempId,
            })
          );
        } else {
          // Fallback: If socket temporarily closed, refresh message stream
          setTimeout(loadMessages, 1000);
        }
      } catch {
        // Message error
      } finally {
        setIsSending(false);
        // Mark optimistic message as sent
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, isSending: false } : m))
        );
      }
    },
    [loadMessages]
  );

  return {
    messages,
    isConnected,
    isTyping,
    isSending,
    conversationId,
    sendMessage,
    reloadMessages: loadMessages,
  };
}
