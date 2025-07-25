CREATE TABLE "document_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_document_id" serial NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"start_position" integer,
	"end_position" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" serial NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" serial NOT NULL,
	"keyword" varchar(100) NOT NULL,
	"bm25_score" numeric(10, 6) NOT NULL,
	"term_frequency" integer NOT NULL,
	"document_frequency" integer NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" varchar(500) NOT NULL,
	"title" text,
	"full_content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"message_id" varchar(20),
	"channel_id" varchar(20),
	"author_id" varchar(20),
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "embeddings" RENAME COLUMN "document_id" TO "chunk_id";--> statement-breakpoint
ALTER TABLE "keywords" RENAME COLUMN "document_id" TO "chunk_id";--> statement-breakpoint
ALTER TABLE "embeddings" DROP CONSTRAINT "embeddings_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "keywords" DROP CONSTRAINT "keywords_document_id_documents_id_fk";
--> statement-breakpoint
DROP INDEX "document_id_idx";--> statement-breakpoint
DROP INDEX "keywords_document_id_idx";--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_embeddings" ADD CONSTRAINT "legacy_embeddings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_keywords" ADD CONSTRAINT "legacy_keywords_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunks_source_document_id_idx" ON "document_chunks" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "document_chunks_chunk_index_idx" ON "document_chunks" USING btree ("chunk_index");--> statement-breakpoint
CREATE INDEX "document_chunks_source_doc_chunk_idx" ON "document_chunks" USING btree ("source_document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "legacy_embeddings_document_id_idx" ON "legacy_embeddings" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "legacy_keywords_document_id_idx" ON "legacy_keywords" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "legacy_keywords_keyword_idx" ON "legacy_keywords" USING btree ("keyword");--> statement-breakpoint
CREATE INDEX "legacy_keywords_bm25_score_idx" ON "legacy_keywords" USING btree ("bm25_score");--> statement-breakpoint
CREATE INDEX "source_documents_url_idx" ON "source_documents" USING btree ("url");--> statement-breakpoint
CREATE INDEX "source_documents_message_id_idx" ON "source_documents" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "source_documents_created_at_idx" ON "source_documents" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embeddings_chunk_id_idx" ON "embeddings" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "keywords_chunk_id_idx" ON "keywords" USING btree ("chunk_id");