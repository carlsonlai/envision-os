# Envicion OS — System Blueprint v1

Owner: Carlson (Boss)
Scope: Build-ready architecture for the AI-operated creative marketing agency.
Date: 2026-04-18
Status: Authoritative reference. Supersedes prior partial specs.

---

## 1. System Purpose (Sharp)

Envicion OS is a closed-loop AI operating layer that converts every ringgit of ad spend, every minute of design time, and every client touchpoint into measured, margin-weighted output — run by one human Boss, executed by six AI agents, and policed by a policy engine that no user (human or AI) can bypass.

No operations manager. No project manager. No middle layer. Work flows, money flows, and decisions are logged.

---

## 2. Core System Functions

Every function below is a concrete subsystem with owning code module, data footprint, and measurable outcome.

| # | Function | What it does | Owning module | Success metric |
|---|---|---|---|---|
| F1 | Goal → Task Decomposition | Turns Boss OKRs into scheduled tasks | `brain/planner` | OKR coverage ratio |
| F2 | Workload Scheduler | Minute-level capacity calendar per user | `brain/scheduler` + `WorkloadSlot` | Utilization 70–90% band |
| F3 | Profit Accounting | Live margin per project / client / team / period | `engine/profit` | Forecast error ≤ 10% |
| F4 | Lead-to-Cash Pipeline | Traffic → paid → retained → upsold | `agents/sales` + `agents/inhouse` | Pipeline conversion % |
| F5 | Agent Orchestrator | Message bus + shared state for all AI agents | `orchestrator/*` | Agent uptime, task SLA |
| F6 | Policy & Guardrails | Rules that bind AI and humans (e.g. no financial to Lark) | `policy/*` | Violations = 0 |
| F7 | Human Role Gateways | Permission-walled UIs per role | `app/{admin,cs,designer,client}` | 0 cross-role leaks |
| F8 | Performance Intelligence | Every event scored, every person ranked | `agents/perfintel` | Recommendation adoption % |
| F9 | Self-Improvement Loop | Nightly recalibration of coefficients | `jobs/learn` | Model MAE trend ↓ |
| F10 | Audit & Override | Full log + 24h rollback on any AI decision | `audit/*` | Rollback coverage 100% |

---

## 3. AI Brain Logic — Step-by-Step

### 3.1 Goal → Task

1. Boss enters quarterly target in `/admin/brain`: revenue, margin floor, CSAT, pipeline coverage.
2. Planner decomposes to weekly targets and to required activity volume per stage:
   - Revenue target ÷ AOV ÷ close rate = SQLs required.
   - SQLs required ÷ SQL rate = leads required.
   - Leads required × CPL = ad budget required.
3. Each weekly target emits a `Backlog` of typed `AgentTask` rows with: `ownerType` (agent|role), `priorityScore`, `expectedMinutes`, `deadline`.

### 3.2 Prioritization

Score formula per task:

```
priority =
  0.35 * revenue_impact_score
+ 0.20 * deadline_urgency
+ 0.15 * client_tier_multiplier
+ 0.15 * margin_risk
+ 0.15 * dependency_unblocks
```

Modifiers:
- GOLD / PLATINUM clients: ×1.20.
- Clients over `revision_limit`: ×0.70.
- Task blocked waiting on external input > 24h: auto-deprioritize and emit CS nudge.

### 3.3 Assignment

1. Filter candidates by `skills` tag on `User` and by agent capability manifest.
2. Rank by: `(available_minutes ≥ expectedMinutes) AND (past_performance_score) AND (loaded_cost_per_hour)`.
3. If human candidate: create pending assignment, wait for acceptance (SLA 1h business time).
4. If AI agent: auto-accept, execute, log `AIAgentAction`.
5. If no candidate satisfies deadline: escalate with three options (extend, reassign scope, outsource).

### 3.4 Dynamic Timeline

- Base duration = historical p50 for `itemType × designerTier`.
- Buffer = p85 overrun coefficient for that pairing.
- Recompute on: `revision_requested`, `scope_change`, `feedback_delay`, `dependency_slipped`.
- Publish new deadline to all stakeholders atomically — never partial.

### 3.5 Bottleneck Prediction

Signals scanned every 15 minutes:
- `committed_minutes / capacity_minutes` per user for next 5 days.
- Queue depth per agent.
- WIP count per person.
- Ratio `remaining_minutes / deadline_slack`.

States:
- RED: any user ≥ 90% for 5+ days, or deadline slack < 1.25×.
- YELLOW: ≥ 90% for 3 days, or slack < 1.5×.
- GREEN: otherwise.

On RED: Brain auto-proposes reassignment, scope split, or deadline renegotiation brief; Boss approves or overrides.

### 3.6 Continuous Optimization (nightly)

1. Diff estimated vs actual minutes per task → update estimation coefficients (Bayesian).
2. Diff quoted vs billable minutes per itemType → update pricing suggestions.
3. Diff CSAT per designer × itemType → update skill routing weights.
4. Re-score open opportunities against updated models.
5. Emit `margin_leak` events for Boss digest.

---

## 4. AI Agents — Full Definitions

Each agent is a stateless executor over a typed input schema, writing outputs to the event bus. All agents are observable, reversible, and rate-limited.

### 4.1 Sales Agent

- Responsibilities: qualify inbound leads, generate first-response, build quote, book meeting.
- Inputs: `Lead` (source, company, industry, budget_hint, message), historical conversion by vertical, active promotions, Boss pricing bands.
- Outputs: lead qualification score, auto-reply draft (sent after human/auto approval per policy), `Quote` record, calendar invite link, CRM row.
- KPIs: first-response time < 10 min, SQL rate, close rate, average quote size, win rate by vertical.
- Interactions: consumes from Traffic Agent, hands off signed deals to Delivery Agent, reports margin intent to Performance Intel.

### 4.2 Traffic Agent

- Responsibilities: run paid acquisition (Meta, Google, TikTok), manage budget allocation.
- Inputs: Boss budget ceiling, CAC by channel, weekly SQL demand from Brain, creative bank from Self-Promotion Agent, blocklists.
- Outputs: campaign edits (budget shift, negative keywords, new ad sets), daily spend and CPL report, creative performance scorecard.
- KPIs: CAC, CPL, ROAS, lead quality (closes ÷ leads sent), budget utilization within ±5%.
- Interactions: feeds Sales Agent, consumes assets from Self-Promotion Agent, reports to Performance Intel.

### 4.3 Self-Promotion Agent

- Responsibilities: plan and produce content for owned channels (LinkedIn, Instagram, newsletter, website case studies).
- Inputs: completed `Project` with `usable_as_case_study=true`, brand voice doc, industry trend feed, content calendar.
- Outputs: drafted posts with visuals, scheduled publish jobs, newsletter drafts, creative variants for Traffic Agent.
- KPIs: direct inbound leads, content velocity (posts/week), engagement rate, assisted conversion.
- Interactions: pulls from Delivery Agent outputs, supplies Traffic Agent.

### 4.4 In-house Sales Agent (Upsell + Retention)

- Responsibilities: expand revenue inside the installed base.
- Inputs: `Client` LTV, last-touch date, `Project` completion events, contract/retainer expiry, CSAT trend, payment history.
- Outputs: upsell proposals, renewal reminders, churn risk alerts, package upgrade pitches.
- KPIs: NRR, upsell $ per active client, churn rate, expansion rate within GOLD/PLATINUM.
- Interactions: reads Delivery Agent feed, pushes CS tasks, escalates churn risk to Boss.

### 4.5 Delivery Agent

- Responsibilities: orchestrate CS + designer execution from signed brief to final asset.
- Inputs: `ProjectBrief`, `DeliverableItem[]`, `WorkloadSlot`, revision events, feedback events, deadlines.
- Outputs: task assignments, daily standup brief, deadline recomputations, QA checkpoints, revision-limit enforcement, Lark notifications (non-financial per policy `src/services/lark.ts`).
- KPIs: on-time delivery %, revisions per item, designer utilization %, CSAT per project, QA pass rate.
- Interactions: receives handoffs from Sales Agent, feeds Performance Intel, reads Client Portal feedback.

### 4.6 Performance Intelligence Agent

- Responsibilities: telemetry, learning, Boss-facing intelligence.
- Inputs: every event across agents and humans, Bukku financial ledger, time logs, CSAT responses, revision counts.
- Outputs: project/client/team margin reports, designer scorecards, weekly Boss digest, pricing recommendations, anomaly alerts.
- KPIs: forecast accuracy ±10% on next-week revenue, anomaly precision ≥ 90%, recommendation adoption ≥ 60%.
- Interactions: feeds updated coefficients to every other agent, writes directly to Boss dashboard, flags margin leaks.

---

## 5. Unified Data Layer

### 5.1 Data Entities

| Domain | Entities |
|---|---|
| Identity | `User`, `Role`, `Client`, `Tenant` |
| Work | `Project`, `ProjectBrief`, `DeliverableItem`, `RevisionEvent`, `FeedbackEvent`, `QACheckpoint` |
| Capacity | `WorkloadSlot`, `TimeLog`, `SkillTag` |
| Commercial | `Quote`, `Invoice`, `Payment`, `Expense`, `AgentCost` (ad spend, AI tokens), `PricingRule` |
| Funnel | `Lead`, `LeadEvent`, `SalesActivity`, `UpsellOpportunity`, `RenewalEvent` |
| Content | `ContentAsset`, `CampaignCreative`, `SocialPost`, `CaseStudy` |
| AI | `AIAgentAction`, `AIAgentDecision`, `ShadowRun`, `OverrideLog`, `AIRoleReport` |
| Audit | `AuditLog`, `PolicyViolation`, `CircuitBreakerState` |

### 5.2 Data Flow

```
          ┌─────────────────────────────────────┐
Boss ────▶│                Brain                │───▶ Planner / Scheduler
          └────────────────────┬────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Event Bus (pub/sub)    │
                    └──────────────────────┘
                   ▲       ▲        ▲       ▲
                   │       │        │       │
              Agents   Humans   Policy   Perf-Intel
                   │       │        │       │
                   ▼       ▼        ▼       ▼
             ┌──────────────────────────────────┐
             │        Append-only Event Store   │
             └──────────────┬───────────────────┘
                            ▼
                 Read models per dashboard
```

Rules:
- Every mutation is a typed event (never direct table write from agents).
- Event store is append-only with 7-year retention.
- Read models are materialized: Boss P&L, CS pipeline, designer workload, client portal.
- Policy engine validates every event before persist.

### 5.3 How Data Drives Decisions

| Decision | Data used |
|---|---|
| Task scheduling | `WorkloadSlot` + `estimatedMinutes` + deadline + skill match |
| Quote pricing | cost coefficient × target margin × tier multiplier × win-prob |
| Agent routing | historical performance × current load × cost per outcome |
| Retention trigger | activity recency × CSAT delta × payment behavior |
| Churn alert | last-touch > threshold for tier + CSAT downtick + invoice overdue |
| Pricing raise | 30-day margin for itemType < target for ≥ 3 consecutive periods |

---

## 6. Profit Optimization Engine (Critical)

### 6.1 Profit Formulas

```
ProjectMargin =
    revenue_paid
  − Σ(time_log_minutes × loaded_rate_per_minute)
  − Σ(direct_costs: outsourcing, stock, print)
  − allocated_overhead
  − attributed_ad_spend
  − attributed_ai_cost
```

```
ClientMargin (rolling) =
    Σ ProjectMargin for client
  − support_cost (CS minutes × loaded_rate)
  − attributed_acquisition_cost (amortized over LTV window)
```

```
TeamMemberContribution =
    (billable_minutes × loaded_rate) − (loaded_cost) − rework_minutes_cost
```

### 6.2 Margin Leak Detection (triggers)

| Leak | Trigger | Action |
|---|---|---|
| Delay | `actual_minutes > 1.3 × estimated_minutes` | Root-cause tag (brief/designer/client), rebalance, flag pattern |
| Excess revisions | `revisions_used > revision_limit` | Auto-invoice overage or Boss escalation if GOLD+ |
| Low-value client | margin per CS-hour < threshold OR repeat_score < 0.3 | Suggest tier-down or termination |
| Unbalanced team | designer A util < 50% while B > 90% for 5+ days | Auto-rebalance task queue |
| Price drift | itemType avg margin < target for 30d | Propose price hike to Boss |
| Client non-response | feedback outstanding > 48h | Pause clock, notify CS, push deadline, stop idle burn |

### 6.3 Automatic Actions

- Reassign task to next-ranked candidate with free slot (logged in `OverrideLog`).
- Extend deadline with autogenerated client communication draft.
- Alert Boss on margin leak ≥ RM 2,000 single event or client-margin < 15%.
- Suggest pricing change with data-backed justification.
- Block further revisions at API layer once revision_limit is hit; require Boss unlock.

---

## 7. End-to-End Business Flow

| Stage | What happens | Responsible agent | Data generated | Brain optimization |
|---|---|---|---|---|
| Traffic | Ads + organic + partnerships drive visits | Traffic + Self-Promotion | session, CTR, CAC | Reallocate budget to lowest-CAC channel weekly |
| Lead | Form, DM, inbound call | Sales Agent | `Lead`, `LeadEvent` | Score, auto-route by vertical |
| Sales | Qualify, quote, close | Sales Agent | `Quote`, `SalesActivity` | Suggest quote by win-prob × margin |
| Project | Brief → deliverables → schedule | Delivery Agent | `ProjectBrief`, `DeliverableItem`, `WorkloadSlot` | Fit against free slots |
| Delivery | Design, review, revise | Delivery Agent + CS + Designers | `RevisionEvent`, time logs, QA | Watch overruns, rebalance, enforce limits |
| Payment | Invoice, collect via Bukku | In-house Sales + Bukku | `Invoice`, `Payment` | Cashflow forecast, late-payer nudge |
| Retention | Check-in, CSAT pulse | In-house Sales Agent | CSAT, activity_recency | Flag churn risk |
| Upsell | Expansion pitch at peak satisfaction | In-house Sales Agent | `UpsellOpportunity`, proposal | Time pitch to high-CSAT window |

---

## 8. Human vs AI Responsibilities

### 8.1 Boss (Admin Login)

- Controls: OKRs, pricing bands, client tier thresholds, budget ceilings, policy overrides, hiring decisions, approval of AI decisions above thresholds.
- Never does: daily task assignment, client comms, design proofing, lead routing.

### 8.2 AI (Brain + 6 Agents) — fully autonomous within policy

- Lead routing, quote drafting, task scheduling, workload balancing, deadline computation, content scheduling, ad budget allocation, invoice generation, reminder sequences, churn detection, pricing recommendations.

### 8.3 CS (Client Servicing)

- Executes client communication, gathers briefs, confirms feedback, QA-signs final deliverables, handles escalations AI flags.
- Does not control assignment, pricing, or scheduling.

### 8.4 Designers (all levels)

- Produce design work, log time, mark revisions, accept/reject AI duration estimates with justification.
- Do not see revenue, cost, or other designers' queues.

### 8.5 Client

- Views status, approves briefs/deliverables, submits feedback within revision limit, pays invoices.
- Cannot extend revisions, download hi-res pre-payment, or see internal comms.

---

## 9. UI & Permission System (Strict & Enforceable)

Permissions enforced at three layers: UI hides, API authorizes, DB row-level-security filters. No single-layer trust.

### 9.1 Boss — `/admin/*`, `/admin/brain`

| Capability | Scope |
|---|---|
| SEE | Full P&L, all projects/clients/users, agent decision log, overrides, margin leaks |
| DO | Set OKRs, override any AI decision (with mandatory reason), change policy, approve quotes above threshold, adjust client tier |
| CANNOT | Directly assign individual tasks (must route through Brain — preserves audit trail) |
| AI enforces | Every override logged with reason, reason required before submit, Slack/Lark digest to Boss |

### 9.2 CS — `/cs/*`

| Capability | Scope |
|---|---|
| SEE | Own assigned clients, their projects, briefs, feedback queue, messages |
| DO | Update brief, mark feedback received, approve deliverables, request revision (within limit), log client call |
| CANNOT | See other CS's clients, see any P&L, change pricing, reassign designers directly |
| AI enforces | Cannot close project without client sign-off event; cannot exceed `revision_limit` without Boss unlock; cannot mark paid (Bukku sole source of truth) |

### 9.3 Designers — `/designer/*`

| Capability | Scope |
|---|---|
| SEE | Own queue, own workload calendar, attached brief/assets, own revision history |
| DO | Accept task, mark in-progress, log minutes, submit for review, flag blocker |
| CANNOT | See other designers' queues, see revenue or cost data, reassign own tasks (request only) |
| AI enforces | Cannot take new task if committed_minutes > 90% of capacity; cannot skip QA checkpoint; time logs required to close task |

### 9.4 Client — `/client/*`

| Capability | Scope |
|---|---|
| SEE | Their project status, watermarked previews, invoice status, revisions remaining |
| DO | Approve brief, submit feedback (text + annotation), approve final, pay invoice |
| CANNOT | See other clients, download hi-res until paid, request revisions beyond limit without paid unlock |
| AI enforces | Feedback window auto-closes after `feedback_window_days`; over-revisions trigger billing; access revoked on non-payment after grace |

### 9.5 Inefficiency / Delay / Abuse Prevention

- Hard cap on revisions per package (enforced at API layer).
- Auto-nudge if client feedback > 48h stale (with deadline adjustment).
- Auto-reassign if designer task idle > 36h.
- Rate limits on new client requests per week by tier.
- CS cannot mass-approve; each approval emits discrete event with timestamp.

---

## 10. System Safeguards

### 10.1 When AI is wrong

- Every decision carries a `confidence_score`. < 70% → Boss approval required before action.
- Every decision reversible within 24h via Decision Log single-click rollback.
- Side-by-side diff of input → rationale → output displayed on `/admin/brain/decisions`.

### 10.2 Mandatory Boss Intervention

- Quote > RM 20,000.
- Client tier change (up or down).
- Designer performance score triggers PIP flag.
- Margin leak > RM 2,000 single event.
- Any attempt to violate a policy rule (e.g. financial content to Lark — already blocked in `src/services/lark.ts`).

### 10.3 Fail-safes

- Circuit breaker per agent: error rate > 5% in 1h → pause agent, alert Boss.
- Shadow mode: new agent behaviors run read-only for 14 days, compared against current behavior, before taking live action.
- Human-in-loop for irreversible events: sending to client, publishing content, moving money.
- Dead-letter queue: failed tasks retry → then human escalation with full context.

### 10.4 Escalation Ladder

| Level | Trigger | Action |
|---|---|---|
| L1 | Agent error | In-agent retry |
| L2 | Retry failed | Peer agent takeover (e.g., Delivery → Performance Intel investigation) |
| L3 | Peer cannot resolve | CS notified with context |
| L4 | Unresolved > SLA | Boss paged with full decision trail |

---

## 11. Competitive Advantage

### 11.1 Hard to Replicate

- Compounding data moat: every project teaches estimation, pricing, and routing coefficients specific to `itemType × vertical × designer`. New entrants start at zero coefficients.
- Integrated trio — Bukku (finance) + WorkloadSlot (capacity) + AgentTask (execution) — under one audit-logged event bus. Not available off-the-shelf.
- Policy engine captures agency-specific rules (Lark financial block, tier boosts, revision caps) that competitors do not have the history to write.

### 11.2 Scalable Across Teams

- Multi-tenant by design: `tenantId` on every row, isolated event store, shared model weights with per-tenant calibration.
- Role enum + permission system decouples org shape from code — new role is a config change, not a deploy.
- WorkloadSlot is per-user, so capacity scales linearly with headcount.

### 11.3 SaaS-Ready

- Tenant isolation at DB row-level-security.
- Per-tenant policy overrides (brand voice, revision defaults, margin targets, currency).
- Usage-priced: per active user + per GB event store + per AI token consumed.
- White-label client portal theming per tenant.
- Export hooks: Bukku-compatible, generic CSV/Parquet, API for accounting/CRM of choice.

---

## 12. Gap Analysis — Current Codebase vs Blueprint

Reference: `prisma/schema.prisma`, `prisma/seed.ts`, `src/services/lark.ts`, `/admin/brain`, Vercel prod deploy at `envision-os.vercel.app`.

### 12.1 Already in place

- Next.js 16 + Prisma 7 + Postgres on Vercel (Singapore `sin1`).
- 14-role enum including `AI_SALES_AGENT`, `AI_CS_AGENT` stubs.
- `/admin/brain` cockpit route (deployed commit `6dcf0f0`).
- Lark integration with `containsBlockedContent()` policy guard at `src/services/lark.ts`.
- Bukku integration hooks (`src/app/api/bukku/**`).
- 4 seeded test users; Acme Corp + PRJ-0001 sample project.
- Models exist: `WorkloadSlot`, `DeliverableItem` (with `revisionLimit`, `estimatedMinutes`), `ProjectBrief`, `AIAgentAction`, `AIRoleReport`.
- Cron jobs: `/api/cron/sync-lark` (daily), `/api/cron/whatsapp` (hourly).

### 12.2 Gaps to Close

| Gap | Blueprint reference | Impact |
|---|---|---|
| No event bus — agents write DB directly | §5.2 | Blocks audit, rollback, shadow mode |
| No Decision Log UI + 24h rollback | §10.1 | Boss cannot inspect or reverse AI calls |
| 10 of 14 roles not seeded, no role-specific UI | §9 | Company cannot onboard real staff |
| No Traffic / Self-Promotion / In-house Sales implementations | §4 | Only Delivery-side AI is scaffolded |
| No Profit Engine — only raw ledger | §6 | Margin leaks invisible |
| No circuit breaker / shadow mode | §10.3 | Bad AI behavior cannot be contained |
| No Client Portal | §9.4 | Feedback flows outside system, no revision cap enforcement |
| `revision_limit` stored but not enforced at API | §6.3, §9.4 | Revenue leakage, scope creep |
| No multi-tenant layer | §11.2 | Blocks SaaS |
| Shared bootstrap password `Envicion@2026!` across seeded users | n/a — security | Credential reuse risk |
| Custom domain `os.envicion.com` points to AWS, not Vercel | infra | Auth cookies / SSL broken on vanity URL |

---

## 13. 12-Week Build Sequence (Improvement Plan)

Sequenced so every week ships a usable increment and unlocks the next layer.

| Wk | Deliverable | Unlocks |
|---|---|---|
| 1 | Event bus + typed events (`events/*.ts`) + append-only `AIAgentAction` store wrapper | Auditability for everything after |
| 2 | Decision Log table + `/admin/brain/decisions` UI with rollback | §10.1 |
| 3 | Profit Engine v1: per-project margin calc + read model | §6 detection visible |
| 4 | Profit widget live on `/admin/brain` + first margin-leak alerts | Boss feedback loop |
| 5 | Delivery Agent hardening: enforce `revision_limit` at API layer, auto-reassign rules | Close revenue leak |
| 6 | Performance Intel Agent v1: designer scorecards + weekly Boss digest | Compounding data moat begins |
| 7 | Client Portal MVP: status, watermarked previews, feedback intake | §9.4 + revision cap |
| 8 | Seed remaining 10 roles + per-user password setup + rotate shared password | Staff onboarding |
| 9 | In-house Sales Agent v1: renewals + upsell queue | §4.4 |
| 10 | Traffic Agent v1: Meta + Google Ads budget reallocation | §4.2 |
| 11 | Self-Promotion Agent v1: content queue + case study pipeline | §4.3 |
| 12 | Circuit breakers, shadow mode harness, multi-tenant row-level isolation flag | §10.3 + §11.2 |

### 13.1 Priority-1 Quick Wins (next 14 days)

1. Enforce `revision_limit` at API — no `RevisionEvent` creatable beyond limit without Boss unlock.
2. Add `AIAgentDecision` table + `/admin/brain/decisions` list view with rollback button.
3. Build Profit widget on `/admin/brain` (per project, live, last 30 days).
4. Seed remaining 10 roles with placeholder users and per-role landing pages.
5. Rotate the shared `Envicion@2026!` password; ship first-login forced password reset.
6. Fix DNS for `os.envicion.com` → `cname.vercel-dns.com`.

---

## 14. Non-Negotiable Policy Rules (already encoded or must be encoded)

| Rule | Where enforced |
|---|---|
| No financial content (invoice, quotation, pricing, payment, billing) to Lark | `src/services/lark.ts` `containsBlockedContent()` — encoded |
| Every AI decision logged | `AIAgentAction` — partially encoded, needs `AIAgentDecision` with rationale + confidence |
| No direct DB writes from agents | TODO — introduce event bus, remove direct `prisma.*` calls from agent code |
| Every override by Boss requires reason text | TODO — `OverrideLog.reason NOT NULL` + UI |
| `revision_limit` is a hard cap | TODO — move enforcement from schema to API |
| Shadow mode required for new agent behaviors for ≥ 14 days | TODO — `ShadowRun` model + harness |
| Circuit breaker on agent error rate > 5% / 1h | TODO — `CircuitBreakerState` + cron |

---

## 15. Success Definition (what "done" looks like)

Envicion OS is shipped when:

- Boss sets quarterly targets in one screen and never assigns another task by hand.
- Every project shows live margin, updated on every time log.
- Every AI decision is logged with inputs, rationale, confidence, and is reversible for 24 hours.
- No client can exceed revisions without being billed — enforced at API, not UI.
- Designer scorecards publish weekly with zero manual intervention.
- Traffic budget reallocates weekly to lowest-CAC channel without Boss touching ad manager.
- A second agency can be onboarded as a tenant in under 1 day.

End of blueprint.
