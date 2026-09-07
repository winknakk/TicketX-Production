# Master End-to-End Ticket Lifecycle Blueprint: AutomationX & TicketX (100% Complete Edition)
**System:** AutomationX / TicketX Service Management Platform  
**Codebase Sources of Truth:** `TicketLifecycle.ts`, `TicketStateMachine.ts`, `search_project_docs`, `PlaneWebhookService.ts`  
**Scope:** 100% Complete & Unbroken End-to-End Flow:  
1. **Intake & Multi-Path Triage:** FAQ, Information (via `search_project_docs` & `Human Takeover`), Bug / Defect  
2. **Confirmation & Provisioning:** Summarize ➔ Confirmation Gating ➔ Ticket Creation (`NEW` ➔ `IN_PROGRESS`)  
3. **Execution & Real-Time Status Engine:** Hourly Dev Reminders, Customer Proactive Push, and Customer Self-Service Inquiry seamlessly connected to live lifecycle states (`IN_PROGRESS`, `WAITING_CUSTOMER`, `WAITING_INTERNAL`)  
4. **Resolution (Asymmetric Boundary):** Plane `Done` ➔ `RESOLVED` ➔ Automatic UAT Prompt to Customer  
5. **Verification & Closure Decision:**  
   - **Pass:** `CUSTOMER_CONFIRMED` ➔ `CLOSED` (Terminal) ➔ Sync Done to Plane.so  
   - **Fail (Same Bug):** `REOPENED` ➔ Reuse Original Ticket ➔ Back to `IN_PROGRESS`  
   - **Fail (New Bug):** Isolate / Close original ➔ Route to `START` for New Ticket Creation  
**Date:** September 7, 2026  

---

## 1. Master E2E Lifecycle Flowchart (100% Connected)

```mermaid
flowchart TD
    %% STAGE 1: INTAKE & TRIAGE
    subgraph S1["Stage 1: Intake & Multi-Path Triage"]
        Start(["● START: Customer sends message via LINE OA"]) --> Ingest["Channel Gateway: Ingestion & Debounce (15s)"]
        Ingest --> Triage{"AI Intent Classification & Triage"}
        
        %% Path 1: FAQ
        Triage -- "1. FAQ" --> FastFAQ["Instant Answer via Fast Path<br>(Standard Static Knowledge)"]
        FastFAQ --> EndFAQ(["● END: Turn Complete (No Ticket)"])
        
        %% Path 2: Information
        Triage -- "2. Information" --> CallDocs["Invoke Tool: search_project_docs<br>Query Project Knowledge Base (pgvector)"]
        CallDocs --> CheckDocsFound{"Knowledge Base Evidence Found?"}
        CheckDocsFound -- "Evidence Found" --> AnsInfo["Synthesize 1-2 Direct Points<br>+ Attach Manual / Reference Link"]
        AnsInfo --> EndInfo(["● END: Turn Complete (No Ticket)"])
        CheckDocsFound -- "Not Found (ANSWER_NOT_FOUND)" --> InfoEscalate{"Does customer want<br>officer assistance?"}
        InfoEscalate -- "No" --> EndInfoNo
        InfoEscalate -- "Yes" --> HumanTakeover["Invoke Tool: escalate_to_pm / Human Takeover<br>Handoff conversation to Support Admin"]
        HumanTakeover --> EndHuman(["● Officer Takeover Active"])
        
        %% Path 3: Bug / Defect
        Triage -- "3. Bug / Defect" --> GenSummary["AI Summarizes Subsystem, Symptom, Priority<br>Emits Quick Reply: [ Confirm ] [ Edit/Cancel ]"]
        GenSummary --> CustConfirm{"Customer Confirms Details?"}
        CustConfirm -- "Edit / Incomplete" --> ReqMore["Request More Information / Refine"]
        ReqMore --> GenSummary
        CustConfirm -- "Confirm" --> ProvisionTicket["Create Ticket in PostgreSQL (Status: NEW)<br>+ Push Work Item to Plane.so<br>+ Calculate Target SLA (e.g. 4h)"]
    end

    %% STAGE 2: EXECUTION & STATUS ENGINE
    subgraph S2["Stage 2: Execution & Monitoring Engine"]
        ProvisionTicket --> StateInProgress["Ticket State: IN_PROGRESS<br>(Dev team analyzes & implements)"]
        
        %% Waiting Customer Loop
        StateInProgress <-->|"Dev requests info / Customer replies"| StateWaitCust["Ticket State: WAITING_CUSTOMER<br>(Awaiting user details)"]
        
        %% Monitoring Track A: Customer Inbound Check
        subgraph TrackA["【Track A: Customer Self-Service Inquiry】"]
            CustCheck["Customer types 'Check Status' / taps menu"] --> CustList["Taps Quick Reply 'View all recent cases' (LIST)"]
            CustList --> CustPick["Selects Ticket ID (e.g. TCK-2026-46939)"]
            CustPick --> ReadStatus["Query Live Status from TicketStateMachine"]
        end
        StateInProgress -.-> ReadStatus
        StateWaitCust -.-> ReadStatus
        
        ReadStatus --> ReturnStatusReport["Bot reports Current Stage + Remaining SLA Time<br>+ Attaches Contextual Action Buttons"]
        
        %% Monitoring Track B: Proactive High-Frequency Alerts
        subgraph TrackB["【Track B: Proactive High-Frequency Alerts】"]
            WorkerScan["SLA Worker scans Urgent tickets every 15m"] --> DevCheckInterval["Hourly Dev Reminders<br>(1h: Root Cause / 2h: Code / 3h: Deploy)"]
            DevCheckInterval --> CheckBlocker{"Blocker Encountered or<br>Risk of SLA Breach?"}
            CheckBlocker -- "Breach Risk" --> PreBreachAlert["Escalate to Lead & Send Proactive<br>30-45m Pre-breach Extension Request"]
            CheckBlocker -- "On Schedule" --> CustInterimPush["Push LINE Update to Customer every 1.5 - 2h<br>(Unsolicited Progress Report)"]
        end
        StateInProgress -.-> WorkerScan
    end

    %% STAGE 3: RESOLUTION & UAT
    subgraph S3["Stage 3: Resolution & Verification (UAT)"]
        DevCheckInterval --> DevDeployDone["Dev completes fix ➔ Tests pass ➔ Deploy Successful ✓<br>Sets Work Item state in Plane.so to 'Done'"]
        DevDeployDone --> PlaneWebhook["Plane Webhook / Reverse Poller triggered<br>(Asymmetric Boundary: Done ➔ RESOLVED)"]
        PlaneWebhook --> StateResolved["Ticket State: RESOLVED<br>(Technical work done, awaiting user UAT)"]
        
        StateResolved --> PushUAT["Send LINE Push to Customer:<br>'Issue resolved, please verify your data'<br>Quick Reply: [ Pass / Close ] [ Fail ]"]
        ReturnStatusReport -.->|"If status is RESOLVED"| PushUAT
    end

    %% STAGE 4: VERIFICATION & CLOSURE
    subgraph S4["Stage 4: Verification & Closure Decision"]
        PushUAT --> CustVerify{"Customer UAT Result<br>(Pass or Fail?)"}
        
        %% Pass Path
        CustVerify -- "1. Pass (Confirmed)" --> StateConfirmed["Ticket State: CUSTOMER_CONFIRMED"]
        StateConfirmed --> StateClosed["Ticket State: CLOSED (Terminal)<br>+ Sync Closed state to Plane.so<br>+ Deliver Closing Thank-You"]
        StateClosed --> EndSuccess(["● END: Process Complete"])
        
        %% Fail Path
        CustVerify -- "2. Fail" --> EvaluateFail{"Evaluate Failure Scope"}
        
        %% Same Bug
        EvaluateFail -- "Same Bug (Root cause unresolved)" --> StateReopened["Ticket State: REOPENED<br>【Reuse Original Ticket】 No duplicate ticket<br>Attach failed UAT feedback into Plane"]
        StateReopened --> StateInProgress
        
        %% New Bug
        EvaluateFail -- "New Bug (Different symptom noticed)" --> BranchNewTicket["【Open New Ticket】<br>Delimit original ticket<br>Route new issue to Intake"]
        BranchNewTicket --> Start
    end

    EndInfoNo(["● END: Turn Complete"])
```

---

## 2. Dedicated "Information" Flow (Knowledge Retrieval & Escalation)

```mermaid
flowchart TD
    InboundInfo["Customer asks general usage, guideline, policy, or manual"] --> CallTool["AgentX invokes search_project_docs(query, project_id)"]
    CallTool --> VectorSearch[("Semantic & Keyword Vector Search<br>PostgreSQL pgvector / Knowledge Base")]
    
    VectorSearch --> HasEvidence{"Relevant Evidence<br>Found in Knowledge Base?"}
    
    %% Found
    HasEvidence -- "Evidence Found" --> FormatAns["AI synthesizes 1-2 core direct points<br>+ Attaches link/manual reference"]
    FormatAns --> AskMore["Closes with: 'Let me know if you need any further details!'"]
    AskMore --> DoneInfo(["Turn Complete (No Ticket Created)"])
    
    %% Not Found
    HasEvidence -- "Not Found (ANSWER_NOT_FOUND)" --> NoHallucinate["AI admits limitation politely (Zero Hallucination)<br>Explains documentation lacks this topic"]
    NoHallucinate --> OfferOption{"Provides Quick Reply Options"}
    
    OfferOption -- "1. Talk to Human Agent" --> DoTakeover["Call escalate_to_pm / Human Takeover<br>Notify Admin Console in TicketX<br>for smooth human takeover"]
    OfferOption -- "2. Open Inquiry Ticket" --> RouteToTicket["Route to Ticket Creation Flow<br>(Type: Inquiry / Service Request)"]
    OfferOption -- "3. Done" --> ByeInfo["Polite farewell and close turn"]
```

---

## 3. Ticket Lifecycle State Machine Architecture

From `TicketLifecycle.ts` and `TicketStateMachine.ts`:

| State in TicketX | Description & Role | Mapped State in Plane.so | Permitted Transition Actor |
| :--- | :--- | :--- | :--- |
| `NEW` | Fresh ticket created in database | `Backlog` | System / Operator |
| `TRIAGED` | Assessed and categorized | `Backlog` | Operator / System |
| `IN_PROGRESS` | Engineering actively investigating and resolving | `Open` | Dev (Plane) / Operator |
| `WAITING_CUSTOMER` | Waiting for additional info/screenshots from user | `Open` | Operator / System |
| `WAITING_INTERNAL` | Waiting for cross-team or vendor dependency | `Open` | Operator / System |
| **`RESOLVED`** | **Engineering Done in Plane.so ➔ Waiting for Customer UAT** | **`Done`** | **Plane / System (Never auto-closed!)** |
| `CUSTOMER_CONFIRMED` | Customer verifies and confirms fix | `Done` | **Customer Only** |
| **`CLOSED`** | Ticket permanently closed (Terminal State) | **`Done`** | **Customer / System** |
| **`REOPENED`** | **Customer reports Fail (Same Bug) ➔ Reopens ticket** | **`Open`** | **Customer / Operator** |
| `CANCELLED` | Ticket cancelled by customer or operator | `Cancelled` | Customer / Operator |

> [!IMPORTANT]
> **The Asymmetric Boundary Principle:**  
> When engineering marks an issue `Done` in Plane.so, TicketX transitions the ticket to **`RESOLVED`**, NEVER directly to `CLOSED`.  
> Engineering completing work does not mean the customer agrees the problem is solved. Only the customer can transition the ticket past `RESOLVED` into `CUSTOMER_CONFIRMED` ➔ `CLOSED` or `REOPENED`.

---

## 4. Unbroken Status Inquiry Track (Track A)

1. **Customer Inquires Status:** Customer taps *"Check Status"* ➔ *"View all recent cases"* (`LIST`).
2. **Selecting Ticket:** The system queries `TicketStateMachine`:
   - If `IN_PROGRESS`: Reports current stage and hours left to SLA.
   - If `WAITING_CUSTOMER`: Informs the user what information the team is waiting for.
   - **If `RESOLVED`:** Directly presents UAT decision chips:
     - **[ Verified & Correct (Close Case) ]**
     - **[ Still Broken (Fail) ]**
   - **This directly connects Track A into Stage 4 (Verification & Closure) without any broken or dead-end paths.**
