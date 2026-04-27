// src/App.js

// 0) Polyfill global pour éviter "ReferenceError: global is not defined"
if (typeof global === 'undefined') {
  window.global = window
}

import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation, BrowserRouter as Router } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Spin } from 'antd'

// 1) Helper pour lazy loading avec fallback
const lazyWithFallback = importFn =>
  React.lazy(() =>
    importFn().then(mod => ({ default: mod.default || mod }))
  )

// 2) Lazy-loaded components
const Login                           = lazyWithFallback(() => import('./components/Login'))
const AppLayout                       = lazyWithFallback(() => import('./components/AppLayout'))
const Dashboard                       = lazyWithFallback(() => import('./components/Dashboard'))
const RegionList                      = lazyWithFallback(() => import('./components/RegionList'))
const RegionForm                      = lazyWithFallback(() => import('./components/RegionForm'))
const ProvinceList                    = lazyWithFallback(() => import('./components/ProvinceList'))
const ProvinceForm                    = lazyWithFallback(() => import('./components/ProvinceForm'))
const CommuneList                     = lazyWithFallback(() => import('./components/CommuneList'))
const CommuneForm                     = lazyWithFallback(() => import('./components/CommuneForm'))
const LocaliteList                    = lazyWithFallback(() => import('./components/LocaliteList'))
const LocaliteForm                    = lazyWithFallback(() => import('./components/LocaliteForm'))
const EntiteList                      = lazyWithFallback(() => import('./components/EntiteList'))
const EntiteForm                      = lazyWithFallback(() => import('./components/EntiteForm'))
const VdpList                         = lazyWithFallback(() => import('./components/VdpList'))
const VdpForm                         = lazyWithFallback(() => import('./components/VdpForm'))
const VdpFiche                        = lazyWithFallback(() => import('./components/VdpFiche'))
const ArmeList                        = lazyWithFallback(() => import('./components/ArmeList'))
const ArmeForm                        = lazyWithFallback(() => import('./components/ArmeForm'))
const AfficheArme                     = lazyWithFallback(() => import('./components/AfficheArme'))
const LotList                         = lazyWithFallback(() => import('./components/LotList'))
const LotForm                         = lazyWithFallback(() => import('./components/LotForm'))
const SourceList                      = lazyWithFallback(() => import('./components/SourceList'))
const SourceForm                      = lazyWithFallback(() => import('./components/SourceForm'))
const ConfigArmeList                  = lazyWithFallback(() => import('./components/ConfigArmeList'))
const ConfigArmeForm                  = lazyWithFallback(() => import('./components/ConfigArmeForm'))
const ConfigMunitionList              = lazyWithFallback(() => import('./components/ConfigMunitionList'))
const ConfigMunitionForm              = lazyWithFallback(() => import('./components/ConfigMunitionForm'))
const ConfigOptiqueList               = lazyWithFallback(() => import('./components/ConfigOptiqueList'))
const ConfigOptiqueForm               = lazyWithFallback(() => import('./components/ConfigOptiqueForm'))
const ConfigMaterielList              = lazyWithFallback(() => import('./components/ConfigMaterielList'))
const ConfigMaterielForm              = lazyWithFallback(() => import('./components/ConfigMaterielForm'))
const DotationArmeList                = lazyWithFallback(() => import('./components/DotationArmeList'))
const DotationArmeForm                = lazyWithFallback(() => import('./components/DotationArmeForm'))
const DotationMunitionList            = lazyWithFallback(() => import('./components/DotationMunitionList'))
const DotationMunitionForm            = lazyWithFallback(() => import('./components/DotationMunitionForm'))
const DotationOptiqueList             = lazyWithFallback(() => import('./components/DotationOptiqueList'))
const DotationOptiqueForm             = lazyWithFallback(() => import('./components/DotationOptiqueForm'))
const DotationMaterielSpecifiqueList  = lazyWithFallback(() => import('./components/DotationMaterielSpecifiqueList'))
const DotationMaterielSpecifiqueForm  = lazyWithFallback(() => import('./components/DotationMaterielSpecifiqueForm'))
const DotationRapide                  = lazyWithFallback(() => import('./components/DotationRapide'))
const DdrList                         = lazyWithFallback(() => import('./components/DdrList'))
const DdrForm                         = lazyWithFallback(() => import('./components/DdrForm'))
const GeolocalisationList             = lazyWithFallback(() => import('./components/GeolocalisationList'))
const GeolocalisationForm             = lazyWithFallback(() => import('./components/GeolocalisationForm'))
const CarteVisuel                     = lazyWithFallback(() => import('./components/CarteVisuel'))
const MagasinList                     = lazyWithFallback(() => import('./components/MagasinList'))
const MagasinForm                     = lazyWithFallback(() => import('./components/MagasinForm'))
const StockList                       = lazyWithFallback(() => import('./components/StockList'))
const AuditLogs                       = lazyWithFallback(() => import('./components/AuditLogs'))
const SyncLogs                        = lazyWithFallback(() => import('./components/SyncLogs'))
const SessionList                     = lazyWithFallback(() => import('./components/SessionList'))
const NotificationList                = lazyWithFallback(() => import('./components/NotificationList'))
const AppConfig                       = lazyWithFallback(() => import('./components/AppConfig'))
const ConsommationMunitions           = lazyWithFallback(() => import('./components/ConsommationMunitions'))
const StatistiquesVDP                 = lazyWithFallback(() => import('./components/StatistiquesVDP'))
const StatistiquesEntites             = lazyWithFallback(() => import('./components/StatistiquesEntites'))
const StatistiquesArmes               = lazyWithFallback(() => import('./components/StatistiquesArmes'))
const StatistiquesMunitions           = lazyWithFallback(() => import('./components/StatistiquesMunitions'))
const StatistiquesOptiques            = lazyWithFallback(() => import('./components/StatistiquesOptiques'))
const StatistiquesMateriel            = lazyWithFallback(() => import('./components/StatistiquesMateriel'))
const DocumentsImpression             = lazyWithFallback(() => import('./components/DocumentsImpression'))
const DocumentsEtat                   = lazyWithFallback(() => import('./components/DocumentsEtat'))
const MunitionList                    = lazyWithFallback(() => import('./components/MunitionList'))
const MunitionForm                    = lazyWithFallback(() => import('./components/MunitionForm'))
const OptiqueList                     = lazyWithFallback(() => import('./components/OptiqueList'))
const OptiqueForm                     = lazyWithFallback(() => import('./components/OptiqueForm'))
const MaterielSpecifiqueList          = lazyWithFallback(() => import('./components/MaterielSpecifiqueList'))
const MaterielSpecifiqueForm          = lazyWithFallback(() => import('./components/MaterielSpecifiqueForm'))
const UtilisateurList                 = lazyWithFallback(() => import('./components/UtilisateurList'))
const UtilisateurForm                 = lazyWithFallback(() => import('./components/UtilisateurForm'))
const RoleList                        = lazyWithFallback(() => import('./components/RoleList'))
const RoleForm                        = lazyWithFallback(() => import('./components/RoleForm'))
const NotFound                        = lazyWithFallback(() => import('./components/NotFound'))
const CoordinationHierarchy            = lazyWithFallback(() => import('./components/CoordinationHierarchy'))
const CoordinationRegionaleList = lazyWithFallback(() => import('./components/CoordinationRegionaleList'));
const CoordinationRegionaleForm = lazyWithFallback(() => import('./components/CoordinationRegionaleForm'));
const CoordinationProvincialeList = lazyWithFallback(() => import('./components/CoordinationProvincialeList'));
const CoordinationProvincialeForm = lazyWithFallback(() => import('./components/CoordinationProvincialeForm'));
const CoordinationCommunaleList = lazyWithFallback(() => import('./components/CoordinationCommunaleList'));
const CoordinationCommunaleForm = lazyWithFallback(() => import('./components/CoordinationCommunaleForm'))
const ArmeCrossAnalysis                 = lazyWithFallback(() => import('./components/ArmeCrossAnalysis'))
const TypeArmeList                    = lazyWithFallback(() => import('./components/TypeArmeList'));
const TypeArmeForm                    = lazyWithFallback(() => import('./components/TypeArmeForm'));
const CategorieArmeList               = lazyWithFallback(() => import('./components/CategorieArmeList'));
const CategorieArmeForm               = lazyWithFallback(() => import('./components/CategorieArmeForm'));
const ModeleArmeList                  = lazyWithFallback(() => import('./components/ModeleArmeList'));
const ModeleArmeForm                  = lazyWithFallback(() => import('./components/ModeleArmeForm'));

// 3) Wrapper pour protéger les routes et gérer le loading
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100 }}>
        <Spin size='large' tip='Vérification en cours…' />
      </div>
    )
  }
  if (!user) {
    return <Navigate to='/login' replace state={{ from: location }} />
  }
  return children
}

// 4) Redirection par défaut hors /login et hors /dashboard/*
function RedirectToDashboard() {
  const { pathname } = useLocation()

  if (pathname === '/' || pathname === '/login') {
    return <Navigate to='/login' replace />
  }
  if (!pathname.startsWith('/dashboard')) {
    const sub = pathname.replace(/^\//, '')
    return <Navigate to={`/dashboard/${sub}`} replace />
  }
  return <Navigate to='/dashboard' replace />
}

// 5) Composant principal
export default function App() {
  return (
    <Suspense fallback={<Spin tip='Chargement…' style={{ width: '100%' }} />} >
      <Routes>
        {/* redirection racine */}
        <Route path='/' element={<Navigate to='/login' replace />} />
        <Route path='/login' element={<Login />} />

        {/* routes protégées Dashboard */}
        <Route
          path='/dashboard'
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />

          {/* localisation */}
          <Route path='regions' element={<RegionList />} />
          <Route path='regions/add' element={<RegionForm />} />
          <Route path='regions/edit/:id' element={<RegionForm />} />

          <Route path='provinces' element={<ProvinceList />} />
          <Route path='provinces/add' element={<ProvinceForm />} />
          <Route path='provinces/edit/:id' element={<ProvinceForm />} />

          <Route path='communes' element={<CommuneList />} />
          <Route path='communes/add' element={<CommuneForm />} />
          <Route path='communes/edit/:id' element={<CommuneForm />} />

          <Route path='localites' element={<LocaliteList />} />
          <Route path='localites/add' element={<LocaliteForm />} />
          <Route path='localites/edit/:id' element={<LocaliteForm />} />

          {/* entités */}
          <Route path='entites' element={<EntiteList />} />
          <Route path='entites/form/:mode' element={<EntiteForm />} />
          <Route path='entites/form/:mode/:id' element={<EntiteForm />} />
          <Route path='entites/add' element={<EntiteForm />} />
          <Route path='entites/edit/:id' element={<EntiteForm />} />

          {/* VDP */}
          <Route path='vdp' element={<VdpList />} />
          <Route path='vdp/add' element={<VdpForm />} />
          <Route path='vdp/edit/:id' element={<VdpForm />} />
          <Route path='vdp/fiche/:id' element={<VdpFiche />} />

          {/* armes et lots */}
          <Route path='armes' element={<ArmeList />} />
          <Route path='armes/add' element={<ArmeForm />} />
          <Route path='armes/edit/:id' element={<ArmeForm />} />
          <Route path='arme/fiche/:id' element={<AfficheArme />} />
          <Route path='analyse-croisee' element={<ArmeCrossAnalysis />} />

          <Route path='lots' element={<LotList />} />
          <Route path='lots/add' element={<LotForm />} />
          <Route path='lots/edit/:id' element={<LotForm />} />

          {/* configurations */}
          <Route path='config-armes' element={<ConfigArmeList />} />
          <Route path='config-armes/form' element={<ConfigArmeForm />} />
          <Route path='config-armes/form/:id' element={<ConfigArmeForm />} />
          <Route path='config-armes/types' element={<TypeArmeList />} />
          <Route path='config-armes/types/add' element={<TypeArmeForm />} />
          <Route path='config-armes/types/edit/:id' element={<TypeArmeForm />} />
          <Route path='config-armes/categories' element={<CategorieArmeList />} />
          <Route path='config-armes/categories/add' element={<CategorieArmeForm />} />
          <Route path='config-armes/categories/edit/:id' element={<CategorieArmeForm />} />
          <Route path='config-armes/modeles' element={<ModeleArmeList />} />
          <Route path='config-armes/modeles/add' element={<ModeleArmeForm />} />
          <Route path='config-armes/modeles/edit/:id' element={<ModeleArmeForm />} />

          <Route path='config-arme' element={<ConfigArmeList />} />
          <Route path='config-arme/form' element={<ConfigArmeForm />} />
          <Route path='config-arme/form/:id' element={<ConfigArmeForm />} />

          <Route path='config-munition' element={<ConfigMunitionList />} />
          <Route path='config-munition/form' element={<ConfigMunitionForm />} />
          <Route path='config-munition/form/:id' element={<ConfigMunitionForm />} />

          <Route path='config-optique' element={<ConfigOptiqueList />} />
          <Route path='config-optique/form' element={<ConfigOptiqueForm />} />
          <Route path='config-optique/form/:id' element={<ConfigOptiqueForm />} />

          <Route path='config-materiel' element={<ConfigMaterielList />} />
          <Route path='config-materiel/form' element={<ConfigMaterielForm />} />
          <Route path='config-materiel/form/:id' element={<ConfigMaterielForm />} />
          <Route path='sources' element={<SourceList />} />
          <Route path='sources/add' element={<SourceForm />} />
          <Route path='sources/edit/:id' element={<SourceForm />} />
          <Route path='lots' element={<LotList />} />
          <Route path='lots/add' element={<LotForm />} />
          <Route path='lots/edit/:id' element={<LotForm />} />

          {/* dotations & DDR */}
          <Route path='dotation-arme' element={<DotationArmeList />} />
          <Route path='dotation-arme/add' element={<DotationArmeForm />} />

          <Route path='dotation-munition' element={<DotationMunitionList />} />
          <Route path='dotation-munition/add' element={<DotationMunitionForm />} />

          <Route path='dotation-optique' element={<DotationOptiqueList />} />
          <Route path='dotation-optique/add' element={<DotationOptiqueForm />} />

          <Route
            path='dotation-materiel'
            element={<DotationMaterielSpecifiqueList />}
          />
          <Route
            path='dotation-materiel/add'
            element={<DotationMaterielSpecifiqueForm />}
          />

          <Route path='dotation-rapide' element={<DotationRapide />} />
          <Route path='ddr' element={<DdrList />} />
          <Route path='ddr/add' element={<DdrForm />} />

          {/* géolocalisation & carte */}
          <Route
            path='geolocalisation'
            element={<GeolocalisationList />}
          />
          <Route
            path='geolocalisation/add'
            element={<GeolocalisationForm />}
          />
          <Route path='carte' element={<CarteVisuel />} />

          {/* magasin & stock */}
          <Route path='magasin' element={<MagasinList />} />
          <Route path='magasin/add' element={<MagasinForm />} />
          <Route path='stock' element={<StockList />} />

          {/* système */}
          <Route path='audit-logs' element={<AuditLogs />} />
          <Route path='sync-logs' element={<SyncLogs />} />
          <Route path='sessions' element={<SessionList />} />
          <Route path='notifications' element={<NotificationList />} />
          <Route path='config-app' element={<AppConfig />} />
          <Route
            path='consommation-munitions'
            element={<ConsommationMunitions />}
          />
          <Route path='utilisateurs' element={<UtilisateurList />} />
          <Route path='utilisateurs/add' element={<UtilisateurForm />} />
          <Route path='utilisateurs/edit/:id' element={<UtilisateurForm />} />
          <Route path='roles' element={<RoleList />} />
          <Route path='roles/add' element={<RoleForm />} />

          {/* statistiques */}
          <Route path='stats/vdp' element={<StatistiquesVDP />} />
          <Route path='stats/entites' element={<StatistiquesEntites />} />
          <Route path='stats/armes' element={<StatistiquesArmes />} />
          <Route path='stats/munitions' element={<StatistiquesMunitions />} />
          <Route path='stats/optiques' element={<StatistiquesOptiques />} />
          <Route
            path='stats/materiel'
            element={<StatistiquesMateriel />}
          />

          {/* documents */}
          <Route
            path='documents/impression'
            element={<DocumentsImpression />}
          />
          <Route path='documents/etat' element={<DocumentsEtat />} />

          {/* munition, optique, matériel */}
          <Route path='munition' element={<MunitionList />} />
          <Route path='munition/add' element={<MunitionForm />} />
          <Route path='munition/edit/:id' element={<MunitionForm />} />

          <Route path='optique' element={<OptiqueList />} />
          <Route path='optique/add' element={<OptiqueForm />} />
          <Route path='optique/edit/:id' element={<OptiqueForm />} />

          <Route
            path='materiel'
            element={<MaterielSpecifiqueList />}
          />
          <Route
            path='materiel/add'
            element={<MaterielSpecifiqueForm />}
          />
          <Route path='materiel/edit/:id' element={<MaterielSpecifiqueForm />} />

          {/* Coordinations hiérarchiques */}
          <Route path='coordinations/regionale' element={<CoordinationRegionaleList />} />
          <Route path='coordinations/regionale/add' element={<CoordinationRegionaleForm />} />
          <Route path='coordinations/regionale/edit/:id' element={<CoordinationRegionaleForm />} />
          <Route path='coordinations/provinciale' element={<CoordinationProvincialeList />} />
          <Route path='coordinations/provinciale/add' element={<CoordinationProvincialeForm />} />
          <Route path='coordinations/provinciale/edit/:id' element={<CoordinationProvincialeForm />} />
          <Route path='coordinations/communale' element={<CoordinationCommunaleList />} />
          <Route path='coordinations/communale/add' element={<CoordinationCommunaleForm />} />
          <Route path='coordinations/communale/edit/:id' element={<CoordinationCommunaleForm />} />

          {/* fallback interne */}
          <Route path='*' element={<Navigate to='/dashboard' replace />} />
        </Route>

        {/* catch-all hors dashboard */}
        <Route path='*' element={<RedirectToDashboard />} />
      </Routes>
    </Suspense>
  )
}