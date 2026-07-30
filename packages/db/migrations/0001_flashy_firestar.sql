CREATE TABLE "channel_connection_provider_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel_connection_id" text NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text NOT NULL,
	"external_sender_id" text NOT NULL,
	"routing_address" text NOT NULL,
	"credentials_ciphertext" text NOT NULL,
	"credentials_nonce" text NOT NULL,
	"credentials_auth_tag" text NOT NULL,
	"credentials_key_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_connection_provider_bindings_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "channel_connection_provider_bindings_connection_unique" UNIQUE("organization_id","channel_connection_id"),
	CONSTRAINT "channel_connection_provider_bindings_provider_check" CHECK ("channel_connection_provider_bindings"."provider" in ('twilio'))
);
--> statement-breakpoint
ALTER TABLE "channel_connection_provider_bindings" ADD CONSTRAINT "channel_connection_provider_bindings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_connection_provider_bindings" ADD CONSTRAINT "channel_connection_provider_bindings_connection_fk" FOREIGN KEY ("organization_id","channel_connection_id") REFERENCES "public"."channel_connections"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connection_provider_bindings_routing_uidx" ON "channel_connection_provider_bindings" USING btree ("provider","external_account_id","routing_address");--> statement-breakpoint
CREATE INDEX "channel_connection_provider_bindings_organization_id_idx" ON "channel_connection_provider_bindings" USING btree ("organization_id");