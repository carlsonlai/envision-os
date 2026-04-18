# Envicion OS — Mission/Vision Alignment Audit
**Prepared for:** Carlson
**Date:** 2026-04-18
**Method:** Compared your stated mission/vision against the actual code in this repository (Prisma schema, `src/lib/agents/`, `src/app/api/`, `src/app/(dashboard)/`).

---

## 1. Verdict in one line

The **scaffolding is ~65% aligned** with your vision — most of the data models, agent files, and dashboards exist — but **three load-bearing pieces are missing or stubbed**, and the **human role list has drifted**. As it stands today, the system *cannot* deliver the "AI as CEO+COO, humans as executors only" promise.

---

## 2. Alignment scorecard

| Vision layer | Required capability | Status | Evidence |
|---|---|---|---|
| **Boss Layer** | Single admin login, highest authority, sets targets, approves/overrides AI, reads full perf | **Partial** | `/admin/*` + `/command/*` pages exist. `Target` Prisma model exists. Boss approve/override exists on AgentDecision. **Missing:** one unified "Boss cockpit" that stitches targets + AI decisions + P&L + pipeline health into one screen. |
| **AI Brain (CEO+COO)** | Central intelligence: goals → tasks → assignments → timelines → bottleneck prediction → continuous optimization | **MISSING** | No `brain.ts`, no goal→task converter, no dynamic timeline generator. `src/lib/agents/run.ts` orchestrates individual agent runs but there is no layer above them that turns a `Target` into assigned tasks. **This is the #1 gap.** |
| **AI Agents (6)** | Sales, Traffic, Self-Promotion, In-house Sales, Delivery, Performance Intelligence | **Partial** | 12 agents exist in `src/lib/agents/`. Mapping below. Coverage is there, naming is scattered, **Traffic Agent = Ads management is not cleanly built** (LEAD_ENGINE covers inbound capture but not ad-spend optimization). |
| **Human roles** | CS, Designers (CD, Sr AD, Jr AD, GD, Jr GD), Client — that's it | **DRIFTED** | Prisma `Role` enum has 14 values including `SALES` and `DIGITAL_MARKETING` (you said those must be AI), plus `DESIGNER_3D`, `MULTIMEDIA_DESIGNER`, `JUNIOR_DESIGNER` (extra designer tiers). **Dashboards still exist at `/sales`, `/ai-sales`, `/digital-marketing` area.** |
| **Client login** | Client sees their projects, approves, signs FA | **MISSING** | `CLIENT` role exists in enum but **there is no `/client` dashboard**. Only an internal `/api/cs/job-track/client/[id]` exists for CS to view. Clients cannot log in today. |
| **Unified Data Layer** | Leads, projects, tasks, time, cost, revisions, payments | **Good** | All models present: `Lead`, `Client`, `Project`, `ProjectBrief`, `DeliverableItem`, `Revision`, `QCCheck`, `Invoice`, `Quotation`, `FileVersion`, `AuditLog`, `KPIRecord`, `Target`. |
| **Profit Optimization Engine** | Profit per project/client/team, margin leak detection, automatic actions | **STUB** | `Project.profitability: Float?` field exists. `/api/kpi/profitability/[projectId]` returns a computation via `getProjectProfitability()`. **Missing:** per-client + per-team profit, margin leak detection, auto-triggered reassignment/pricing/alert logic. |
| **End-to-end flow** | Traffic→Lead→Sales→Project→Delivery→Payment→Retention→Upsell | **Partial** | Data models support the full chain. Delivery (designer queue, QC, FA) is newest and best-built. Retention + Upsell loops exist as agent files (`revenue-expansion.ts`) but are not wired to a cadence. Traffic→Lead intake is the weakest end. |
| **Governance / Safeguards** | What happens when AI is wrong, Boss intervention, fail-safe | **Good** | `AgentConfig` has `autonomyEnabled`, `confidenceThreshold`, `valueCapCents`, `rateCapPerHour`, `pausedReason`. `FailsafeIncident` model exists. `AgentDecision` table captures every decision for review. This part is *genuinely well-designed.* |
| **Permissions** | Role-based enforcement, prevent inefficiency/abuse | **Partial** | `src/lib/permissions.ts` exists but **has Prisma-client drift** — references `MULTIMEDIA_DESIGNER` which the generated Prisma client does not know about yet. Typecheck fails on this and 8 other schema-drift errors (pre-existing — unrelated to today's work but blocks a clean build). |
| **Real-time fanout** | Designers see status changes, CS sees escalations | **Good** | Pusher wiring on `designer-{id}`, `cs-alerts`, `project-{id}`, `management` channels (completed today). |
| **Business-rule enforcement** | Lark never leaks invoice/quotation/pricing/payment/RM | **Good** | `containsBlockedContent()` in `src/services/lark.ts` enforces this at `notify()` boundary. |

---

## 3. The six vision agents → what's in code

| Vision agent | Closest code agent(s) | Status |
|---|---|---|
| Sales Agent | `sales-agent.ts` + `SALES_AGENT` in `AgentKind` | ✓ Built |
| Traffic Agent (Ads + Lead Gen) | `lead-engine.ts` + `demand-intel.ts` + `/api/ai/ad-campaign` | ~ Partial — ad-spend optimization loop not closed |
| Self-Promotion Agent (Content + Brand) | `content-generator.ts` + `distribution-engine.ts` | ✓ Built |
| In-house Sales (Upsell + Retention) | `revenue-expansion.ts` | ~ Exists but not scheduled on a cadence |
| Delivery Agent | `delivery-agent.ts` + `pm-ai.ts` + `qa-agent.ts` + `onboarding-agent.ts` | ✓ Built (strongest agent cluster) |
| Performance Intelligence | `performance-optimizer.ts` | ~ Computes metrics; does not yet feed decisions back into Brain (because there is no Brain) |

**Extra agents in code that your vision didn't name** (keep or prune consciously): `PAYMENT_AGENT`, `ONBOARDING_AGENT`, `PM_AI`, `QA_AGENT`. I'd keep all four — they map to delivery + collection flows and support profit optimization.

---

## 4. Human-role drift — this must be resolved

Your vision says the **only** human logins are: `CS`, `Creative Director`, `Senior Art Director`, `Junior Art Director`, `Graphic Designer`, `Junior Graphic Designer`, `Client`. Seven roles.

The Prisma `Role` enum has **fourteen**, including three that violate the vision:

| Role in code | Vision verdict | Action |
|---|---|---|
| `ADMIN` | Boss | keep |
| `CREATIVE_DIRECTOR` | keep | keep |
| `SENIOR_ART_DIRECTOR` | keep | keep |
| `JUNIOR_ART_DIRECTOR` | keep | keep |
| `GRAPHIC_DESIGNER` | keep | keep |
| `JUNIOR_DESIGNER` | ambiguous — treat as "Junior Graphic Designer" | **rename to `JUNIOR_GRAPHIC_DESIGNER`** for clarity |
| `CLIENT_SERVICING` | keep | keep |
| `CLIENT` | keep | keep, but **build the dashboard** |
| `SALES` | **violates vision** — Sales must be AI | **remove or migrate all `SALES` users to `CLIENT_SERVICING`** |
| `DIGITAL_MARKETING` | **violates vision** — Traffic must be AI | **remove or migrate to `ADMIN`/`CS`** |
| `DESIGNER_3D` | not in vision — real skill though | **Decide: keep as designer sub-tag, or collapse into `GRAPHIC_DESIGNER`** |
| `MULTIMEDIA_DESIGNER` | not in vision — real skill though | **Same decision as above** |
| `AI_SALES_AGENT` | AI, not human — ok | keep |
| `AI_CS_AGENT` | AI, not human — ok | keep |

**Recommendation:** add a `specialization` field on `User` (enum: `GRAPHIC`, `3D`, `MULTIMEDIA`, `DIGITAL`) and keep the `Role` enum to the seven tiers from your vision. This preserves skill-routing for the Delivery Agent without violating the role hierarchy.

---

## 5. Three load-bearing things missing

### 5.1 AI Brain (central goal-to-task converter)
**What's missing:** a single entrypoint that takes a `Target` (e.g. "RM 180k revenue this month, 30% margin"), decomposes it into:
- lead-gen volume required (Traffic Agent)
- proposal throughput required (Sales Agent)
- delivery capacity required (Delivery Agent + WorkloadSlot)
- content output required (Self-Promotion Agent)

…and writes those as `AgentRun` triggers + `DeliverableItem` capacity reservations, then re-plans every 24h based on actuals.

**Where to build it:** `src/lib/agents/brain.ts`, cron-triggered daily. Reads `Target`, `KPIRecord`, `Project.status`, `WorkloadSlot`. Writes `AgentDecision` rows that cascade into individual agent runs.

### 5.2 Profit Optimization Engine
**What exists:** single-project profitability calc.
**What's missing:**
- per-client rolling profit (LTV, margin erosion, revision burn)
- per-team / per-designer profit contribution (actualMinutes vs billable)
- **margin leak detector** — cron job that flags projects where:
  - revisionCount ≥ revisionLimit (unpaid rework)
  - actualMinutes > 1.3× estimatedMinutes (scope blown)
  - deadline passed + unbilled (collection drift)
  - clientLTVProfit < 0 (client loses money repeatedly)
- **automatic triggers** per vision:
  - reassign to higher-utilization designer (via `WorkloadSlot`)
  - extend timeline + notify CS
  - alert Boss when project margin <X%
  - suggest pricing increase on repeat clients via `revenue-expansion.ts`
  - throttle client requests when revisionLimit hit

**Where to build it:** `src/lib/agents/profit-engine.ts` + `/api/cron/profit-sweep` running hourly.

### 5.3 Client-facing dashboard
**What's missing:** `/client` route with scoped views of their projects, WIP previews, FA approvals, invoice list (read-only — payment through Bukku link).

**Where to build it:** `src/app/(dashboard)/client/page.tsx` + middleware gate that redirects `CLIENT`-role users here.

---

## 6. Does the system still violate "AI fully controls, humans only execute"?

**Partial violations today:**
1. `/sales` and `/ai-sales` dashboards both exist — humans can still act as Sales. Vision says only AI sells. **Remove `/sales` human pages or restrict to read-only dashboards for the Boss.**
2. `/digital-marketing` equivalents (via `DIGITAL_MARKETING` role) can touch ad campaigns manually. **Remove human path — keep ads under AI Ad-Campaign agent; Boss approves spend thresholds only.**
3. CS `/cs/projects/[id]` page allows CS to manually set project status — vision says Delivery Agent should drive this. **Keep CS override for exceptions, but default status transitions must come from the Delivery Agent on DeliverableItem events.**

---

## 7. What's genuinely strong today

- Pusher real-time fanout across designer/cs/project/management channels
- AgentConfig governance (autonomy toggle, confidence threshold, value cap, rate cap, pause-with-reason) — **textbook-quality safeguard layer**
- AgentDecision + AgentRun + AuditLog provide full traceability of every AI action
- Lark notification guardrails (no financial leak)
- Deliverable → Revision → QCCheck → FASignOff → Invoice chain is complete and correctly modeled
- Freelancer + FreelancerAssignment models exist — gives the Delivery Agent an overflow valve when in-house capacity is blown

---

## 8. Prioritized 30-day build sequence to reach full alignment

1. **Schema cleanup (2 days)** — fix Prisma drift, decide role-list, migrate `SALES`/`DIGITAL_MARKETING` users, regenerate Prisma client, get typecheck to zero errors.
2. **AI Brain v1 (5 days)** — `brain.ts` that reads `Target` → emits `AgentDecision` every 24h. Simple rule-based first; LLM-augmented later.
3. **Profit Optimization Engine (5 days)** — per-client profit, margin leak detector cron, four automatic triggers.
4. **Client dashboard (3 days)** — scoped read-only view + FA approval.
5. **Traffic Agent close-the-loop (4 days)** — ad-spend-to-lead-to-revenue attribution, auto-budget reallocation inside AgentConfig caps.
6. **Remove / lock human sales+marketing paths (2 days)** — convert `/sales` to Boss-read-only; remove `DIGITAL_MARKETING` role.
7. **Boss cockpit consolidation (3 days)** — one `/admin` home that shows: target vs actual, agent decisions pending approval, profit heatmap, pipeline health, incidents.
8. **End-to-end verification (2 days)** — simulate a quarter of activity, check each stage fires the right agent and writes the right audit trail.

---

## 9. Is this competitive?

**Yes, if the three missing pieces ship.** What makes it hard to replicate:
- The **AgentConfig governance layer** (autonomy + confidence + value cap + rate cap + pause) is rare even at well-funded SaaS companies.
- **Lark + Bukku + Pusher + Prisma** integration in one stack with business-rule firewalls is custom work.
- Designer-centric workflow (DeliverableItem → Revision → QCCheck → FASignOff) mirrors an agency's real P&L pressure points — most generic PM tools don't.

**What stops it from being SaaS-ready today:**
- Multi-tenancy isn't modeled (no `Tenant` or `Workspace` table on top of `Project`).
- Lark + Bukku are hard-wired — SaaS needs provider abstraction.
- No API key / webhook management for external tenants.

These are v2 concerns. Get the three missing engines shipped first.

---

## 10. Bottom line for Carlson

The vision is **buildable**, and the foundation is more complete than most agencies ever get. But today, without the Brain, without the Profit Engine, and without the Client login, the system is a **really good agency ops tool** — not yet an **AI-run company**.

Ship those three in the next 30 days and the promise is real.
