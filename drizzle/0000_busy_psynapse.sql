CREATE TABLE "discord_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" varchar(20) NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"guild_id" varchar(20),
	"author_id" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discord_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"source" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "init_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"category_id" varchar(20) NOT NULL,
	"category_name" varchar(100) NOT NULL,
	"initiated_by" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_channels" integer DEFAULT 0,
	"processed_channels" integer DEFAULT 0,
	"total_messages" integer DEFAULT 0,
	"processed_messages" integer DEFAULT 0,
	"links_found" integer DEFAULT 0,
	"documents_created" integer DEFAULT 0,
	"keywords_extracted" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(20) NOT NULL,
	"guild_id" varchar(20),
	"query" text NOT NULL,
	"response" text NOT NULL,
	"confidence" numeric(5, 4),
	"processing_time" integer,
	"sources_used" jsonb DEFAULT '[]'::jsonb,
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
CREATE INDEX "message_id_idx" ON "discord_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "channel_id_idx" ON "discord_messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "guild_id_idx" ON "discord_messages" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "author_id_idx" ON "discord_messages" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "source_idx" ON "documents" USING btree ("source");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "init_jobs_guild_id_idx" ON "init_jobs" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "init_jobs_status_idx" ON "init_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "init_jobs_created_at_idx" ON "init_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rag_user_id_idx" ON "rag_queries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rag_guild_id_idx" ON "rag_queries" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "rag_created_at_idx" ON "rag_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "source_documents_url_idx" ON "source_documents" USING btree ("url");--> statement-breakpoint
CREATE INDEX "source_documents_message_id_idx" ON "source_documents" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "source_documents_created_at_idx" ON "source_documents" USING btree ("created_at");