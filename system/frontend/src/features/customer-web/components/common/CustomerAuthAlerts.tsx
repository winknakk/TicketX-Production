import React from 'react';
import { Lock, MessageSquare, RefreshCw } from 'lucide-react';
import { Button } from '../../../../components/ui/Primitives';

export function GuestNoticeCard({
  onSwitchToChat,
}: {
  onSwitchToChat: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border/80 bg-card p-6 sm:p-8 text-center shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Lock className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base sm:text-lg font-semibold text-foreground">
        กรุณายืนยันตัวตนเพื่อดูประวัติการแจ้งปัญหา
      </h3>

      <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        ขณะนี้คุณกำลังเข้าใช้งานในฐานะ <span className="font-medium text-foreground">ผู้มาเยือน (Guest)</span> เพื่อความปลอดภัยของข้อมูลส่วนบุคคล ประวัติการแจ้งตั๋วจะแสดงเฉพาะผู้ใช้งานที่ยืนยันตัวตนผ่านบัญชี LINE OA หรือลิงก์ที่ได้รับเท่านั้นค่ะ
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          variant="primary"
          onClick={onSwitchToChat}
          className="w-full sm:w-auto gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          <span>แชทสอบถามปัญหาต่อ</span>
        </Button>
      </div>
    </div>
  );
}

export function SessionExpiredDialog({
  isOpen,
  onReconnect,
}: {
  isOpen: boolean;
  onReconnect: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg text-center animate-in fade-in zoom-in-95">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <RefreshCw className="h-6 w-6" />
        </div>

        <h3 className="mt-4 text-lg font-semibold text-foreground">
          เซสชันหมดอายุ
        </h3>

        <p className="mt-2 text-sm text-muted-foreground">
          การเชื่อมต่อของคุณหมดอายุแล้ว กรุณากดปุ่มด้านล่างเพื่อเชื่อมต่อและรีเฟรชข้อมูลใหม่อีกครั้งนะคะ
        </p>

        <div className="mt-6">
          <Button
            variant="primary"
            onClick={onReconnect}
            className="w-full gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>เชื่อมต่อใหม่</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
