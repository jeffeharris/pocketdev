-- Migration: Add Git user settings
-- This migration adds git user configuration settings to the settings table

-- Insert default git user settings if they don't exist
INSERT OR IGNORE INTO settings (key, value) VALUES ('git_user_name', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('git_user_email', '');

-- Add a timestamp for when this migration was applied
INSERT OR REPLACE INTO settings (key, value) VALUES ('migration_002_applied', datetime('now'));