CREATE TABLE "keywords" (
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
ALTER TABLE "init_jobs" ADD COLUMN "keywords_extracted" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "keywords_document_id_idx" ON "keywords" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "keywords_keyword_idx" ON "keywords" USING btree ("keyword");--> statement-breakpoint
CREATE INDEX "keywords_bm25_score_idx" ON "keywords" USING btree ("bm25_score");