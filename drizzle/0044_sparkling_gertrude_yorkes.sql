ALTER TABLE `dataforseo_spend` ADD `task_id` text;--> statement-breakpoint
ALTER TABLE `dataforseo_spend` ADD `subject` text;--> statement-breakpoint
CREATE UNIQUE INDEX `dataforseo_spend_task_id_idx` ON `dataforseo_spend` (`task_id`);