import React from 'react';
import ReactDOM from 'react-dom/client';
import { WidgetRoot } from './WidgetRoot';

const widgetStyles = `
  :host { color-scheme: light; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif; }
  *, *::before, *::after { box-sizing: border-box; }
  button, input { font: inherit; }
  button:focus-visible, input:focus-visible, a:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
  .visually-hidden { position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important; }
  .widget-fab { position:fixed;right:0;bottom:140px;z-index:999999;display:flex;align-items:center;justify-content:center;width:44px;height:48px;border-radius:12px 0 0 12px;background:#4b5fc7;color:#fff;box-shadow:-2px 4px 16px rgba(45,55,110,.25);cursor:pointer;border:1px solid rgba(255,255,255,0.18);border-right:0; }
  .online-badge { position:absolute;left:4px;top:4px;width:10px;height:10px;border:2px solid #fff;border-radius:50%;background:#16a34a; }
  .chat-window { position:fixed;right:12px;bottom:195px;z-index:999999;display:flex;width:min(380px,calc(100vw - 24px));height:min(540px,calc(100dvh - 210px));min-height:340px;flex-direction:column;overflow:hidden;border:1px solid #e1e4ea;border-radius:12px;background:#fff;color:#20242d;box-shadow:0 22px 54px rgba(20,27,45,.18);animation:widget-in .18s ease-out; }
  @keyframes widget-in { from { transform:translateY(12px);opacity:0; } }
  .chat-header { display:flex;min-height:64px;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:#292f5f;color:#fff; }
  .agent-info { display:flex;min-width:0;align-items:center;gap:10px; }
  .avatar { display:grid;width:36px;height:36px;flex:none;place-items:center;border-radius:8px;background:rgba(255,255,255,.12);font-size:12px;font-weight:700; }
  .agent-name { margin:0;font-size:14px;font-weight:650; }
  .agent-status { margin-top:2px;color:#bfdbfe;font-size:12px; }
  .close-btn,.upload-btn,.send-btn { display:grid;min-width:44px;min-height:44px;place-items:center;border:0;border-radius:10px;background:transparent;color:inherit;cursor:pointer; }
  .close-btn:hover { background:rgba(255,255,255,.12); }
  .takeover-banner { display:flex;align-items:center;gap:8px;border-bottom:1px solid #fed7aa;background:#fff7ed;padding:10px 14px;color:#9a3412;font-size:12px;font-weight:650; }
  .takeover-banner > :first-child { display:grid;width:20px;height:20px;flex:none;place-items:center;border-radius:50%;background:#ea580c;color:#fff;font-weight:900; }
  .widget-error { display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #fecaca;background:#fef2f2;padding:9px 12px;color:#b91c1c;font-size:12px; }
  .widget-error button { min-height:36px;border:1px solid #fecaca;border-radius:8px;background:#fff;padding:0 12px;color:#991b1b;font-weight:700;cursor:pointer; }
  .messages-area { display:flex;min-height:0;flex:1;flex-direction:column;gap:14px;overflow-y:auto;overscroll-behavior:contain;padding:18px 16px;background:#f8f9fb; }
  .widget-state { margin:auto;padding:24px;text-align:center;color:#64748b;font-size:13px;line-height:1.5; }
  .message-bubble { max-width:84%;padding:10px 13px;border-radius:8px;font-size:13.5px;line-height:1.55;overflow-wrap:anywhere; }
  .msg-customer { align-self:flex-end;background:#e9ecf8;color:#29336f; }
  .msg-agent { align-self:flex-start;border-left:2px solid #4b5fc7;background:#fff;color:#20242d; }
  .msg-time { display:block;margin-top:4px;text-align:right;font-size:10px;opacity:.7; }
  .attachment-link { display:block;margin-top:7px;border-radius:7px;background:rgba(255,255,255,.14);padding:7px;color:inherit;font-size:12px; }
  .typing-bubble { padding:15px 18px; }
  .typing-indicator { display:flex;gap:4px; }
  .typing-indicator span { width:6px;height:6px;border-radius:50%;background:#64748b;animation:typing 1.2s infinite; }
  .typing-indicator span:nth-child(2){animation-delay:.12s}.typing-indicator span:nth-child(3){animation-delay:.24s}
  @keyframes typing { 50% { transform:translateY(-4px); } }
  .input-area { display:flex;flex:none;align-items:center;gap:4px;border-top:1px solid #e2e8f0;background:#fff;padding:10px max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left)); }
  .input-area > input { min-width:0;min-height:44px;flex:1;border:1px solid #d2d7e0;border-radius:8px;padding:9px 12px;color:#20242d;background:#fff;font-size:14px; }
  .input-area > input:disabled { cursor:not-allowed;background:#f1f5f9;color:#64748b; }
  .upload-btn input { position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0); }
  .upload-btn,.send-btn { color:#4338ca; }
  .upload-btn:has(input:disabled),.send-btn:disabled { cursor:not-allowed;color:#94a3b8; }
  @media (max-width:1024px) { .widget-fab { bottom:max(82px,calc(env(safe-area-inset-bottom) + 76px)); } }
  @media (max-width:480px) { .widget-fab { right:max(12px,env(safe-area-inset-right));width:48px;height:48px; } .chat-window { inset:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));width:auto;height:auto;max-height:none;border-radius:10px; } .message-bubble{max-width:88%;} }
  @media (prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important; } }
  @media (forced-colors:active) { .widget-fab,.chat-header { border:1px solid ButtonText; } .online-badge { background:Highlight; } }
`;

class AutomationXChatWidget extends HTMLElement {
  private mountPoint: HTMLDivElement | null = null;
  private root: ReactDOM.Root | null = null;
  private initialized = false;
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    const shadowRoot = this.attachShadow({ mode: 'open' });
    const styleElement = document.createElement('style'); styleElement.textContent = widgetStyles; shadowRoot.appendChild(styleElement);
    this.mountPoint = document.createElement('div'); this.mountPoint.id = 'automationx-webchat-widget-root'; shadowRoot.appendChild(this.mountPoint);
    const projectId = this.getAttribute('data-app-id') || '1';
    this.root = ReactDOM.createRoot(this.mountPoint); this.root.render(<React.StrictMode><WidgetRoot projectId={projectId} /></React.StrictMode>);
  }
  disconnectedCallback() { this.root?.unmount(); this.root = null; }
}

if (!customElements.get('automationx-chat-widget')) customElements.define('automationx-chat-widget', AutomationXChatWidget);
