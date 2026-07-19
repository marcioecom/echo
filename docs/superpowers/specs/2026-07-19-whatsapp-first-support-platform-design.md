# WhatsApp-First Support Platform Design

Date: 2026-07-19

Status: Approved for planning

## Summary

Build a B2B AI support platform that launches with WhatsApp as the Primary Channel and keeps the domain ready for future Channels such as the Embedded Widget.

This repo remains a functional reference for product shape, Support Inbox flow, and UI/UX patterns. It is not the technical foundation for the new platform. The new implementation is a monorepo with `apps/web`, `apps/api`, and `apps/worker`.

## Product Intent

The platform handles inbound customer support conversations for B2B tenants. Customers contact a business over WhatsApp. The platform ingests those messages, stores them in a tenant-aware support domain, lets AI respond when appropriate, and escalates to human operators when needed.

The Support Inbox is the system of record for support operations. Operators do not work from the Twilio Console.

## Goals

- Launch with WhatsApp as the Primary Channel.
- Support true B2B multitenancy from day 1.
- Keep the core domain Channel-oriented so future Channels can plug in without rewriting the model.
- Let AI respond directly to customers when eligible.
- Escalate cleanly to humans when AI should stop.
- Provide an operator-first Support Inbox for monitoring, replying, escalating, and resolving conversations.

## Non-Goals

- Voice agent support.
- Broad outbound messaging or campaign workflows.
- Sales qualification flows.
- Embedded Widget delivery in the first release.
- WhatsApp template management in the MVP.
- Full media-first workflows in the MVP. Text is the first-class path.

## Approved Technology Direction

- `apps/web`: `Next.js` for the Support Inbox, auth UI, and admin pages.
- `apps/api`: `Fastify` for authenticated API endpoints, domain orchestration, and public Twilio webhooks.
- `apps/worker`: background worker for jobs, retries, outbound delivery, and `LangGraph` execution.
- `Better Auth`: authentication, organizations, memberships, invites, and roles for internal users.
- `Twilio`: WhatsApp connectivity for inbound and outbound messaging.
- `LangGraph`: AI orchestration for classification, context gathering, response generation, and escalation decisions.
- `Postgres`: source of truth for business data.
- `Redis`: queue and transient job coordination.

## Monorepo Structure

- `apps/web`: operator-facing web application and auth screens.
- `apps/api`: domain API, webhook entrypoints, and admin configuration endpoints.
- `apps/worker`: asynchronous processing runtime.
- shared packages may be added later for domain types, UI primitives, or client SDKs, but the initial design centers the three apps above.

## Architectural Style

Use a modular monolith with explicit adapters at the edges.

Why this style:

- simpler than a distributed system for an MVP
- strong enough to support multitenancy and future Channels
- easier to evolve into more separated services later if needed
- keeps operational boundaries clear between web, API, and worker

The system is split by responsibility, not by premature service count.

## High-Level Architecture

1. A customer sends a WhatsApp message.
2. Twilio calls a public webhook in `apps/api`.
3. `apps/api` validates the request, normalizes the payload, and persists the inbound message in Postgres.
4. `apps/api` publishes a job to Redis-backed queues.
5. `apps/worker` consumes the job and runs the `LangGraph` flow when the conversation is eligible for AI.
6. The worker persists its decision and, when appropriate, creates an outbound message record.
7. The worker sends the outbound message through the Twilio adapter.
8. Delivery and read updates return through Twilio webhooks and update message state.
9. `apps/web` reads conversation projections from `apps/api` and provides the operator workflow.

## Bounded Contexts

### Identity and Organizations

Handles:

- internal users
- organizations
- memberships
- invites
- role enforcement

Implementation direction:

- `Better Auth` is the auth foundation
- organizations and memberships are tenant boundaries
- the minimum roles are `owner/admin` and `operator`

### Contacts

Handles the canonical person being supported.

A Contact is persistent across time and may appear in multiple Conversations and multiple Channels.

### Channels

Represents the product-level concept of a customer-facing entry point.

Initial supported Channel:

- `whatsapp`

Future Channel example:

- `embedded_widget`

### Channel Connections

Represents a tenant's configured connection to a Channel.

For the MVP this means the organization's Twilio-backed WhatsApp connection, including the receiving number and secrets needed for verification and sending.

### Channel Identities

Represents a Contact's address inside a Channel.

Example:

- `whatsapp:+5511999999999`

A Contact may have many Channel Identities.

### Support Conversations

Represents the support interaction itself.

This is the operator-facing unit of work inside the Support Inbox.

### Messaging

Handles:

- inbound messages
- outbound messages
- delivery state
- read state
- sender attribution
- audit trail

### Knowledge Base

Stores or indexes the documents and sources used by AI to answer support questions.

### Agent Orchestration

Runs the `LangGraph` workflow that decides whether to:

- answer directly
- ask for more context
- escalate to a human operator

### Support Inbox

Provides query models and endpoints optimized for operator workflows.

## Core Domain Model

### Organization

The tenant boundary for B2B customers.

### User

An internal user who authenticates into the platform.

### Membership

Links a User to an Organization and carries a role.

### Channel

The generic concept of a customer-facing entry point.

### ChannelConnection

An Organization-specific configuration for a Channel.

For WhatsApp, this includes the Twilio-facing integration details for that tenant.

### Contact

The persistent supported person.

### ChannelIdentity

A Channel-specific address for a Contact.

### SupportConversation

The durable support thread tracked by operators between one ChannelIdentity and one ChannelConnection. Contact through a different ChannelConnection forms a separate thread, even when the ChannelIdentity is the same.

Suggested state machine:

- `open`: conversation was created and is awaiting routing or automation ownership. This state should be short-lived and transition quickly to `ai_active` or `human_required`
- `ai_active`: AI is eligible to continue responding
- `human_required`: human follow-up is required and AI auto-replies are disabled
- `resolved`: support work is considered complete

### Message

Each inbound or outbound communication event stored by the system.

Minimum fields should capture:

- organization
- conversation
- channel
- direction: inbound or outbound
- sender type: contact, ai, operator, or system
- raw provider identifiers
- normalized text body
- operational status
- timestamps

### KnowledgeDocument

Knowledge source available to retrieval and agent flows.

### AuditEvent

Immutable trail for important system events.

## Domain Rules

- Do not model customer contact as a `session`, `visitor`, or widget-scoped identity.
- The persistent unit is always `Contact + ChannelIdentity + SupportConversation`.
- WhatsApp is the first `Channel`, not a special-case architecture.
- Twilio is an adapter, not the source of truth.
- The AI runtime is not the system of record.
- The Support Inbox is the operational workspace and source of operator actions.

## Conversation Lifecycle

1. Customer sends an inbound WhatsApp message.
2. `apps/api` validates the Twilio signature.
3. The payload is normalized into internal message structures.
4. The system resolves the Organization from the WhatsApp ChannelConnection.
5. The system resolves or creates the Contact and ChannelIdentity.
6. The system resolves the active Conversation for the ChannelIdentity and ChannelConnection pair or creates a new one. A resolved Conversation is never reopened by a new inbound Message.
7. The inbound Message is persisted before any AI action starts.
8. A worker job is published.
9. `apps/worker` evaluates whether the Conversation is AI-eligible.
10. `LangGraph` decides to answer, ask for clarification, or escalate.
11. If answering, the system creates an outbound Message and sends it through Twilio.
12. Delivery updates return through webhook callbacks and update Message state.
13. If escalation is needed, the Conversation moves to `human_required`.
14. Operators continue in the Support Inbox.

## AI Behavior in the MVP

The approved AI mode is: respond directly when appropriate, then escalate when confidence or policy requires human involvement.

The AI may:

- retrieve tenant knowledge
- answer support questions
- ask follow-up questions
- stop and escalate to humans

The AI may not:

- keep responding after the Conversation enters `human_required`
- act as a side channel outside the core message model
- become the source of truth for Conversation state

Escalation triggers should include at least:

- explicit user request for a human
- low confidence or insufficient context
- unsupported policy area
- repeated failed attempts by the AI
- infrastructure failure in the agent flow

If the AI pipeline fails, the safe fallback is `human_required`.

## Auth and Tenancy

- `apps/web` authenticates internal users through `Better Auth`.
- `apps/api` exposes authenticated endpoints for the inbox and admin features.
- public endpoints exist only for Twilio webhooks and similar integrations.
- every tenant-scoped record must carry an Organization boundary.
- membership checks gate access to Organizations and their Support Conversations.
- the worker runs with internal credentials and bypasses browser-facing auth, but still operates on tenant-scoped records.
- Organizations are archived rather than physically deleted through normal product flows.
- tenant-owned support data must not be cascade-deleted when an Organization is archived.
- any future permanent purge requires a separate, explicit retention policy and workflow.

## Operator Roles

### owner/admin

Can:

- configure the Organization
- configure the WhatsApp ChannelConnection
- manage members and invites
- access operational settings

### operator

Can:

- view assigned or visible Support Conversations
- reply in the Support Inbox
- escalate or resolve Conversations

## Support Inbox Requirements

### Conversation List

Must show at least:

- Conversation status
- contact name or normalized phone identifier
- last activity time
- last message preview
- whether the last responder was AI, human, or customer

### Conversation Detail

Must show:

- unified timeline of inbound and outbound messages
- operational events such as escalation, retries, and failures
- clear attribution for each message: contact, AI, operator, or system
- controls for replying, escalating, and resolving

Operators reply from the Support Inbox only.

## WhatsApp-Specific Rules

- respect the 24-hour WhatsApp customer care window
- do not attempt free-form outbound messages outside that window
- out-of-window conversations become operational exceptions or future template-driven flows
- template management is outside MVP scope
- text is the primary supported content type in MVP
- the model may include media-ready fields, but media workflows are not required for first release

## Reliability and Failure Handling

- validate every Twilio webhook before processing
- reject and audit invalid signatures, unknown tenants, and unknown ChannelConnections
- apply idempotency keys to inbound provider events
- persist inbound messages before queueing downstream work
- never execute the AI flow inline in the webhook request
- use retry with backoff for transient failures in Twilio delivery, LLM calls, retrieval, and queue handling
- move exhausted jobs to a dead-letter queue with operational visibility
- if outbound delivery fails, the Message state must reflect failure explicitly
- accept out-of-order delivery/read callbacks only when the transition is consistent

## Concurrency Rules

- active Conversation states are `open`, `ai_active`, and `human_required`
- only one active Conversation should exist per `Organization + ChannelIdentity + ChannelConnection`
- while that Conversation is active, new inbound Messages join it regardless of elapsed time
- after that Conversation is resolved, a new inbound Message creates a new Conversation rather than reopening the resolved one
- the WhatsApp customer care window controls outbound eligibility, not Conversation identity
- the system must prevent AI and operator replies from double-sending concurrently on the same Conversation
- when a Conversation enters `human_required`, AI auto-reply eligibility is removed until the state changes explicitly

## Observability

Minimum structured logging dimensions:

- `organizationId`
- `conversationId`
- `channelIdentityId`
- `messageId`
- `jobId`

Minimum metrics:

- inbound message volume by tenant
- time to first response
- AI-to-human escalation rate
- outbound failure rate
- retry count
- dead-letter job count

Tracing should cover `apps/api`, `apps/worker`, the Twilio adapter, and the `LangGraph` runtime.

## Testing Strategy

### Unit Tests

Cover:

- Contact and ChannelIdentity resolution
- Conversation open and reopen rules
- AI eligibility rules
- Conversation state transitions

### Integration Tests

Cover:

- Twilio inbound webhook to persisted Message
- worker execution to outbound Message creation
- operator reply to outbound delivery invocation

### Contract Tests

Cover:

- Twilio signature validation and payload normalization
- `Better Auth` integration surfaces needed by `apps/web` and `apps/api`

### End-to-End Tests

Cover:

- operator login
- Conversation list visibility
- Conversation detail timeline
- human reply flow
- AI handoff to human flow

### Production Smoke Checks

Cover:

- webhook health
- queue health
- database connectivity
- AI provider reachability

## Delivery Strategy

Build in vertical slices:

1. monorepo foundation and core domain model
2. auth, Organizations, Memberships, and invites
3. tenant WhatsApp ChannelConnection configuration
4. inbound WhatsApp ingestion
5. minimal Support Inbox
6. operator outbound reply flow
7. AI response and escalation flow
8. observability, retries, and hardening

## Reuse Strategy from the Current Repo

Reuse from the current repo as reference only:

- Support Inbox interaction patterns
- conversation-centric operator workflow
- admin UX ideas
- terminology from `CONTEXT.md`

Do not preserve as technical foundation:

- `Clerk`
- `Convex`
- widget-centric session modeling
- embedded-first assumptions
- voice agent and Vapi dependencies

## Roadmap Execution Constraint

When the roadmap is turned into implementation issues, create them in Linear and organize them under a Linear project named `echo`.
