-- Migration: Add split view layout support
-- Date: 2025-07-29
-- Description: Adds column to store split view layout configuration for tasks

-- Add split_layout column to tasks table
-- This will store JSON configuration for split view layouts
ALTER TABLE tasks ADD COLUMN split_layout JSON;

-- Example JSON structure:
-- {
--   "mode": "split" | "tab",
--   "orientation": "horizontal" | "vertical",
--   "primaryTerminalId": "terminal-session-id-1",
--   "secondaryTerminalId": "terminal-session-id-2",
--   "splitRatio": 0.5
-- }

-- Index for tasks with split layouts (for potential future analytics)
CREATE INDEX IF NOT EXISTS idx_tasks_split_layout ON tasks(id) WHERE split_layout IS NOT NULL;