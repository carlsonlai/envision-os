# Envicion OS — System Blueprint v2

Owner: Carlson (Boss)
Stack anchor: Next.js 16, Prisma 7, Postgres (Vercel sin1), Bukku ledger, Lark comms, Claude API.
Roles in `enum Role`: ADMIN, CREATIVE_DIRECTOR, SENIOR_ART_DIRECTOR, SALES, CLIENT_SERVICING, JUNIOR_ART_DIRECTOR, GRAPHIC_DESIGNER, JUNIOR_DESIGNER, DESIGNER_3D, MULTIMEDIA_DESIGNER, DIGITAL_MARKETING, CLIENT, AI_SALES_AGENT, AI_CS_AGENT.

This supersedes v1 for architecture. v1's §12–§15 (gap analysis, 12-week plan, policy, success def) remain authoritative and should be read alongside.

---

## 1. System Purpose (Sharp)

Envicion OS is a closed-loop AI operating layer that converts every ringgit of ad spend, every minute of design time, and every client touch into margin-weighted output — owned by one Boss, executed by six AI agents, and policed by an event-scoped policy engine no user (human or AI) can bypass.

Not a PM tool. Not a CRM. A self-correcting P&L machine with a design studio bolted on.

---

## 2. Core System Functions

| # | Function | Subsystem | Owning module | Measurable outcome |
|---|---|---|---|---|
| F1 | Goal decomposition | Planner | `brain/planner.ts` | OKR coverage ≥ 95% |
| F2 | Workload scheduling | Capacity engine | `brain/scheduler.ts` + `WorkloadSlot` | Designer utilisation 70–90% |
| F3 | Profit accounting | Margin engine | `engine/profit.ts` | Forecast vs actual ≤ ±10% |
| F4 | Lead-to-cash pipeline | Funnel agents | `agents/sales`, `agents/inhouse` | Lead→SQL→Close conversion |
| F5 | Event bus + agent orchestration | Orchestrator | `orchestrator/bus.ts` | Event lag < 2s p95 |
| F6 | Policy guardrails | Policy engine | `policy/*` | Violations = 0 |
| F7 | Role-gated UIs | Permission layer | `app/(dashboard)/{admin,cs,designer,client}` | Zero cross-role leaks |
| F8 | Performance intelligence | Telemetry + learner | `agents/perfintel` | Recommendation adoption ≥ 60% |
| F9 | Self-improvement loop | Nightly retrain | `jobs/learn.ts` | Coefficient MAE trend down |
| F10 | Audit + rollback | Decision log | `audit/*`, `AgentDecision`, `OverrideLog` | 100% reversible ≤ 24h |

---

## 3. AI Brain Logic — Step-by-Step

### 3.1 Goal → Task

1. Boss sets quarterly target in `/admin/brain`: revenue (RM), margin floor (%), CSAT, pipeline coverage ratio.
2. Planner decomposes top-down:
   - Revenue target ÷ AOV ÷ close rate = SQLs required.
   - SQLs ÷ SQL rate = Leads required.
   - Leads × CPL = ad budget required.
   - Projects in flight × avg minutes = designer hours required.
3. Each weekly target emits typed `AgentTask` rows: `ownerType` (agent|role), `priorityScore`, `expectedMinutes`, `deadline`, `revenueImpact`, `dependencies[]`.
4. Planner re-runs on: Boss target edit, week rollover, completion event, slip event.

### 3.2 Prioritisation

```
priority =
  0.35 × revenue_impact_score
+ 0.20 × deadline_urgency
+ 0.15 × client_tier_multiplier
+ 0.15 × margin_risk
+ 0.15 × dependency_unblocks
```

Modifiers:
- GOLD / PLATINUM client: ×1.20.
- Client over `revisionLimit`: ×0.70 (deprioritise paid-for-work vs profitable work).
- Task blocked on external input > 24h: auto-deprioritise, emit CS nudge event.

### 3.3 Assignment

1. Filter candidates by skill tag (`User.skills`*, currently only on `Freelancer`) + agent capability manifest.
2. Rank by `(available_minutes ≥ expectedMinutes)` → `past_performance_score` → `loaded_cost_per_hour` ascending.
3. Human assignee: create pending assignment. SLA 1h business time. Auto-escalate on timeout.
4. Agent assignee: auto-accept, execute, log `AgentRun` + `AgentDecision`.
5. No candidate meets deadline: emit 3-option escalation (extend, split scope, outsource to Freelancer pool).

### 3.4 Dynamic Timeline

- Base duration: historical p50 for `itemType × designerTier`.
- Buffer: p85 overrun coefficient for that pairing.
- Recompute triggers: `revision_requested`, `scope_change`, `feedback_delay > 24h`, `dependency_slipped`.
- Publish atomically: all stakeholders see the same new deadline or none. No partial updates.

### 3.5 Bottleneck Prediction

Signals, scanned every 15 min:
- `committed_minutes / capacity_minutes` per user, next 5 days.
- Queue depth per agent.
- Active WIP per person.
- `remaining_minutes / deadline_slack` per project.

States:
- RED: any user ≥ 90% for 5+ days, or slack < 1.25×.
- YELLOW: ≥ 90% for 3 days, or slack < 1.5×.
- GREEN: otherwise.

On RED: Brain auto-generates (a) reassignment proposal, (b) scope-split plan, or (c) client renegotiation brief. Boss one-clicks approve or override.

### 3.6 Continuous Optimisation (nightly cron)

1. Diff estimated vs actual minutes per task → update estimation coefficients (Bayesian, per `itemType × designerTier`).
2. Diff quoted vs billable minutes per `itemType` → emit pricing suggestions to Boss queue.
3. Diff CSAT per designer × itemType → update skill routing weights.
4. Re-score open `Lead` and `UpsellOpportunity` rows against new models.
5. Emit `margin_leak` events for morning Boss digest.

---

## 4. AI Agents — Full Definitions

Every agent is a stateless executor over a typed input schema, writes outputs to the event bus, is observable, reversible, and rate-limited per minute and per day.

> Crosswalk — blueprint names (conceptual) → `enum AgentKind` (implementation):
> Sales Agent → `SALES_AGENT` + `LEAD_ENGINE`; Traffic Agent → `DISTRIBUTION_ENGINE` + `PERFORMANCE_OPTIMIZER`; Self-Promotion Agent → `CONTENT_GENERATOR` + `DISTRIBUTION_ENGINE`; In-house Sales Agent → `REVENUE_EXPANSION` + `PAYMENT_AGENT`; Delivery Agent → `DELIVERY_AGENT` + `PM_AI` + `QA_AGENT` + `ONBOARDING_AGENT`; Performance Intelligence Agent → `PERFORMANCE_OPTIMIZER` + `DEMAND_INTEL`. The enum is authoritative for routing, configs, decisions, and failsafe records — the blueprint names remain the contract for responsibilities and KPIs.

### 4.1 Sales Agent (AI_SALES_AGENT)

- Responsibilities: qualify inbound leads, draft first-response, build quote, book discovery call.
- Inputs: `Lead` (source, company, industry, budget hint, message body), historical conversion by vertical, active promotions, Boss pricing bands, `ProspectConversation` history.
- Outputs: lead qualification score 0–100, auto-reply draft (sent per policy), `Quotation` record, calendar invite, CRM row, `ProspectMessage` log.
- KPIs: first-response < 10 min, SQL rate, close rate, avg quote size, win rate by vertical.
- Coordinates with: Traffic Agent (receives scored inbound), Delivery Agent (handoff signed deal), Performance Intel (reports margin intent).

### 4.2 Traffic Agent

- Responsibilities: run paid acquisition (Meta, Google, TikTok), manage budget allocation, rotate creatives.
- Inputs: Boss budget ceiling, live CAC by channel, weekly SQL demand from Brain, creative bank from Self-Promotion Agent, blocklists, `ContentPerformance` by asset.
- Outputs: campaign edits (budget shift, keyword tweaks, new ad sets), daily spend + CPL report, creative scorecard, `AdCampaign` updates.
- KPIs: CAC, CPL, ROAS, lead quality (closes ÷ leads sent), budget utilisation within ±5% of ceiling.
- Coordinates with: Sales Agent (feeds Leads), Self-Promotion Agent (pulls creatives), Performance Intel (reports).

### 4.3 Self-Promotion Agent

- Responsibilities: plan + produce owned-channel content (LinkedIn, IG, newsletter, website case studies, 小红书).
- Inputs: completed `Project` with `usable_as_case_study=true`, brand voice doc, industry trend feed, `ContentAsset` library, `Asset` (Google Drive-indexed).
- Outputs: drafted `SocialPost` + visuals, scheduled publish jobs, newsletter drafts, creative variants for Traffic Agent, case-study PDFs.
- KPIs: direct inbound leads, content velocity posts/week, engagement rate, assisted conversion attribution.
- Coordinates with: Delivery Agent (pulls completed work), Traffic Agent (supplies variants).

### 4.4 In-house Sales Agent (Upsell + Retention)

- Responsibilities: expand revenue inside the installed base.
- Inputs: `Client` LTV, last-touch date, `Project` completion events, retainer expiry, CSAT trend, `Invoice` payment history.
- Outputs: upsell proposals, renewal reminders, churn-risk alerts, package upgrade pitches, `UpsellOpportunity` rows.
- KPIs: NRR, upsell $ per active client, churn rate, GOLD/PLATINUM expansion rate.
- Coordinates with: Delivery Agent (reads completion feed), CS (pushes tasks), Boss (escalates churn risk).

### 4.5 Delivery Agent (AI_CS_AGENT for the CS-facing workflow)

- Responsibilities: orchestrate CS + designers from signed brief to final asset, enforce scope caps, emit Lark notifications (non-financial per `src/services/lark.ts` policy).
- Inputs: `ProjectBrief`, `DeliverableItem[]`, `WorkloadSlot`, `Revision` events, client feedback events, deadlines.
- Outputs: task assignments, daily standup brief, deadline recomputations, `QCCheck` checkpoints, `revision_limit` enforcement, Lark alerts.
- KPIs: on-time delivery %, revisions per item, designer utilisation %, CSAT per project, QA pass rate.
- Coordinates with: Sales Agent (handoff), CS (task queue), Designers (assignment), Performance Intel (telemetry).

### 4.6 Performance Intelligence Agent

- Responsibilities: telemetry, coefficient learning, Boss-facing intelligence.
- Inputs: every event from agents and humans, Bukku ledger (`Invoice`, `Payment`), `TimeLog`, CSAT responses, `Revision` counts, `ContentPerformance`.
- Outputs: project/client/team margin reports, designer scorecards, weekly Boss digest, pricing recommendations, anomaly alerts, `AIRoleReport`.
- KPIs: next-week revenue forecast ±10%, anomaly precision ≥ 90%, recommendation adoption ≥ 60%.
- Coordinates with: every other agent (pushes updated coefficients), Boss dashboard (direct writes to read models).

---

## 5. Unified Data Layer

### 5.1 Data Entities (grouped)

| Domain | Entities (existing or planned) |
|---|---|
| Identity | `User`, `Role`, `Client`, `Tenant`* |
| Work | `Project`, `ProjectBrief`, `DeliverableItem`, `Revision`, `FeedbackEvent`*, `QCCheck`, `FASignOff` |
| Capacity | `WorkloadSlot`, `TimeLog`*, `SkillTag`* |
| Commercial | `Quotation`, `Invoice`, `Payment`*, `Expense`*, `AgentCost`*, `PricingRule`* |
| Funnel | `Lead`, `LeadEvent`*, `SalesActivity`*, `UpsellOpportunity`*, `ProspectConversation`, `ProspectMessage` |
| Content | `ContentAsset`*, `Asset`, `CampaignCreative`*, `SocialPost`*, `CaseStudy`*, `SocialPlatformStat` |
| Ads | `AdCampaign`, `ContentPerformance`, `KeywordSignal` |
| AI | `AgentConfig`, `AgentRun`, `AgentDecision`, `AIAgentLog`, `AIRoleReport`, `ShadowRun`*, `OverrideLog`* |
| Audit | `AuditLog`, `PolicyViolation`*, `FailsafeIncident`, `CircuitBreakerState`* |
| Comms | `ChatMessage`, `LarkGroupExclusion`, `BukkuSyncLog` |
| System | `SystemSettings`, `Target`, `KPIRecord`, `BrandAsset` |

`*` = to be added (see v1 §12.2 Gap Analysis).

### 5.2 Data Flow

```
          ┌───────────────────────────────┐
Boss ───▶ │             Brain             │ ──▶ Planner / Scheduler
          └─────────────────┬─────────────┘
                            ▼
                 ┌──────────────────────┐
                 │  Event Bus (pub/sub) │
                 └──────────┬───────────┘
           ▲      ▲         │         ▲      ▲
           │      │         ▼         │      │
        Agents  Humans   Policy   Perf-Intel │
           │      │         │         │      │
           ▼      ▼         ▼         ▼      ▼
           ┌─────────────────────────────────┐
           │   Append-only Event Store       │
           └─────────────────┬───────────────┘
                             ▼
                Materialised read models
          (Boss P&L, CS pipeline, designer queue, client portal)
```

Rules:
- Every mutation is a typed event. Agents never write `prisma.*` directly.
- Event store is append-only, 7-year retention.
- Policy engine validates every event before persist.
- Read models are eventually consistent (≤ 2s lag).

### 5.3 How Data Drives Decisions

| Decision | Data consumed |
|---|---|
| Task scheduling | `WorkloadSlot` + `estimatedMinutes` + deadline + skill match |
| Quote pricing | cost coefficient × target margin × client tier × win-probability |
| Agent routing | historical performance × current load × cost per outcome |
| Retention trigger | activity recency × CSAT delta × payment behaviour |
| Churn alert | last-touch > tier threshold AND CSAT downtick AND invoice overdue |
| Pricing raise | 30-day margin for `itemType` < target for ≥ 3 consecutive periods |
| Ad budget shift | CAC delta × quality score × Sales Agent pipeline demand |
| Content calendar | recent winners × trend feed × Boss pillars × gap in posting cadence |

---

## 6. Profit Optimisation Engine (Critical)

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
ClientMargin (rolling 90d) =
    Σ ProjectMargin for client
  − support_cost (CS minutes × loaded_rate)
  − attributed_acquisition_cost (amortised over LTV window)
```

```
TeamMemberContribution =
    (billable_minutes × loaded_rate)
  − (loaded_cost)
  − rework_minutes_cost
  − idle_minutes × loaded_rate
```

```
AgencyMargin (per period) =
    Σ ClientMargin
  − fixed_opex
  − one-off_capex_amortised
```

### 6.2 Margin Leak Detection (triggers)

| Leak | Trigger condition | Action |
|---|---|---|
| Delay | `actual_minutes > 1.3 × estimated_minutes` | Root-cause tag (brief/designer/client), rebalance, flag pattern |
| Excess revisions | `revisions_used > revisionLimit` | Auto-invoice overage OR Boss escalation if GOLD+ |
| Low-value client | margin per CS-hour < RM threshold OR `repeat_score` < 0.3 | Suggest tier-down or termination letter |
| Unbalanced team | designer A utilisation < 50% while B > 90% for 5+ days | Auto-rebalance task queue |
| Price drift | `itemType` avg margin < target for 30d | Propose price hike to Boss queue |
| Client non-response | feedback outstanding > 48h | Pause clock, notify CS, push deadline, stop idle burn |
| Ad channel underperform | CAC > 1.5× target for 14d | Pause channel, reallocate budget to next-best |
| AI token overrun | monthly AI cost > 15% of project revenue | Alert Boss, tighten prompts, cache answers |

### 6.3 Automatic Actions

- Reassign task to next-ranked candidate with free slot → logged in `OverrideLog` with reason.
- Extend deadline + autogenerate client comm draft → CS reviews, sends.
- Alert Boss on margin leak ≥ RM 2,000 single event OR client margin < 15% rolling.
- Suggest pricing change with data-backed justification (n, window, deltas).
- Hard-block further `Revision` at API layer once `revisionLimit` hit; Boss unlock required.
- Force `Project` status transition gate: cannot move to COMPLETED without QCCheck pass + FASignOff.

---

## 7. End-to-End Business Flow

| Stage | What happens | Responsible | Data generated | Brain optimisation |
|---|---|---|---|---|
| Traffic | Ads + organic + partnerships drive visits | Traffic + Self-Promotion | session, CTR, CAC, `ContentPerformance` | Reallocate budget weekly to lowest-CAC channel |
| Lead | Form, DM, inbound call | Sales Agent | `Lead`, `ProspectConversation`, `ProspectMessage` | Score, auto-route by vertical |
| Sales | Qualify, quote, close | Sales Agent | `Quotation`, sales activity | Suggest quote by win-prob × target margin |
| Project | Brief → deliverables → schedule | Delivery Agent | `ProjectBrief`, `DeliverableItem`, `WorkloadSlot` | Fit against free slots, compute deadline |
| Delivery | Design, review, revise | Delivery Agent + CS + Designers | `Revision`, `TimeLog`, `QCCheck`, `FASignOff` | Watch overruns, rebalance, enforce caps |
| Payment | Invoice, collect via Bukku | In-house Sales + Bukku | `Invoice`, `Payment`, `BukkuSyncLog` | Cashflow forecast, late-payer nudge |
| Retention | Check-in, CSAT pulse | In-house Sales Agent | CSAT events, activity recency | Flag churn risk, trigger intervention |
| Upsell | Expansion pitch at peak CSAT | In-house Sales Agent | `UpsellOpportunity`, proposal | Time pitch to high-CSAT window |

Every stage emits events. Brain scores stage conversion rates weekly and re-weights prioritisation accordingly.

---

## 8. Human vs AI Responsibilities

### 8.1 Boss controls

- Quarterly OKRs, margin floor, pricing bands, client tier thresholds, budget ceilings.
- Policy overrides, hiring/firing, client acceptance above threshold.
- Approval of AI decisions flagged above confidence or impact thresholds.
- Boss never does: daily task assignment, client comms, design proofing, lead routing.

### 8.2 AI fully controls (within policy)

- Lead qualification + routing, quote drafting (≤ threshold), task scheduling, workload balancing, deadline computation, content scheduling, ad budget allocation, invoice draft generation, reminder sequences, churn detection, pricing recommendations.
- Every decision carries `confidence_score`, `rationale`, `inputs_hash`. Reversible ≤ 24h.

### 8.3 CS (CLIENT_SERVICING)

- Client communication, brief intake, feedback confirmation, final QA sign-off, handle AI-flagged escalations.
- Does NOT control: task assignment, pricing, scheduling, designer selection.

### 8.4 Designers (CREATIVE_DIRECTOR, SENIOR_ART_DIRECTOR, JUNIOR_ART_DIRECTOR, GRAPHIC_DESIGNER, JUNIOR_DESIGNER, DESIGNER_3D, MULTIMEDIA_DESIGNER, DIGITAL_MARKETING)

- Produce design work, log time, mark revisions, accept/reject AI estimate with justification, request reassignment.
- Seniors (CREATIVE_DIRECTOR, SENIOR_ART_DIRECTOR) additionally: approve juniors' output, set brand direction.
- All designers do NOT: see revenue, cost, other designers' queues, or P&L.

### 8.5 Client

- Views status, approves brief, submits feedback within revision limit, pays invoice.
- Does NOT: extend revisions unilaterally, download hi-res pre-payment, see internal comms, see other clients.

---

## 9. UI & Permission System (Strict & Enforceable)

Enforcement in three layers: UI hides, API authorises, DB row-level-security filters. No single-layer trust.

### 9.1 Boss — `/admin/*`, `/admin/brain`

| | |
|---|---|
| SEE | Full P&L, all projects/clients/users, agent decision log, `OverrideLog`, margin leaks, ad spend, AI token spend |
| DO | Set OKRs, override any AI decision (with mandatory reason text), change policy, approve above-threshold quotes, adjust client tier, unlock revision cap, pause/resume agents |
| CANNOT | Directly assign individual tasks (must route through Brain — preserves coefficient learning + audit) |
| AI enforces | Every override logged with reason; reason required before submit; Lark digest to Boss (non-financial only) |

### 9.2 CS — `/cs/*`

| | |
|---|---|
| SEE | Own assigned clients, their projects, briefs, feedback queue, messages |
| DO | Update brief, mark feedback received, approve deliverables, request revision within limit, log client call |
| CANNOT | See other CS's clients, any P&L, change pricing, directly reassign designers, close project without client sign-off, mark invoice paid (Bukku is sole source of truth) |
| AI enforces | Cannot close `Project` without client sign-off event; `revisionLimit` hard-capped at API; `PROJECT_PAID` status only written from Bukku webhook |

### 9.3 Designers — `/designer/*`

| | |
|---|---|
| SEE | Own queue, own `WorkloadSlot` calendar, attached brief + `Asset`, own `Revision` history |
| DO | Accept task, mark in-progress, log `TimeLog` minutes, submit for QCCheck, flag blocker, request reassign |
| CANNOT | See other designers' queues, see any revenue/cost data, directly reassign own tasks |
| AI enforces | Cannot take new task if `committed_minutes > 0.9 × capacity`; cannot skip `QCCheck`; `TimeLog` required to close task |

### 9.4 Client — `/client/*`

| | |
|---|---|
| SEE | Own project status, watermarked previews, invoice status (via Bukku portal link), `Revision` remaining |
| DO | Approve brief, submit feedback (text + annotation on `FileVersion`), approve final, pay via Bukku link |
| CANNOT | See other clients, download hi-res until paid, request revisions beyond `revisionLimit` without paid unlock, contact designers directly |
| AI enforces | Feedback window auto-closes after `feedback_window_days`; over-revisions trigger overage `Invoice`; portal access revoked on non-payment past grace period |

### 9.5 Inefficiency / Delay / Abuse Prevention

- `revisionLimit` hard cap at API (not just schema).
- Auto-nudge CS if client feedback stale > 48h; deadline adjusts automatically.
- Auto-reassign if designer task idle > 36h.
- Rate limits on new client requests per week by tier (e.g. GOLD = 5 active projects, SILVER = 2).
- CS cannot mass-approve: each approval emits a discrete event with timestamp + actor.
- Lark notifications blocked for any financial keyword (already enforced `src/services/lark.ts` `containsBlockedContent()`).

---

## 10. System Safeguards

### 10.1 When AI is wrong

- Every decision has a `confidence_score`. Below 70% → requires Boss approval before action.
- Every decision reversible within 24h via Decision Log single-click rollback.
- Diff view on `/admin/brain/decisions`: inputs → rationale → output → actual impact.

### 10.2 Mandatory Boss Intervention

| Event | Trigger |
|---|---|
| Quote > RM 20,000 | Agent cannot send without Boss tick |
| Client tier change | Up or down |
| Designer PIP flag | Performance score below floor 2 weeks in a row |
| Margin leak > RM 2,000 single event OR client margin < 15% rolling | Automatic page |
| Policy rule attempt | e.g. financial content to Lark (already blocked) |
| Agent error rate > 5% / 1h | Circuit breaker trips |

### 10.3 Fail-safes

- Per-agent circuit breaker: error rate > 5% in 1h → pause agent, alert Boss, route to peer.
- Shadow mode: new agent behaviours run read-only for 14 days, diffed against current, before going live.
- Human-in-loop required for irreversible events: external send, public publish, money movement.
- Dead-letter queue: failed tasks retry with exponential backoff → human escalation with full context.
- 24-hour rollback window on every AI write (event-store replay).
- Daily reconciliation: Bukku ledger vs in-system `Invoice`/`Payment` — any drift alerts Boss.

### 10.4 Escalation Ladder

| Level | Trigger | Action |
|---|---|---|
| L1 | Agent error | In-agent retry ×3 with backoff |
| L2 | Retries exhausted | Peer agent takeover (e.g. Delivery → Perf Intel diagnosis) |
| L3 | Peer cannot resolve | CS notified with full context + proposed fix |
| L4 | Unresolved past SLA | Boss paged with decision trail + recommended action |

---

## 11. Competitive Advantage

### 11.1 Hard to Replicate

- Compounding data moat: every project updates estimation, pricing, routing coefficients keyed on `itemType × vertical × designerTier`. New entrants start at zero coefficients — they cannot price or schedule accurately on day one.
- Integrated trio — Bukku (finance) + `WorkloadSlot` (capacity) + `AgentTask` (execution) — on one audit-logged event bus. Off-the-shelf tools stitch this together across 4–6 SaaS; Envicion OS runs it under one transaction.
- Policy engine encodes agency-specific rules (Lark financial block, tier boosts, revision caps, Malaysian accounting via Bukku) that competitors lack the operating history to write.
- AI-native by architecture, not bolt-on: every surface is an agent input and an agent output, so every new capability compounds instead of stacking tech debt.

### 11.2 Scalable Across Teams

- Multi-tenant by design: `tenantId` on every row, isolated event store, shared global models with per-tenant fine-tuning.
- Role enum + permission layer decouple org shape from code — a new role is a config change, not a deploy.
- `WorkloadSlot` is per-user so capacity scales linearly with headcount; no shared single-threaded choke points.
- Policies are first-class entities (not hardcoded ifs) — new tenant writes new rules without touching agent code.

### 11.3 SaaS-Ready

- Tenant isolation at DB row-level security.
- Per-tenant policy overrides: brand voice, revision defaults, margin targets, currency, language, time zone.
- Usage-priced: per active seat × per GB event store × per AI token consumed.
- White-label client portal per tenant (theme + domain).
- Export hooks: Bukku-compatible, generic CSV/Parquet, API to plug any accounting/CRM.
- Deploy target: Vercel + Neon/Supabase Postgres; multi-region read replicas for Asia-Pacific latency.

---

## Appendix — Cross-Reference to v1

- Gap analysis (code vs blueprint) → v1 §12.
- 12-week build sequence → v1 §13.
- Non-negotiable policy rules → v1 §14.
- Success definition → v1 §15.

v2 is the canonical architecture. v1 is the canonical build plan.

End of blueprint.
