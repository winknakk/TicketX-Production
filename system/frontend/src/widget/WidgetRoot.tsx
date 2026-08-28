import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from '../lib/apiBaseUrl';

export interface Attachment {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface WidgetMessage {
  id: string;
  role: "customer" | "ai" | "human";
  content: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface WidgetRootProps {
  projectId: string;
}

export const WidgetRoot: React.FC<WidgetRootProps> = ({ projectId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [takeoverActive, setTakeoverActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Was: `${protocol}//${hostname === "127.0.0.1" ? "127.0.0.1:3000" : "localhost:3000"}`.
  // On any real host that produced https://localhost:3000 — the visitor's own
  // machine, over TLS it does not speak — and every handshake failed with
  // ERR_SSL_PROTOCOL_ERROR. The shared resolver returns the deployed origin.
  const backendUrl = API_BASE_URL;

  // 1. Handshake and Session Setup
  useEffect(() => {
    isMountedRef.current = true;
    const initSession = async () => {
      try {
        const guestUuidKey = `automationx_webchat_guest_uuid_${projectId}`;
        let guestUuid = localStorage.getItem(guestUuidKey);

        const response = await fetch(`${backendUrl}/api/v1/webchat/handshake`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            projectId,
            guestUuid: guestUuid || undefined
          })
        });

        if (!isMountedRef.current) return;

        const data = await response.json();
        if (data.token) {
          if (data.guestUuid) {
            localStorage.setItem(guestUuidKey, data.guestUuid);
          }

          // Fetch message history
          await fetchHistory(data.token);
          if (!isMountedRef.current) return;

          // Connect to real-time WebSockets
          connectSocket(data.token);
        }
      } catch (err) {
        console.error("[WebChatWidget] Handshake failed:", err);
      }
    };

    initSession();

    return () => {
      isMountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [projectId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentTyping]);

  // 2. Fetch history log
  const fetchHistory = async (token: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/v1/webchat/messages`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!isMountedRef.current) return;
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
        // Determine if takeover was active in history
        const hasHumanMsg = data.messages.some((m: WidgetMessage) => m.role === "human");
        if (hasHumanMsg) {
          setTakeoverActive(true);
        }
      }
    } catch (err) {
      console.error("[WebChatWidget] Failed to load messages history:", err);
    }
  };

  // 3. WebSocket Connection
  const connectSocket = (token: string) => {
    if (!isMountedRef.current) return;

    // Derived from the same origin as the HTTP calls, so the socket cannot
    // point somewhere the rest of the widget does not.
    const wsUrl = `${backendUrl.replace(/^http/, "ws")}/api/v1/webchat/socket?token=${token}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) {
        ws.close();
        return;
      }
      setIsConnected(true);
      reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      console.log("[WebChatWidget] WebSocket connection established");
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const payload = JSON.parse(event.data);

        if (payload.event === "message") {
          const newMsg = payload.data as WidgetMessage;
          setMessages((prev) => {
            // Deduplicate temporary customer messages
            if (newMsg.role === "customer" && prev.some((m) => m.content === newMsg.content && m.role === "customer")) {
              return prev;
            }
            // Deduplicate AI/Agent messages
            if (prev.some((m) => m.id === newMsg.id || (m.content === newMsg.content && m.role === newMsg.role && Math.abs(new Date(m.createdAt).getTime() - new Date(newMsg.createdAt).getTime()) < 3000))) {
              return prev;
            }
            return [...prev, newMsg];
          });

          if (newMsg.role === "human") {
            setTakeoverActive(true);
          }
          setIsAgentTyping(false);
        } else if (payload.event === "typing") {
          if (payload.data.senderId !== localStorage.getItem(`automationx_webchat_guest_uuid_${projectId}`)) {
            setIsAgentTyping(!!payload.data.isTyping);
          }
        }
      } catch (err) {
        console.error("[WebChatWidget] WebSocket parsed message error:", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (!isMountedRef.current) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(Math.pow(2, attempts) * 1000, 30000);
      console.log(`[WebChatWidget] WebSocket connection closed, reconnecting in ${delay / 1000}s (attempt ${attempts + 1})...`);
      
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSocket(token);
      }, delay);
    };
  };

  // 4. Send typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      if (!isTyping && e.target.value.length > 0) {
        setIsTyping(true);
        socketRef.current.send(JSON.stringify({ event: "typing", isTyping: true }));
      } else if (isTyping && e.target.value.length === 0) {
        setIsTyping(false);
        socketRef.current.send(JSON.stringify({ event: "typing", isTyping: false }));
      }
    }
  };

  // 5. Send message text
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socketRef.current) return;

    const tempId = randomId();
    const payload = {
      text: inputText,
      tempId
    };

    socketRef.current.send(JSON.stringify(payload));

    // Append client-side immediately for latency response
    const localMsg: WidgetMessage = {
      id: tempId,
      role: "customer",
      content: inputText,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, localMsg]);
    setInputText("");
    setIsTyping(false);

    if (socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event: "typing", isTyping: false }));
    }
  };

  // 6. Handle File/Image upload via presigned S3 URLs
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);

    try {
      // 1. Get S3 presigned URL from backend
      const presignResponse = await fetch(`${backendUrl}/api/v1/webchat/upload/presign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        })
      });

      const { uploadUrl, fileUrl } = await presignResponse.json();

      // 2. Upload file directly to S3 bucket via PUT
      await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type
        },
        body: file
      });

      // 3. Send message containing the S3 attachment
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({
          text: `Uploaded attachment: ${file.name}`,
          attachments: [{
            fileUrl,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          }]
        }));
      }
    } catch (err) {
      console.error("[WebChatWidget] File upload workflow failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const randomId = () => {
    return Math.random().toString(36).substring(2, 9);
  };

  return (
    <>
      {/* 1. Glassmorphic FAB Button */}
      {!isOpen && (
        <button className="widget-fab" onClick={() => setIsOpen(true)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          {isConnected && <span className="online-badge"></span>}
        </button>
      )}

      {/* 2. Chat Window Container */}
      {isOpen && (
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <div className="agent-info">
              <div className="avatar">AI</div>
              <div>
                <div className="agent-name">Support Assistant</div>
                <div className="agent-status">{isConnected ? "Online" : "Connecting..."}</div>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Handoff Takeover Warning Banner */}
          {takeoverActive && (
            <div className="takeover-banner">
              <span className="banner-icon">⚠️</span>
              <span className="banner-text">AI is muted. A human support agent has taken control.</span>
            </div>
          )}

          {/* Messages Area */}
          <div className="messages-area">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-bubble ${msg.role === "customer" ? "msg-customer" : "msg-agent"}`}>
                <div className="msg-content">{msg.content}</div>
                {msg.attachments && msg.attachments.map((attach, index) => (
                  <a key={index} href={attach.fileUrl} target="_blank" rel="noopener noreferrer" className="attachment-link">
                    <span className="attachment-icon">📎</span>
                    <span className="attachment-name">{attach.fileName}</span>
                  </a>
                ))}
                <div className="msg-time">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}

            {/* Agent Typing Indicator */}
            {isAgentTyping && (
              <div className="message-bubble msg-agent typing-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form className="input-area" onSubmit={sendMessage}>
            <label className="upload-btn">
              <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </label>
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={uploading ? "Uploading file..." : "Type your message..."}
              disabled={uploading}
            />
            <button type="submit" className="send-btn" disabled={!inputText.trim() || uploading}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
};
