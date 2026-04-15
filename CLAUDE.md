@AGENTS.md

# Business Rules

## Lark Notifications
- **NEVER send invoice, quotation, pricing, payment, or billing content to Lark group chats.**
- This is enforced in `src/services/lark.ts` via `containsBlockedContent()` — the `notify()` function will silently drop any message whose title or body contains these keywords.
- When writing new Lark notifications: keep messages to project status updates, team alerts, and workflow events only. Direct staff to Bukku for all financial details.
