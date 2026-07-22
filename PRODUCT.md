# Product

## Register

product

## Users

Internal Users of B2B customer Organizations: Owners, Admins, and Operators.
Operators live in the Support Inbox all day, working a queue of Support
Conversations from the Primary Channel (WhatsApp). Admins and Owners also
manage Memberships, Invitations, and Channel Connections.

Context of use: reactive, queue-driven work. The operator opens the app and
stays in it for hours, triaging and responding. The interface must lower the
heart rate when the queue is full, not add to it.

## Product Purpose

Echo is a B2B customer support platform that uses AI to handle inbound
support conversations across customer-facing Channels. The Support Inbox is
the operator system of record: conversations are monitored, responded to,
escalated, and resolved there.

Success looks like: an operator triages and resolves a high volume of
conversations calmly, with AI handling the first line and humans stepping in
with full context. The tool disappears into the task.

## Brand Personality

Calm, precise, reliable.

Nothing shouts. Hierarchy is silent but unambiguous. Every state is explicit.
Copy is direct and short; no marketing voice inside the app.

Quality bar: Plain and Linear. A user fluent in those tools should sit down
and trust this interface in minutes.

## Anti-references

- Generic 2023 SaaS: identical card grids, uppercase tracked eyebrows,
  gradient text, hero metrics, decorative glassmorphism.
- Zendesk / legacy enterprise help desks: heavy chrome, gray-on-gray tables
  without hierarchy, cluttered toolbars.
- Raw shadcn template: stock neutral boilerplate with no identity of its own
  (the current state of this repo).

## Design Principles

1. **The queue never shouts.** Hierarchy comes from typography and spacing,
   not decoration. Saturated color is reserved for state and the primary
   action.
2. **Earned familiarity.** Standard affordances behave as expected. No
   reinvented form controls, no novelty navigation, no display fonts in UI.
3. **State is explicit.** Every conversation, message, member, and
   integration has a visible, unambiguous state: open, pending, resolved,
   AI-handled, human-handled, loading, empty, error.
4. **Density with air.** Dense where the task demands (lists, tables,
   thread views), generous whitespace in the surrounding structure. Never
   cramped, never floaty.
5. **Calm by default.** Motion only conveys state (150-250ms, ease-out).
   No orchestrated page-load sequences. Reduced motion respected.

## Accessibility & Inclusion

WCAG 2.2 AA as the floor: body text contrast >= 4.5:1, large text >= 3:1,
visible focus on every interactive element, full keyboard operability,
`prefers-reduced-motion` respected. State is never conveyed by color alone;
always pair with icon or label.
