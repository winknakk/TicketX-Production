# พิมพ์เขียว Master End-to-End Flow: AutomationX & TicketX Lifecycle
**ระบบ:** AutomationX / TicketX Service Management Platform  
**ขอบเขต:** ตั้งแต่ลูกค้าส่งข้อความแรก (Intake) ➔ คัดกรอง/เปิดเคส ➔ การติดตามสถานะ 2 รูปแบบ (Self-service & Proactive) ➔ แก้ไข & ทดสอบ ➔ ปิดเคส (Case Closure)  
**วันที่บันทึก:** 2026-09-04  

---

## 1. ผังรวมภาพใหญ่ตลอดวงจรชีวิตของตั๋วงาน (Master E2E Lifecycle)

```mermaid
flowchart TD
    %% STAGE 1: INTAKE & TRIAGE
    subgraph S1["ระยะที่ 1: รับเรื่อง & คัดกรอง (Intake & Triage)"]
        A1["ลูกค้าพิมพ์ข้อความผ่าน LINE OA"] --> A2["Channel Gateway: Debounce (15s)"]
        A2 --> A3{"Main AI Core & AgentX:<br>ข้อความทั่วไป หรือ แจ้งปัญหา?"}
        A3 -- "คำถามทั่วไป / ตอบได้ทันที" --> A4["บอทตอบคำถามทันที (Fast Path)<br>จบการสนทนา ไม่เปิด Ticket"]
        A3 -- "ปัญหาที่ต้องแก้ไข / ซัพพอร์ต" --> A5["บอทสรุปเรื่อง & ส่ง Quick Reply<br>[ยืนยัน] / [ยกเลิก]"]
        A5 --> A6{"ลูกค้ายืนยัน?"}
        A6 -- "ยกเลิก / ขอแก้ข้อมูล" --> A7["ยกเลิกหรือรอรายละเอียดเพิ่ม"]
        A6 -- "ยืนยัน" --> A8["สร้าง Ticket (TCK-XXXXX)<br>+ Push Work Item ไปยัง Plane.so<br>+ แจ้ง SLA เป้าหมาย (เช่น 4 ชม.)"]
    end

    %% STAGE 2: DUAL-TRACK MONITORING
    subgraph S2["ระยะที่ 2: ระหว่างดำเนินการ & ติดตาม 2 รูปแบบ (Execution & Dual-Track Monitoring)"]
        A8 --> B_Pool[("ตั๋วอยู่ในสถานะ IN_PROGRESS<br>บน PostgreSQL & Plane.so")]
        
        %% Track A
        B_Pool -.-> TA1["【แบบที่ 1: ลูกค้าติดตามเอง】<br>ลูกค้าพิมพ์ 'ตรวจสอบสถานะ'"]
        TA1 --> TA2["กด Quick Reply 'ดูเคสล่าสุดทั้งหมด' (LIST)"]
        TA2 --> TA3["เลือกเลขเคส (เช่น TCK-2026-94619)"]
        TA3 --> TA4["บอทดึงสถานะ Real-time + แจ้งเป้าหมายเวลา SLA"]
        
        %% Track B
        B_Pool -.-> TB1["【แบบที่ 2: ระบบ/ทีมติดตามเชิงรุก (เพิ่มความถี่)】<br>SLA Monitoring Worker ตรวจสอบตั๋ว Urgent ทุก 15 นาที"]
        TB1 --> TB2["สะกิด Dev ทุก 1 ชม.<br>(1h: Root Cause / 2h: Code / 3h: Deploy)"]
        TB2 --> TB3{"มีความคืบหน้า<br>หรือติด Blocker?"}
        TB3 -- "ติดปัญหา/ส่อแววช้า" --> TB4["Escalate ถึง Lead & แจ้งขอขยายเวลากับลูกค้าล่วงหน้า 30 นาที"]
        TB3 -- "คืบหน้าตามแผน" --> TB5["ส่ง Interim Update ให้ลูกค้าทาง LINE ทุก 1.5 - 2 ชม."]
    end

    %% STAGE 3: RESOLUTION & VERIFICATION
    subgraph S3["ระยะที่ 3: แก้ไขเสร็จสิ้น & ตรวจสอบ (Resolution)"]
        TB2 --> C1["Dev แก้ไขสำเร็จ & ปรับสถานะเป็น Done ใน Plane.so"]
        C1 --> C2["Plane Webhook / Reverse Poller<br>Sync สถานะกลับมายัง TicketX DB"]
        C2 --> C3["TicketX Push Notification แจ้งลูกค้าทาง LINE<br>'แก้ไขเรียบร้อยแล้ว กรุณาเข้าตรวจสอบ'"]
    end

    %% STAGE 4: CLOSURE
    subgraph S4["ระยะที่ 4: การปิดเคสสมบูรณ์ (Closure & Feedback)"]
        C3 --> D1["ลูกค้าตรวจสอบความถูกต้องของระบบ/เอกสาร"]
        D1 --> D2["ลูกค้ากดปุ่ม 'ปิดเคส' หรือพิมพ์ยืนยัน"]
        D2 --> D3["Deterministic Close Net ตรวจจับ & ปิดตั๋ว"]
        D3 --> D4["Sync ปิดเคสไปยัง Plane.so & ส่งข้อความขอบคุณ"]
    end

    S1 --> S2 --> S3 --> S4
```

---

## 2. ลำดับการทำงานข้ามระบบแบบละเอียด (Cross-System Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as ลูกค้า (LINE OA)
    participant Gateway as Channel Gateway & Fastify
    participant AgentCore as Main AI Core & AgentX
    participant DB as PostgreSQL (csdb)
    participant Plane as Plane.so (PM Tool)
    participant Dev as ทีมพัฒนา (Dev Team)
    participant Worker as SLA Monitoring Worker

    %% 1. Intake & Ticket Creation
    Note over Customer, Gateway: ระยะที่ 1: รับเรื่องและเปิดเคส
    Customer->>Gateway: ส่งข้อความแจ้งปัญหา (เช่น SLIP ชื่อเป็น NULL)
    Gateway->>Gateway: Debounce 15s (รวบข้อความ + รูปภาพ)
    Gateway->>AgentCore: ส่งข้อความรวมเข้า Process
    AgentCore->>Customer: ส่ง Quick Reply ยืนยัน: [ ยืนยัน ] [ ยกเลิก ]
    Customer->>Gateway: แตะปุ่ม "ยืนยัน"
    Gateway->>AgentCore: Execute tool "create_ticket"
    AgentCore->>DB: INSERT INTO tickets (status: 'IN_PROGRESS', priority: 'urgent')
    AgentCore->>Plane: POST /work-items/ (สร้าง Issue ใน Plane.so)
    AgentCore-->>Customer: "เปิดเคสเรียบร้อยค่ะ รหัส TCK-2026-46939 คาดว่าจะเสร็จภายในวันนี้ 13:05 น. (4 ชม.)"

    %% 2. Dual-Track Monitoring
    Note over Customer, Worker: ระยะที่ 2: การติดตาม 2 รูปแบบคู่ขนาน

    par แบบที่ 1: ลูกค้าติดตามเอง (Inbound)
        Customer->>Gateway: พิมพ์ "ตรวจสอบสถานะ" ➔ กด "ดูเคสล่าสุดทั้งหมด"
        Gateway->>DB: SELECT tickets WHERE customer_id = ... (LIST)
        DB-->>Gateway: ส่งตั๋วที่กำลังดำเนินการ
        Gateway-->>Customer: แสดงลิสต์ตั๋ว
        Customer->>Gateway: พิมพ์ "TCK-2026-46939"
        Gateway->>DB: SELECT ticket status & SLA
        Gateway-->>Customer: "ตอนนี้ตรวจสอบเบื้องต้นแล้ว กำลังแก้ข้อมูล คาดว่าจะเสร็จก่อน 13:05 น."
    and แบบที่ 2: ระบบและทีมติดตามเชิงรุก (Outbound Proactive)
        loop ตรวจสอบทุก 1 ชั่วโมง (เพิ่มความถี่)
            Worker->>DB: Query ตั๋ว Urgent ที่ไม่มีการขยับ > 60 นาที
            Worker->>Dev: ยิงแจ้งเตือน Slack/LINE Dev: "เคส TCK-2026-46939 ครบ 1 ชม. ขอสถานะ Root cause ค่ะ"
            Dev-->>Worker: อัปเดตสถานะ: "พบจุด NULL แล้ว กำลังแก้ Query"
        end
        Worker->>Customer: (ครบ 2 ชม.) LINE Push: "อัปเดตความคืบหน้าเคส TCK-2026-46939 ทีมกำลังแก้ข้อมูลตามแผนเดิม 13:05 น. ค่ะ"
    end

    %% 3. Resolution & Closure
    Note over Dev, Customer: ระยะที่ 3 & 4: แก้ไขเสร็จและปิดเคส
    Dev->>Plane: ปรับสถานะ Issue เป็น "Done"
    Plane->>Gateway: Webhook: Issue Updated (state: Done)
    Gateway->>DB: UPDATE tickets SET status = 'RESOLVED'
    Gateway->>Customer: LINE Push: "แก้ไขข้อมูล SLIP เรียบร้อยแล้วค่ะ รบกวนตรวจสอบนะคะ"
    Customer->>Gateway: กดปุ่มเมนู "ปิดเคส"
    Gateway->>DB: UPDATE tickets SET status = 'CLOSED'
    Gateway->>Plane: Sync Closure to Plane
    Gateway-->>Customer: "ปิดเคส TCK-2026-46939 เรียบร้อยแล้วค่ะ ขอบคุณที่ใช้บริการนะคะ 🙏"
```

---

## 3. เจาะลึกการวางระบบและการทำงานในแต่ละระยะ (Architecture Components)

### ระยะที่ 1: Intake & Smart Triage (การรับเรื่องและคัดกรอง)
1. **Channel Ingestion (LINE Debounce Service):**
   - ดักจับ Event จากลูกค้า ถ้าลูกค้าส่งข้อความติดต่อกันหลายบรรทัดหรือส่งรูปพร้อมข้อความ ระบบจะหน่วงเวลาไว้ **15 วินาที** (`LineMessageBatchingService`) เพื่อรวบรวมเป็นก้อนเดียว ก่อนส่งเข้าสมองกล AI
2. **AI Intent Classification (AgentX):**
   - **Fast Path (คำถามทั่วไป/FAQ):** หากเป็นคำถามที่ AI มีข้อมูลตอบได้ (เช่น สอบถามระเบียบ, ขั้นตอนการขอเอกสาร) บอทจะตอบทันทีและ **ไม่สร้างตั๋วงาน** เพื่อไม่ให้รกระบบ
   - **Case Creation Path (แจ้งปัญหา/ข้อผิดพลาด):** หากเป็นปัญหาเชิงเทคนิค (เช่น สลิปแสดงค่า NULL) AI จะสรุปข้อมูล:
     - *Subject:* หัวข้อปัญหาที่กระชับ
     - *Description:* รายละเอียดและผลกระทบ
     - *Priority:* ประเมินความเร่งด่วน (Urgent / High / Normal)
     - *Confirmation Gate:* ส่งปุ่ม Quick Reply ให้ลูกค้ากด **"ยืนยัน"** หรือ **"ยกเลิก"**
3. **Ticket Provisioning & Promotion:**
   - เมื่อลูกค้ายืนยัน ระบบเรียก internal tool `create_ticket`:
     - บันทึกลง PostgreSQL ในตาราง `tickets` ได้เลข `TCK-YYYY-NNNNN`
     - ยิง API เชื่อมต่อไปยัง **Plane.so** สร้าง Work Item ส่งต่อไปให้ทีม Dev ทันที พร้อมแนบรูปลิงก์จาก S3
     - คำนวณ SLA Due Time (เช่น เคสด่วน = 4 ชั่วโมงข้างหน้า) แล้วตอบยืนยันลูกค้า

---

### ระยะที่ 2: Dual-Track Monitoring (การติดตามสถานะ 2 ช่องทาง)

#### รูปแบบที่ 1: ลูกค้าติดตามด้วยตนเอง (Customer Self-Service)
- **พฤติกรรม:** ลูกค้าเป็นฝ่ายทักเข้ามาเพราะอยากทราบสถานะปัจจุบัน
- **Flow การทำงาน:**
  1. ลูกค้าพิมพ์หรือกด Rich Menu คำว่า **"ตรวจสอบสถานะ"**
  2. ระบบตอบกลับพร้อมปุ่ม Quick Reply พิเศษ **"ดูเคสล่าสุดทั้งหมด"**
  3. เมื่อแตะปุ่ม ระบบจะส่งข้อความชะลอการรอ *"รับเรื่องแล้วค่ะ รอสักครู่นะคะ"* และเรียกฟังก์ชัน `LIST` จาก Hub ดึงเฉพาะตั๋วที่ยัง Active ของผู้ใช้คนนั้น
  4. บอทแสดงรายการตั๋วพร้อม Bullet Point
  5. ลูกค้าส่งรหัสตั๋วที่ต้องการ ➔ ระบบตอบรายละเอียดสถานะล่าสุด พร้อมข้อความสัญญาเวลา SLA ล่วงหน้า

#### รูปแบบที่ 2: ระบบและทีมงานติดตามเชิงรุก (Proactive Internal Follow-up)
- **พฤติกรรม:** ลูกค้าไม่ต้องเอ่ยปากถาม ระบบและทีมงานคอยสะกิดตามงานและรายงานผลเป็นระยะ
- **กลไกการทำงาน (เพิ่มความถี่สำหรับเคสด่วน 4 ชม.):**
  1. **สะกิด Dev ทุก 1 ชั่วโมง (Internal Push):**
     - *ชั่วโมงที่ 1 (10:05 น.):* เช็คว่าวิเคราะห์ Root Cause เจอหรือยัง ต้องการ Log หรือ Data เพิ่มไหม
     - *ชั่วโมงที่ 2 (11:05 น.):* เช็คความคืบหน้าการแก้ Code/Database ปลดล็อกเกอร์ทันที
     - *ชั่วโมงที่ 3 (12:05 น.):* เช็คสถานะ Build, Deployment และผลเทส
  2. **รายงานลูกค้าทุก 1.5 – 2 ชั่วโมง (Customer Interim Push):**
     - ระบบยิง LINE Push Notification ส่งข้อความสรุปความคืบหน้าให้ลูกค้าทราบตามรอบ
  3. **การจัดการความเสี่ยง (SLA Pre-breach Management):**
     - หากถึงชั่วโมงที่ 3 แล้วงานยังไม่เรียบร้อย ทีมงานจะแจ้ง **ขอขยายเวลาอย่างเป็นทางการล่วงหน้า 30-45 นาที** (ห้ามปล่อยให้เลยกำหนดโดยไม่แจ้ง)

---

### ระยะที่ 3: Resolution & Sync (การแก้ไขและตรวจรับ)
1. **Dev Resolved:** ทีมพัฒนาทำ Patch ขึ้นระบบเสร็จสิ้น และเปลี่ยนสถานะใน Plane.so เป็น `Done`
2. **Reverse Poller / Webhook:** 
   - `PlaneWebhookService` ใน TicketX Backend จะรับ Webhook ทันทีที่มีการเปลี่ยนสถานะ
   - อัปเดตสถานะในตาราง `tickets` เป็น `RESOLVED`
3. **Notify Customer:**
   - ระบบส่ง Push Message แจ้งลูกค้าทาง LINE พร้อมคำแนะนำให้ตรวจสอบข้อมูลในระบบ

---

### ระยะที่ 4: Deterministic Case Closure (การปิดเคสสมบูรณ์)
1. **Onboarding / Menu Integration:**
   - ลูกค้าสามารถแตะการ์ดเมนู **"ปิดเคส"** หรือพิมพ์บอกว่าตรวจสอบเรียบร้อยแล้ว
2. **Deterministic Close Net:**
   - ระบบตรวจจับบริบทการปิดเคสอย่างแม่นยำ ไม่สับสนกับการถามสถานะ
   - ปรับสถานะในฐานข้อมูลเป็น `CLOSED` และส่งสถานะไปปิด Issue ใน Plane.so
3. **Closure Farewell:**
   - ส่งข้อความยืนยันปิดเคสอย่างสุภาพ (ลงท้ายด้วย "ค่ะ/นะคะ") และบันทึกประวัติการสนทนาเข้าฐานข้อมูลอย่างสมบูรณ์

---

## 4. ตารางสรุปหน้าที่และความรับผิดชอบของแต่ละส่วนในระบบ

| ส่วนประกอบ (Component) | บทบาทในระยะที่ 1 (Intake) | บทบาทในระยะที่ 2 (Tracking) | บทบาทในระยะที่ 3-4 (Close) |
| :--- | :--- | :--- | :--- |
| **LINE Official Account** | หน้าด่านรับข้อความ และแสดงปุ่ม Quick Reply ยืนยัน | รองรับเมนูตรวจสอบสถานะ / รับข้อความ Push แจ้งเตือน | รับคำสั่งปิดเคส / แสดงข้อความขอบคุณ |
| **Channel Gateway & Fastify** | ทำ Debounce 15 วิ และตรวจจับ Signature | บริหารคิวข้อความ (Agent Session Queue) | จัดการ Webhook และสิทธิ์การเข้าถึง |
| **Main AI Core & AgentX** | คัดกรอง Intent (ทั่วไป vs เปิดเคส) | แปลงคำถามสถานะ (`LIST` / `GET_STATUS`) | ตรวจจับคำสั่งปิดเคส (Deterministic Close Net) |
| **PostgreSQL (`csdb`)** | บันทึก `tickets`, `messages`, `attachments` | บันทึกประวัติการอัปเดตสถานะและ SLA Due Date | ปรับสถานะเป็น `RESOLVED` / `CLOSED` |
| **Plane.so** | รับ Work Item ไปจัดคิวให้ทีม Dev | ติดตามความคืบหน้าของ Task ใน Sprint | รับการปิดตั๋วเมื่อเคสเสร็จสมบูรณ์ |
| **SLA Monitoring Worker** | คำนวณกรอบเวลา SLA ตามระดับความด่วน | วนลูปสะกิด Dev ทุก 1 ชม. & ยิงเตือนก่อนหลุด SLA | สรุปเวลาที่ใช้ในการแก้ไข (Resolution Time) |
