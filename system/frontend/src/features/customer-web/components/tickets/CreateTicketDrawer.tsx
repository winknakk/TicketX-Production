import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { Button } from '../../../../components/ui/Primitives';

export function CreateTicketDrawer({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { subject: string; summary: string }) => Promise<void>;
}) {
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !summary.trim()) {
      setError('กรุณากรอกหัวข้อและรายละเอียดปัญหาให้ครบถ้วนค่ะ');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({ subject: subject.trim(), summary: summary.trim() });
      setSubject('');
      setSummary('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถสร้างตั๋วได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            เปิดตั๋วแจ้งปัญหาใหม่
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              หัวข้อปัญหา <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="เช่น เข้าสู่ระบบไม่ได้, ขอข้อมูลการใช้งาน"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              รายละเอียดปัญหา <span className="text-destructive">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="อธิบายอาการที่พบ หรือข้อความแจ้งเตือนที่ปรากฏ..."
              className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              <span>{isSubmitting ? 'กำลังส่งเรื่อง...' : 'ส่งเรื่องแจ้งปัญหา'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
