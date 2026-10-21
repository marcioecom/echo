# Inbound audio transcription

- Status: Accepted
- Date: 2026-10-20

## Context

WhatsApp is the Primary Channel, and customers send voice notes as readily as text. Until now, inbound audio was normalized as `unsupported` and force-handed off to an operator. Operators had to listen to every recording before responding, the audio disappeared from text-based history, and the Support Agent could not answer it at all. Customers were asked to repeat themselves in writing.

The support core already treats a `Message` as the unit of communication and the `SupportConversation` as the operator's unit of work. Audio needs to fit that model instead of becoming a side channel.

## Decision

- Audio is a first-class inbound `Message` content type (`messages.content_type = 'audio'`), not `unsupported`. The transcript is stored in `messages.body`, so the Support Inbox, conversation history, and the Support Agent read one normalized text source.
- Media metadata lives in `message_media`: MIME type, size, duration, download status, object key, provider reference, and transcription status, model, and language. Bytes live in R2 and never travel through Redis or BullMQ.
- The application that owns the provider session fetches the bytes. `apps/wa-gateway` downloads Baileys audio with the socket's media keys and uploads it directly to R2, returning only the object key. For Twilio, `apps/worker` downloads from the media URL with the decrypted account credentials and uploads to R2. `apps/api` never handles audio bytes.
- Transcription runs as the `transcribe-inbound-audio` worker job. It calls the Vercel AI Gateway transcription endpoint (`/v4/ai/transcription-model`) with base64 audio and the model in the `ai-model-id` header. The model is configured with `AI_TRANSCRIPTION_MODEL` and defaults to `openai/gpt-4o-mini-transcribe`.
- The transcript is written to `messages.body` only while the body is null, then `message_media` records `transcript_status`, `transcript_model`, and `transcript_language`. The normal `process-inbound-message` flow runs afterwards, so the agent handles audio exactly like text.
- Playback is served on demand. `GET /v1/support-conversations/:conversationId/messages/:messageId/media` checks the caller's Organization, then returns a short-lived signed R2 URL. Audio URLs are never embedded in the timeline payload.
- Outbound remains text-only. The platform does not synthesize or send audio.
- A permanent media download or transcription failure marks the media or transcript `failed`, records an audit event, and degrades the conversation to `human_required` with reason `transcription_failed`. The original audio Message is preserved with a null body.

## Consequences

Audio becomes usable by both operators and the agent without changing the text-first support model. Operators read instead of listening, the AI can answer voice notes, and every failed download or transcription leaves an audit trail. Because the transcript is just `Message.body`, channel adapters and the agent need no audio-specific branches, and future Channels can reuse the same pipeline.

The cost is operational. Inbound audio consumes R2 storage and incurs per-audio transcription charges, and answering takes longer because download and transcription add two queue hops before the agent runs. Baileys retrieval depends on the gateway still owning the session and on the message cache, which expires after 24 hours. A retention policy for audio bytes is still undefined. Outbound audio is not supported, so a conversation that starts with a voice note still continues in text.
