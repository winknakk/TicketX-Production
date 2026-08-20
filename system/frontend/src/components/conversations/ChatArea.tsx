import React, { useState, useRef } from 'react';
import { MessageSquare, Send, Mail, Phone, Clock, Sparkles, Building2, Activity, Reply, X, Image as ImageIcon, ChevronRight, ChevronLeft, Paperclip } from 'lucide-react';
import { useConversation } from '../../context/ConversationContext';
import { MediaAttachmentGrid } from '../media/MediaAttachmentGrid';
import { AiAnalysisSidePanel } from './AiAnalysisSidePanel';
import { useProject } from '../../context/ProjectContext';
import { getOperatorProfile } from '../../lib/operator';


import { Button } from '@/components/ui/button';
import { HandoffStatusBadge } from '../common/HandoffStatusBadge';

import { cn } from '../../lib/utils';

interface ChatAreaProps {
  className?: string;
  onBack?: () => void;
  onOpenContext?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ className, onBack, onOpenContext }) => {
  const { activeProjectId } = useProject();
  const operatorProfile = getOperatorProfile(activeProjectId);
  const [activeImageForAnalysis, setActiveImageForAnalysis] = useState<any | null>(null);
  interface PendingImageItem {
    id: string;
    file: File;
    previewUrl: string;
  }
  const [pendingImageItems, setPendingImageItems] = useState<PendingImageItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddPendingImages = (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    if (newFiles.length === 0) return;
    const newItems: PendingImageItem[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingImageItems((prev) => [...prev, ...newItems]);
  };

  const handleRemovePendingImage = (id: string) => {
    setPendingImageItems((prev) => {
      const itemToRemove = prev.find((item) => item.id === id);
      if (itemToRemove) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearAllPendingImages = () => {
    pendingImageItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingImageItems([]);
  };

  const handleCombinedSend = async () => {
    if (pendingImageItems.length > 0) {
      const filesToUpload = pendingImageItems.map((item) => item.file);
      const captionText = replyText.trim();
      handleClearAllPendingImages();
      setReplyText('');
      await handleSendImageReply(filesToUpload, captionText);
    } else {
      await handleSendReply();
    }
  };
  const {
    selectedCustomerId,
    activeChannelTab,
    setActiveChannelTab,
    conversations,
    selectedConvId,
    messages,
    replyText,
    setReplyText,
    replyingToMessage,
    setReplyingToMessage,
    isLoadingMessages,
    isSendingReply,
    isTakingOver,
    isReleasing,
    remainingTime,
    chatContainerRef,
    messagesEndRef,
    handleTakeover,
    handleRelease,
    handleSendReply,
    handleSendImageReply,
    isConversationUnread,
    customers,
    isCrmCollapsed,
    setIsCrmCollapsed,
    profileData
  } = useConversation();

  const selectedCustomer = customers.find(cust => cust.id === selectedCustomerId);
  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  if (!selectedCustomer) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-card/25">
        <MessageSquare className="h-12 w-12 mb-3 opacity-40 text-primary" />
        <h3 className="font-bold text-foreground text-base mb-1">No customer selected</h3>
        <p className="text-xs max-w-xs leading-relaxed text-muted-foreground/80 font-medium">
          Select a customer from the inbox to open their unified CRM workspace.
        </p>
      </main>
    );
  }

  // Helper: check if two dates are on different calendar days
  const isDifferentDay = (a: string | undefined, b: string | undefined) => {
    if (!a || !b) return false;
    return new Date(a).toDateString() !== new Date(b).toDateString();
  };

  const formatDateSeparator = (ts: string) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className={cn("flex-1 bg-card/25 flex flex-col overflow-hidden relative", className)}>

      {/* ── HEADER ── */}
      <div className="border-b border-border px-5 py-3 bg-card shrink-0 shadow-sm">
        {/* Row 1: Avatar + Name + Status Controls */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 overflow-hidden">
              {(profileData?.identity?.avatar_url || selectedCustomer?.avatarUrl || selectedConversation?.avatar_url) ? (
                <img src={profileData?.identity?.avatar_url || selectedCustomer?.avatarUrl || selectedConversation?.avatar_url} alt={selectedCustomer?.name || 'Customer'} className="w-full h-full rounded-full object-cover" />
              ) : (
                (selectedCustomer?.name || 'CU').slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 leading-tight">
                <span className="truncate">{selectedCustomer.name}</span>
                {selectedCustomer.unread_count > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 shadow-sm animate-pulse">
                    {selectedCustomer.unread_count} unread
                  </span>
                )}
              </h2>

            </div>
          </div>

          {/* Handoff Controls */}
          {selectedConversation && (
            selectedConversation.takeover_status === 'PENDING_HUMAN' ? (
              <div className="flex items-center gap-2 shrink-0">
                <HandoffStatusBadge status="PENDING_HUMAN" />
                <button
                  onClick={() => handleTakeover(selectedConversation.id)}
                  disabled={isTakingOver}
                  className="px-3 py-1.5 bg-red-600 text-white font-bold text-xs rounded-lg shadow-sm hover:bg-red-700 transition cursor-pointer"
                >
                  {isTakingOver ? 'Claiming...' : 'Claim'}
                </button>
              </div>
            ) : selectedConversation.handled_by === 'ai' ? (
              <div className="flex items-center gap-2 shrink-0">
                <HandoffStatusBadge status="AI_ACTIVE" />
                <button
                  onClick={() => handleTakeover(selectedConversation.id)}
                  disabled={isTakingOver}
                  className="px-4 py-1.5 bg-black text-white font-bold text-xs rounded-full shadow-sm hover:bg-slate-800 active:scale-95 transition cursor-pointer"
                >
                  {isTakingOver ? 'Taking over...' : 'Take Over'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <HandoffStatusBadge status="ACTIVE_HUMAN" />
                {remainingTime && (
                  <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold text-[10px] flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    {remainingTime}
                  </span>
                )}
                <button
                  onClick={() => handleRelease(selectedConversation.id)}
                  disabled={isReleasing}
                  className="px-3 py-1.5 bg-secondary hover:bg-muted border border-border text-foreground font-bold text-xs rounded-lg shadow-sm active:scale-95 transition cursor-pointer"
                >
                  {isReleasing ? 'Releasing...' : 'Return to AI'}
                </button>
              </div>
            )
          )}
        </div>

        {/* Row 2: Channel Tabs (Only show channels that actually exist) */}
        <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40">
          {(['line', 'email', 'whatsapp', 'webchat'] as const)
            .filter((channel) => !!selectedCustomer.conversations[channel])
            .map((channel) => {
              const isSelected = activeChannelTab === channel;
              const conv = selectedCustomer.conversations[channel];
              const unread = conv ? isConversationUnread(conv) : false;

              let icon = <MessageSquare className="h-3 w-3 shrink-0" />;
              if (channel === 'email') icon = <Mail className="h-3 w-3 shrink-0" />;
              if (channel === 'whatsapp') icon = <Phone className="h-3 w-3 shrink-0" />;
              if (channel === 'webchat') icon = <Sparkles className="h-3 w-3 shrink-0" />;

              return (
                <button
                  key={channel}
                  onClick={() => setActiveChannelTab(channel)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-foreground text-background border-foreground shadow-sm'
                      : 'bg-muted/40 border-border text-foreground hover:bg-muted/80'
                  }`}
                >
                  {icon}
                  <span>{channel === 'line' ? 'LINE' : channel === 'webchat' ? 'WebChat' : channel.charAt(0).toUpperCase() + channel.slice(1)}</span>
                  {unread && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-card shrink-0" />
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* ── CHAT BODY ── */}
      {selectedConversation ? (
        <>
          {/* PENDING_HUMAN banner */}
          {selectedConversation.takeover_status === 'PENDING_HUMAN' && (
            <div className="bg-red-500/10 border-b border-red-500/25 px-5 py-2.5 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <div className="text-xs">
                  <span className="font-extrabold text-red-600">Pending Takeover: </span>
                  <span className="text-muted-foreground">This user is waiting for a human operator.</span>
                </div>
              </div>
              <button
                onClick={() => handleTakeover(selectedConversation.id)}
                disabled={isTakingOver}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg cursor-pointer active:scale-95 transition-all shrink-0"
              >
                {isTakingOver ? 'Claiming...' : 'Claim Room'}
              </button>
            </div>
          )}

          {/* Message bubbles */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col">
            {isLoadingMessages ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
                <span className="text-xs font-medium">Loading chat logs...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12 text-center">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs font-medium">No messages in this chat thread.</p>
              </div>
            ) : (
              messages
                .filter((m) => {
                  const hasText = !!(m.content && m.content.trim());
                  const hasAtt = (m.attachments && m.attachments.length > 0) || !!((m as any).imageUrl || (m as any).image_url || (m as any).file_path || (m as any).filePath);
                  return hasText || hasAtt || m.role === 'system' || m.messageType === 'image' || m.message_type === 'image';
                })
                .map((m, idx, displayArr) => {
                const isLeft = m.role === 'customer';

                // Date separator
                const prevMsg = displayArr[idx - 1];
                const showDateSep = idx === 0 || isDifferentDay(prevMsg?.timestamp || undefined, m.timestamp || undefined);

                // System message
                if (m.role === 'system') {
                  return (
                    <div key={idx} className="flex justify-center my-2">
                      <span className="px-3 py-1 rounded-full bg-muted/70 border border-border text-muted-foreground text-[10px] font-semibold">
                        {m.content}
                      </span>
                    </div>
                  );
                }

                let msgOperatorName = (m as any).sender_name || (m as any).operator_name || (m as any).author_name;
                if (!msgOperatorName && (m.role === 'human' || (m as any).role === 'operator')) {
                  try {
                    const cache = JSON.parse(localStorage.getItem('operator_message_senders') || '{}');
                    msgOperatorName = cache[`${selectedConvId}:${m.content}`] || (m.id ? cache[m.id] : undefined);
                  } catch { }
                }

                const roleBadge = m.role === 'customer'
                  ? 'User'
                  : m.role === 'ai'
                    ? 'AI Agent'
                    : (msgOperatorName || operatorProfile.name);

                const badgeColor = m.role === 'customer'
                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                  : m.role === 'ai'
                    ? 'bg-slate-900 text-white border border-slate-800'
                    : 'bg-black text-white border border-black';

                const formattedTime = m.timestamp
                  ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';

                const parentMsgId = (m as any).reply_to_message_id || (m as any).replyToMessageId || (m as any).parent_message_id || (m as any).metadata?.reply_to_message_id || (m as any).metadata?.parent_message_id || (m as any).quoted_message_id;
                const parentMsg = (m as any).reply_to_message || (m as any).quoted_message || (parentMsgId ? messages.find(item => String(item.id) === String(parentMsgId)) : null);

                const rawImgUrl = (m as any).imageUrl || (m as any).image_url || (m as any).file_path || (m as any).filePath ||
                  ((m.message_type === 'image' || (m as any).messageType === 'image') && m.content && (m.content.startsWith('http://') || m.content.startsWith('https://')) ? m.content : '');
                const attachmentsToRender = (m.attachments && m.attachments.length > 0)
                  ? m.attachments
                  : rawImgUrl
                    ? [{
                      id: m.id || idx,
                      fileUrl: rawImgUrl,
                      fileName: 'Attached Image',
                      fileType: 'image/jpeg'
                    }]
                    : [];

                // Grouping: only show label on first bubble of a sender group
                // For human/operator messages, also compare sender_name so different operators get separate group headers
                const prevRole = prevMsg?.role;
                const prevSenderName = prevMsg
                  ? (prevMsg as any).sender_name || (prevMsg as any).operator_name || (prevMsg as any).author_name || null
                  : null;
                const isSameSender =
                  prevRole === m.role &&
                  (m.role !== 'human'
                    ? true
                    : prevSenderName === (msgOperatorName || operatorProfile.name));
                const isFirstInGroup = idx === 0 || !isSameSender || (prevRole as string) === 'system';
                const groupGap = isFirstInGroup && idx > 0 ? 'mt-3' : 'mt-0.5';

                return (
                  <React.Fragment key={idx}>
                    {/* Date separator */}
                    {showDateSep && m.timestamp && (
                      <div className="flex items-center gap-2 my-3 select-none">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[10px] text-slate-500 font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                          {formatDateSeparator(m.timestamp)}
                        </span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}

                    <div className={`flex flex-col max-w-[80%] sm:max-w-[72%] ${isLeft ? 'self-start' : 'self-end items-end'} ${groupGap}`}>
                      {/* Label: only first of group */}
                      {isFirstInGroup && (
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500 font-semibold px-1">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold ${badgeColor}`}>
                            {roleBadge}
                          </span>
                          {formattedTime && (
                            <span className="text-[9px] text-slate-400 font-normal">· {formattedTime}</span>
                          )}
                        </div>
                      )}

                      <div className={`group/bubble flex items-center gap-1.5 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-full shadow-xs ${isLeft
                          ? 'bg-slate-100 text-slate-900 border border-slate-200/80 rounded-tl-xs'
                          : m.role === 'ai'
                            ? 'bg-slate-900 text-white font-medium rounded-tr-xs border border-slate-800'
                            : 'bg-black text-white font-medium rounded-tr-xs shadow-sm'
                          }`}>
                          {/* Quoted Reply Card */}
                          {parentMsg ? (
                            <div className={`mb-2 p-2 rounded-lg border text-xs overflow-hidden ${isLeft
                              ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              : 'bg-black/10 border-black/10 text-white'
                              }`}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-[11px] opacity-90 truncate">
                                    {parentMsg.role === 'customer' || parentMsg.customer_name ? (parentMsg.customer_name || 'Customer') : parentMsg.role === 'ai' ? 'AI Agent' : operatorProfile.name}
                                  </div>
                                  <div className="text-[11px] opacity-75 line-clamp-2 break-words whitespace-normal">
                                    {(parentMsg.messageType === 'image' || parentMsg.message_type === 'image' || (parentMsg.attachments && parentMsg.attachments.length > 0))
                                      ? '📷 Photo'
                                      : (parentMsg.content || '').trim() || '📷 Photo'}
                                  </div>
                                </div>
                              </div>
                              {(parentMsg.messageType === 'image' || (parentMsg.attachments && parentMsg.attachments.length > 0) || parentMsg.imageUrl || parentMsg.image_url) && (
                                <div className="h-8 w-8 rounded-lg overflow-hidden bg-black/10 shrink-0 border border-black/10">
                                  <img
                                    src={parentMsg.imageUrl || parentMsg.image_url || (parentMsg.attachments?.[0]?.fileUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256'}
                                    alt="Quoted"
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              )}
                            </div>
                          ) : m.content && m.content.startsWith('> ') ? (
                            <div className={`pl-3 pr-2 py-1.5 mb-2 text-xs rounded-xl border flex items-center gap-2 ${isLeft
                              ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                              : 'bg-black/10 border-black/10 text-white'
                              }`}>
                              <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-[11px] opacity-80">
                                  {m.content.split('\n')[0].replace(/^>\s*/, '')}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {m.content && (!rawImgUrl || m.content !== rawImgUrl) ? (
                            <div className="whitespace-pre-wrap">
                              {m.content.startsWith('> ')
                                ? m.content.split('\n').slice(1).join('\n')
                                : m.content}
                            </div>
                          ) : attachmentsToRender.length === 0 ? (
                            <div className="whitespace-pre-wrap text-xs opacity-70 italic">
                              {m.messageType === 'image' || m.message_type === 'image' ? '📷 Image' : m.messageType === 'sticker' || m.message_type === 'sticker' ? '🎨 Sticker' : '[Empty message]'}
                            </div>
                          ) : null}

                          {attachmentsToRender.length > 0 && (
                            <MediaAttachmentGrid
                              attachments={attachmentsToRender}
                              onAnalyzeImage={(att) => setActiveImageForAnalysis(att)}
                            />
                          )}
                        </div>

                        {/* Hover action buttons */}
                        <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            onClick={() => setReplyingToMessage(m)}
                            title="Reply"
                            className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-primary hover:bg-muted shadow-xs cursor-pointer"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          {(m.messageType === 'image' || attachmentsToRender.length > 0) && (
                            <button
                              onClick={() => {
                                const att = attachmentsToRender.length > 0
                                  ? attachmentsToRender[0]
                                  : { id: m.id, fileUrl: 'http://localhost:3000/api/v1/media/file?key=test_sample.png', fileName: 'customer_image.jpg' };
                                setActiveImageForAnalysis(att);
                              }}
                              title="AI Image Analysis"
                              className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 shadow-xs cursor-pointer"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <AiAnalysisSidePanel
            isOpen={!!activeImageForAnalysis}
            attachment={activeImageForAnalysis}
            conversationId={selectedConvId ?? undefined}
            onClose={() => setActiveImageForAnalysis(null)}
          />

          {/* Quoted Message Preview Bar */}
          {replyingToMessage && (
            <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center justify-between text-xs font-medium shrink-0 animate-in fade-in slide-in-from-bottom-1 duration-150">
              <div className="flex items-center gap-2 overflow-hidden">
                <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-primary shrink-0">
                  ตอบกลับ{replyingToMessage.role === 'customer' ? 'ลูกค้า' : ''}:
                </span>
                <span className="truncate text-muted-foreground">
                  {replyingToMessage.attachments && replyingToMessage.attachments.length > 0
                    ? '[📷 รูปภาพ]'
                    : replyingToMessage.content || '[รูปภาพ]'}
                </span>
              </div>
              <button
                onClick={() => setReplyingToMessage(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-background/50 cursor-pointer shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Pending Images Multi-Preview Bar */}
          {pendingImageItems.length > 0 && (
            <div className="px-4 py-2 bg-muted/60 border-t border-border flex items-center justify-between gap-3 text-xs shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 overflow-x-auto min-w-0 py-1">
                {pendingImageItems.map((item, idx) => (
                  <div key={item.id} className="relative group shrink-0">
                    <div className="h-11 w-11 rounded-lg overflow-hidden bg-black/10 border border-border shadow-2xs">
                      <img src={item.previewUrl} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePendingImage(item.id)}
                      className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition cursor-pointer"
                      title="ลบรูปนี้"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <div className="min-w-0 pl-1 shrink-0">
                  <div className="font-bold text-foreground text-xs truncate">
                    📷 แนบ {pendingImageItems.length} รูปภาพ
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {(pendingImageItems.reduce((sum, item) => sum + item.file.size, 0) / 1024).toFixed(0)} KB รวม · พร้อมส่ง
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearAllPendingImages}
                className="text-muted-foreground hover:text-red-500 p-1.5 rounded-lg hover:bg-background/60 cursor-pointer transition shrink-0 text-xs font-semibold flex items-center gap-1"
                title="ยกเลิกแนบรูปทั้งหมด"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">ลบทั้งหมด</span>
              </button>
            </div>
          )}

          {/* ── COMPOSER ── */}
          <div className="px-3 py-3 border-t border-border bg-card shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleAddPendingImages(e.target.files);
                }
                e.target.value = '';
              }}
            />
            <div className="flex items-end gap-2">
              {/* Textarea with image attach icon inside */}
              <div className="flex-1 relative flex items-end bg-background border border-border rounded-xl focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSendingReply}
                  title="แนบรูปภาพ (Attach Image)"
                  className={`self-end mb-1.5 ml-2 p-1.5 rounded-lg transition cursor-pointer shrink-0 disabled:opacity-40 ${pendingImageItems.length > 0 ? 'text-primary bg-primary/10 font-bold' : 'text-muted-foreground hover:text-primary hover:bg-muted'
                    }`}
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  rows={1}
                  placeholder={
                    pendingImageItems.length > 0
                      ? `พิมพ์คำอธิบายรูปภาพ (${pendingImageItems.length} รูป)...`
                      : replyingToMessage
                        ? `ตอบกลับข้อความ...`
                        : selectedConversation.handled_by === 'ai'
                          ? 'Type reply (auto TAKE OVER)...'
                          : 'Type message...'
                  }
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleCombinedSend();
                    }
                  }}
                  className="flex-1 bg-transparent px-2 py-2.5 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none max-h-28 min-h-[2.5rem]"
                />
              </div>

              {/* Send Button */}
              <button
                onClick={handleCombinedSend}
                disabled={isSendingReply || (!replyText.trim() && pendingImageItems.length === 0)}
                className="h-10 px-5 bg-black text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 hover:bg-slate-800 active:scale-95 transition cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSendingReply ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Send</>
                )}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Inactive Channel Placeholder */}
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-background/30">
            <MessageSquare className="h-10 w-10 mb-3 opacity-45 text-muted-foreground" />
            <h3 className="font-bold text-foreground text-sm mb-1 capitalize">
              {activeChannelTab} Inactive
            </h3>
            <p className="text-xs max-w-xs leading-relaxed text-muted-foreground/80 font-medium">
              {selectedCustomer?.name || 'Customer'} has not linked their {(activeChannelTab || 'line').toUpperCase()} account yet.
            </p>
          </div>

          {/* Disabled Composer */}
          <div className="px-3 py-3 border-t border-border bg-card/50 shrink-0 select-none opacity-50">
            <div className="flex gap-2 items-center bg-muted border border-border rounded-xl px-4 py-2.5">
              <input
                disabled
                type="text"
                placeholder={`${activeChannelTab.toUpperCase()} is inactive`}
                className="flex-1 bg-transparent text-xs focus:outline-none cursor-not-allowed"
              />
              <Send className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </>
      )}

      {/* ── CRM SIDE TAB (replaces floating circle button) ── */}
      {isCrmCollapsed && (
        <button
          onClick={() => setIsCrmCollapsed(false)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center gap-1 bg-card border border-border border-r-0 shadow-md rounded-l-xl px-1.5 py-4 hover:bg-muted transition-all cursor-pointer group"
          title="Open CRM Panel"
        >
          <Activity className="h-3.5 w-3.5 text-primary group-hover:text-primary" />
          <span
            className="text-[9px] font-bold text-muted-foreground group-hover:text-foreground tracking-widest"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            CRM
          </span>
          <ChevronLeft className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
        </button>
      )}
    </div>
  );
};
