import React, { useState } from 'react';
import type { CustomerAppRoute } from '../types';
import { ChevronDown, Sparkles, BookOpen, MessageSquare } from 'lucide-react';
import { Button } from '../../../components/ui/Primitives';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'ระบบ TicketX Support คืออะไร?',
    answer: 'TicketX Support คือศูนย์บริการช่วยเหลือลูกค้าอัจฉริยะ ที่เชื่อมต่อคุณกับ AI Assistant และทีมงานผู้เชี่ยวชาญ คุณสามารถสอบถามปัญหา ติดตามสถานะงาน และยืนยันผลการแก้ไขได้ตลอด 24 ชั่วโมงค่ะ',
  },
  {
    question: 'ตั๋วแต่ละสถานะมีความหมายอย่างไร?',
    answer: '• "รับเรื่องแล้ว" คือระบบได้รับคำขอแล้ว\n• "กำลังดำเนินการ" คือทีมงานหรือระบบกำลังแก้ไขปัญหา\n• "รอข้อมูลเพิ่มเติมจากคุณ" คือต้องการข้อมูลจากคุณเพิ่มเติม\n• "แก้ไขแล้ว — รอคุณยืนยัน" คือทีมงานแก้ไขเสร็จแล้ว และรอให้คุณตรวจสอบความถูกต้องค่ะ',
  },
  {
    question: 'จะยืนยันหรือแจ้งปัญหาต่อเมื่อได้รับการแก้ไขแล้วอย่างไร?',
    answer: 'เมื่อตั๋วอยู่ในสถานะ "แก้ไขแล้ว — รอคุณยืนยัน" คุณสามารถกดเข้ามาที่ตั๋วใบนั้น และเลือกกด "ยืนยันว่าแก้ไขแล้ว" หรือ "ยังพบปัญหาอยู่" เพื่อให้ทีมงานเปิดเรื่องดูแลต่อได้ทันทีค่ะ',
  },
  {
    question: 'หากใช้งานในฐานะผู้มาเยือน (Guest) จะดูประวัติการแจ้งปัญหาได้อย่างไร?',
    answer: 'ผู้มาเยือนสามารถแชทสอบถาม AI ได้ทันที แต่หากต้องการดูประวัติตั๋วงานย้อนหลัง กรุณาเข้าใช้งานผ่านลิงก์ที่ผูกกับบัญชี LINE Official Account ของคุณค่ะ',
  },
];

export function CustomerHelpPage({
  onNavigate,
}: {
  onNavigate: (route: CustomerAppRoute) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl w-full p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BookOpen className="h-6 w-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          ศูนย์ช่วยเหลือและคำถามที่พบบ่อย (Help Center)
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          ค้นหาคำตอบสำหรับคำถามทั่วไปเกี่ยวกับการใช้งานระบบ TicketX
        </p>
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-border/70 bg-card overflow-hidden transition-all shadow-2xs"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-expanded={isOpen}
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-primary' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line border-t border-border/40 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contact Support CTA Box */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          ไม่พบคำตอบที่คุณต้องการ?
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          AI Assistant และทีมงานของเราพร้อมตอบคำถามและช่วยเหลือคุณทันทีค่ะ
        </p>
        <Button
          variant="primary"
          onClick={() => onNavigate('home')}
          className="gap-2 text-xs rounded-xl"
        >
          <MessageSquare className="h-4 w-4" />
          <span>เริ่มแชทสนทนากับ AI Support</span>
        </Button>
      </div>
    </div>
  );
}
