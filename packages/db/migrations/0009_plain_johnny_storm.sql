CREATE TABLE "message_media" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"message_id" text NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer,
	"duration_ms" integer,
	"download_status" text DEFAULT 'pending' NOT NULL,
	"object_key" text,
	"provider_ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transcript_status" text DEFAULT 'pending' NOT NULL,
	"transcript_model" text,
	"transcript_language" text,
	"transcription_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_media_organization_message_unique" UNIQUE("organization_id","message_id"),
	CONSTRAINT "message_media_kind_check" CHECK ("message_media"."kind" in ('audio')),
	CONSTRAINT "message_media_download_status_check" CHECK ("message_media"."download_status" in ('pending', 'stored', 'failed')),
	CONSTRAINT "message_media_transcript_status_check" CHECK ("message_media"."transcript_status" in ('pending', 'transcribing', 'completed', 'failed')),
	CONSTRAINT "message_media_object_key_check" CHECK ("message_media"."download_status" <> 'stored' or "message_media"."object_key" is not null),
	CONSTRAINT "message_media_size_check" CHECK ("message_media"."size_bytes" is null or "message_media"."size_bytes" > 0),
	CONSTRAINT "message_media_duration_check" CHECK ("message_media"."duration_ms" is null or "message_media"."duration_ms" > 0)
);
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_content_type_check";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_content_body_check";--> statement-breakpoint
ALTER TABLE "support_conversations" DROP CONSTRAINT "support_conversations_handoff_reason_check";--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_media_organization_download_status_idx" ON "message_media" USING btree ("organization_id","download_status");--> statement-breakpoint
CREATE INDEX "message_media_organization_transcript_status_idx" ON "message_media" USING btree ("organization_id","transcript_status");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_audio_inbound_only_check" CHECK ("messages"."content_type" <> 'audio' or "messages"."direction" = 'inbound');--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_type_check" CHECK ("messages"."content_type" in ('text', 'audio', 'unsupported'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_body_check" CHECK (("messages"."content_type" = 'text' and "messages"."body" is not null and length(btrim("messages"."body")) > 0) or ("messages"."content_type" = 'audio' and ("messages"."body" is null or length(btrim("messages"."body")) > 0)) or ("messages"."content_type" = 'unsupported' and "messages"."body" is null));--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_handoff_reason_check" CHECK ("support_conversations"."handoff_reason" is null or "support_conversations"."handoff_reason" in ('human_requested', 'low_confidence', 'unsupported_policy', 'ai_failure', 'unsupported_content', 'transcription_failed', 'operator_takeover'));