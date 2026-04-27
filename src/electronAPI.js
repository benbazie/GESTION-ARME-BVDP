// src/electronAPI.js
import api from "./api";

const electronAPIShim = {
  // ---------- Localisation ----------
  // Regions
  getRegions: () => api.getRegions(),
  getRegionById: (id) => api.getRegionById(id),
  addRegion: (data) => api.addRegion(data),
  updateRegion: (id, data) => api.updateRegion(id, data),
  deleteRegion: (id) => api.deleteRegion(id),

  // Provinces
 
 getProvinces: () => api.getProvinces(),
 getProvince: (id) => api.getProvince(id),
 addProvince: (data) => api.addProvince(data),
 updateProvince: (id, data) => api.updateProvince(id, data),
 deleteProvince: (id) => api.deleteProvince(id),
 getProvincesWithRegions: () => api.getProvincesWithRegions(),

  


  // Communes
  getCommunes: () => api.getCommunes(),
  getCommune: (id) => api.getCommune(id),
  addCommune: (data) => api.addCommune(data),
  updateCommune: (id, data) => api.updateCommune(id, data),
  deleteCommune: (id) => api.deleteCommune(id),
  getCommunesWithDetails: () => api.getCommunesWithDetails(),
  getCommunesWithProvinces: () => api.getCommunesWithProvinces(), // <-- ajoute ceci

  // Localités
  getLocalites: () => api.getLocalites(),
  getLocaliteById: (id) => api.getLocaliteById(id),
  addLocalite: (data) => api.addLocalite(data),
  updateLocalite: (id, data) => api.updateLocalite(id, data),
  deleteLocalite: (id) => api.deleteLocalite(id),
  getLocalitesWithDetails: () => api.getLocalitesWithDetails(),

  // ---------- Entités ----------
  getEntites: () => api.getEntites(),
  getEntite: (id) => api.getEntite(id),
  addEntite: (data) => api.addEntite(data),
  updateEntite: (id, data) => api.updateEntite(id, data),
  deleteEntite: (id) => api.deleteEntite(id),

  // Sous-entités
  getSousEntites: () => api.getSousEntites(),
  getSousEntiteById: (id) => api.getSousEntiteById(id),
  getSousEntite: (id) => api.getSousEntite(id),
  addSousEntite: (data) => api.addSousEntite(data),
  updateSousEntite: (id, data) => api.updateSousEntite(id, data),
  deleteSousEntite: (id) => api.deleteSousEntite(id),
  getSousEntitesByEntite: (entiteId) => api.getSousEntitesList({ entite_id: entiteId }),

  // ---------- Coordinations ----------
  getCoordinations: () => api.getCoordinations(),
  getCoordinationById: (id) => api.getCoordinationById(id),
  addCoordination: (data) => api.addCoordination(data),
  updateCoordination: (id, data) => api.updateCoordination(id, data),
  deleteCoordination: (id) => api.deleteCoordination(id),
  getSousCoordinationsByCoordination: (coordinationId) => api.getCoordinationsList({ parent_id: coordinationId }),

  // Localités dynamiques
  getLocalitesByCommune: (communeId) => api.getLocalitesList({ commune_id: communeId }),

  // ---------- VDP ----------
  getVdps: () => api.getVdps(),
  getVdpById: (id) => api.getVdpById(id),
  addVdp: (data) => api.addVdp(data),
  updateVdp: (id, data) => api.updateVdp(id, data),
  deleteVdp: (id) => api.deleteVdp(id),

  // ---------- Configurations des Ressources ----------
  // config_arme
  getConfigArme: () => api.getConfigArme(),
  getConfigArmeById: (id) => api.getConfigArmeById(id),
  addConfigArme: (data) => api.addConfigArme(data),
  updateConfigArme: (id, data) => api.updateConfigArme(id, data),
  deleteConfigArme: (id) => api.deleteConfigArme(id),

  // config_munition
  getConfigMunition: () => api.getConfigMunition(),
  getConfigMunitionById: (id) => api.getConfigMunitionById(id),
  addConfigMunition: (data) => api.addConfigMunition(data),
  updateConfigMunition: (id, data) => api.updateConfigMunition(id, data),
  deleteConfigMunition: (id) => api.deleteConfigMunition(id),

  // config_optique
  getConfigOptique: () => api.getConfigOptique(),
  getConfigOptiqueById: (id) => api.getConfigOptiqueById(id),
  addConfigOptique: (data) => api.addConfigOptique(data),
  updateConfigOptique: (id, data) => api.updateConfigOptique(id, data),
  deleteConfigOptique: (id) => api.deleteConfigOptique(id),

  // config_materiel
  getConfigMateriel: () => api.getConfigMateriel(),
  getConfigMaterielById: (id) => api.getConfigMaterielById(id),
  addConfigMateriel: (data) => api.addConfigMateriel(data),
  updateConfigMateriel: (id, data) => api.updateConfigMateriel(id, data),
  deleteConfigMateriel: (id) => api.deleteConfigMateriel(id),

  // ---------- Ressources Physiques ----------
  // armes
  getArmes: () => api.getArmes(),
  getArme: (id) => api.getArme(id),
  addArme: (data) => api.addArme(data),
  updateArme: (id, data) => api.updateArme(id, data),
  deleteArme: (id) => api.deleteArme(id),

  // munitions
  getMunitions: () => api.getMunitions(),
  getMunitionsList: () => api.getMunitions(),
  getAllMunitions: () => api.getMunitions(),
  getMunition: (id) => api.getMunition(id),
  addMunition: (data) => api.addMunition(data),
  createMunitions: (data) => api.addMunition(data),
  updateMunition: (id, data) => api.updateMunition(id, data),
  deleteMunition: (id) => api.deleteMunition(id),

  // optiques
  getOptiques: () => api.getOptiques(),
  getOptiquesList: () => api.getOptiques(),
  getOptique: (id) => api.getOptique(id),
  addOptique: (data) => api.addOptique(data),
  createOptiques: (data) => api.addOptique(data),
  updateOptique: (id, data) => api.updateOptique(id, data),
  deleteOptique: (id) => api.deleteOptique(id),

  // matériel spécifique
  getMaterielSpecifique: () => api.getMaterielSpecifique(),
  getMaterielsSpecifiquesList: () => api.getMaterielSpecifique(),
  getMaterielsSpecifiques: () => api.getMaterielSpecifique(),
  getMaterielSpecifiqueById: (id) => api.getMaterielSpecifiqueById(id),
  addMaterielSpecifique: (data) => api.addMaterielSpecifique(data),
  createMaterielsSpecifiques: (data) => api.addMaterielSpecifique(data),
  updateMaterielSpecifique: (id, data) => api.updateMaterielSpecifique(id, data),
  deleteMaterielSpecifique: (id) => api.deleteMaterielSpecifique(id),

  // ---------- Lots ----------
  getLots: () => api.getLots(),
  getLot: (id) => api.getLot(id),
  addLot: (data) => api.addLot(data),
  updateLot: (id, data) => api.updateLot(id, data),
  deleteLot: (id) => api.deleteLot(id),

  getSourcesArmement: () => api.getSourcesArmement(),
  getSourceArmement: (id) => api.getSourceArmement(id),
  addSourceArmement: (data) => api.addSourceArmement(data),
  updateSourceArmement: (id, data) => api.updateSourceArmement(id, data),
  deleteSourceArmement: (id) => api.deleteSourceArmement(id),

  // ---------- DDR & Désarmement ----------
  getDdr: () => api.getDdr(),
  getDdrById: (id) => api.getDdrById(id),
  addDdr: (data) => api.addDdr(data),
  updateDdr: (id, data) => api.updateDdr(id, data),
  deleteDdr: (id) => api.deleteDdr(id),

  // ---------- Géolocalisation ----------
  getGeolocalisations: () => api.getGeolocalisations(),
  getGeolocalisation: (id) => api.getGeolocalisation(id),
  addGeolocalisation: (data) => api.addGeolocalisation(data),
  updateGeolocalisation: (id, data) => api.updateGeolocalisation(id, data),
  deleteGeolocalisation: (id) => api.deleteGeolocalisation(id),

  // ---------- Magasin & Stock ----------
  getMagasin: () => api.getMagasin(),
  getMagasinById: (id) => api.getMagasinById(id),
  addMagasin: (data) => api.addMagasin(data),
  updateMagasin: (id, data) => api.updateMagasin(id, data),
  deleteMagasin: (id) => api.deleteMagasin(id),

  getStock: () => api.getStock(),
  getStockById: (id) => api.getStockById(id),
  addStock: (data) => api.addStock(data),
  updateStock: (id, data) => api.updateStock(id, data),
  deleteStock: (id) => api.deleteStock(id),

  // ---------- Système ----------
  // Audit Logs
  getAuditLogs: () => api.getAuditLogs(),
  addAuditLog: (data) => api.addAuditLog(data),

  // Sync Logs
  getSyncLogs: () => api.getSyncLogs(),
  addSyncLog: (data) => api.addSyncLog(data),

  // Sessions
  getSessions: () => api.getSessions(),
  getSessionById: (id) => api.getSessionById(id),
  addSession: (data) => api.addSession(data),
  updateSession: (id, data) => api.updateSession(id, data),
  deleteSession: (id) => api.deleteSession(id),

  // Notifications
  getNotifications: () => api.getNotifications(),
  getNotificationById: (id) => api.getNotificationById(id),
  addNotification: (data) => api.addNotification(data),
  updateNotification: (id, data) => api.updateNotification(id, data),
  deleteNotification: (id) => api.deleteNotification(id),

  // Rôles
  getRoles: () => api.getRoles(),
  getRole: (id) => api.getRole(id),
  addRole: (data) => api.addRole(data),
  updateRole: (id, data) => api.updateRole(id, data),
  deleteRole: (id) => api.deleteRole(id),

  // Utilisateurs
  getUtilisateurs: () => api.getUtilisateurs(),
  getUtilisateur: (id) => api.getUtilisateurById(id),
  addUtilisateur: (data) => api.addUtilisateur(data),
  updateUtilisateur: (id, data) => api.updateUtilisateur(id, data),
  deleteUtilisateur: (id) => api.deleteUtilisateur(id),

  // App Config
  getAppConfig: () => api.getAppConfig(),
  getAppConfigByName: (name) => api.getAppConfigByName(name),
  updateAppConfig: (id, data) => api.updateAppConfig(id, data),

  // Consommation Munitions
  getConsommationMunitions: () => api.getConsommationMunitions(),
  getConsommationMunition: (id) => api.getConsommationMunitionById(id),
  addConsommationMunition: (data) => api.addConsommationMunition(data),
  updateConsommationMunition: (id, data) => api.updateConsommationMunition(id, data),
  deleteConsommationMunition: (id) => api.deleteConsommationMunition(id),

  // Impression
  printDocument: (data) => api.printDocument(data), // Nouvelle méthode pour imprimer

  // ---------- Coordinations Hiérarchiques ----------
  // Régionaux
  getCoordinationRegionales: () => api.getCoordinationRegionaleList(),
  getCoordinationRegionaleById: (id) => api.getCoordinationRegionaleById(id),
  addCoordinationRegionale: (data) =>
    (typeof api.createCoordinationRegionale === "function"
      ? api.createCoordinationRegionale(data)
      : (typeof api.call === "function"
          ? api.call("createCoordinationRegionale", data)
          : Promise.reject(new Error("Aucune fonction createCoordinationRegionale disponible")))),
  updateCoordinationRegionale: (id, data) =>
    (typeof api.updateCoordinationRegionale === "function"
      ? api.updateCoordinationRegionale({ id, ...data })
      : (typeof api.call === "function"
          ? api.call("updateCoordinationRegionale", { id, ...data })
          : Promise.reject(new Error("Aucune fonction updateCoordinationRegionale disponible")))),
  deleteCoordinationRegionale: (id) =>
    (typeof api.deleteCoordinationRegionale === "function"
      ? api.deleteCoordinationRegionale(id)
      : (typeof api.call === "function"
          ? api.call("deleteCoordinationRegionale", id)
          : Promise.reject(new Error("Aucune fonction deleteCoordinationRegionale disponible")))),

  // Provinciales
  getCoordinationProvinciales: (regionale_id) => api.getCoordinationProvincialeList({ parent_id: regionale_id }),
  getCoordinationProvincialeById: (id) => api.getCoordinationProvincialeById(id),
  addCoordinationProvinciale: (data) =>
    (typeof api.createCoordinationProvinciale === "function"
      ? api.createCoordinationProvinciale(data)
      : (typeof api.call === "function"
          ? api.call("createCoordinationProvinciale", data)
          : Promise.reject(new Error("Aucune fonction createCoordinationProvinciale disponible")))),
  updateCoordinationProvinciale: (id, data) =>
    (typeof api.updateCoordinationProvinciale === "function"
      ? api.updateCoordinationProvinciale({ id, ...data })
      : (typeof api.call === "function"
          ? api.call("updateCoordinationProvinciale", { id, ...data })
          : Promise.reject(new Error("Aucune fonction updateCoordinationProvinciale disponible")))),
  deleteCoordinationProvinciale: (id) =>
    (typeof api.deleteCoordinationProvinciale === "function"
      ? api.deleteCoordinationProvinciale(id)
      : (typeof api.call === "function"
          ? api.call("deleteCoordinationProvinciale", id)
          : Promise.reject(new Error("Aucune fonction deleteCoordinationProvinciale disponible")))),

  // Communales
  getCoordinationCommunales: (provinciale_id) => api.getCoordinationCommunaleList({ parent_id: provinciale_id }),
  getCoordinationCommunaleById: (id) => api.getCoordinationCommunaleById(id),
  addCoordinationCommunale: (data) =>
    (typeof api.createCoordinationCommunale === "function"
      ? api.createCoordinationCommunale(data)
      : (typeof api.call === "function"
          ? api.call("createCoordinationCommunale", data)
          : Promise.reject(new Error("Aucune fonction createCoordinationCommunale disponible")))),
  updateCoordinationCommunale: (id, data) =>
    (typeof api.updateCoordinationCommunale === "function"
      ? api.updateCoordinationCommunale({ id, ...data })
      : (typeof api.call === "function"
          ? api.call("updateCoordinationCommunale", { id, ...data })
          : Promise.reject(new Error("Aucune fonction updateCoordinationCommunale disponible")))),
  deleteCoordinationCommunale: (id) =>
    (typeof api.deleteCoordinationCommunale === "function"
      ? api.deleteCoordinationCommunale(id)
      : (typeof api.call === "function"
          ? api.call("deleteCoordinationCommunale", id)
          : Promise.reject(new Error("Aucune fonction deleteCoordinationCommunale disponible")))),

  // Localités liées à une coordination communale
  getLocalitesByCoordinationCommunale: (coordination_commune_id) => api.call('get', `/coordinations/localites/${coordination_commune_id}`),
  addLocaliteToCoordinationCommunale: (data) => api.call('post', '/coordinations/localites', data),
  removeLocaliteFromCoordinationCommunale: (id) => api.call('delete', `/coordinations/localites/${id}`),
};

// Installer le shim en mode Web s'il n'est pas déjà défini
if (typeof window !== "undefined" && !window.electronAPI) {
  window.electronAPI = electronAPIShim;
}

console.log("[electronAPI] Fonctions disponibles :", Object.keys(electronAPIShim));

export default electronAPIShim;
