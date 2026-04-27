-- Options d'écrans configurables par instance
ALTER TABLE instance_config ADD COLUMN IF NOT EXISTS ecran_public_active BOOLEAN DEFAULT TRUE;
ALTER TABLE instance_config ADD COLUMN IF NOT EXISTS tablette_president_active BOOLEAN DEFAULT FALSE;
ALTER TABLE instance_config ADD COLUMN IF NOT EXISTS type_secretaire TEXT DEFAULT 'ELU' CHECK (type_secretaire IN ('ELU', 'ADMINISTRATIF'));
ALTER TABLE instance_config ADD COLUMN IF NOT EXISTS tablettes_individuelles BOOLEAN DEFAULT FALSE;
ALTER TABLE instance_config ADD COLUMN IF NOT EXISTS enregistrement_audio BOOLEAN DEFAULT FALSE;
