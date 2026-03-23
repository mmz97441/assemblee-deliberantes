-- ============================================================
-- Migration 00015: Phase 2 — Arrivée tardive, Secrétaire, Approbation PV
-- ============================================================

-- 1. Add arrivee_tardive flag to presences
ALTER TABLE presences ADD COLUMN IF NOT EXISTS arrivee_tardive BOOLEAN DEFAULT FALSE;

-- 2. Add secretaire_designation_mode to seances (DIRECT or VOTE)
ALTER TABLE seances ADD COLUMN IF NOT EXISTS secretaire_designation_mode TEXT CHECK (secretaire_designation_mode IN ('DIRECT', 'VOTE'));

-- 3. Add pv_precedent_seance_id to odj_points for APPROBATION_PV linking
ALTER TABLE odj_points ADD COLUMN IF NOT EXISTS pv_precedent_seance_id UUID REFERENCES seances(id);

-- 4. Index for quick PV lookup by seance
CREATE INDEX IF NOT EXISTS idx_pv_seance_statut ON pv (seance_id, statut);

-- 5. Index for quick presence lookup with arrivee_tardive
CREATE INDEX IF NOT EXISTS idx_presences_tardive ON presences (seance_id) WHERE arrivee_tardive = TRUE;
