-- H1: Fix RLS policy for vote cancellation
-- The previous policy votes_update_open_only only allowed UPDATE when statut = 'OUVERT',
-- but cancelVote needs to update CLOS votes to ANNULE.
-- This new policy allows gestionnaire to update votes in OUVERT or CLOS status.

DROP POLICY IF EXISTS "votes_update_open_only" ON votes;

CREATE POLICY "votes_update_gestionnaire" ON votes
  FOR UPDATE TO authenticated
  USING (is_admin_or_gestionnaire() AND statut IN ('OUVERT', 'CLOS'))
  WITH CHECK (is_admin_or_gestionnaire());
