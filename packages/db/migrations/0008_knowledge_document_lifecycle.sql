CREATE TABLE "knowledge_storage_deletions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"knowledge_document_id" text NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "knowledge_storage_deletions_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_storage_deletions" ADD CONSTRAINT "knowledge_storage_deletions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_storage_deletions" ADD CONSTRAINT "knowledge_storage_deletions_document_fk" FOREIGN KEY ("organization_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_storage_deletions_pending_idx" ON "knowledge_storage_deletions" USING btree ("created_at") WHERE "knowledge_storage_deletions"."completed_at" is null;--> statement-breakpoint
CREATE INDEX "knowledge_documents_active_organization_updated_at_idx" ON "knowledge_documents" USING btree ("organization_id","updated_at") WHERE "knowledge_documents"."deleted_at" is null;