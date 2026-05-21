-- Migration 00013: Add noms_pour column to votes table for nominal (roll call) votes
-- Nominal votes record EVERY voter's name by choice category

ALTER TABLE votes ADD COLUMN IF NOT EXISTS noms_pour TEXT[] DEFAULT '{}';
