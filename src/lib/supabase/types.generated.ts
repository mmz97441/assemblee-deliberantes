// Types generes automatiquement depuis Supabase
// NE PAS MODIFIER A LA MAIN — regenerer avec: npx supabase gen types typescript --project-id rvcyxgtqxqzmqecerjvy
// Derniere generation: 2026-03-20

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bulletins_secret: {
        Row: {
          bulletin_token: string
          choix_chiffre: string
          hash_integrite: string
          horodatage_serveur: string | null
          id: string
          nonce: string
          vote_id: string
        }
        Insert: {
          bulletin_token: string
          choix_chiffre: string
          hash_integrite: string
          horodatage_serveur?: string | null
          id?: string
          nonce: string
          vote_id: string
        }
        Update: {
          bulletin_token?: string
          choix_chiffre?: string
          hash_integrite?: string
          horodatage_serveur?: string | null
          id?: string
          nonce?: string
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletins_secret_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletins_vote: {
        Row: {
          choix: string
          device_id: string | null
          est_procuration: boolean | null
          hash_integrite: string
          horodatage_serveur: string | null
          id: string
          mandant_id: string | null
          member_id: string
          nonce: string
          vote_id: string
        }
        Insert: {
          choix: string
          device_id?: string | null
          est_procuration?: boolean | null
          hash_integrite: string
          horodatage_serveur?: string | null
          id?: string
          mandant_id?: string | null
          member_id: string
          nonce: string
          vote_id: string
        }
        Update: {
          choix?: string
          device_id?: string | null
          est_procuration?: boolean | null
          hash_integrite?: string
          horodatage_serveur?: string | null
          id?: string
          mandant_id?: string | null
          member_id?: string
          nonce?: string
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletins_vote_mandant_id_fkey"
            columns: ["mandant_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletins_vote_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletins_vote_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      convocataires: {
        Row: {
          ar_recu_at: string | null
          canal_communication: string | null
          confirme_at: string | null
          created_at: string | null
          envoye_at: string | null
          erreur_detail: string | null
          id: string
          lu_at: string | null
          member_id: string
          seance_id: string
          statut_convocation:
            | Database["public"]["Enums"]["convocation_statut"]
            | null
          token_confirmation: string | null
          updated_at: string | null
        }
        Insert: {
          ar_recu_at?: string | null
          canal_communication?: string | null
          confirme_at?: string | null
          created_at?: string | null
          envoye_at?: string | null
          erreur_detail?: string | null
          id?: string
          lu_at?: string | null
          member_id: string
          seance_id: string
          statut_convocation?:
            | Database["public"]["Enums"]["convocation_statut"]
            | null
          token_confirmation?: string | null
          updated_at?: string | null
        }
        Update: {
          ar_recu_at?: string | null
          canal_communication?: string | null
          confirme_at?: string | null
          created_at?: string | null
          envoye_at?: string | null
          erreur_detail?: string | null
          id?: string
          lu_at?: string | null
          member_id?: string
          seance_id?: string
          statut_convocation?:
            | Database["public"]["Enums"]["convocation_statut"]
            | null
          token_confirmation?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convocataires_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocataires_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      deliberations: {
        Row: {
          affiche_at: string | null
          annulee: boolean | null
          contenu_articles: Json | null
          created_at: string | null
          id: string
          motif_annulation: string | null
          numero: string | null
          odj_point_id: string | null
          pdf_url: string | null
          publie_at: string | null
          seance_id: string
          titre: string
          transmis_prefecture_at: string | null
          updated_at: string | null
          vote_id: string | null
        }
        Insert: {
          affiche_at?: string | null
          annulee?: boolean | null
          contenu_articles?: Json | null
          created_at?: string | null
          id?: string
          motif_annulation?: string | null
          numero?: string | null
          odj_point_id?: string | null
          pdf_url?: string | null
          publie_at?: string | null
          seance_id: string
          titre: string
          transmis_prefecture_at?: string | null
          updated_at?: string | null
          vote_id?: string | null
        }
        Update: {
          affiche_at?: string | null
          annulee?: boolean | null
          contenu_articles?: Json | null
          created_at?: string | null
          id?: string
          motif_annulation?: string | null
          numero?: string | null
          odj_point_id?: string | null
          pdf_url?: string | null
          publie_at?: string | null
          seance_id?: string
          titre?: string
          transmis_prefecture_at?: string | null
          updated_at?: string | null
          vote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliberations_odj_point_id_fkey"
            columns: ["odj_point_id"]
            isOneToOne: false
            referencedRelation: "odj_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliberations_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliberations_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_config: {
        Row: {
          actif: boolean | null
          composition_max: number | null
          created_at: string | null
          delai_convocation_jours: number | null
          id: string
          majorite_defaut:
            | Database["public"]["Enums"]["majorite_requise"]
            | null
          mode_arrivee_tardive:
            | Database["public"]["Enums"]["late_arrival_mode"]
            | null
          nom: string
          quorum_fraction_denominateur: number | null
          quorum_fraction_numerateur: number | null
          quorum_type: Database["public"]["Enums"]["quorum_type"] | null
          seances_publiques_defaut: boolean | null
          type_legal: string
          updated_at: string | null
          voix_preponderante: boolean | null
          vote_secret_nominations: boolean | null
          votes_qd_autorises: boolean | null
        }
        Insert: {
          actif?: boolean | null
          composition_max?: number | null
          created_at?: string | null
          delai_convocation_jours?: number | null
          id?: string
          majorite_defaut?:
            | Database["public"]["Enums"]["majorite_requise"]
            | null
          mode_arrivee_tardive?:
            | Database["public"]["Enums"]["late_arrival_mode"]
            | null
          nom: string
          quorum_fraction_denominateur?: number | null
          quorum_fraction_numerateur?: number | null
          quorum_type?: Database["public"]["Enums"]["quorum_type"] | null
          seances_publiques_defaut?: boolean | null
          type_legal: string
          updated_at?: string | null
          voix_preponderante?: boolean | null
          vote_secret_nominations?: boolean | null
          votes_qd_autorises?: boolean | null
        }
        Update: {
          actif?: boolean | null
          composition_max?: number | null
          created_at?: string | null
          delai_convocation_jours?: number | null
          id?: string
          majorite_defaut?:
            | Database["public"]["Enums"]["majorite_requise"]
            | null
          mode_arrivee_tardive?:
            | Database["public"]["Enums"]["late_arrival_mode"]
            | null
          nom?: string
          quorum_fraction_denominateur?: number | null
          quorum_fraction_numerateur?: number | null
          quorum_type?: Database["public"]["Enums"]["quorum_type"] | null
          seances_publiques_defaut?: boolean | null
          type_legal?: string
          updated_at?: string | null
          voix_preponderante?: boolean | null
          vote_secret_nominations?: boolean | null
          votes_qd_autorises?: boolean | null
        }
        Relationships: []
      }
      instance_members: {
        Row: {
          actif: boolean | null
          created_at: string | null
          fonction_dans_instance: string | null
          id: string
          instance_config_id: string
          member_id: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          fonction_dans_instance?: string | null
          id?: string
          instance_config_id: string
          member_id: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          fonction_dans_instance?: string | null
          id?: string
          instance_config_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_members_instance_config_id_fkey"
            columns: ["instance_config_id"]
            isOneToOne: false
            referencedRelation: "instance_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_config: {
        Row: {
          adresse_siege: string | null
          created_at: string | null
          dpo_email: string | null
          dpo_nom: string | null
          email_secretariat: string | null
          format_numero_deliberation: string | null
          id: string
          logo_url: string | null
          longueur_mdp_min: number | null
          nom_officiel: string
          numero_depart: number | null
          otp_expiration_minutes: number | null
          prefecture_rattachement: string | null
          prefixe_numero_deliberation: string | null
          remise_zero_annuelle: boolean | null
          session_timeout_heures: number | null
          signature_president_url: string | null
          siren: string | null
          siret: string | null
          telephone: string | null
          tentatives_login_max: number | null
          type_institution: Database["public"]["Enums"]["institution_type"]
          updated_at: string | null
          url_portail_public: string | null
        }
        Insert: {
          adresse_siege?: string | null
          created_at?: string | null
          dpo_email?: string | null
          dpo_nom?: string | null
          email_secretariat?: string | null
          format_numero_deliberation?: string | null
          id?: string
          logo_url?: string | null
          longueur_mdp_min?: number | null
          nom_officiel: string
          numero_depart?: number | null
          otp_expiration_minutes?: number | null
          prefecture_rattachement?: string | null
          prefixe_numero_deliberation?: string | null
          remise_zero_annuelle?: boolean | null
          session_timeout_heures?: number | null
          signature_president_url?: string | null
          siren?: string | null
          siret?: string | null
          telephone?: string | null
          tentatives_login_max?: number | null
          type_institution: Database["public"]["Enums"]["institution_type"]
          updated_at?: string | null
          url_portail_public?: string | null
        }
        Update: {
          adresse_siege?: string | null
          created_at?: string | null
          dpo_email?: string | null
          dpo_nom?: string | null
          email_secretariat?: string | null
          format_numero_deliberation?: string | null
          id?: string
          logo_url?: string | null
          longueur_mdp_min?: number | null
          nom_officiel?: string
          numero_depart?: number | null
          otp_expiration_minutes?: number | null
          prefecture_rattachement?: string | null
          prefixe_numero_deliberation?: string | null
          remise_zero_annuelle?: boolean | null
          session_timeout_heures?: number | null
          signature_president_url?: string | null
          siren?: string | null
          siret?: string | null
          telephone?: string | null
          tentatives_login_max?: number | null
          type_institution?: Database["public"]["Enums"]["institution_type"]
          updated_at?: string | null
          url_portail_public?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          member_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          token: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          member_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          member_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          adresse_postale: string | null
          created_at: string | null
          device_id: string | null
          email: string
          groupe_politique: string | null
          id: string
          mandat_debut: string | null
          mandat_fin: string | null
          nom: string
          preferences_notification: Json | null
          prenom: string
          qualite_officielle: string | null
          role: Database["public"]["Enums"]["user_role"]
          statut: Database["public"]["Enums"]["member_statut"] | null
          telephone: string | null
          updated_at: string | null
          user_id: string | null
          webauthn_credential_id: string | null
        }
        Insert: {
          adresse_postale?: string | null
          created_at?: string | null
          device_id?: string | null
          email: string
          groupe_politique?: string | null
          id?: string
          mandat_debut?: string | null
          mandat_fin?: string | null
          nom: string
          preferences_notification?: Json | null
          prenom: string
          qualite_officielle?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          statut?: Database["public"]["Enums"]["member_statut"] | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
          webauthn_credential_id?: string | null
        }
        Update: {
          adresse_postale?: string | null
          created_at?: string | null
          device_id?: string | null
          email?: string
          groupe_politique?: string | null
          id?: string
          mandat_debut?: string | null
          mandat_fin?: string | null
          nom?: string
          preferences_notification?: Json | null
          prenom?: string
          qualite_officielle?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          statut?: Database["public"]["Enums"]["member_statut"] | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
          webauthn_credential_id?: string | null
        }
        Relationships: []
      }
      members_versions: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          member_id: string
          modified_by: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          member_id: string
          modified_by?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          member_id?: string
          modified_by?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_versions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      odj_points: {
        Row: {
          created_at: string | null
          description: string | null
          documents: Json | null
          huis_clos: boolean | null
          id: string
          majorite_requise:
            | Database["public"]["Enums"]["majorite_requise"]
            | null
          notes_seance: string | null
          position: number
          projet_deliberation: string | null
          rapporteur_id: string | null
          seance_id: string
          source_bureau_deliberation_id: string | null
          statut: string | null
          titre: string
          type_traitement: Database["public"]["Enums"]["odj_point_type"] | null
          updated_at: string | null
          votes_interdits: boolean | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          documents?: Json | null
          huis_clos?: boolean | null
          id?: string
          majorite_requise?:
            | Database["public"]["Enums"]["majorite_requise"]
            | null
          notes_seance?: string | null
          position: number
          projet_deliberation?: string | null
          rapporteur_id?: string | null
          seance_id: string
          source_bureau_deliberation_id?: string | null
          statut?: string | null
          titre: string
          type_traitement?: Database["public"]["Enums"]["odj_point_type"] | null
          updated_at?: string | null
          votes_interdits?: boolean | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          documents?: Json | null
          huis_clos?: boolean | null
          id?: string
          majorite_requise?:
            | Database["public"]["Enums"]["majorite_requise"]
            | null
          notes_seance?: string | null
          projet_deliberation?: string | null
          position?: number
          rapporteur_id?: string | null
          seance_id?: string
          source_bureau_deliberation_id?: string | null
          statut?: string | null
          titre?: string
          type_traitement?: Database["public"]["Enums"]["odj_point_type"] | null
          updated_at?: string | null
          votes_interdits?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "odj_points_rapporteur_id_fkey"
            columns: ["rapporteur_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odj_points_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_secours: {
        Row: {
          created_at: string | null
          expire_at: string
          id: string
          member_id: string
          pin_hash: string
          seance_id: string
          utilise: boolean | null
        }
        Insert: {
          created_at?: string | null
          expire_at: string
          id?: string
          member_id: string
          pin_hash: string
          seance_id: string
          utilise?: boolean | null
        }
        Update: {
          created_at?: string | null
          expire_at?: string
          id?: string
          member_id?: string
          pin_hash?: string
          seance_id?: string
          utilise?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pin_secours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_secours_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      presences: {
        Row: {
          biometrie_hash: string | null
          created_at: string | null
          device_id: string | null
          hash_document: string | null
          heure_arrivee: string | null
          heure_depart: string | null
          horodatage_serveur: string | null
          id: string
          member_id: string
          mode_authentification:
            | Database["public"]["Enums"]["mode_authentification"]
            | null
          seance_id: string
          signature_svg: string | null
          statut: Database["public"]["Enums"]["presence_statut"] | null
          timestamp_tsa: string | null
          updated_at: string | null
          webauthn_assertion_id: string | null
        }
        Insert: {
          biometrie_hash?: string | null
          created_at?: string | null
          device_id?: string | null
          hash_document?: string | null
          heure_arrivee?: string | null
          heure_depart?: string | null
          horodatage_serveur?: string | null
          id?: string
          member_id: string
          mode_authentification?:
            | Database["public"]["Enums"]["mode_authentification"]
            | null
          seance_id: string
          signature_svg?: string | null
          statut?: Database["public"]["Enums"]["presence_statut"] | null
          timestamp_tsa?: string | null
          updated_at?: string | null
          webauthn_assertion_id?: string | null
        }
        Update: {
          biometrie_hash?: string | null
          created_at?: string | null
          device_id?: string | null
          hash_document?: string | null
          heure_arrivee?: string | null
          heure_depart?: string | null
          horodatage_serveur?: string | null
          id?: string
          member_id?: string
          mode_authentification?:
            | Database["public"]["Enums"]["mode_authentification"]
            | null
          seance_id?: string
          signature_svg?: string | null
          statut?: Database["public"]["Enums"]["presence_statut"] | null
          timestamp_tsa?: string | null
          updated_at?: string | null
          webauthn_assertion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      procurations: {
        Row: {
          canal_communication: string | null
          created_at: string | null
          cree_par_gestionnaire: boolean | null
          document_url: string | null
          id: string
          mandant_id: string
          mandataire_id: string
          seance_id: string
          valide: boolean | null
          validee_at: string | null
          validee_par: string | null
        }
        Insert: {
          canal_communication?: string | null
          created_at?: string | null
          cree_par_gestionnaire?: boolean | null
          document_url?: string | null
          id?: string
          mandant_id: string
          mandataire_id: string
          seance_id: string
          valide?: boolean | null
          validee_at?: string | null
          validee_par?: string | null
        }
        Update: {
          canal_communication?: string | null
          created_at?: string | null
          cree_par_gestionnaire?: boolean | null
          document_url?: string | null
          id?: string
          mandant_id?: string
          mandataire_id?: string
          seance_id?: string
          valide?: boolean | null
          validee_at?: string | null
          validee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procurations_mandant_id_fkey"
            columns: ["mandant_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurations_mandataire_id_fkey"
            columns: ["mandataire_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurations_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      pv: {
        Row: {
          approuve_en_seance_id: string | null
          contenu_json: Json | null
          created_at: string | null
          id: string
          pdf_url: string | null
          seance_id: string
          signe_at: string | null
          signe_par: Json | null
          statut: Database["public"]["Enums"]["pv_statut"] | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          approuve_en_seance_id?: string | null
          contenu_json?: Json | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          seance_id: string
          signe_at?: string | null
          signe_par?: Json | null
          statut?: Database["public"]["Enums"]["pv_statut"] | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          approuve_en_seance_id?: string | null
          contenu_json?: Json | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          seance_id?: string
          signe_at?: string | null
          signe_par?: Json | null
          statut?: Database["public"]["Enums"]["pv_statut"] | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pv_approuve_en_seance_id_fkey"
            columns: ["approuve_en_seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: true
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      rappels_config: {
        Row: {
          actif: boolean | null
          canaux: string[] | null
          created_at: string | null
          delai_unite: string
          delai_valeur: number
          destinataires: string | null
          id: string
          instance_config_id: string | null
          ordre: number
          template_corps: string | null
          template_sujet: string | null
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          canaux?: string[] | null
          created_at?: string | null
          delai_unite: string
          delai_valeur: number
          destinataires?: string | null
          id?: string
          instance_config_id?: string | null
          ordre: number
          template_corps?: string | null
          template_sujet?: string | null
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          canaux?: string[] | null
          created_at?: string | null
          delai_unite?: string
          delai_valeur?: number
          destinataires?: string | null
          id?: string
          instance_config_id?: string | null
          ordre?: number
          template_corps?: string | null
          template_sujet?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rappels_config_instance_config_id_fkey"
            columns: ["instance_config_id"]
            isOneToOne: false
            referencedRelation: "instance_config"
            referencedColumns: ["id"]
          },
        ]
      }
      recusations: {
        Row: {
          declared_by: string | null
          horodatage: string | null
          id: string
          member_id: string
          motif: string | null
          odj_point_id: string
          seance_id: string
        }
        Insert: {
          declared_by?: string | null
          horodatage?: string | null
          id?: string
          member_id: string
          motif?: string | null
          odj_point_id: string
          seance_id: string
        }
        Update: {
          declared_by?: string | null
          horodatage?: string | null
          id?: string
          member_id?: string
          motif?: string | null
          odj_point_id?: string
          seance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recusations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recusations_odj_point_id_fkey"
            columns: ["odj_point_id"]
            isOneToOne: false
            referencedRelation: "odj_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recusations_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      seances: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_seance: string
          heure_cloture: string | null
          heure_ouverture: string | null
          id: string
          instance_id: string
          late_arrival_mode:
            | Database["public"]["Enums"]["late_arrival_mode"]
            | null
          lieu: string | null
          mode: Database["public"]["Enums"]["seance_mode"] | null
          notes: string | null
          president_effectif_seance_id: string | null
          publique: boolean | null
          quorum_atteint: number | null
          quorum_requis: number | null
          reconvocation: boolean | null
          secretaire_seance_id: string | null
          statut: Database["public"]["Enums"]["seance_statut"] | null
          titre: string
          updated_at: string | null
          voix_preponderante: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_seance: string
          heure_cloture?: string | null
          heure_ouverture?: string | null
          id?: string
          instance_id: string
          late_arrival_mode?:
            | Database["public"]["Enums"]["late_arrival_mode"]
            | null
          lieu?: string | null
          mode?: Database["public"]["Enums"]["seance_mode"] | null
          notes?: string | null
          president_effectif_seance_id?: string | null
          publique?: boolean | null
          quorum_atteint?: number | null
          quorum_requis?: number | null
          reconvocation?: boolean | null
          secretaire_seance_id?: string | null
          statut?: Database["public"]["Enums"]["seance_statut"] | null
          titre: string
          updated_at?: string | null
          voix_preponderante?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_seance?: string
          heure_cloture?: string | null
          heure_ouverture?: string | null
          id?: string
          instance_id?: string
          late_arrival_mode?:
            | Database["public"]["Enums"]["late_arrival_mode"]
            | null
          lieu?: string | null
          mode?: Database["public"]["Enums"]["seance_mode"] | null
          notes?: string | null
          president_effectif_seance_id?: string | null
          publique?: boolean | null
          quorum_atteint?: number | null
          quorum_requis?: number | null
          reconvocation?: boolean | null
          secretaire_seance_id?: string | null
          statut?: Database["public"]["Enums"]["seance_statut"] | null
          titre?: string
          updated_at?: string | null
          voix_preponderante?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "seances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instance_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seances_president_effectif_seance_id_fkey"
            columns: ["president_effectif_seance_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seances_secretaire_seance_id_fkey"
            columns: ["secretaire_seance_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          abstention: number | null
          clos_at: string | null
          contre: number | null
          created_at: string | null
          formule_pv: string | null
          hash_integrite: string | null
          id: string
          noms_abstention: string[] | null
          noms_contre: string[] | null
          nul: number | null
          odj_point_id: string
          ouvert_at: string | null
          pour: number | null
          question: string | null
          quorum_a_ouverture: number
          resultat: Database["public"]["Enums"]["vote_resultat"] | null
          seance_id: string
          statut: Database["public"]["Enums"]["vote_statut"] | null
          total_votants: number | null
          type_vote: Database["public"]["Enums"]["vote_type"] | null
          updated_at: string | null
          voix_preponderante_activee: boolean | null
        }
        Insert: {
          abstention?: number | null
          clos_at?: string | null
          contre?: number | null
          created_at?: string | null
          formule_pv?: string | null
          hash_integrite?: string | null
          id?: string
          noms_abstention?: string[] | null
          noms_contre?: string[] | null
          nul?: number | null
          odj_point_id: string
          ouvert_at?: string | null
          pour?: number | null
          question?: string | null
          quorum_a_ouverture: number
          resultat?: Database["public"]["Enums"]["vote_resultat"] | null
          seance_id: string
          statut?: Database["public"]["Enums"]["vote_statut"] | null
          total_votants?: number | null
          type_vote?: Database["public"]["Enums"]["vote_type"] | null
          updated_at?: string | null
          voix_preponderante_activee?: boolean | null
        }
        Update: {
          abstention?: number | null
          clos_at?: string | null
          contre?: number | null
          created_at?: string | null
          formule_pv?: string | null
          hash_integrite?: string | null
          id?: string
          noms_abstention?: string[] | null
          noms_contre?: string[] | null
          nul?: number | null
          odj_point_id?: string
          ouvert_at?: string | null
          pour?: number | null
          question?: string | null
          quorum_a_ouverture?: number
          resultat?: Database["public"]["Enums"]["vote_resultat"] | null
          seance_id?: string
          statut?: Database["public"]["Enums"]["vote_statut"] | null
          total_votants?: number | null
          type_vote?: Database["public"]["Enums"]["vote_type"] | null
          updated_at?: string | null
          voix_preponderante_activee?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_odj_point_id_fkey"
            columns: ["odj_point_id"]
            isOneToOne: false
            referencedRelation: "odj_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      votes_participation: {
        Row: {
          a_vote: boolean | null
          device_id: string | null
          horodatage_serveur: string | null
          id: string
          member_id: string
          vote_id: string
        }
        Insert: {
          a_vote?: boolean | null
          device_id?: string | null
          horodatage_serveur?: string | null
          id?: string
          member_id: string
          vote_id: string
        }
        Update: {
          a_vote?: boolean | null
          device_id?: string | null
          horodatage_serveur?: string | null
          id?: string
          member_id?: string
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_participation_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_participation_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin_or_gestionnaire: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      convocation_statut:
        | "NON_ENVOYE"
        | "ENVOYE"
        | "LU"
        | "CONFIRME_PRESENT"
        | "ABSENT_PROCURATION"
        | "ERREUR_EMAIL"
        | "ENVOYE_COURRIER"
      institution_type: "commune" | "syndicat" | "cc" | "departement" | "asso"
      late_arrival_mode: "STRICT" | "SOUPLE" | "SUSPENDU"
      majorite_requise: "SIMPLE" | "ABSOLUE" | "QUALIFIEE" | "UNANIMITE"
      member_statut: "ACTIF" | "SUSPENDU" | "FIN_DE_MANDAT" | "DECEDE"
      mode_authentification: "WEBAUTHN" | "PIN" | "MANUEL" | "ASSISTE"
      odj_point_type:
        | "DELIBERATION"
        | "INFORMATION"
        | "QUESTION_DIVERSE"
        | "ELECTION"
        | "APPROBATION_PV"
      presence_statut: "PRESENT" | "ABSENT" | "EXCUSE" | "PROCURATION"
      pv_statut:
        | "BROUILLON"
        | "EN_RELECTURE"
        | "APPROUVE_EN_SEANCE"
        | "SIGNE"
        | "PUBLIE"
      quorum_type:
        | "MAJORITE_MEMBRES"
        | "TIERS_MEMBRES"
        | "DEUX_TIERS"
        | "STATUTS"
      seance_mode: "PRESENTIEL" | "HYBRIDE" | "VISIO"
      seance_statut:
        | "BROUILLON"
        | "CONVOQUEE"
        | "EN_COURS"
        | "SUSPENDUE"
        | "CLOTUREE"
        | "ARCHIVEE"
      user_role:
        | "super_admin"
        | "president"
        | "gestionnaire"
        | "secretaire_seance"
        | "elu"
        | "preparateur"
      vote_resultat:
        | "ADOPTE"
        | "REJETE"
        | "NUL"
        | "ADOPTE_UNANIMITE"
        | "ADOPTE_VOIX_PREPONDERANTE"
      vote_statut: "OUVERT" | "CLOS" | "ANNULE" | "CONTESTE"
      vote_type: "MAIN_LEVEE" | "SECRET" | "NOMINAL" | "TELEVOTE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      convocation_statut: [
        "NON_ENVOYE",
        "ENVOYE",
        "LU",
        "CONFIRME_PRESENT",
        "ABSENT_PROCURATION",
        "ERREUR_EMAIL",
        "ENVOYE_COURRIER",
      ],
      institution_type: ["commune", "syndicat", "cc", "departement", "asso"],
      late_arrival_mode: ["STRICT", "SOUPLE", "SUSPENDU"],
      majorite_requise: ["SIMPLE", "ABSOLUE", "QUALIFIEE", "UNANIMITE"],
      member_statut: ["ACTIF", "SUSPENDU", "FIN_DE_MANDAT", "DECEDE"],
      mode_authentification: ["WEBAUTHN", "PIN", "MANUEL", "ASSISTE"],
      odj_point_type: [
        "DELIBERATION",
        "INFORMATION",
        "QUESTION_DIVERSE",
        "ELECTION",
        "APPROBATION_PV",
      ],
      presence_statut: ["PRESENT", "ABSENT", "EXCUSE", "PROCURATION"],
      pv_statut: [
        "BROUILLON",
        "EN_RELECTURE",
        "APPROUVE_EN_SEANCE",
        "SIGNE",
        "PUBLIE",
      ],
      quorum_type: [
        "MAJORITE_MEMBRES",
        "TIERS_MEMBRES",
        "DEUX_TIERS",
        "STATUTS",
      ],
      seance_mode: ["PRESENTIEL", "HYBRIDE", "VISIO"],
      seance_statut: [
        "BROUILLON",
        "CONVOQUEE",
        "EN_COURS",
        "SUSPENDUE",
        "CLOTUREE",
        "ARCHIVEE",
      ],
      user_role: [
        "super_admin",
        "president",
        "gestionnaire",
        "secretaire_seance",
        "elu",
        "preparateur",
      ],
      vote_resultat: [
        "ADOPTE",
        "REJETE",
        "NUL",
        "ADOPTE_UNANIMITE",
        "ADOPTE_VOIX_PREPONDERANTE",
      ],
      vote_statut: ["OUVERT", "CLOS", "ANNULE", "CONTESTE"],
      vote_type: ["MAIN_LEVEE", "SECRET", "NOMINAL", "TELEVOTE"],
    },
  },
} as const


// ============================================
// Aliases pratiques pour le code applicatif
// ============================================
export type UserRole = Database['public']['Enums']['user_role']
export type InstitutionType = Database['public']['Enums']['institution_type']
export type SeanceStatut = Database['public']['Enums']['seance_statut']
export type SeanceMode = Database['public']['Enums']['seance_mode']
export type PresenceStatut = Database['public']['Enums']['presence_statut']
export type ConvocationStatut = Database['public']['Enums']['convocation_statut']
export type VoteType = Database['public']['Enums']['vote_type']
export type VoteStatut = Database['public']['Enums']['vote_statut']
export type VoteResultat = Database['public']['Enums']['vote_resultat']
export type PVStatut = Database['public']['Enums']['pv_statut']
export type MemberStatut = Database['public']['Enums']['member_statut']
export type ODJPointType = Database['public']['Enums']['odj_point_type']
export type MajoriteRequise = Database['public']['Enums']['majorite_requise']
export type LateArrivalMode = Database['public']['Enums']['late_arrival_mode']
export type QuorumType = Database['public']['Enums']['quorum_type']

// Raccourcis pour les Row types des tables principales
export type MemberRow = Database['public']['Tables']['members']['Row']
export type SeanceRow = Database['public']['Tables']['seances']['Row']
export type VoteRow = Database['public']['Tables']['votes']['Row']
export type ODJPointRow = Database['public']['Tables']['odj_points']['Row']
export type PresenceRow = Database['public']['Tables']['presences']['Row']
export type ConvocataireRow = Database['public']['Tables']['convocataires']['Row']
export type PVRow = Database['public']['Tables']['pv']['Row']
export type DeliberationRow = Database['public']['Tables']['deliberations']['Row']
export type InstitutionConfigRow = Database['public']['Tables']['institution_config']['Row']
export type InstanceConfigRow = Database['public']['Tables']['instance_config']['Row']
