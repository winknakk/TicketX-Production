# พิมพ์เขียว Master End-to-End Flow: AutomationX & TicketX Lifecycle (ฉบับสมบูรณ์ที่สุด)
**ระบบ:** AutomationX / TicketX Service Management Platform  
**อ้างอิงโค้ดฐานข้อมูลและสเตทแมชชีนจริง:** `TicketLifecycle.ts`, `TicketStateMachine.ts`, `search_project_docs`, `PlaneWebhookService.ts`  
**ขอบเขต:** ครอบคลุมครบทุกเส้นทาง 100% ไม่มีจุดลอยหรือเส้นขาด:  
1. **Intake & Multi-Path Triage:** FAQ, Information (ค้นหาคลังความรู้ `search_project_docs` + ส่งต่อเจ้าหน้าที่ `Human Takeover`), และ Bug / Defect  
2. **Confirmation & Provisioning:** สรุปปัญหา ➔ ยืนยัน ➔ สร้างตั๋ว (`NEW` ➔ `IN_PROGRESS`)  
3. **Dual-Track Monitoring & Status Engine:** การติดตามคู่ขนาน ทั้งฝั่ง Dev (สะกิดทุก 1 ชม.), ฝั่งลูกค้าติดตามเชิงรุก (Interim update), และฝั่งลูกค้ากดดูเอง (Inbound Check Status) ซึ่งเชื่อมโยงกับสถานะจริงในระบบ (`IN_PROGRESS`, `WAITING_CUSTOMER`, `WAITING_INTERNAL`)  
4. **Resolution (Asymmetric Boundary):** Dev Done ใน Plane.so ➔ ซิงค์เป็น `RESOLVED` ➔ ส่งแจ้งเตือนลูกค้าตรวจรับ (UAT)  
5. **Verification & Closure Decision:**  
   - **ผ่าน (Pass):** `CUSTOMER_CONFIRMED` ➔ `CLOSED` ➔ ซิงค์ปิด Plane.so ➔ จบกระบวนการ  
   - **ไม่ผ่าน (Fail - Bug เดิม):** `REOPENED` ➔ วนกลับไปที่ `IN_PROGRESS` ให้ Dev แก้ไขต่อใน Ticket เดิม  
   - **ไม่ผ่าน (Fail - Bug ใหม่):** แยกเป็นเคสใหม่ ➔ วนกลับไปที่จุดเริ่มต้น `START` เพื่อเปิดตั๋วใหม่  

---

## 1. ผังรวมระดับ Master E2E Flow (เชื่อมโยงสมบูรณ์ทุกสถานะ)

```mermaid
flowchart TD
    %% STAGE 1: INTAKE & TRIAGE
    subgraph S1["ระยะที่ 1: รับเรื่องและจำแนกประเภท (Intake & Triage)"]
        Start(["● START: ลูกค้าทักแชต LINE OA"]) --> Ingest["Channel Gateway: Debounce (15s)"]
        Ingest --> Triage{"AI วิเคราะห์จำแนกประเภทคำขอ"}
        
        %% Path 1: FAQ
        Triage -- "1. FAQ (คำถามพบบ่อย)" --> FastFAQ["บอทตอบคำถามทันที (Fast Path)<br>อิงจากความรู้พื้นฐาน"]
        FastFAQ --> EndFAQ(["● END: จบการสนทนา (ไม่เปิดตั๋ว)"])
        
        %% Path 2: Information
        Triage -- "2. Information (ขอข้อมูล/คู่มือ)" --> CallDocs["เรียกใช้ Tool: search_project_docs<br>ค้นหาในคลังเอกสารของโปรเจกต์"]
        CallDocs --> CheckDocsFound{"พบข้อมูลในเอกสารหรือไม่?"}
        CheckDocsFound -- "พบข้อมูล" --> AnsInfo["สรุปคำตอบ 1-2 ประเด็นตรงจุด<br>พร้อมแนบลิงก์คู่มือให้ลูกค้า"]
        AnsInfo --> EndInfo(["● END: จบการสนทนา (ไม่เปิดตั๋ว)"])
        CheckDocsFound -- "ไม่พบข้อมูล (ANSWER_NOT_FOUND)" --> InfoEscalate{"ลูกค้าต้องการสอบถาม<br>เจ้าหน้าที่เพิ่มเติมหรือไม่?"}
        InfoEscalate -- "ไม่ต้องการ" --> EndInfoNo
        InfoEscalate -- "ต้องการ" --> HumanTakeover["เรียก Tool: escalate_to_pm / Human Takeover<br>ส่งต่อห้องแชตให้เจ้าหน้าที่ดูแลต่อ"]
        HumanTakeover --> EndHuman(["● เจ้าหน้าที่รับช่วงต่อ"])
        
        %% Path 3: Bug / Defect
        Triage -- "3. Bug / Defect (ระบบมีปัญหา)" --> GenSummary["AI สรุปปัญหา (Subsystem, Symptom, Priority)<br>ส่งปุ่ม Quick Reply: [ยืนยัน] [แก้ไข/ยกเลิก]"]
        GenSummary --> CustConfirm{"ลูกค้ายืนยันความถูกต้อง?"}
        CustConfirm -- "ไม่ยืนยัน / ขอแก้ข้อมูล" --> ReqMore["ขอข้อมูลเพิ่มเติม / ปรับปรุงรายละเอียด"]
        ReqMore --> GenSummary
        CustConfirm -- "ยืนยัน (Confirm)" --> ProvisionTicket["สร้าง Ticket ใน PostgreSQL (สถานะ: NEW)<br>+ Push Work Item เข้า Plane.so<br>+ คำนวณเวลา SLA (เช่น 4 ชม.)"]
    end

    %% STAGE 2: EXECUTION & STATUS ENGINE
    subgraph S2["ระยะที่ 2: ดำเนินการ & ระบบติดตามคู่ขนาน (Execution & Monitoring Engine)"]
        ProvisionTicket --> StateInProgress["ตั๋วเข้าสู่สถานะ: IN_PROGRESS<br>(Dev รับเรื่องและเริ่มวิเคราะห์)"]
        
        %% รอข้อมูลจากลูกค้า
        StateInProgress <-->|"Dev ขอข้อมูลเพิ่ม / ลูกค้าส่งข้อมูล"| StateWaitCust["สถานะ: WAITING_CUSTOMER<br>(รอข้อมูลเพิ่มเติมจากลูกค้า)"]
        
        %% Monitoring Track A: Customer Inbound Check
        subgraph TrackA["【Track A: ลูกค้ากดตรวจสอบสถานะเอง】"]
            CustCheck["ลูกค้าพิมพ์ 'ตรวจสอบสถานะ' / กดปุ่มเมนู"] --> CustList["กด Quick Reply 'ดูเคสล่าสุดทั้งหมด' (LIST)"]
            CustList --> CustPick["เลือกเลขเคส (เช่น TCK-2026-46939)"]
            CustPick --> ReadStatus["ระบบอ่านสถานะ Real-time จากฐานข้อมูล<br>(TicketLifecycle State Machine)"]
        end
        StateInProgress -.-> ReadStatus
        StateWaitCust -.-> ReadStatus
        
        ReadStatus --> ReturnStatusReport["บอทรายงานสถานะปัจจุบัน + เวลา SLA ที่เหลือ<br>+ แนบปุ่มดำเนินการตามสถานะนั้นๆ"]
        
        %% Monitoring Track B: Proactive High-Frequency Alerts
        subgraph TrackB["【Track B: ระบบและทีมติดตามเชิงรุก (เพิ่มความถี่)】"]
            WorkerScan["SLA Worker ตรวจสอบตั๋ว Urgent ทุก 15 นาที"] --> DevCheckInterval["สะกิด Dev ทุก 1 ชม.<br>(1h: Root Cause / 2h: Code / 3h: Deploy)"]
            DevCheckInterval --> CheckBlocker{"พบ Blocker หรือ<br>มีแววช้ากว่า SLA?"}
            CheckBlocker -- "เสี่ยงหลุด SLA" --> PreBreachAlert["Escalate ถึง Lead & ส่งข้อความ<br>ขอขยายเวลากับลูกค้าล่วงหน้า 30-45 นาที"]
            CheckBlocker -- "คืบหน้าตามแผน" --> CustInterimPush["ส่ง LINE Push Update ให้ลูกค้าทุก 1.5 - 2 ชม.<br>(รายงานความคืบหน้าระหว่างทาง)"]
        end
        StateInProgress -.-> WorkerScan
    end

    %% STAGE 3: RESOLUTION & UAT
    subgraph S3["ระยะที่ 3: แก้ไขเสร็จสิ้น & ตรวจรับ (Resolution & Verification UAT)"]
        DevCheckInterval --> DevDeployDone["Dev แก้ไขโค้ด/ดาต้า ➔ เทสต์ผ่าน ➔ Deploy สำเร็จ ✓<br>ปรับสถานะใน Plane.so เป็น 'Done'"]
        DevDeployDone --> PlaneWebhook["Plane Webhook / Reverse Poller ทำงาน<br>(Asymmetric Boundary: Done ➔ RESOLVED)"]
        PlaneWebhook --> StateResolved["ตั๋วเข้าสู่สถานะ: RESOLVED<br>(งานเทคนิคเสร็จแล้ว รอลูกค้าตรวจรับ)"]
        
        StateResolved --> PushUAT["ส่งแจ้งเตือนลูกค้าทาง LINE:<br>'แก้ไขเรียบร้อยแล้ว กรุณาตรวจสอบความถูกต้อง'<br>พร้อม Quick Reply: [ผ่าน / ปิดเคส] [ไม่ผ่าน]"]
        ReturnStatusReport -.->|"กรณีตั๋วอยู่สถานะ RESOLVED"| PushUAT
    end

    %% STAGE 4: VERIFICATION & CLOSURE
    subgraph S4["ระยะที่ 4: การปิดเคส และการแยกกรณีไม่ผ่าน (Verification & Closure Decision)"]
        PushUAT --> CustVerify{"ผลการตรวจสอบของลูกค้า<br>(ผ่าน หรือ ไม่ผ่าน?)"}
        
        %% Path Pass
        CustVerify -- "1. ผ่าน (Pass)" --> StateConfirmed["ตั๋วเข้าสู่สถานะ: CUSTOMER_CONFIRMED"]
        StateConfirmed --> StateClosed["ตั๋วเข้าสู่สถานะ: CLOSED (Terminal)<br>+ ซิงค์ปิด Issue ใน Plane.so<br>+ ส่งข้อความขอบคุณลูกค้า"]
        StateClosed --> EndSuccess(["● END: ปิดเคสสมบูรณ์"])
        
        %% Path Fail
        CustVerify -- "2. ไม่ผ่าน (Fail)" --> EvaluateFail{"ประเมินอาการที่ไม่ผ่าน"}
        
        %% Same Bug
        EvaluateFail -- "Bug เดิม (จุดเดิมยังไม่หาย)" --> StateReopened["ตั๋วเข้าสู่สถานะ: REOPENED<br>【ใช้ Ticket เดิม】 ไม่เปิดตั๋วใหม่ซ้ำซ้อน<br>แนบรายละเอียดที่ลูกค้าแจ้งกลับเข้า Plane.so"]
        StateReopened --> StateInProgress
        
        %% New Bug
        EvaluateFail -- "Bug ใหม่ (เป็นอาการอื่นที่จุดใหม่)" --> BranchNewTicket["【เปิด Ticket ใหม่】<br>ปิดหรือแยกขอบเขตตั๋วเดิม<br>นำอาการใหม่เข้าสู่กระบวนการเปิดเคส"]
        BranchNewTicket --> Start
    end

    EndInfoNo(["● END: จบการสนทนา"])
```

---

## 2. เจาะลึก Flow ปัญหาประเภท "Information" (พร้อมคลังเอกสาร & Human Takeover)

ในระบบ AutomationX ปัญหาประเภท `Information` ไม่ใช่แค่ตอบข้อความเปล่าๆ แต่มี Sub-flow ที่สมบูรณ์ตามมาตรฐานระบบ:

```mermaid
flowchart TD
    InboundInfo["ลูกค้าสอบถามข้อมูลทั่วไป / ขั้นตอน / ระเบียบ / คู่มือ"] --> CallTool["AgentX เรียก Tool: search_project_docs(query, project_id)"]
    CallTool --> VectorSearch[("ค้นหา Semantic & Keyword ในคลังความรู้<br>PostgreSQL pgvector / Knowledge Base")]
    
    VectorSearch --> HasEvidence{"พบคู่มือหรือเอกสาร<br>ที่ตรงกับคำถามหรือไม่?"}
    
    %% กรณีพบ
    HasEvidence -- "พบเอกสารตรงจุด" --> FormatAns["AI สรุปคำตอบ 1-2 ประเด็นหลักอย่างกระชับ<br>พร้อมแนบขั้นตอนและลิงก์เอกสารอ้างอิง"]
    FormatAns --> AskMore["ลงท้าย: 'อยากรู้เรื่องไหนเพิ่มเติมก็ถามต่อได้เลยนะคะ'"]
    AskMore --> DoneInfo(["จบเทิร์น (ไม่เปิดตั๋ว)"])
    
    %% กรณีไม่พบ
    HasEvidence -- "ไม่พบเอกสาร (ANSWER_NOT_FOUND)" --> NoHallucinate["AI ไม่คาดเดาข้อมูลเอง (No Hallucination)<br>แจ้งลูกค้าอย่างสุภาพว่าไม่พบข้อมูลในคู่มือปัจจุบัน"]
    NoHallucinate --> OfferOption{"ให้ตัวเลือกลูกค้าผ่าน Quick Reply"}
    
    OfferOption -- "1. ต้องการคุยกับเจ้าหน้าที่" --> DoTakeover["เรียก escalate_to_pm / Human Takeover<br>แจ้งเตือน Admin ในระบบ TicketX<br>เพื่อส่งต่อบทสนทนาให้คนเข้ามารับช่วง"]
    OfferOption -- "2. ประสานงานเปิดตั๋วสอบถาม" --> RouteToTicket["ส่งต่อไปยังกระบวนการเปิด Ticket<br>(ประเภท: Inquiry / Request)"]
    OfferOption -- "3. ไม่ต้องการอะไรเพิ่ม" --> ByeInfo["ขอบคุณลูกค้าและจบการสนทนา"]
```

---

## 3. วงจรชีวิตของสถานะตั๋ว (Ticket Lifecycle State Machine)

ในโค้ด `system/backend/src/domain/ticket/TicketLifecycle.ts` และ `TicketStateMachine.ts` สถานะของตั๋วถูกควบคุมอย่างเข้มงวด ดังนี้:

| สถานะใน TicketX (Customer Lifecycle) | ความหมายและบริบทการทำงาน | สถานะที่เชื่อมกับ Plane.so | ใครเป็นคนเปลี่ยนสถานะได้ (Actor) |
| :--- | :--- | :--- | :--- |
| `NEW` | ตั๋วถูกสร้างขึ้นในระบบ รอการจัดคิว | `Backlog` | System / Operator |
| `TRIAGED` | ผ่านการคัดกรองและประเมินเบื้องต้นแล้ว | `Backlog` | Operator / System |
| `IN_PROGRESS` | ทีม Dev กำลังดำเนินการตรวจสอบและแก้ไข | `Open` | Dev (Plane) / Operator |
| `WAITING_CUSTOMER` | ทีมงานขอข้อมูลเพิ่มเติมจากลูกค้า (เช่น ขอรูป Log เพิ่ม) | `Open` | Operator / System |
| `WAITING_INTERNAL` | รอการประสานงานภายในระหว่างทีม | `Open` | Operator / System |
| **`RESOLVED`** | **Dev แก้ไขเสร็จ (Done ใน Plane) ➔ ส่งให้ลูกค้าตรวจรับ (UAT)** | **`Done`** | **Plane / System (ไม่ใช่ Closed!)** |
| `CUSTOMER_CONFIRMED` | ลูกค้าตรวจสอบแล้วยืนยันว่า "ผ่าน" | `Done` | **Customer เท่านั้น** |
| **`CLOSED`** | ตั๋วถูกปิดอย่างเป็นทางการ (Terminal State) | **`Done`** | **Customer / System** |
| **`REOPENED`** | **ลูกค้าแจ้ง "ไม่ผ่าน" (Bug เดิม) ➔ วนกลับไปแก้ต่อ** | **`Open`** | **Customer / Operator** |
| `CANCELLED` | ยกเลิกเคส (เช่น ลูกค้าแจ้งยกเลิกก่อนเริ่มงาน) | `Cancelled` | Customer / Operator |

> [!IMPORTANT]
> **หลักการ Asymmetric Boundary (ความปลอดภัยของสถานะ):**  
> เมื่อทีม Dev แก้ไขงานเสร็จใน Plane.so และปรับสถานะเป็น `Done` ระบบจะเปลี่ยนสถานะใน TicketX เป็น **`RESOLVED` เท่านั้น (ห้ามเปลี่ยนเป็น `CLOSED` เด็ดขาด)**  
> เพราะ *"การที่ Dev ทำเสร็จ ไม่ได้แปลว่าปัญหาได้รับการแก้ไขถูกต้องในมุมมองของลูกค้า"* ตั๋วจะปิดเป็น `CLOSED` ได้ก็ต่อเมื่อ **ลูกค้าเป็นผู้ยืนยันตรวจรับด้วยตนเอง** เท่านั้น!

---

## 4. รายละเอียดจุดเชื่อมโยงของการตรวจสอบสถานะ (Track A ที่ไม่ขาดตอน)

จากข้อสังเกตเรื่องสถานะที่หายไป เมื่อลูกค้ากดดูสถานะในแชต:
1. **เมื่อลูกค้าพิมพ์ `"ตรวจสอบสถานะ"` ➔ กด `"ดูเคสล่าสุดทั้งหมด"`:**
   - ระบบจะ Query รายการตั๋วที่ยังไม่ปิด (`status NOT IN ('CLOSED', 'CANCELLED')`)
2. **เมื่อเลือกรหัสตั๋ว เช่น `TCK-2026-46939`:**
   - ระบบอ่านค่าจาก `TicketStateMachine`
   - **ถ้าสถานะคือ `IN_PROGRESS`:** บอทจะรายงานความคืบหน้า + เวลา SLA เป้าหมาย + แจ้งว่าทีมงานกำลังเร่งดำเนินการ
   - **ถ้าสถานะคือ `WAITING_CUSTOMER`:** บอทจะขึ้นข้อความเตือนว่า *"ทีมงานกำลังรอข้อมูล [เรื่องที่ขอ] เพิ่มเติมจากคุณลูกค้าอยู่นะคะ"*
   - **ถ้าสถานะคือ `RESOLVED` (งานเสร็จแล้วรอลูกค้าตรวจ):** บอทจะไม่ใช่แค่บอกสถานะ แต่จะ **แนบปุ่มยืนยันผลตรวจรับ UAT ทันที**:
     - ปุ่ม **[ ตรวจสอบแล้ว ถูกต้อง (ปิดเคส) ]**
     - ปุ่ม **[ ยังพบปัญหา (ไม่ผ่าน) ]**
   - **ทำให้เส้นทางของลูกค้า (Track A) เชื่อมโยงกลับเข้าสู่กระบวนการปิดเคส (Stage 4) ได้ทันทีโดยไม่มีจุดตัน!**

---

## 5. การจัดการตอนปิดเคสแบบละเอียด: "ผ่าน" vs "ไม่ผ่าน (Bug เดิม vs Bug ใหม่)"

```mermaid
sequenceDiagram
    autonumber
    actor Customer as ลูกค้า (LINE OA)
    participant Core as AutomationX Backend
    participant SM as Ticket State Machine
    participant Plane as Plane.so (Dev)

    Note over Customer, Plane: ขั้นตอนส่งมอบงานและการตรวจรับ (UAT)
    Plane->>Core: Dev ปรับสถานะเป็น Done
    Core->>SM: transition(to: 'RESOLVED', actor: 'plane')
    SM-->>Core: Status = RESOLVED
    Core-->>Customer: Push แจ้งเตือน: "ระบบแก้ไขเรียบร้อยแล้วค่ะ รบกวนตรวจสอบนะคะ"<br>พร้อมตัวเลือก: [ ผ่าน / ปิดเคส ] [ ไม่ผ่าน ]

    alt 1. ลูกค้าตรวจแล้ว "ผ่าน" (Pass)
        Customer->>Core: แตะปุ่ม "ผ่าน / ปิดเคส"
        Core->>SM: transition(to: 'CUSTOMER_CONFIRMED', actor: 'customer')
        Core->>SM: transition(to: 'CLOSED', actor: 'system')
        Core->>Plane: Sync Closure to Plane (Close Work Item)
        Core-->>Customer: "ปิดเคสเรียบร้อยค่ะ ขอบคุณที่ใช้บริการนะคะ 🙏"
    else 2. ลูกค้าตรวจแล้ว "ไม่ผ่าน" — เป็น Bug เดิม
        Customer->>Core: แตะปุ่ม "ไม่ผ่าน" + ระบุ: "ชื่อเจ้าหน้าที่ยังเป็น NULL เหมือนเดิม"
        Core->>SM: transition(to: 'REOPENED', actor: 'customer', reason: 'Same Bug persists')
        Core->>Plane: Reopen Issue ➔ State: Open + Post Comment อาการที่ลูกค้าแจ้ง
        Core->>Core: แจ้งเตือนด่วนเข้ากลุ่ม Dev ทันที
        Core-->>Customer: "รับทราบค่ะ ทีมงานขออภัยด้วยนะคะ กำลังเร่งตรวจสอบในเคสเดิม (TCK-2026-46939) ให้อีกครั้งทันทีค่ะ"
    else 3. ลูกค้าตรวจแล้ว "ไม่ผ่าน" — เป็น Bug ใหม่
        Customer->>Core: แตะปุ่ม "ไม่ผ่าน" + ระบุ: "ชื่อขึ้นแล้ว แต่ยอดสุทธิคำนวณผิด"
        Core->>Core: วิเคราะห์พบเป็นอาการใหม่นอกเหนือสโคปเดิม
        Core->>SM: transition(to: 'CUSTOMER_CONFIRMED', actor: 'system') ➔ ปิดตั๋วเดิม
        Core-->>Customer: "สำหรับปัญหายอดสุทธิคำนวณผิด เป็นข้อผิดพลาดคนละส่วนกัน ขออนุญาตเปิดเป็นเคสใหม่เพื่อติดตามให้นะคะ"
        Core->>Core: ส่งเรื่องวนกลับไปที่ START ➔ สร้าง Ticket รหัสใหม่ (TCK ตัวใหม่)
    end
```
