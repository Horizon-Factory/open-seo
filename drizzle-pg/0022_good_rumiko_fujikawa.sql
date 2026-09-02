ALTER TABLE "dataforseo_spend" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "dataforseo_spend" ADD COLUMN "subject" text;--> statement-breakpoint
CREATE UNIQUE INDEX "dataforseo_spend_task_id_idx" ON "dataforseo_spend" USING btree ("task_id");