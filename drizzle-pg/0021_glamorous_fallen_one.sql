CREATE TABLE "dataforseo_spend" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text,
	"project_id" text,
	"path" text NOT NULL,
	"credit_feature" text NOT NULL,
	"cost_usd" real NOT NULL,
	"source" text,
	"outcome" text DEFAULT 'ok' NOT NULL,
	"occurred_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dataforseo_spend" ADD CONSTRAINT "dataforseo_spend_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dataforseo_spend_occurred_idx" ON "dataforseo_spend" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "dataforseo_spend_feature_idx" ON "dataforseo_spend" USING btree ("credit_feature");--> statement-breakpoint
CREATE INDEX "dataforseo_spend_project_idx" ON "dataforseo_spend" USING btree ("project_id");