ALTER TABLE "messages" DROP CONSTRAINT "messages_body_check";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "content_type" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_type_check" CHECK ("messages"."content_type" in ('text', 'unsupported'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_body_check" CHECK (("messages"."content_type" = 'text' and "messages"."body" is not null and length(btrim("messages"."body")) > 0) or ("messages"."content_type" = 'unsupported' and "messages"."body" is null));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_unsupported_inbound_check" CHECK ("messages"."content_type" <> 'unsupported' or ("messages"."direction" = 'inbound' and "messages"."sender_type" = 'contact' and "messages"."status" = 'received'));