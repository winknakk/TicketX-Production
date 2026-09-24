import React, { useRef, useEffect, useState, useCallback } from 'react';
import type {
  CustomerChatEntry,
  CustomerChatMessage,
  CustomerMessageAttachment,
  CustomerTicket,
  CustomerCancellationState,
  CustomerWorkflowState,
} from '../../types';
import {
  Sparkles,
  User,
  Send,
  Bot,
  Plus,
  X,
  FileText,
  Image as ImageIcon,
  Headset,
  AlertTriangle,
  Loader2,
  RotateCw,
  Ticket,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';

/* ────────────────────────────── time ────────────────────────────── */

/**
 * All timestamps render in the viewer's own timezone, which is what
 * `toLocaleTimeString` already did for individual bubbles. The date separators
 * derive their day boundary the same way, so a message and the separator above
 * it can never disagree about which day it is.
 */
function parseAt(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function timeLabel(value: string | null): string | null {
  const d = parseAt(value);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
}

/** Local calendar day key. Not an ISO slice: that would group by UTC. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dateSeparatorLabel(d: Date): string {
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const key = dayKey(d);
  if (key === today) return 'วันนี้';
  if (key === yesterday) return 'เมื่อวาน';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label={label}>
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ──────────────────────────── attachments ──────────────────────────── */

function isImageAttachment(att: CustomerMessageAttachment): boolean {
  if (att.fileType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|avif|heic)$/i.test(att.fileName || '');
}

function formatSize(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Full-size view of one image.
 *
 * The preview in the transcript is deliberately small; this is where the
 * customer actually reads their screenshot. Escape and a backdrop click both
 * close it, and focus moves to the dialog so the keyboard path works.
 */
function ImageLightbox({ attachment, onClose }: { attachment: CustomerMessageAttachment; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`ภาพแนบ ${attachment.fileName}`}
      onClick={onClose}
    >
      <div className="relative flex max-h-full max-w-4xl flex-col" onClick={(e) => e.stopPropagation()}>
        <img
          src={attachment.fileUrl}
          alt={attachment.fileName}
          className="max-h-[80vh] max-w-full rounded-lg object-contain"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-white/80">
          <span className="truncate">{attachment.fileName}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/30 px-3 py-1.5 font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One attachment inside a bubble.
 *
 * An image renders as a **bounded** preview. It used to be an unconstrained
 * `<img>` that let a full-resolution screenshot fill the entire chat viewport
 * and push the conversation off screen. The cap is on the box, with
 * `object-contain`, so the aspect ratio is preserved rather than squashed —
 * the picture is legible, and the transcript is still readable around it.
 *
 * Only `fileName` is ever rendered as text. The URL lives in `src`/`href`, so
 * the signed `expires`/`signature` query parameters the media route issues are
 * never printed into the transcript.
 */
function AttachmentView({
  attachment,
  onOpen,
}: {
  attachment: CustomerMessageAttachment;
  onOpen: (a: CustomerMessageAttachment) => void;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const size = formatSize(attachment.fileSize);

  if (attachment.status === 'failed') {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-2.5 py-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium">{attachment.fileName}</div>
          <div className="text-[10px] text-rose-400">{attachment.error || 'แนบไฟล์ไม่สำเร็จ'}</div>
        </div>
      </div>
    );
  }

  if (attachment.status === 'uploading') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-current/20 px-2.5 py-2">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span className="truncate text-[11px]">{attachment.fileName}</span>
        <span className="text-[10px] opacity-70">กำลังอัปโหลด…</span>
      </div>
    );
  }

  const canPreview = isImageAttachment(attachment) && !previewFailed && !!attachment.fileUrl;

  if (canPreview) {
    return (
      <figure className="m-0">
        <button
          type="button"
          onClick={() => onOpen(attachment)}
          aria-label={`เปิดดูภาพ ${attachment.fileName} ขนาดเต็ม`}
          className="block overflow-hidden rounded-xl border border-current/20 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img
            src={attachment.fileUrl}
            alt={attachment.fileName}
            loading="lazy"
            onError={() => setPreviewFailed(true)}
            // Bounded box, aspect ratio preserved. One screenshot must not own
            // the viewport.
            className="max-h-[240px] w-auto max-w-full object-contain sm:max-w-[320px]"
          />
        </button>
        <figcaption className="mt-1 flex items-center gap-1.5 text-[10px] opacity-75">
          <ImageIcon className="h-3 w-3 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
          {size && <span className="shrink-0 font-mono">{size}</span>}
        </figcaption>
      </figure>
    );
  }

  // Non-image, or an image whose URL would not load: a safe card, never a
  // broken image frame.
  return (
    <a
      href={attachment.fileUrl || undefined}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-2 rounded-xl border border-current/20 px-2.5 py-2 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {isImageAttachment(attachment) ? (
        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{attachment.fileName}</span>
      {size && <span className="shrink-0 font-mono text-[10px] opacity-70">{size}</span>}
    </a>
  );
}

/* ────────────────────────── flow 5/6 cards ────────────────────────── */

/**
 * 1. Cancel Confirmation UI
 * Distinct prompt with confirmation request, clear ticket ID, stable button IDs,
 * idempotent state handling, and deterministic success/decline display.
 */
export function CancelConfirmationCard({
  cancellationState,
  activeTicket,
  onConfirm,
  onDecline,
  isSending,
}: {
  cancellationState: CustomerCancellationState;
  activeTicket: CustomerTicket | null;
  onConfirm: () => void;
  onDecline: () => void;
  isSending?: boolean;
}) {
  if (cancellationState.status === 'IDLE') return null;

  const ticketNumber =
    cancellationState.ticketNumber ||
    (activeTicket?.ticket_number ? String(activeTicket.ticket_number) : activeTicket?.ticket_id ? String(activeTicket.ticket_id) : activeTicket?.id ? String(activeTicket.id) : '');

  return (
    <div
      id="card-cancel-confirmation"
      data-testid="cancel-confirmation-card"
      className="mx-auto my-3 max-w-lg rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-card-foreground shadow-sm animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">ยืนยันการขอยกเลิกตั๋ว</h4>
            {ticketNumber && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                #{ticketNumber}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {cancellationState.status === 'PENDING'
              ? `คุณต้องการยกเลิกคำขอแจ้งปัญหา #${ticketNumber} ใช่หรือไม่? การยกเลิกจะมีผลทันทีและไม่สามารถย้อนกลับได้ค่ะ`
              : cancellationState.status === 'CONFIRMED'
                ? `ตั๋ว #${ticketNumber} ถูกยกเลิกเรียบร้อยแล้วค่ะ`
                : `ยกเลิกคำขอค่ะ ดำเนินการต่อสำหรับตั๋ว #${ticketNumber}`}
          </p>

          {cancellationState.error && (
            <div className="mt-2 rounded-lg bg-rose-500/15 p-2 text-[11px] text-rose-500 font-medium">
              {cancellationState.error}
            </div>
          )}

          {cancellationState.status === 'PENDING' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-confirm-cancel"
                data-testid="btn-confirm-cancel"
                disabled={isSending}
                onClick={onConfirm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                <span>ยืนยันยกเลิกตั๋ว</span>
              </button>
              <button
                type="button"
                id="btn-decline-cancel"
                data-testid="btn-decline-cancel"
                disabled={isSending}
                onClick={onDecline}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span>ไม่ยกเลิก (ดำเนินการต่อ)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 5. Dev-CS Waiting State UI
 * Shown when ticket status is WAITING_CUSTOMER
 */
export function WaitingForCustomerCard({
  detail,
  activeTicket,
  onCloseCase,
  onProvideInfo,
  isSending,
}: {
  detail?: string;
  activeTicket: CustomerTicket | null;
  onCloseCase: () => void;
  onProvideInfo: () => void;
  isSending?: boolean;
}) {
  const ticketNumber = activeTicket?.ticket_number || activeTicket?.id || '';

  return (
    <div
      id="card-waiting-customer"
      data-testid="waiting-for-customer-card"
      className="mx-auto my-3 max-w-lg rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-4 text-card-foreground shadow-sm animate-in fade-in"
    >
      <div className="flex items-start gap-3">
        <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">ทีมงานต้องการข้อมูลเพิ่มเติม</h4>
            {ticketNumber && (
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                #{ticketNumber}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {detail || 'ทีมงานหรือ Dev-CS ได้อัปเดตและกำลังรอคำตอบจากคุณ กรุณาตรวจสอบหรือตอบกลับเพื่อให้การดำเนินการต่อเนื่องค่ะ'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-waiting-close"
              data-testid="btn-waiting-close"
              disabled={isSending}
              onClick={onCloseCase}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>ปิดเคสเรียบร้อย</span>
            </button>
            <button
              type="button"
              id="btn-waiting-respond"
              data-testid="btn-waiting-respond"
              disabled={isSending}
              onClick={onProvideInfo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span>ขอข้อมูลเพิ่ม / ปัญหาเดิม</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Switch-ticket chips
 * Explicit list of available tickets, selected visual indicator,
 * idle/selecting/selected/failed states.
 */
export function SwitchTicketChips({
  tickets,
  activeTicket,
  onSelectTicket,
  onOpenNewCase,
  disabled,
}: {
  tickets: CustomerTicket[];
  activeTicket: CustomerTicket | null;
  onSelectTicket: (ticket: CustomerTicket | null) => void;
  onOpenNewCase?: () => void;
  disabled?: boolean;
}) {
  if (!tickets || tickets.length === 0) return null;

  const openTickets = tickets.filter(
    (t) => !['CLOSED', 'CANCELLED'].includes(String(t.status || '').toUpperCase())
  );
  const closedTickets = tickets.filter((t) =>
    ['CLOSED', 'CANCELLED'].includes(String(t.status || '').toUpperCase())
  );

  return (
    <div className="flex flex-col gap-1.5 py-1 text-xs">
      {/* Active Case Context Header */}
      {activeTicket && (
        <div
          data-testid="active-case-context"
          className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs"
        >
          <span className="text-[11px] font-medium text-muted-foreground shrink-0">กำลังคุยเรื่อง:</span>
          <span className="font-semibold text-primary truncate max-w-[240px]">
            {activeTicket.subject || activeTicket.summary || activeTicket.ticket_number}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            ({activeTicket.ticket_number || `#${activeTicket.id}`})
          </span>
        </div>
      )}

      {/* Case Switch Chips Row */}
      <div
        data-testid="switch-ticket-chips"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
        role="group"
        aria-label="เปลี่ยนเรื่องหรือเลือกเคสที่ต้องการสนทนา"
      >
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Ticket className="h-3 w-3" />
          <span>เปลี่ยนเรื่อง:</span>
        </span>

        <button
          type="button"
          id="chip-ticket-none"
          data-testid="chip-ticket-none"
          disabled={disabled}
          onClick={() => onSelectTicket(null)}
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
            !activeTicket
              ? 'bg-foreground text-background shadow-xs font-semibold'
              : 'border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <span>ทั่วไป (ไม่ผูกตั๋ว)</span>
        </button>

        {/* Open Cases: Green Indicator */}
        {openTickets.map((t) => {
          const isSelected = String(activeTicket?.id) === String(t.id);
          const ticketNum = t.ticket_number || t.ticket_id || `#${t.id}`;
          const isWaiting = t.status?.toUpperCase() === 'WAITING_CUSTOMER';

          return (
            <button
              key={t.id}
              type="button"
              id={`ticket-chip-${t.id}`}
              data-testid={`ticket-chip-${t.id}`}
              data-legacy-id={`chip-ticket-${t.id}`}
              disabled={disabled}
              onClick={() => onSelectTicket(t)}
              title={t.subject || t.summary}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'border border-border bg-card text-foreground hover:bg-muted hover:border-primary/40'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="เปิดอยู่ (Open)" />
              <span className="font-mono">{ticketNum}</span>
              {t.subject && <span className="truncate max-w-[100px] text-[10px] opacity-80">{t.subject}</span>}
              {isWaiting && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" title="รอข้อมูลจากคุณ" />
              )}
              {isSelected && <CheckCircle2 className="h-3 w-3 text-current shrink-0" />}
            </button>
          );
        })}

        {/* Closed Cases: Muted Indicator, Disabled/Read-only */}
        {closedTickets.map((t) => {
          const ticketNum = t.ticket_number || t.ticket_id || `#${t.id}`;
          return (
            <button
              key={t.id}
              type="button"
              id={`ticket-chip-${t.id}`}
              data-testid={`ticket-chip-${t.id}`}
              disabled={true}
              title="เคสนี้ปิดเรียบร้อยแล้ว (ไม่สามารถส่งข้อความเข้าเคสที่ปิดแล้วได้)"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium opacity-60 cursor-not-allowed bg-muted/40 border border-dashed border-border text-muted-foreground"
            >
              <span className="h-2 w-2 rounded-full bg-neutral-400 shrink-0" title="ปิดแล้ว (Closed)" />
              <span className="font-mono">{ticketNum}</span>
              <span className="text-[10px]">(ปิดแล้ว)</span>
            </button>
          );
        })}

        {/* New Case Button */}
        <button
          type="button"
          id="chip-ticket-new"
          data-testid="chip-ticket-new"
          disabled={disabled}
          onClick={() => {
            if (onOpenNewCase) {
              onOpenNewCase();
            } else {
              onSelectTicket(null);
            }
          }}
          className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-dashed border-primary/60 text-primary hover:bg-primary/10 transition-all"
        >
          <Plus className="h-3 w-3" />
          <span>+ แจ้งปัญหาใหม่</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 3. Active-ticket indicator
 * Compact header view showing currently active ticket, status, and quick switch action.
 */
export function ActiveTicketIndicator({
  activeTicket,
  onClear,
}: {
  activeTicket: CustomerTicket | null;
  onClear?: () => void;
}) {
  if (!activeTicket) return null;

  const ticketNum = activeTicket.ticket_number || activeTicket.ticket_id || `#${activeTicket.id}`;
  const status = activeTicket.status?.toUpperCase() || 'OPEN';
  const isWaiting = status === 'WAITING_CUSTOMER';

  return (
    <div
      id="active-ticket-indicator"
      data-testid="active-ticket-indicator"
      className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs"
    >
      <Ticket className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono font-bold text-primary">{ticketNum}</span>
        <span className="truncate max-w-[120px] sm:max-w-[180px] text-[11px] text-muted-foreground">
          {activeTicket.subject || activeTicket.summary}
        </span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
            isWaiting
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              : 'bg-primary/20 text-primary'
          }`}
        >
          {status}
        </span>
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          title="ยกเลิกการผูกเคสนี้"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────── bubbles ────────────────────────────── */

function SystemNoticeRow({ text, tone }: { text: string; tone: 'info' | 'warning' | 'error' }) {
  const palette =
    tone === 'error'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
      : tone === 'warning'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
        : 'border-border bg-muted/60 text-muted-foreground';

  return (
    <div className="flex justify-center" role="status">
      <div className={`inline-flex max-w-[85%] items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] ${palette}`}>
        {tone === 'error' ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Headset className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="leading-relaxed">{text}</span>
      </div>
    </div>
  );
}

function ChatBubble({
  msg,
  onAction,
  onOpenImage,
  onRetry,
  pendingAction,
  isSending,
}: {
  msg: CustomerChatMessage;
  onAction?: (value: string) => void;
  onOpenImage: (a: CustomerMessageAttachment) => void;
  onRetry?: (tempId: string) => void;
  pendingAction?: string | null;
  isSending?: boolean;
}) {
  const isCustomer = msg.role === 'customer';
  const failed = msg.deliveryStatus === 'failed';
  const time = timeLabel(msg.createdAt);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    if (retrying || isSending || msg.deliveryStatus === 'sending') return;
    setRetrying(true);
    onRetry?.(msg.id);
    window.setTimeout(() => setRetrying(false), 1000);
  }, [retrying, isSending, msg.deliveryStatus, msg.id, onRetry]);

  return (
    <div className={`flex items-start gap-3 sm:gap-4 ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      {!isCustomer && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
          {msg.role === 'human' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
      )}

      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-xs ${
          isCustomer
            ? 'bg-primary text-primary-foreground rounded-tr-xs'
            : 'bg-card border border-border text-card-foreground rounded-tl-xs'
        } ${failed ? 'ring-1 ring-rose-500/50' : ''}`}
      >
        {msg.content && <div className="whitespace-pre-wrap break-words">{msg.content}</div>}

        {msg.attachments && msg.attachments.length > 0 && (
          <div className={`space-y-1.5 ${msg.content ? 'mt-2.5 border-t border-current/15 pt-2' : ''}`}>
            {msg.attachments.map((att, idx) => (
              <AttachmentView key={`${att.fileName}-${idx}`} attachment={att} onOpen={onOpenImage} />
            ))}
          </div>
        )}

        {/* Quick-action chips the backend attached to this message. Only label
            and value are ever used — an action id, or the raw object, is never
            rendered. */}
        {!isCustomer && msg.actions && msg.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {msg.actions.map((action) => {
              const sending = pendingAction === action.value;
              return (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => onAction?.(action.value)}
                  // Disabled while any action is in flight, so a double tap
                  // cannot send the same choice twice.
                  disabled={!onAction || !!pendingAction}
                  aria-busy={sending}
                  className={`touch-target inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                    action.style === 'primary'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border bg-card text-foreground hover:bg-muted'
                  }`}
                >
                  {sending && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {failed && msg.error && <div className="mt-2 text-[10px] text-rose-300">{msg.error}</div>}

        {failed && onRetry && (
          <button
            type="button"
            disabled={!onRetry || isSending || retrying || msg.deliveryStatus === 'sending'}
            onClick={handleRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-2.5 py-1 text-[11px] font-medium hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
            <span>{retrying ? 'กำลังส่งใหม่…' : 'ลองส่งอีกครั้ง'}</span>
          </button>
        )}

        <div
          className={`mt-1.5 text-[10px] ${
            isCustomer ? 'text-primary-foreground/75 text-right' : 'text-muted-foreground text-left'
          }`}
        >
          {/* No timestamp is shown when the server sent none. Substituting the
              current time would misdate the message and hide the data problem. */}
          {time ?? <span title="ไม่มีข้อมูลเวลาจากระบบ">เวลาไม่ระบุ</span>}
          {msg.deliveryStatus === 'sending' && ' · กำลังส่ง…'}
          {(msg.deliveryStatus === 'sent' || msg.deliveryStatus === 'processing') && (
            <span className="inline-flex items-center gap-1">
              <span> · ส่งแล้ว</span>
              <span className="inline-block h-1 w-1 rounded-full bg-current animate-pulse" />
              <span>กำลังประมวลผล…</span>
            </span>
          )}
          {failed && ' · ส่งไม่สำเร็จ'}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── stream ────────────────────────────── */

export function CustomerChatStream({
  entries,
  isTyping,
  isReconnecting,
  onAction,
  onRetry,
  pendingAction,
  isSending,
  cancellationState,
  activeTicket,
  onConfirmCancel,
  onDeclineCancel,
  customerWorkflowState,
  waitingDetail,
  onCloseWaiting,
  onRespondWaiting,
}: {
  entries: CustomerChatEntry[];
  isTyping: boolean;
  isReconnecting?: boolean;
  onAction?: (value: string) => void;
  onRetry?: (tempId: string) => void;
  /** The action value currently being sent, if any. */
  pendingAction?: string | null;
  isSending?: boolean;
  cancellationState?: CustomerCancellationState;
  activeTicket?: CustomerTicket | null;
  onConfirmCancel?: () => void;
  onDeclineCancel?: () => void;
  customerWorkflowState?: CustomerWorkflowState;
  waitingDetail?: string;
  onCloseWaiting?: () => void;
  onRespondWaiting?: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<CustomerMessageAttachment | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, isTyping, cancellationState?.status, customerWorkflowState]);

  const openImage = useCallback((a: CustomerMessageAttachment) => setLightbox(a), []);

  // Walk once, inserting a separator wherever the local calendar day changes.
  let lastDay: string | null = null;

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-5 bg-background text-foreground transition-colors"
      role="log"
      aria-live="polite"
    >
      <div className="max-w-3xl mx-auto w-full space-y-5">
        {isReconnecting && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>กำลังเชื่อมต่อใหม่...</span>
            </div>
          </div>
        )}

        {/* Cancellation Flow Card */}
        {cancellationState && cancellationState.status === 'PENDING' && onConfirmCancel && onDeclineCancel && (
          <CancelConfirmationCard
            cancellationState={cancellationState}
            activeTicket={activeTicket ?? null}
            onConfirm={onConfirmCancel}
            onDecline={onDeclineCancel}
            isSending={isSending}
          />
        )}

        {/* Waiting For Customer Card */}
        {customerWorkflowState === 'WAITING_FOR_CUSTOMER' && onCloseWaiting && onRespondWaiting && (
          <WaitingForCustomerCard
            detail={waitingDetail}
            activeTicket={activeTicket ?? null}
            onCloseCase={onCloseWaiting}
            onProvideInfo={onRespondWaiting}
            isSending={isSending}
          />
        )}

        {entries.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center p-6 select-none">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border text-primary shadow-lg mb-4">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">พร้อมเมื่อไรก็บอกได้เลย</h2>
            <p className="mt-2 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
              สอบถามคำถาม ติดตามตั๋ว หรือแจ้งปัญหาการใช้งานกับ AI ผู้ช่วยได้ทันทีค่ะ
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            const at = parseAt(entry.createdAt);
            const key = at ? dayKey(at) : null;
            const needsSeparator = at !== null && key !== lastDay;
            if (needsSeparator) lastDay = key;

            return (
              <React.Fragment key={entry.id}>
                {needsSeparator && at && <DateSeparator label={dateSeparatorLabel(at)} />}
                {entry.kind === 'system' ? (
                  <SystemNoticeRow text={entry.text} tone={entry.tone} />
                ) : (
                  <ChatBubble
                    msg={entry}
                    onAction={onAction}
                    onOpenImage={openImage}
                    onRetry={onRetry}
                    pendingAction={pendingAction}
                    isSending={isSending}
                  />
                )}
              </React.Fragment>
            );
          })
        )}

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3 rounded-tl-xs shadow-xs">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0.2s]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {lightbox && <ImageLightbox attachment={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

/* ───────────────────────────── composer ───────────────────────────── */

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function CustomerChatComposer({
  onSendMessage,
  isSending,
  disabled,
  quickActions,
  onSelectAction,
  activeTicket,
  availableTickets,
  onSelectTicket,
}: {
  onSendMessage: (text: string, files?: File[]) => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
  quickActions?: Array<{ label: string; value: string; style?: string }>;
  onSelectAction?: (val: string) => void;
  activeTicket?: CustomerTicket | null;
  availableTickets?: CustomerTicket[];
  onSelectTicket?: (ticket: CustomerTicket | null) => void;
}) {
  const [text, setText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs for the composer's own thumbnails. Revoked when the chip goes
  // away, so picking and removing files repeatedly does not leak blobs.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    };
    // Intentionally on unmount only; per-file revocation happens in removeFile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyOf = (f: File, i: number) => `${f.name}-${f.size}-${i}`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (picked.length === 0) return;

    const tooLarge = picked.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    const accepted = picked.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);

    setFileError(
      tooLarge.length > 0 ? `ไฟล์ ${tooLarge.map((f) => f.name).join(', ')} ใหญ่เกิน 10MB จึงยังแนบไม่ได้ค่ะ` : null
    );
    if (accepted.length > 0) {
      setAttachedFiles((prev) => {
        const next = [...prev, ...accepted];
        setPreviews((p) => {
          const merged = { ...p };
          accepted.forEach((f, i) => {
            if (f.type.startsWith('image/')) merged[keyOf(f, prev.length + i)] = URL.createObjectURL(f);
          });
          return merged;
        });
        return next;
      });
    }
  };

  const removeFile = (idx: number) => {
    setAttachedFiles((prev) => {
      const f = prev[idx];
      const k = f ? keyOf(f, idx) : '';
      setPreviews((p) => {
        if (p[k]) URL.revokeObjectURL(p[k]);
        const { [k]: _removed, ...rest } = p;
        return rest;
      });
      return prev.filter((_, i) => i !== idx);
    });
    setFileError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && attachedFiles.length === 0) || isSending || disabled) return;

    const msgText = text;
    const filesToSend = [...attachedFiles];

    setText('');
    setAttachedFiles([]);
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    setPreviews({});
    setFileError(null);

    await onSendMessage(msgText, filesToSend.length > 0 ? filesToSend : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-background/95 p-3 sm:p-4">
      <div className="max-w-3xl mx-auto w-full">
        {availableTickets && availableTickets.length > 0 && onSelectTicket && (
          <div className="mb-2 border-b border-border/40 pb-1.5">
            <SwitchTicketChips
              tickets={availableTickets}
              activeTicket={activeTicket ?? null}
              onSelectTicket={onSelectTicket}
              onOpenNewCase={() => onSelectAction?.('+ แจ้งปัญหาใหม่')}
              disabled={disabled || isSending}
            />
          </div>
        )}

        {quickActions && quickActions.length > 0 && (
          <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {quickActions.map((action) => (
              <button
                key={action.value}
                type="button"
                id={`btn-quick-action-${action.value}`}
                data-testid={`btn-quick-action-${action.value}`}
                onClick={() => onSelectAction?.(action.value)}
                disabled={disabled || isSending}
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                  action.style === 'primary'
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-border bg-card/90 backdrop-blur-xs text-foreground hover:bg-muted hover:border-primary/40'
                }`}
              >
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {fileError && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {attachedFiles.map((file, idx) => {
              const preview = previews[keyOf(file, idx)];
              return (
                <div
                  key={keyOf(file, idx)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-1.5 text-xs text-foreground shadow-xs"
                >
                  {preview ? (
                    <img src={preview} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : file.type.startsWith('image/') ? (
                    <ImageIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  )}
                  <span className="max-w-[140px] truncate text-[11px] font-medium">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({(file.size / 1024).toFixed(0)}KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    title="ลบไฟล์แนบ"
                    aria-label={`ลบไฟล์แนบ ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="relative flex items-end rounded-2xl border border-border bg-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-xs">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />

          <div className="p-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
              title="แนบไฟล์หรือรูปภาพ (+)"
              aria-label="แนบไฟล์หรือรูปภาพ"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <textarea
            id="composer-input"
            data-testid="composer-input"
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ถามอะไรก็ได้ หรือกด + เพื่อแนบไฟล์..."
            aria-label="ข้อความ"
            className="flex-1 max-h-32 min-h-[44px] resize-none bg-transparent px-2 py-3 text-xs sm:text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
          />

          <div className="p-2 shrink-0">
            <button
              type="submit"
              id="btn-send-message"
              data-testid="btn-send-message"
              disabled={(!text.trim() && attachedFiles.length === 0) || isSending || disabled}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
              aria-label="ส่งข้อความ"
              title="ส่งข้อความ"
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
