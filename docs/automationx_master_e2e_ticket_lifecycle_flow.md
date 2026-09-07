# พิมพ์เขียว Master End-to-End Flow: AutomationX & TicketX Lifecycle (ฉบับสมบูรณ์ที่สุด)
**ระบบ:** AutomationX / TicketX Service Management Platform  
**อ้างอิงข้อกำหนดเพิ่มเติมจากทีม AppSup:**  
เมื่อ Dev แก้ไขปัญหาเสร็จ จะมีขั้นตอนการตรวจสอบ 2 ระดับใน Plane.so ก่อนส่งถึงลูกค้า:
1. **`AppSup Test`:** ให้ทีม AppSup ตรวจสอบความถูกต้องภายในก่อน (หากไม่ผ่าน ตีกลับให้ Dev แก้ต่อทันที โดยลูกค้าไม่ต้องรับรู้)
2. **`Customer Test`:** เมื่อ AppSup ตรวจผ่าน จะเปลี่ยนสถานะเป็น `Customer Test` ซึ่งระบบจะ **ทริกเกอร์ส่ง LINE Push แจ้งเตือนลูกค้าให้เข้าตรวจรับ (UAT)**  
**วันที่ปรับปรุง:** 2026-09-07  

---

## 1. ผังรวมระดับ Master E2E Flow (พร้อมขั้นตอน AppSup Test ➔ Customer Test)

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

    %% STAGE 3: RESOLUTION & 2-STEP VERIFICATION (APPSUP TEST -> CUSTOMER TEST)
    subgraph S3["ระยะที่ 3: ตรวจสอบ 2 ระดับ (AppSup Test ➔ Customer Test)"]
        DevCheckInterval --> DevDone["Dev แก้ไขเสร็จสิ้น ➔ อัปเดตใน Plane.so"]
        DevDone --> StateAppSupTest["【สถานะที่ 1: AppSup Test】<br>(ส่งให้ทีม AppSup ทดสอบภายในก่อน)"]
        
        StateAppSupTest --> AppSupCheck{"AppSup ทดสอบภายใน<br>ผ่านหรือไม่?"}
        AppSupCheck -- "ไม่ผ่าน (Fail)" --> DevRework["ตีกลับให้ Dev แก้ไขต่อทันที<br>(ลูกค้าไม่ถูกรบกวน)"]
        DevRework --> StateInProgress
        
        AppSupCheck -- "ผ่าน (Pass)" --> StateCustomerTest["【สถานะที่ 2: Customer Test】<br>(ปรับสถานะใน Plane.so เป็น Customer Test)"]
        
        StateCustomerTest --> PlaneWebhook["Plane Webhook ซิงค์สถานะเข้า TicketX<br>(Mapping: Customer Test ➔ RESOLVED)"]
        PlaneWebhook --> PushUAT["⚡ ระบบส่ง LINE Push Notification อัตโนมัติ:<br>'ระบบแก้ไขและตรวจสอบเบื้องต้นแล้ว<br>รบกวนคุณลูกค้าเข้าตรวจสอบและยืนยันค่ะ'<br>พร้อม Quick Reply: [ผ่าน / ปิดเคส] [ไม่ผ่าน]"]
        ReturnStatusReport -.->|"กรณีตั๋วอยู่สถานะ Customer Test"| PushUAT
    end

    %% STAGE 4: VERIFICATION & CLOSURE
    subgraph S4["ระยะที่ 4: การปิดเคส และการแยกกรณีไม่ผ่าน (Verification & Closure Decision)"]
        PushUAT --> CustVerify{"ผลการตรวจสอบของลูกค้า<br>(ผ่าน หรือ ไม่ผ่าน?)"}
        
        %% Path Pass
        CustVerify -- "1. ผ่าน (Pass)" --> StateConfirmed["ตั๋วเข้าสู่สถานะ: CUSTOMER_CONFIRMED"]
        StateConfirmed --> StateClosed["ตั๋วเข้าสู่สถานะ: CLOSED (Terminal)<br>+ ซิงค์ปิด Issue ใน Plane.so เป็น Done/Closed<br>+ ส่งข้อความขอบคุณลูกค้า"]
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

## 2. ลำดับขั้นตอนการทำงานในช่วง AppSup Test ➔ Customer Test

```mermaid
sequenceDiagram
    autonumber
    actor Dev as ทีมพัฒนา (Dev)
    actor AppSup as ทีม AppSup (Support/QA)
    participant Plane as Plane.so (Work Board)
    participant Core as AutomationX Backend
    actor Customer as ลูกค้า (LINE OA)

    Note over Dev, AppSup: 1. ขั้นตอน AppSup Test (ตรวจสอบภายใน)
    Dev->>Plane: แก้ไขปัญหาเสร็จ ➔ ปรับสถานะเป็น "AppSup Test"
    Plane-->>AppSup: แจ้งเตือน AppSup ให้เข้าทดสอบในสภาพแวดล้อม Staging/UAT
    
    alt กรณี AppSup ทดสอบแล้ว "ไม่ผ่าน" (Internal Reject)
        AppSup->>Plane: ปรับสถานะกลับเป็น "In Progress" + แนบ Log ที่พบบั๊ก
        Plane-->>Dev: แจ้งเตือน Dev ให้กลับไปแก้ไขต่อ (ลูกค้ายังไม่โดนกวนใจ)
    else กรณี AppSup ทดสอบแล้ว "ผ่าน" (Internal Approved)
        AppSup->>Plane: ปรับสถานะใน Plane.so เป็น "Customer Test"
        
        Note over Plane, Customer: 2. ขั้นตอน Customer Test (ส่งมอบให้ลูกค้าตรวจรับ)
        Plane->>Core: Webhook Event: Status changed to "Customer Test"
        Core->>Core: อัปเดตสถานะใน TicketX เป็น "RESOLVED" (รอผลตรวจรับ)
        Core->>Customer: ⚡ ส่ง LINE Push Notification อัตโนมัติ:<br>"เรียน คุณลูกค้า เคส TCK-2026-46939 ได้รับการแก้ไขและทดสอบเบื้องต้นเรียบร้อยแล้วค่ะ รบกวนเข้าตรวจสอบความถูกต้องของข้อมูลนะคะ" [ผ่าน / ปิดเคส] [ไม่ผ่าน]
        
        alt ลูกค้าตรวจรับแล้ว "ผ่าน" (Customer Confirmed)
            Customer->>Core: แตะปุ่ม "ผ่าน / ปิดเคส"
            Core->>Plane: Sync ปิดเคส ➔ ปรับสถานะเป็น "Done / Closed"
            Core-->>Customer: "ปิดเคสเรียบร้อยค่ะ ขอบคุณที่ใช้บริการนะคะ 🙏"
        else ลูกค้าตรวจรับแล้ว "ไม่ผ่าน" (Customer Failed)
            Customer->>Core: แตะปุ่ม "ไม่ผ่าน" + แจ้งอาการ
            Core->>Plane: Reopen Work Item ➔ สถานะ "In Progress" พร้อมส่ง Comment ลูกค้าให้ทีม
        end
    end
```

---

## 3. ตารางสถานะที่เชื่อมโยงระหว่าง Plane.so และ TicketX

| ขั้นตอนการทำงาน | สถานะใน Plane.so | สถานะใน TicketX | การกระทำของระบบ (System Action) |
| :--- | :--- | :--- | :--- |
| รับเรื่อง / เปิดเคส | `Backlog` / `Todo` | `NEW` / `TRIAGED` | สร้างตั๋วงาน แจ้งเลขเคสและ SLA แก่ลูกค้า |
| Dev กำลังแก้ปัญหา | `In Progress` | `IN_PROGRESS` | ระบบวนลูปสะกิด Dev ทุก 1 ชม. / ส่ง Interim Update ลูกค้า |
| Dev ทำเสร็จ ส่งตรวจภายใน | **`AppSup Test`** | `WAITING_INTERNAL` | **AppSup ทำการทดสอบระบบภายใน (ยังไม่แจ้งลูกค้า)** |
| AppSup เทสไม่ผ่าน | `In Progress` | `IN_PROGRESS` | ตีกลับให้ Dev แก้ต่อทันที โดยลูกค้าไม่เสียเวลา |
| AppSup เทสผ่าน | **`Customer Test`** | **`RESOLVED`** | **ระบบยิง LINE Push เตือนลูกค้าให้ตรวจรับทันที!** |
| ลูกค้ายืนยันว่า "ผ่าน" | `Done` / `Closed` | `CUSTOMER_CONFIRMED` ➔ `CLOSED` | ปิดเคสสมบูรณ์ บันทึกประวัติและส่งข้อความขอบคุณ |
| ลูกค้าแจ้ง "ไม่ผ่าน" (Bug เดิม) | `In Progress` / `Reopened` | `REOPENED` ➔ `IN_PROGRESS` | นำข้อมูลลูกค้าส่งต่อให้ Dev แก้ไขต่อในตั๋วเดิม |
| ลูกค้าแจ้ง "ไม่ผ่าน" (Bug ใหม่) | `Done` (ตั๋วเดิม) / เปิดใหม่ | `CLOSED` (เดิม) / `NEW` (ใหม่) | ปิดตั๋วเดิม และเปิดตั๋วใหม่สำหรับอาการใหม่ |

---

## 4. ตัวอย่างข้อความแจ้งเตือนเมื่อเข้าสู่สถานะ `Customer Test`

เมื่อทีม AppSup เปลี่ยนสถานะใน Plane.so เป็น `Customer Test` บอทจะยิงข้อความเข้า LINE ลูกค้าทันที:

```text
เรียน คุณลูกค้า (แจ้งผลการแก้ไขเพื่อตรวจสอบ: TCK-2026-46939) 📌

ขณะนี้ทีมงานได้ดำเนินการแก้ไขปัญหาข้อมูลใบรับรองการจ่ายเงินเดือน (SLIP) และผ่านการตรวจสอบความถูกต้องเบื้องต้นจากทีมสนับสนุนระบบ (AppSup) เรียบร้อยแล้วค่ะ

🔹 รายละเอียดเคส: TCK-2026-46939
🔹 สถานะปัจจุบัน: Customer Test (พร้อมให้คุณลูกค้าเข้าตรวจรับ)

รบกวนคุณลูกค้าเข้าตรวจสอบความถูกต้องของข้อมูลในระบบได้ตามปกติค่ะ เมื่อตรวจสอบเรียบร้อยแล้ว สามารถกดปุ่มด้านล่างเพื่อยืนยันได้เลยนะคะ:
[ ตรวจสอบแล้ว ถูกต้อง (ปิดเคส) ]   [ ยังพบปัญหา (ไม่ผ่าน) ]

หากมีข้อติดขัดประการใด สามารถแจ้งทีมงานกลับมาได้ทันทีนะคะ ขอบคุณค่ะ 🙏
```
