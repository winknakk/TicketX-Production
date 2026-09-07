# Master End-to-End Ticket Lifecycle Blueprint: AutomationX & TicketX (100% Complete Edition)
**System:** AutomationX / TicketX Service Management Platform  
**Specification Update:** Incorporating 2-Step Staging Verification defined by Application Support (AppSup):  
1. **`AppSup Test`:** Internal verification by Application Support / QA team before customer handoff (if failed, returned to Dev without disturbing the customer).  
2. **`Customer Test`:** Once AppSup approves, the status transitions to `Customer Test`, which **triggers an automated LINE Push Notification prompting the customer to perform UAT**.  
**Date:** September 7, 2026  

---

## 1. Master E2E Lifecycle Flowchart (With AppSup Test & Customer Test)

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

    %% STAGE 3: RESOLUTION & 2-STEP VERIFICATION (APPSUP TEST -> CUSTOMER TEST)
    subgraph S3["Stage 3: 2-Step Verification (AppSup Test ➔ Customer Test)"]
        DevCheckInterval --> DevDone["Dev completes fix ➔ Updates Plane.so status"]
        DevDone --> StateAppSupTest["【State 1: AppSup Test】<br>(Application Support validates internally)"]
        
        StateAppSupTest --> AppSupCheck{"AppSup Internal Test<br>Passed or Failed?"}
        AppSupCheck -- "Failed (Reject)" --> DevRework["Return to Dev for rework<br>(Customer is not disturbed)"]
        DevRework --> StateInProgress
        
        AppSupCheck -- "Passed (Approved)" --> StateCustomerTest["【State 2: Customer Test】<br>(Set status to 'Customer Test' in Plane.so)"]
        
        StateCustomerTest --> PlaneWebhook["Plane Webhook syncs to TicketX<br>(Mapping: Customer Test ➔ RESOLVED)"]
        PlaneWebhook --> PushUAT["⚡ Automated LINE Push Notification:<br>'Issue resolved & verified by AppSup.<br>Please verify and confirm your records.'<br>Quick Reply: [ Pass / Close ] [ Fail ]"]
        ReturnStatusReport -.->|"If status is Customer Test"| PushUAT
    end

    %% STAGE 4: VERIFICATION & CLOSURE
    subgraph S4["Stage 4: Verification & Closure Decision"]
        PushUAT --> CustVerify{"Customer UAT Result<br>(Pass or Fail?)"}
        
        %% Pass Path
        CustVerify -- "1. Pass (Confirmed)" --> StateConfirmed["Ticket State: CUSTOMER_CONFIRMED"]
        StateConfirmed --> StateClosed["Ticket State: CLOSED (Terminal)<br>+ Sync Closed state to Plane.so as Done/Closed<br>+ Deliver Closing Thank-You"]
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

## 2. Sequence Diagram: AppSup Test to Customer Test Transition

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    actor AppSup as AppSup Team (Support/QA)
    participant Plane as Plane.so (Work Item Board)
    participant Core as AutomationX Backend
    actor Customer as Customer (LINE OA)

    Note over Dev, AppSup: 1. Internal AppSup Testing Stage
    Dev->>Plane: Fix deployed to Staging ➔ Sets status to "AppSup Test"
    Plane-->>AppSup: Notifies AppSup to verify on Staging
    
    alt AppSup Internal Test Fails
        AppSup->>Plane: Reverts status to "In Progress" + Attaches bug log
        Plane-->>Dev: Alerts Dev to continue fixing (Customer is NOT disturbed)
    else AppSup Internal Test Passes
        AppSup->>Plane: Advances status in Plane.so to "Customer Test"
        
        Note over Plane, Customer: 2. Customer UAT Notification Stage
        Plane->>Core: Webhook Event: Status changed to "Customer Test"
        Core->>Core: Updates TicketX state to "RESOLVED" (Awaiting Customer UAT)
        Core->>Customer: ⚡ Triggers Automated LINE Push Notification:<br>"Dear Customer, case TCK-2026-46939 has been resolved and verified by our support team. Please review and confirm." [ Pass / Close ] [ Fail ]
        
        alt Customer Confirms (Pass)
            Customer->>Core: Taps "Pass / Close"
            Core->>Plane: Closes Work Item ➔ Status: "Done / Closed"
            Core-->>Customer: "Case closed successfully. Thank you for your cooperation! 🙏"
        else Customer Reports Issue (Fail)
            Customer->>Core: Taps "Fail" + describes symptom
            Core->>Plane: Reopens Work Item ➔ Status: "In Progress" with user feedback
        end
    end
```

---

## 3. Plane.so to TicketX State Mapping Table

| Operational Stage | Plane.so State | TicketX Lifecycle State | System Action & Customer Impact |
| :--- | :--- | :--- | :--- |
| Intake & Creation | `Backlog` / `Todo` | `NEW` / `TRIAGED` | Generates TCK ID and SLA commitment to user. |
| In Development | `In Progress` | `IN_PROGRESS` | Hourly dev alerts; customer interim updates. |
| Dev Completed | **`AppSup Test`** | `WAITING_INTERNAL` | **AppSup tests internally. Customer is NOT alerted yet.** |
| AppSup Rejected | `In Progress` | `IN_PROGRESS` | Returned to Dev internally. |
| AppSup Approved | **`Customer Test`** | **`RESOLVED`** | **Automated LINE Push sent prompting customer for UAT.** |
| Customer Confirmed | `Done` / `Closed` | `CUSTOMER_CONFIRMED` ➔ `CLOSED` | Closes case cleanly; sends thank-you message. |
| Customer Failed (Same Bug) | `In Progress` / `Reopened` | `REOPENED` ➔ `IN_PROGRESS` | Resumes work on original ticket; urgent alert to team. |
| Customer Failed (New Bug) | `Done` (Original) / New Ticket | `CLOSED` (Original) / `NEW` (New) | Closes original ticket; routes new issue to Intake. |
