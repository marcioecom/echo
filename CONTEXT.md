# AI Support Platform

This context covers a B2B customer support platform that uses AI to handle inbound support conversations across customer-facing channels.

## Language

**Organization**:
A B2B customer whose data and support operations form an isolated tenant boundary in the platform.
_Avoid_: Account, workspace, customer tenant

**Channel**:
A customer-facing entry point that can originate or carry a support conversation. Examples include WhatsApp and the embedded widget.
_Avoid_: Integration, transport, inbox

**Primary Channel**:
The channel used for the first production rollout. In this project, the Primary Channel is WhatsApp.
_Avoid_: Main integration, default widget

**Channel Connection**:
An Organization's configured connection to a Channel, including the address and credentials needed to receive and send through that Channel.
_Avoid_: Channel, Twilio account, integration

**Embedded Widget**:
A web Channel delivered inside the customer's site. It is a future or secondary Channel for this project, not the initial Primary Channel.
_Avoid_: Chatbox, iframe app

**Support Conversation**:
A customer support interaction about a question, issue, or request for help between one Channel Identity and one Channel Connection. Contact through a different Channel Connection forms a separate Support Conversation, even when the Channel Identity is the same. New interactions join the active Support Conversation for that pair; after it is resolved, a new interaction starts a new Support Conversation. In this project, Support Conversations exclude sales qualification and outbound campaigns.
_Avoid_: Lead, campaign, broadcast

**Support Inbox**:
The operator workspace where Support Conversations are monitored, responded to, escalated, and resolved. In this project, the Support Inbox is the system of record for support operations.
_Avoid_: Copilot panel, external help desk, side tool

**Contact**:
A person who interacts with the Support Inbox across one or more Channels. A Contact can have many Channel Identities and many Support Conversations over time.
_Avoid_: Session, visitor, lead

**Channel Identity**:
A Channel-specific address that links a Contact to a Channel, such as a WhatsApp phone number or an embedded widget identifier. Within an Organization, the same normalized address identifies the same Channel Identity regardless of which Channel Connection carried the interaction. A Contact can have multiple Channel Identities.
_Avoid_: Session token, transport ID, account

**Message**:
An inbound or outbound communication within a Support Conversation, attributed to a Contact, AI, operator, or the system.
_Avoid_: Audit event, job, provider callback

**Audit Event**:
An immutable record of an operationally important action or state change, such as escalation, retry, failure, or resolution. It is not customer-facing communication.
_Avoid_: Message, mutable log entry

## Example Dialogue

Dev: What is our Primary Channel for the first rollout?

Domain Expert: WhatsApp. The Embedded Widget may come later, but it is not the initial Channel.

Dev: So Channel is the generic concept, and WhatsApp is just the first instance?

Domain Expert: Exactly.

Dev: Are we using the same flow for support and sales?

Domain Expert: No. For now we only model Support Conversations.

Dev: Does the team answer customers in another tool?

Domain Expert: No. The Support Inbox in this product is the official workspace for operators.

Dev: If the same person returns on another day or another Channel, do we treat them as new?

Domain Expert: No. We model a persistent Contact that can carry multiple Channel Identities across time.
