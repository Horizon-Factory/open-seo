CREATE TABLE `dataforseo_spend` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` text,
	`project_id` text,
	`path` text NOT NULL,
	`credit_feature` text NOT NULL,
	`cost_usd` real NOT NULL,
	`source` text,
	`outcome` text DEFAULT 'ok' NOT NULL,
	`occurred_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `dataforseo_spend_occurred_idx` ON `dataforseo_spend` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `dataforseo_spend_feature_idx` ON `dataforseo_spend` (`credit_feature`);--> statement-breakpoint
CREATE INDEX `dataforseo_spend_project_idx` ON `dataforseo_spend` (`project_id`);