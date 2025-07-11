CREATE TABLE `engineer_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`base_system_prompt` text,
	`custom_instructions` text,
	`total_tasks` integer DEFAULT 0,
	`successful_tasks` integer DEFAULT 0,
	`average_duration_ms` integer,
	`average_turns` real,
	`total_cost_usd` real DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repository_url` text NOT NULL,
	`default_branch` text DEFAULT 'main' NOT NULL,
	`description` text,
	`github_owner` text,
	`github_repo` text,
	`auto_create_pr` integer DEFAULT true,
	`require_tests` integer DEFAULT true,
	`default_review_timeout_minutes` integer DEFAULT 10,
	`encrypted_github_token` text,
	`github_username` text,
	`last_activity_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`total_tasks` integer DEFAULT 0,
	`completed_tasks` integer DEFAULT 0,
	`total_cost_usd` real DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_repository_url_unique` ON `projects` (`repository_url`);--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`engineer_profile_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`acceptance_criteria` text DEFAULT '[]',
	`task_type` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 0,
	`base_branch` text,
	`feature_branch` text,
	`pr_url` text,
	`commit_hash` text,
	`duration_ms` integer,
	`cost_usd` real,
	`tokens_input` integer,
	`tokens_output` integer,
	`num_turns` integer,
	`result_summary` text,
	`files_changed` text,
	`test_results` text,
	`error_message` text,
	`container_id` text,
	`workspace_path` text,
	`session_id` text,
	`review_status` text,
	`review_comments` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`engineer_profile_id`) REFERENCES `engineer_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
