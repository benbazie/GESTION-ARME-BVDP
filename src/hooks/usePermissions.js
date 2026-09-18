// src/hooks/usePermissions.js
import { useAuth } from '../contexts/AuthContext';

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'role_admin']);

/**
 * Dérive les capacités de l'utilisateur courant à partir de son profil JWT.
 *
 * Retourne :
 *   isAdmin           — admin / superadmin : voit et gère tout
 *   isGestionnaire    — gestionnaire de magasin sans droits admin
 *   magasinIds        — tableau des IDs de magasins dont il est gestionnaire
 *   myMagasinId       — premier magasin (ou null)
 *   canSeeAllMagasins — true pour les admins
 *   canCreateMagasin  — seuls les admins créent des magasins
 */
export function usePermissions() {
  const { user } = useAuth();
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  const isAdmin        = roles.some((r) => ADMIN_ROLES.has(r));
  const isGestionnaire = !isAdmin && roles.some((r) => r === 'gestionnaire');

  const magasinIds  = Array.isArray(user?.magasin_ids) ? user.magasin_ids : [];
  const myMagasinId = magasinIds[0] ?? null;

  return {
    isAdmin,
    isGestionnaire,
    magasinIds,
    myMagasinId,
    canSeeAllMagasins: isAdmin,
    canCreateMagasin:  isAdmin,
  };
}
