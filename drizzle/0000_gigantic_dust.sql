CREATE TABLE `crime_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `geocode_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`lat` real,
	`lng` real,
	`street` text,
	`city` text,
	`state` text,
	`zip` text,
	`fips_state` text,
	`fips_county` text,
	`fips_tract` text,
	`provider` text NOT NULL,
	`fetched_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nickname` text NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`zip` text DEFAULT '' NOT NULL,
	`lat` real,
	`lng` real,
	`fips_state` text,
	`fips_county` text,
	`fips_tract` text,
	`list_price` real DEFAULT 0 NOT NULL,
	`property_tax_annual` real DEFAULT 0 NOT NULL,
	`insurance_annual` real DEFAULT 0 NOT NULL,
	`hoa_monthly` real DEFAULT 0 NOT NULL,
	`beds` real,
	`baths` real,
	`sqft` integer,
	`notes` text DEFAULT '' NOT NULL,
	`notes_private` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'watching' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`property_id` integer NOT NULL,
	`name` text DEFAULT 'Scenario' NOT NULL,
	`down_payment_pct` real DEFAULT 0 NOT NULL,
	`interest_rate` real DEFAULT 6.5 NOT NULL,
	`term_years` integer DEFAULT 30 NOT NULL,
	`funding_fee_financed` integer DEFAULT true NOT NULL,
	`funding_fee_exempt` integer DEFAULT false NOT NULL,
	`va_first_use` integer DEFAULT true NOT NULL,
	`closing_overrides` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scenarios_property_idx` ON `scenarios` (`property_id`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`token` text PRIMARY KEY NOT NULL,
	`property_id` integer,
	`label` text DEFAULT '' NOT NULL,
	`expires_at` integer,
	`read_only` integer DEFAULT true NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
