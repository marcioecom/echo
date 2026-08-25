CREATE TABLE "knowledge_document_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"knowledge_document_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"content" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_document_chunks_organization_document_ordinal_unique" UNIQUE("organization_id","knowledge_document_id","ordinal")
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"content" text,
	"source_name" text,
	"mime_type" text,
	"source_object_key" text,
	"source_object_etag" text,
	"source_size_bytes" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_documents_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "knowledge_documents_source_check" CHECK (("knowledge_documents"."source_type" = 'text' and "knowledge_documents"."content" is not null and "knowledge_documents"."source_name" is null and "knowledge_documents"."mime_type" is null and "knowledge_documents"."source_object_key" is null and "knowledge_documents"."source_object_etag" is null and "knowledge_documents"."source_size_bytes" is null) or ("knowledge_documents"."source_type" = 'file' and "knowledge_documents"."source_name" is not null and "knowledge_documents"."mime_type" is not null and "knowledge_documents"."source_object_key" is not null and "knowledge_documents"."source_object_etag" is not null and "knowledge_documents"."source_size_bytes" is not null))
);
--> statement-breakpoint
ALTER TABLE "knowledge_document_chunks" ADD CONSTRAINT "knowledge_document_chunks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_chunks" ADD CONSTRAINT "knowledge_document_chunks_document_fk" FOREIGN KEY ("organization_id","knowledge_document_id") REFERENCES "public"."knowledge_documents"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_document_chunks_document_idx" ON "knowledge_document_chunks" USING btree ("organization_id","knowledge_document_id");--> statement-breakpoint
CREATE INDEX "knowledge_document_chunks_embedding_hnsw_idx" ON "knowledge_document_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_documents_organization_status_updated_at_idx" ON "knowledge_documents" USING btree ("organization_id","status","updated_at");