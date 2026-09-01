import React, { useRef, useEffect, useState } from 'react';
import type { CustomerChatMessage } from '../../types';
import { Sparkles, User, Send, Bot, Paperclip, Plus, X, FileText, Image as ImageIcon } from 'lucide-react';

export function CustomerChatStream({
  messages,
  isTyping,
}: {
  messages: CustomerChatMessage[];
  isTyping: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-5 bg-background text-foreground transition-colors" role="log" aria-live="polite">
      <div className="max-w-3xl mx-auto w-full space-y-5">
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center p-6 select-none">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border text-primary shadow-lg mb-4">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            พร้อมเมื่อไรก็บอกได้เลย
          </h2>
          <p className="mt-2 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
            สอบถามคำถาม ติดตามตั๋ว หรือแจ้งปัญหาการใช้งานกับ AI ผู้ช่วยได้ทันทีค่ะ
          </p>
        </div>
      ) : (
        messages.map((msg) => {
          const isCustomer = msg.role === 'customer';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 sm:gap-4 ${isCustomer ? 'justify-end' : 'justify-start'}`}
            >
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
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 pt-2 border-t border-current/15">
                    {msg.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-xs underline underline-offset-2 hover:opacity-80"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{att.fileName}</span>
                      </a>
                    ))}
                  </div>
                )}

                <div
                  className={`mt-1.5 text-[10px] ${
                    isCustomer ? 'text-primary-foreground/75 text-right' : 'text-muted-foreground text-left'
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
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
    </div>
  );
}

export function CustomerChatComposer({
  onSendMessage,
  isSending,
  disabled,
}: {
  onSendMessage: (
    text: string,
    attachments?: Array<{
      fileUrl: string;
      fileName: string;
      fileType?: string;
      fileSize?: number;
    }>
  ) => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...files]);
    }
  };

  const removeFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && attachedFiles.length === 0) || isSending || disabled) return;

    const msgText = text;
    const filesToSend = [...attachedFiles];

    setText('');
    setAttachedFiles([]);

    const attachments = filesToSend.map((file) => ({
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      fileType: file.type,
      fileSize: file.size,
    }));

    await onSendMessage(msgText, attachments.length > 0 ? attachments : undefined);
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
        {/* File Attachment Badges */}
        {attachedFiles.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground shadow-xs"
              >
                {file.type.startsWith('image/') ? (
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
                  className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-rose-500 transition-colors"
                  title="ลบไฟล์แนบ"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Pill Composer */}
        <div className="relative flex items-end rounded-2xl border border-border bg-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-xs">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />

          {/* Plus / File Attachment Button */}
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

          {/* Text Input */}
          <textarea
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ถามอะไรก็ได้ หรือกด + เพื่อแนบไฟล์..."
            className="flex-1 max-h-32 min-h-[44px] resize-none bg-transparent px-2 py-3 text-xs sm:text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
          />

          {/* Send Button */}
          <div className="p-2 shrink-0">
            <button
              type="submit"
              disabled={(!text.trim() && attachedFiles.length === 0) || isSending || disabled}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
              aria-label="ส่งข้อความ"
              title="ส่งข้อความ"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
