-- Migration: Add is_active column to activity table in public and sandbox schemas
-- Date: 2026-09-18
-- Author: Antigravity (Implementer)
-- Ref: docs/testing/FIX_SPEC_2026-09-18_candidates_archive-application-and-edit-job.md

ALTER TABLE public.activity  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE sandbox.activity ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
