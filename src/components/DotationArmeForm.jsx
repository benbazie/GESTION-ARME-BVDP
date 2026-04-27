// src/components/DotationArmeForm.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Row,
  Col,
  Space,
  Steps,
  Statistic,
  Table,
  Tag,
  Typography,
  Divider,
  Descriptions,
  message,
  Segmented,
  Select
} from "antd";
import dayjs from "dayjs";
import { ArrowLeftOutlined, CheckCircleOutlined, FileAddOutlined, SearchOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "./DotationArmeForm.css";
import VdpForm from "./VdpForm";
import ArmeForm from "./ArmeForm";

const { Title, Text, Paragraph } = Typography;
const INITIAL_META = {
  dotation_type: "individuelle",
  beneficiary_type: "vdp",
  date_dotation: dayjs(),
  source_arme_id: null
};

const formatDate = (value) => (value ? dayjs(value).format("DD/MM/YYYY") : "—");
const ensureDataUrl = (input) => {
  if (!input) return null;
  if (typeof input === "string") {
    if (input.startsWith("data:")) return input;
    const trimmed = input.replace(/\s+/g, "");
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      return `data:image/jpeg;base64,${trimmed}`;
    }
    return null;
  }
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    const view = input instanceof Uint8Array ? input : new Uint8Array(input);
    let binary = "";
    view.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return `data:image/jpeg;base64,${btoa(binary)}`;
  }
  return null;
};

const ARMES_COLUMNS = [
  {
    title: "N° série / référence",
    dataIndex: "reference",
    render: (_, record) => record.numero_serie || record.reference || "—"
  },
  {
    title: "Description",
    dataIndex: "designation",
    render: (_, record) =>
      record.designation ||
      record.description ||
      `${record.type || ""} ${record.categorie || ""}`.trim() ||
      "—"
  },
  {
    title: "Type / Catégorie",
    key: "typeCategorie",
    render: (_, record) => `${record.type || "—"} / ${record.categorie || "—"}`
  },
  {
    title: "Entité d'origine",
    dataIndex: "entite_nom",
    render: (_, record) => record.entite_nom || record.entite?.nom || "—"
  },
  {
    title: "Statut",
    dataIndex: "statut",
    render: (value) =>
      value ? <Tag color={value === "dotée" ? "magenta" : "blue"}>{value}</Tag> : <Tag>disponible</Tag>
  }
];
const SELECTED_ARME_COLUMNS = [
  {
    title: "Référence",
    key: "reference",
    render: (_, record) => record.reference || record.numero_serie || "—"
  },
  {
    title: "Désignation",
    key: "designation",
    render: (_, record) => record.designation || record.description || record.nom || "—"
  },
  {
    title: "Statut",
    key: "statut",
    render: (_, record) => {
      const status = record.statut || "disponible";
      const color = /épuis|annul/i.test(status) ? "red" : /disponible|dotée|assign/i.test(status) ? "blue" : undefined;
      return <Tag color={color}>{status}</Tag>;
    }
  },
  {
    title: "Qté",
    dataIndex: "quantite",
    align: "center",
    render: (value) => value ?? 1
  }
];
const VdpDetailedColumns = [
  {
    title: "Photo",
    dataIndex: "photo",
    render: (value) => {
      const src = ensureDataUrl(value);
      return src ? <img src={src} alt="VDP" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} /> : "—";
    }
  },
  { title: "Nom", dataIndex: "nom", render: (value) => value || "—" },
  { title: "Prénom", dataIndex: "prenom", render: (value) => value || "—" },
  { title: "Sexe", dataIndex: "sexe", render: (value) => value || "—" },
  { title: "Date naissance", dataIndex: "date_naissance", render: formatDate },
  { title: "Lieu naissance", dataIndex: "lieu_naissance", render: (value) => value || "—" },
  { title: "CNIB", dataIndex: "numero_cnib", render: (value) => value || "—" },
  { title: "Date CNIB", dataIndex: "date_cnib", render: formatDate },
  { title: "Date recrutement", dataIndex: "date_recrutement", render: formatDate },
  { title: "Statut VDP", dataIndex: "statut_vdp", render: (value) => <Tag color={value === "En service" ? "green" : "blue"}>{value || "—"}</Tag> },
  { title: "Statut matrimonial", dataIndex: "statut_matrimonial", render: (value) => value || "—" },
  { title: "Nb enfants", dataIndex: "nb_enfants", render: (value) => value ?? "—" },
  { title: "Type VDP", dataIndex: "type_vdp", render: (value) => value || "—" },
  { title: "Contacts", dataIndex: "contacts", render: (value) => value || "—" },
  { title: "Urgence 1", dataIndex: "contact_urgence1", render: (value) => value || "—" },
  { title: "Urgence 2", dataIndex: "contact_urgence2", render: (value) => value || "—" },
  { title: "Urgence 3", dataIndex: "contact_urgence3", render: (value) => value || "—" },
  { title: "Personne à prévenir", dataIndex: "nom_personne_prevenir", render: (value) => value || "—" },
  { title: "Lien", dataIndex: "lien_personne_prevenir", render: (value) => value || "—" },
  { title: "Entité", dataIndex: "entite_nom", render: (value) => value || "—" },
  { title: "Sous-entité", dataIndex: "sous_entite_nom", render: (value) => value || "—" },
  { title: "Coordination", dataIndex: "coordination_nom", render: (value) => value || "—" },
  { title: "Région", dataIndex: "region_nom", render: (value) => value || "—" },
  { title: "Province", dataIndex: "province_nom", render: (value) => value || "—" },
  { title: "Commune", dataIndex: "commune_nom", render: (value) => value || "—" },
  { title: "Localité", dataIndex: "localite_nom", render: (value) => value || "—" },
  { title: "Observation", dataIndex: "observation", render: (value) => value || "—" }
];
const EntiteDetailedColumns = [
  { title: "Nom", dataIndex: "nom" },
  { title: "Code", dataIndex: "code", render: (value) => value || "—" },
  { title: "Type", dataIndex: "type", render: (value) => value || "—" },
  { title: "Région", dataIndex: "region_nom", render: (value) => value || "—" },
  { title: "Province", dataIndex: "province_nom", render: (value) => value || "—" },
  { title: "Commune", dataIndex: "commune_nom", render: (value) => value || "—" }
];
const SousEntiteDetailedColumns = [
  { title: "Nom", dataIndex: "nom" },
  { title: "Code", dataIndex: "code", render: (value) => value || "—" },
  { title: "Type", dataIndex: "type", render: (value) => value || "—" },
  { title: "Entité parent", dataIndex: "entite_nom", render: (value) => value || "—" },
  { title: "Province", dataIndex: "province_nom", render: (value) => value || "—" },
  { title: "Commune", dataIndex: "commune_nom", render: (value) => value || "—" }
];
const CoordinationDetailedColumns = [
  { title: "Nom", dataIndex: "nom" },
  { title: "Code", dataIndex: "code", render: (value) => value || "—" },
  { title: "Type", dataIndex: "type", render: (value) => value || "—" },
  { title: "Région", dataIndex: "region_nom", render: (value) => value || "—" },
  { title: "Province", dataIndex: "province_nom", render: (value) => value || "—" },
  { title: "Commune", dataIndex: "commune_nom", render: (value) => value || "—" }
];
const normalizeArmeRow = (row = {}) => {
  const rawId = row.resource_id ?? row.id ?? row.uuid;
  const numeroSerie = row.numero_serie || row.reference || null;
  return {
    ...row,
    id: rawId,
    arme_id: rawId,
    reference: row.reference || numeroSerie,
    designation: row.designation || row.description || row.nom || null,
    statut: row.statut || row.status || row.etat || "disponible",
    quantite: row.quantite ?? row.quantity ?? 1,
    // --- Ajout : normalisation des informations de lot si présentes côté serveur ---
    lot_id: row.lot ?? row.lot_id ?? row.lotId ?? null,
    lot_nom: row.lot_nom ?? row.lot_designation ?? row.designation_lot ?? null,
    key: `arme-${rawId || numeroSerie || Date.now()}`
  };
};

const DotationArmeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [metaForm] = Form.useForm();

  const beneficiaryType = Form.useWatch("beneficiary_type", metaForm) ?? INITIAL_META.beneficiary_type;

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [armeQuery, setArmeQuery] = useState("");
  const [armesResults, setArmesResults] = useState([]);
  const [armesCatalog, setArmesCatalog] = useState([]);
  const [selectedArmes, setSelectedArmes] = useState([]);

  const [beneficiaryQuery, setBeneficiaryQuery] = useState("");
  const [beneficiaryResults, setBeneficiaryResults] = useState([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [beneficiaryScope, setBeneficiaryScope] = useState("entite");
  const [allVdps, setAllVdps] = useState([]);
  const [allEntites, setAllEntites] = useState([]);
  const [allSousEntites, setAllSousEntites] = useState([]);
  const [allCoordinations, setAllCoordinations] = useState([]);
  const [allRegions, setAllRegions] = useState([]);
  const [allProvinces, setAllProvinces] = useState([]);
  const [allCommunes, setAllCommunes] = useState([]);
  const [allSourcesArmement, setAllSourcesArmement] = useState([]);

  const [showArmeModal, setShowArmeModal] = useState(false);
  const [showVdpModal, setShowVdpModal] = useState(false);
  const [showEntiteDrawer, setShowEntiteDrawer] = useState(false);
  const [showVdpDrawer, setShowVdpDrawer] = useState(false);
  const [showArmeDrawer, setShowArmeDrawer] = useState(false);
  const [vdpFormKey, setVdpFormKey] = useState(0);

  const [detail, setDetail] = useState(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [heroStats, setHeroStats] = useState({ total: 0, individuelle: 0, collective: 0 });
  const [beneficiaryDetails, setBeneficiaryDetails] = useState(null);
  const [resourceLoading, setResourceLoading] = useState(false);

  const beneficiaryColumns = useMemo(() => {
    if (beneficiaryType === "vdp") return VdpDetailedColumns;
    if (beneficiaryScope === "sous_entite") return SousEntiteDetailedColumns;
    if (beneficiaryScope === "coordination") return CoordinationDetailedColumns;
    return EntiteDetailedColumns;
  }, [beneficiaryType, beneficiaryScope]);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await api.getDotationDetail(id);
      setDetail(response);
      if (response?.dotation) {
        const { dotation, items } = response;
        metaForm.setFieldsValue({
          dotation_type: dotation.dotation_type,
          beneficiary_type: dotation.beneficiary_type,
          date_dotation: dotation.date_dotation ? dayjs(dotation.date_dotation) : dayjs(),
          observation: dotation.observation || "",
          source_arme_id:
            dotation.source_arme_id ??
            (Array.isArray(items) && items.length === 1 ? items[0]?.source_arme_id ?? null : null) ??
            null
        });

        const initialResources = (items || []).map((item) => {
          const baseRow = {
            ...item,
            ...(item.resource || item.arme || {}),
            arme_id: item.arme_id || item.resource_id,
            id: item.arme_id || item.resource_id || item.id
          };
          const normalized = normalizeArmeRow(baseRow);
          normalized.dotation_item_id = item.id;
          normalized.quantite = item.quantite ?? item.quantity ?? normalized.quantite ?? 1;
          return normalized;
        });
        setSelectedArmes(initialResources || []);

        if (dotation.beneficiary_type === "vdp") {
          setSelectedBeneficiary({
            id: Number(dotation.vdp_id),
            nom: dotation.vdp_nom,
            prenom: dotation.vdp_prenom,
            numero_cnib: dotation.numero_cnib,
            contacts: dotation.contacts,
            scope: "vdp",
            key: `vdp-${dotation.vdp_id}`
          });
        } else {
          const scope =
            dotation.sous_entite_id ? "sous_entite" : dotation.coordination_id ? "coordination" : "entite";
          setBeneficiaryScope(scope);
          setSelectedBeneficiary({
            id: Number(dotation.entite_id || dotation.coordination_id || dotation.sous_entite_id),
            nom: dotation.entite_nom || dotation.coordination_nom || dotation.sous_entite_nom,
            code: dotation.entite_code,
            type: dotation.beneficiary_type,
            scope,
            key: `${scope}-${dotation.entite_id || dotation.coordination_id || dotation.sous_entite_id}`
          });
        }
      }
    } catch (error) {
      console.error("[DotationArmeForm] detail:", error);
      message.error("Erreur lors du chargement de la dotation.");
    } finally {
      setLoading(false);
    }
  }, [id, metaForm]);

  const toArray = useCallback((value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.rows)) return value.rows;
    if (Array.isArray(value?.data)) return value.data;
    return [];
  }, []);

  const resolveBridgeMethod = (bridge, method) => {
    if (!bridge) return null;
    if (typeof bridge[method] === "function") return bridge[method];
    if (bridge.ipcRenderer && typeof bridge.ipcRenderer.invoke === "function") {
      return (params) => bridge.ipcRenderer.invoke(method, params);
    }
    if (typeof bridge.invoke === "function") {
      return (params) => bridge.invoke(method, params);
    }
    return null;
  };

  const callBridge = useCallback(async (method, params) => {
    const bridge = typeof window !== "undefined" ? window.electronAPI || window.safeElectronAPI : null;
    const fn = resolveBridgeMethod(bridge, method);
    if (!fn) return undefined;
    return fn(params);
  }, []);

  const fetchDataset = useCallback(
    async (bridgeMethod, apiMethod, params) => {
      let rows = [];
      if (bridgeMethod) {
        try {
          rows = toArray(await callBridge(bridgeMethod, params));
        } catch (error) {
          console.warn(`[DotationArmeForm] bridge ${bridgeMethod}:`, error?.message || error);
        }
      }
      const resolvedApiMethod = typeof apiMethod === "function" ? apiMethod : null;
      if (!rows.length && resolvedApiMethod) {
        try {
          rows = toArray(await resolvedApiMethod(params));
        } catch (error) {
          console.warn(`[DotationArmeForm] api ${bridgeMethod || resolvedApiMethod.name}:`, error?.message || error);
        }
      }
      return rows;
    },
    [callBridge, toArray]
  );
  const loadAvailableArmes = useCallback(async () => {
    setResourceLoading(true);
    try {
      const primary = await fetchDataset("getArmesWithConfig", api.getArmesWithConfig);
      const fallback = primary.length ? primary : await fetchDataset("getArmes", api.getArmesList, { includeDeleted: false });
      const cleaned = toArray(fallback)
        .filter((row) => !row?.deleted_at)
        .map(normalizeArmeRow);
      setArmesCatalog(cleaned);
      setArmesResults(cleaned);
    } catch (error) {
      console.error("[DotationArmeForm] loadArmes:", error);
      message.error("Chargement des armes impossible.");
    } finally {
      setResourceLoading(false);
    }
  }, [fetchDataset, toArray]);
  const handleArmeSearch = useCallback((value) => {
    const needle = (value || "").trim().toLowerCase();
    setArmeQuery(value);
    if (!needle) {
      setArmesResults(armesCatalog);
      return;
    }
    setArmesResults(
      armesCatalog.filter((row) =>
        ["numero_serie", "reference", "designation", "type", "categorie", "entite_nom", "statut", "marque", "modele", "calibre"].some(
          (field) => String(row[field] || "").toLowerCase().includes(needle)
        )
      )
    );
  }, [armesCatalog]);
  useEffect(() => {
    metaForm.setFieldsValue(INITIAL_META);
  }, [metaForm]);
  const hydrateMaps = useCallback(() => {
    const regionMap = new Map(allRegions.map((item) => [String(item.id), item.nom]));
    const provinceMap = new Map(allProvinces.map((item) => [String(item.id), item.nom]));
    const communeMap = new Map(allCommunes.map((item) => [String(item.id), item.nom]));
    return { regionMap, provinceMap, communeMap };
  }, [allRegions, allProvinces, allCommunes]);

  const sliceBeneficiaries = useCallback(
    (list = [], keys = [], term = "") => {
      const base = Array.isArray(list) ? list : [];
      const needle = term?.trim().toLowerCase() || "";
      if (!needle) return base.slice();
      return base.filter((row) =>
        keys.some((field) => String(row[field] || "").toLowerCase().includes(needle))
      );
    },
    []
  );

  const refreshBeneficiaryResults = useCallback(
    (type = undefined, scope = undefined, query = undefined, overrides = {}) => {
      // Utiliser la valeur actuelle du formulaire si type non fourni
      const formType = (typeof type !== 'undefined') ? type : (metaForm.getFieldValue?.('beneficiary_type') ?? beneficiaryType);
      const effectiveType = formType || "vdp";
      // scope : prioriser l'argument, sinon l'état beneficiaryScope
      const effectiveScope = scope || beneficiaryScope || "entite";
      const effectiveQuery = typeof query !== 'undefined' ? query : (beneficiaryQuery ?? "");

      const vdpsSource = overrides.vdps ?? allVdps;
      const entitesSource = overrides.entites ?? allEntites;
      const sousEntitesSource = overrides.sousEntites ?? allSousEntites;
      const coordinationsSource = overrides.coordinations ?? allCoordinations;

      if (effectiveType === "vdp") {
        const keys = [
          "nom",
          "prenom",
          "numero_cnib",
          "statut_vdp",
          "statut_matrimonial",
          "type_vdp",
          "contacts",
          "contact_urgence1",
          "contact_urgence2",
          "contact_urgence3",
          "nom_personne_prevenir",
          "lien_personne_prevenir",
          "entite_nom",
          "sous_entite_nom",
          "coordination_nom",
          "region_nom",
          "province_nom",
          "commune_nom",
          "localite_nom",
          "observation"
        ];
        setBeneficiaryResults(sliceBeneficiaries(vdpsSource, keys, effectiveQuery));
        return;
      }

      const base =
        effectiveScope === "sous_entite"
          ? sousEntitesSource
          : effectiveScope === "coordination"
          ? coordinationsSource
          : entitesSource;

      const keys =
        effectiveScope === "sous_entite"
          ? ["nom", "code", "type", "entite_nom", "province_nom", "commune_nom"]
          : effectiveScope === "coordination"
          ? ["nom", "code", "type", "region_nom", "province_nom", "commune_nom"]
          : ["nom", "code", "type", "region_nom", "province_nom", "commune_nom"];

      setBeneficiaryResults(sliceBeneficiaries(base, keys, effectiveQuery));
    },
    [
      beneficiaryType,
      beneficiaryScope,
      beneficiaryQuery,
      allVdps,
      allEntites,
      allSousEntites,
      allCoordinations,
      sliceBeneficiaries,
      metaForm
    ]
  );
  const loadReferenceData = useCallback(async () => {
    try {
      const vdpApiMethod = api.getVdpsWithLocalites || api.getVdpsList || api.getVdps;
      const [
        regionsArray,
        provincesArray,
        communesArray,
        localitesArray,
        entiteArrayRaw,
        sousEntiteArrayRaw,
        coordinationArrayRaw,
        vdpsArrayRaw,
        sourcesArmementRaw
      ] = await Promise.all([
        fetchDataset("getRegions", api.getRegionsList),
        fetchDataset("getProvinces", api.getProvincesList),
        fetchDataset("getCommunes", api.getCommunesList),
        fetchDataset("getLocalites", api.getLocalitesList),
        fetchDataset("getEntites", api.getEntitesList),
        fetchDataset("getSousEntites", api.getSousEntitesList),
        fetchDataset("getCoordinations", api.getCoordinationsList),
        fetchDataset("getVdps", vdpApiMethod),
        fetchDataset("getSourcesArmement", api.getSourcesArmement)
      ]);
      const regionsMap = new Map(regionsArray.map((item) => [String(item.id), item.nom]));
      const provincesMap = new Map(provincesArray.map((item) => [String(item.id), item.nom]));
      const communesMap = new Map(communesArray.map((item) => [String(item.id), item.nom]));
      const localitesMap = new Map(localitesArray.map((item) => [String(item.id), item.nom]));

      // entités -> ajouter scope + key + id numérique
      const entiteArray = toArray(entiteArrayRaw).map((row) => ({
        ...row,
        id: Number(row.id),
        scope: "entite",
        key: `entite-${row.id}`,
        region_nom: row.region_nom || regionsMap.get(String(row.region_id)) || "—",
        province_nom: row.province_nom || provincesMap.get(String(row.province_id)) || "—",
        commune_nom: row.commune_nom || communesMap.get(String(row.commune_id)) || "—"
      }));
      const entiteMap = new Map(entiteArray.map((item) => [String(item.id), item.nom]));

      // sous‑entités -> scope 'sous_entite'
      const sousEntiteArray = toArray(sousEntiteArrayRaw).map((row) => ({
        ...row,
        id: Number(row.id),
        scope: "sous_entite",
        key: `sous-entite-${row.id}`,
        entite_nom: row.entite_nom || entiteMap.get(String(row.entite_id)) || "—",
        region_nom: row.region_nom || regionsMap.get(String(row.region_id)) || "—",
        province_nom: row.province_nom || provincesMap.get(String(row.province_id)) || "—",
        commune_nom: row.commune_nom || communesMap.get(String(row.commune_id)) || "—"
      }));
      const sousEntiteMap = new Map(sousEntiteArray.map((item) => [String(item.id), item.nom]));

      // coordinations -> scope 'coordination'
      const coordinationArray = toArray(coordinationArrayRaw).map((row) => ({
        ...row,
        id: Number(row.id),
        scope: "coordination",
        key: `coordination-${row.id}`,
        region_nom: row.region_nom || regionsMap.get(String(row.region_id)) || "—",
        province_nom: row.province_nom || provincesMap.get(String(row.province_id)) || "—",
        commune_nom: row.commune_nom || communesMap.get(String(row.commune_id)) || "—"
      }));
      const coordinationMap = new Map(coordinationArray.map((item) => [String(item.id), item.nom]));

      // VDP -> scope 'vdp', id numérique, et champs géoloc normalisés
      const vdpsArray = toArray(vdpsArrayRaw).map((row) => ({
        ...row,
        id: Number(row.id),
        scope: "vdp",
        key: `vdp-${row.id}`,
        entite_nom: row.entite_nom || entiteMap.get(String(row.entite_id)) || "—",
        sous_entite_nom: row.sous_entite_nom || sousEntiteMap.get(String(row.sous_entite_id)) || "—",
        coordination_nom: row.coordination_nom || coordinationMap.get(String(row.coordination_id)) || "—",
        region_nom: row.region_nom || regionsMap.get(String(row.region_id)) || "—",
        province_nom: row.province_nom || provincesMap.get(String(row.province_id)) || "—",
        commune_nom: row.commune_nom || communesMap.get(String(row.commune_id)) || "—",
        localite_nom: row.localite_nom || localitesMap.get(String(row.localite_id)) || "—"
      }));

      const sourcesArmement = toArray(sourcesArmementRaw || []).map((row) => ({
        ...row,
        id: Number(row.id),
        key: `source-armement-${row.id}`,
        label: row.nom || row.name || row.libelle || row.label || row.code || String(row.id)
      }));

      setAllSourcesArmement(sourcesArmement);
      setAllRegions(regionsArray);
      setAllProvinces(provincesArray);
      setAllCommunes(communesArray);
      setAllEntites(entiteArray);
      setAllSousEntites(sousEntiteArray);
      setAllCoordinations(coordinationArray);
      setAllVdps(vdpsArray);

      // refresh en fournissant explicitement les sources enrichies (avec scope/id)
      refreshBeneficiaryResults(
        beneficiaryType,
        beneficiaryScope,
        beneficiaryQuery,
        {
          vdps: vdpsArray,
          entites: entiteArray,
          sousEntites: sousEntiteArray,
          coordinations: coordinationArray
        }
      );
    } catch (error) {
      console.error("[DotationArmeForm] loadReferenceData:", error);
    }
  }, [fetchDataset, toArray]);
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);
  useEffect(() => {
    metaForm.setFieldsValue(INITIAL_META);
  }, [metaForm]);
  useEffect(() => {
    loadAvailableArmes();
  }, [loadAvailableArmes]);
  useEffect(() => {
    loadDetail();
  }, [loadDetail]);
  useEffect(() => {
    const { regionMap, provinceMap, communeMap } = hydrateMaps();
    setAllEntites((prev) =>
      prev.map((row) => ({
        ...row,
        region_nom: row.region_nom || regionMap.get(String(row.region_id)) || "—",
        province_nom: row.province_nom || provinceMap.get(String(row.province_id)) || "—",
        commune_nom: row.commune_nom || communeMap.get(String(row.commune_id)) || "—"
      }))
    );
  }, [hydrateMaps, allRegions, allProvinces, allCommunes]);
  useEffect(() => {
    handleArmeSearch(armeQuery);
  }, [armesCatalog, armeQuery, handleArmeSearch]);

  useEffect(() => {
    if (beneficiaryType === "vdp") {
      const keys = [
        "nom",
        "prenom",
        "numero_cnib",
        "statut_vdp",
        "statut_matrimonial",
        "type_vdp",
        "contacts",
        "contact_urgence1",
        "contact_urgence2",
        "contact_urgence3",
        "nom_personne_prevenir",
        "lien_personne_prevenir",
        "entite_nom",
        "sous_entite_nom",
        "coordination_nom",
        "region_nom",
        "province_nom",
        "commune_nom",
        "localite_nom",
        "observation"
      ];
      setBeneficiaryResults(sliceBeneficiaries(allVdps, keys, beneficiaryQuery));
      return;
    }
    const base =
      beneficiaryScope === "sous_entite"
        ? allSousEntites
        : beneficiaryScope === "coordination"
        ? allCoordinations
        : allEntites;
    const keys =
      beneficiaryScope === "sous_entite"
        ? ["nom", "code", "type", "entite_nom", "province_nom", "commune_nom"]
        : beneficiaryScope === "coordination"
        ? ["nom", "code", "type", "region_nom", "province_nom", "commune_nom"]
        : ["nom", "code", "type", "region_nom", "province_nom", "commune_nom"];
    setBeneficiaryResults(sliceBeneficiaries(base, keys, beneficiaryQuery));
  }, [
    beneficiaryType,
    beneficiaryScope,
    beneficiaryQuery,
    allVdps,
    allEntites,
    allSousEntites,
    allCoordinations,
    sliceBeneficiaries
  ]);
  useEffect(() => {
    setBeneficiaryDetails(selectedBeneficiary);
  }, [selectedBeneficiary]);

  const searchBeneficiaries = useCallback(async () => {
    if (!beneficiaryQuery.trim()) {
      refreshBeneficiaryResults(beneficiaryType, beneficiaryScope, "");
      return;
    }
    try {
      setLoading(true);
      const rows =
        beneficiaryType === "vdp"
          ? await api.searchVdp(beneficiaryQuery.trim())
          : await api.searchEntites(beneficiaryQuery.trim());
      const normalized = Array.isArray(rows) ? rows : [];
      // ajouter scope et id numérique aux résultats de recherche pour la sélection fiable
      setBeneficiaryResults(
        normalized.map((row) => {
          const idNum = row?.id ? Number(row.id) : row?.entite_id ? Number(row.entite_id) : null;
          const scope = beneficiaryType === "vdp" ? "vdp" : (beneficiaryScope || "entite");
          return {
            ...row,
            id: idNum ?? row.id,
            scope,
            key: `${scope}-${idNum ?? row.id ?? Math.random().toString(36).slice(2)}`
          };
        })
      );
    } catch (error) {
      console.error("[DotationArmeForm] searchBeneficiary:", error);
      message.error("Recherche du bénéficiaire impossible.");
    } finally {
      setLoading(false);
    }
  }, [beneficiaryQuery, beneficiaryType, refreshBeneficiaryResults, beneficiaryScope]);

  // --- Remplace addArme pour récupérer l'arme complète et pré-remplir le lot automatiquement ---
  const addArme = async (record) => {
	// normalise l'aperçu
	let normalized = normalizeArmeRow(record);
	const dotType = metaForm.getFieldValue("dotation_type") || INITIAL_META.dotation_type;
	if (dotType === "individuelle" && selectedArmes.length >= 1) {
		message.warning("Pour une dotation individuelle, seule une arme peut être sélectionnée.");
		return;
	}
	if (selectedArmes.some((item) => item.key === normalized.key)) {
		message.info("Cette arme est déjà sélectionnée.");
		return;
	}

	// tente de charger la fiche arme complète côté serveur pour obtenir tous les champs (lot, entité, etc.)
	try {
		if (normalized.arme_id) {
			const full = await api.getArmeById(normalized.arme_id).catch(() => null);
			if (full && typeof full === "object") {
				normalized = { ...normalized, ...normalizeArmeRow(full), ...full };
			}
		}
	} catch (e) {
		// ne bloque pas la sélection si l'API échoue, on garde la version normalisée
		console.warn('[DotationArmeForm] failed to fetch full arme:', e?.message || e);
	}

	// utilise la fiche enrichie pour l'affichage
	setSelectedArmes((prev) => [...prev, { ...normalized, key: normalized.key || `arme-${Date.now()}` }]);
};

// --- Remplacement : sélection robuste du bénéficiaire (scope + id normalisés) ---
const handleSelectBeneficiary = async (record) => {
	// heuristiques pour déterminer le scope
	let scope = record?.scope || null;
	const key = String(record?.key || "").toLowerCase();

	if (!scope) {
		if (key.startsWith("vdp-") || record?.numero_cnib || record?.prenom) scope = "vdp";
		else if (key.startsWith("sous-entite-") || key.startsWith("sous_entite-") || record?.sous_entite_nom) scope = "sous_entite";
		else if (key.startsWith("coordination-") || record?.coordination_nom) scope = "coordination";
		else if (record?.entite_nom || key.startsWith("entite-")) scope = "entite";
		else {
			// fallback : utiliser le choix du formulaire (radio) si présent
			const formBt = metaForm.getFieldValue?.("beneficiary_type");
			scope = formBt === "vdp" ? "vdp" : "entite";
		}
	}

	// Coercition de l'id en Number si possible
	const rawId = record?.id ?? record?.entite_id ?? record?.vdp_id ?? record?.sous_entite_id ?? record?.coordination_id ?? null;
	const idNum = rawId != null ? Number(rawId) : null;

	// Mettre à jour le formulaire pour rester cohérent (individuelle -> vdp logique gérée ailleurs)
	try {
		metaForm.setFieldsValue({ beneficiary_type: scope === "vdp" ? "vdp" : "entite" });
	} catch (_) {}

	// Mettre l'état scope utile pour les listes (entite / sous_entite / coordination)
	if (scope !== "vdp") {
		setBeneficiaryScope(scope);
	}

	const base = { ...record, scope, id: idNum ?? record?.id, key: record?.key || `${scope}-${rawId ?? Date.now()}` };
	setSelectedBeneficiary(base);
	setBeneficiaryDetails(null);

	// Charger détails complets si possible (géoloc, etc.)
	try {
		if (scope === "vdp" && base.id) {
			const full = await api.getVdpById(base.id).catch(() => null);
			if (full) {
				const enriched = { ...base, ...full, scope: "vdp", __detailsLoaded: true, id: Number(base.id) };
				setSelectedBeneficiary(enriched);
				setBeneficiaryDetails(enriched);
				return;
			}
		} else if (base.id) {
			const full = await api.getEntiteById(base.id).catch(() => null);
			if (full) {
				// si la ressource renvoyée contient précision (type/parent), on garde scope détecté
				const enriched = { ...base, ...full, scope: scope || "entite", __detailsLoaded: true, id: Number(base.id) };
				setSelectedBeneficiary(enriched);
				setBeneficiaryDetails(enriched);
				return;
			}
		}
		// fallback : conserver la sélection minimale
		setBeneficiaryDetails(base);
	} catch (err) {
		console.warn("[DotationArmeForm] handleSelectBeneficiary error:", err?.message || err);
		setBeneficiaryDetails(base);
	}
};

  const nextStep = async () => {
    if (currentStep === 0) {
      try {
        await metaForm.validateFields(["dotation_type", "beneficiary_type", "date_dotation"]);
      } catch {
        message.warning("Complétez le paramétrage de la dotation.");
        return;
      }
    }
    if (currentStep === 1 && !selectedBeneficiary) {
      message.warning("Sélectionnez ou créez le bénéficiaire.");
      return;
    }
    if (currentStep === 2 && selectedArmes.length === 0) {
      message.warning("Ajoutez au moins une arme avant de continuer.");
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const resetForm = () => {
    metaForm.setFieldsValue(INITIAL_META);
    setSelectedArmes([]);
    setArmeQuery("");
    setArmesResults(armesCatalog);
    setSelectedBeneficiary(null);
    setCurrentStep(0);
  };

  const submitDotation = useCallback(
    async (dotationId, body) => {
      const method = dotationId ? "updateDotation" : "createDotation";
      try {
        return dotationId ? await api.updateDotation(dotationId, body) : await api.createDotation(body);
      } catch (error) {
        const status = error?.response?.status;
        const isNetworkError =
          error?.code === "ERR_NETWORK" ||
          error?.message === "Network Error" ||
          !error?.response ||
          status === 404;
        if (!isNetworkError) throw error;
        const bridgePayload = dotationId ? { id: dotationId, ...body } : body;
        const bridgeResult = await callBridge(method, bridgePayload);
        if (typeof bridgeResult === "undefined") {
          const bridgeError = new Error("BRIDGE_UNAVAILABLE");
          bridgeError.originalError = error;
          throw bridgeError;
        }
        return bridgeResult;
      }
    },
    [callBridge]
  );

  const handleSubmit = async () => {
    const values = metaForm.getFieldsValue();
    const dotType = values.dotation_type || INITIAL_META.dotation_type;

    // forcer beneficiary_type effectif
    const beneficiary_type_effectif = dotType === "individuelle" ? "vdp" : (values.beneficiary_type || "entite");

    // vérifications (inchangées)
    // ...

    // déterminer ids depuis selectedBeneficiary.scope (fiable si handleSelectBeneficiary a été utilisé)
    const selScope = selectedBeneficiary?.scope;
    const selIdRaw = selectedBeneficiary?.id ?? null;
    const selId = selIdRaw != null ? Number(selIdRaw) : null;

    const payload = {
      dotation_type: dotType,
      beneficiary_type: beneficiary_type_effectif,
      vdp_id: selScope === "vdp" ? selId : null,
      entite_id: selScope === "entite" ? selId : null,
      sous_entite_id: selScope === "sous_entite" ? selId : null,
      coordination_id: selScope === "coordination" ? selId : null,
      source_arme_id: values.source_arme_id != null && values.source_arme_id !== "" ? Number(values.source_arme_id) : null,
      date_dotation: values.date_dotation ? values.date_dotation.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      observation: values.observation || null,
      items: selectedArmes.map((arme) => ({
        id: arme.dotation_item_id,
        arme_id: arme.arme_id || arme.id,
        resource_id: arme.arme_id || arme.id,
        resource_type: "arme",
        quantite: arme.quantite ?? 1,
        source_arme_id: values.source_arme_id != null && values.source_arme_id !== "" ? Number(values.source_arme_id) : null
      }))
    };

    setLoading(true);
    try {
      await submitDotation(id, payload);
      message.success(id ? "Dotation mise à jour." : "Dotation enregistrée.");
      resetForm();
      navigate("/dashboard/dotation-arme");
    } catch (error) {
      console.error("[DotationArmeForm] submit:", error);
      if (
        error?.message === "BRIDGE_UNAVAILABLE" ||
        error?.code === "ERR_NETWORK" ||
        error?.message === "Network Error" ||
        error?.response?.status === 404
      ) {
        message.error("Impossible de joindre l’API locale. Vérifiez le serveur ou le pont Electron.");
      } else {
        message.error("Échec de l’enregistrement de la dotation.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resourceTypeSummary = selectedArmes.length ? "Arme" : "";
  const summaryData = useMemo(() => {
    const values = metaForm.getFieldsValue();
    return [
      { label: "Type de dotation", value: values.dotation_type === "collective" ? "Collective" : "Individuelle" },
      {
        label: "Bénéficiaire",
        value:
          values.beneficiary_type === "vdp"
            ? `${selectedBeneficiary?.nom || ""} ${selectedBeneficiary?.prenom || ""}`.trim()
            : selectedBeneficiary
            ? `${selectedBeneficiary.nom || "—"}${selectedBeneficiary.code ? ` (${selectedBeneficiary.code})` : ""}`
            : "—"
      },
      {
        label: "Date de dotation",
        value: (values.date_dotation || dayjs()).format("DD/MM/YYYY")
      },
      { label: "Observation", value: values.observation || "—" },
      {
        label: "Armes",
        value: `${selectedArmes.length} arme(s)`
      }
    ];
  }, [metaForm, selectedBeneficiary, selectedArmes]);

  const updateProgress = useCallback(
    (values) => {
      const snapshot = values || metaForm.getFieldsValue();
      let score = 0;
      ["dotation_type", "beneficiary_type", "date_dotation", "observation"].forEach((field) => {
        if (snapshot[field]) score += 1;
      });
      if (selectedBeneficiary) score += 3;
      if (selectedArmes.length) score += 3;
      setProgressPercent(Math.min(100, Math.round((score / 10) * 100)));
    },
    [metaForm, selectedBeneficiary, selectedArmes]
  );
  const handleMetaChange = useCallback(
    (changedValues, allValues) => {
      if (Object.prototype.hasOwnProperty.call(changedValues, "beneficiary_type")) {
        const nextType = allValues.beneficiary_type ?? INITIAL_META.beneficiary_type;
        const nextScope = "entite";
        setSelectedBeneficiary(null);
        setBeneficiaryQuery("");
        setBeneficiaryScope(nextScope);
        refreshBeneficiaryResults(nextType, nextScope, "");
      }
      // Forcer les comportements UI selon dotation_type et empêcher plusieurs armes pour individuelle
      if (Object.prototype.hasOwnProperty.call(changedValues, "dotation_type")) {
        const dt = allValues.dotation_type || INITIAL_META.dotation_type;
        if (dt === "individuelle") {
          metaForm.setFieldsValue({ beneficiary_type: "vdp" });
          setSelectedBeneficiary(null);
          // si déjà plus d'une arme sélectionnée, garder la première seulement
          if (selectedArmes.length > 1) {
            setSelectedArmes((prev) => prev.slice(0, 1));
            message.info("Dotation individuelle: seule une arme est autorisée, la sélection a été réduite.");
          }
        } else {
          metaForm.setFieldsValue({ beneficiary_type: "entite" });
          setSelectedBeneficiary(null);
        }
      }
      // Forcer qu'on ne puisse pas choisir entité si individuelle (désactiver scope côté UI)
      if (Object.prototype.hasOwnProperty.call(changedValues, "beneficiary_type")) {
        // si payload tries to set beneficiary_type incompatible -> correct it
        const bt = allValues.beneficiary_type;
        const dt = allValues.dotation_type || metaForm.getFieldValue("dotation_type");
        if (dt === "individuelle" && bt !== "vdp") {
          metaForm.setFieldsValue({ beneficiary_type: "vdp" });
        }
        if (dt === "collective" && bt !== "entite") {
          metaForm.setFieldsValue({ beneficiary_type: "entite" });
        }
      }
      updateProgress(allValues);
    },
    [metaForm, refreshBeneficiaryResults, selectedArmes, updateProgress]
  );

  const loadHeroStats = useCallback(async () => {
    try {
      let rows = await fetchDataset("getDotationsWithDetails", api.getDotationsWithDetails);
      if (!rows.length) {
        rows = await fetchDataset("getDotations", api.getDotations);
      }
      setHeroStats({
        total: rows.length,
        individuelle: rows.filter((item) => item.dotation_type === "individuelle").length,
        collective: rows.filter((item) => item.dotation_type === "collective").length
      });
    } catch (error) {
      console.error("[DotationArmeForm] stats:", error);
    }
  }, [fetchDataset]);

  useEffect(() => {
    loadHeroStats();
  }, [loadHeroStats]);

  useEffect(() => {
    updateProgress();
  }, [updateProgress, selectedBeneficiary, selectedArmes]);

  useEffect(() => {
    if (!selectedBeneficiary?.id) {
      setBeneficiaryDetails(null);
      return;
    }
    if (selectedBeneficiary.__detailsLoaded) {
      setBeneficiaryDetails(selectedBeneficiary);
      return;
    }
    let cancelled = false;
    const fetchDetails = async () => {
      try {
        const detail =
          beneficiaryType === "vdp"
            ? await api.getVdpById(selectedBeneficiary.id)
            : await api.getEntiteById(selectedBeneficiary.id);
        if (cancelled || !detail) {
          if (!cancelled) setBeneficiaryDetails(selectedBeneficiary);
          return;
        }
        const enriched = {
          ...selectedBeneficiary,
          ...detail,
          key: selectedBeneficiary.key || `${beneficiaryType}-${detail.id}`,
          scope: beneficiaryType === "vdp" ? "vdp" : selectedBeneficiary.scope,
          __detailsLoaded: true
        };
        setBeneficiaryDetails(enriched);
        setSelectedBeneficiary((prev) => (prev?.id === enriched.id ? enriched : prev));
      } catch (error) {
        if (!cancelled) setBeneficiaryDetails(selectedBeneficiary);
      }
    };
    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [beneficiaryType, selectedBeneficiary]);

  const summaryDetails = useMemo(() => {
    if (!selectedBeneficiary) return null;
    if (beneficiaryType === "vdp") {
      return [
        { label: "Nom", value: selectedBeneficiary.nom || "—" },
        { label: "Prénom", value: selectedBeneficiary.prenom || "—" },
        { label: "Sexe", value: selectedBeneficiary.sexe || "—" },
        { label: "Statut", value: selectedBeneficiary.statut_vdp || "—" },
        { label: "Type", value: selectedBeneficiary.type_vdp || "—" },
        { label: "Date naissance", value: formatDate(selectedBeneficiary.date_naissance) },
        { label: "Lieu naissance", value: selectedBeneficiary.lieu_naissance || "—" },
        { label: "CNIB", value: selectedBeneficiary.numero_cnib || "—" },
        { label: "Date CNIB", value: formatDate(selectedBeneficiary.date_cnib) },
        { label: "Date recrutement", value: formatDate(selectedBeneficiary.date_recrutement) },
        { label: "Contacts", value: selectedBeneficiary.contacts || "—" },
        { label: "Urgence 1", value: selectedBeneficiary.contact_urgence1 || "—" },
        { label: "Urgence 2", value: selectedBeneficiary.contact_urgence2 || "—" },
        { label: "Urgence 3", value: selectedBeneficiary.contact_urgence3 || "—" },
        { label: "Personne à prévenir", value: selectedBeneficiary.nom_personne_prevenir || "—" },
        { label: "Lien", value: selectedBeneficiary.lien_personne_prevenir || "—" },
        { label: "Entité", value: selectedBeneficiary.entite_nom || "—" },
        { label: "Sous-entité", value: selectedBeneficiary.sous_entite_nom || "—" },
        { label: "Coordination", value: selectedBeneficiary.coordination_nom || "—" },
        { label: "Région", value: selectedBeneficiary.region_nom || "—" },
        { label: "Province", value: selectedBeneficiary.province_nom || "—" },
        { label: "Commune", value: selectedBeneficiary.commune_nom || "—" },
        { label: "Localité", value: selectedBeneficiary.localite_nom || "—" },
        { label: "Observation", value: selectedBeneficiary.observation || "—" }
      ];
    }
    return [
      { label: "Type", value: beneficiaryScope === "coordination" ? "Coordination" : beneficiaryScope === "sous_entite" ? "Sous-entité" : selectedBeneficiary.type || "Entité" },
      { label: "Nom", value: selectedBeneficiary.nom || "—" },
      { label: "Code", value: selectedBeneficiary.code || "—" },
      { label: "Région", value: selectedBeneficiary.region_nom || "—" },
      { label: "Province", value: selectedBeneficiary.province_nom || "—" },
      { label: "Commune", value: selectedBeneficiary.commune_nom || "—" },
      { label: "Entité parent", value: selectedBeneficiary.entite_nom || "—" }
    ].filter((item) => item.value && item.value !== "—");
  }, [selectedBeneficiary, beneficiaryType, beneficiaryScope]);

  const renderStepContent = () => {
    const beneficiaryType = metaForm.getFieldValue("beneficiary_type");
    switch (currentStep) {
      case 0:
        return (
          <Card title="Étape 1 – Paramétrage de la dotation">
            <Form
              form={metaForm}
              layout="vertical"
              initialValues={INITIAL_META}
              onValuesChange={handleMetaChange}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Type de dotation"
                    name="dotation_type"
                    rules={[{ required: true, message: "Sélectionnez un type de dotation." }]}
                  >
                    <Radio.Group>
                      <Radio.Button value="individuelle">Individuelle</Radio.Button>
                      <Radio.Button value="collective">Collective</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Bénéficiaires visés"
                    name="beneficiary_type"
                    rules={[{ required: true, message: "Choisissez le type de bénéficiaire." }]}
                  >
                    <Radio.Group>
                      <Radio.Button value="vdp">Volontaire (VDP)</Radio.Button>
                      <Radio.Button value="entite">Entité / Coordination</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Date de dotation"
                    name="date_dotation"
                    rules={[{ required: true, message: "La date est obligatoire." }]}
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Observation" name="observation">
                    <Input.TextArea rows={3} placeholder="Notes complémentaires" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Source de l'arme" name="source_arme_id">
                    <Select
                      allowClear
                      showSearch
                      placeholder="Sélectionnez une source"
                      optionFilterProp="label"
                      options={allSourcesArmement.map((row) => ({
                        value: row.id,
                        label: row.label
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        );
      case 1:
        return (
          <Card title="Étape 2 – Sélection du bénéficiaire">
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <Alert
                type="info"
                showIcon
                message={
                  beneficiaryType === "vdp"
                    ? "Choisissez le volontaire bénéficiaire."
                    : "Choisissez l'entité, la sous-entité ou la coordination bénéficiaire."
                }
                description="Recherchez dans l’annuaire puis confirmez votre choix."
              />
              <Input.Search
                value={beneficiaryQuery}
                onChange={(event) => setBeneficiaryQuery(event.target.value)}
                onSearch={(value) => setBeneficiaryQuery(value || "")}
                allowClear
                placeholder="CNIB, téléphone, nom..."
                enterButton={<SearchOutlined />}
              />
              {beneficiaryType === "entite" && (
                <Segmented
                  value={beneficiaryScope}
                  onChange={(value) => {
                    setBeneficiaryScope(value);
                    setBeneficiaryQuery("");
                    setSelectedBeneficiary(null);
                    // utiliser la valeur du formulaire si présente
                    const currentType = metaForm.getFieldValue?.('beneficiary_type') ?? beneficiaryType;
                    refreshBeneficiaryResults(currentType, value, "");
                  }}
                  options={[
                    { label: "Entités", value: "entite" },
                    { label: "Sous-entités", value: "sous_entite" },
                    { label: "Coordinations", value: "coordination" }
                  ]}
                />
              )}
              <Table
                size="small"
                rowKey="key"
                pagination={false}
                scroll={{ x: true, y: 260 }}
                dataSource={beneficiaryResults}
                columns={[
                  {
                    title: "Action",
                    key: "select",
                    render: (_, record) => (
                      <Button
                        type="link"
                        onClick={() =>
                          handleSelectBeneficiary(record)
                        }
                      >
                        Choisir
                      </Button>
                    )
                  },
                  ...beneficiaryColumns
                ]}
              />
              {selectedBeneficiary && (
                <Alert
                  type="success"
                  showIcon
                  message={
                    beneficiaryType === "vdp"
                      ? `${selectedBeneficiary.nom || ""} ${selectedBeneficiary.prenom || ""}`.trim() || "VDP sélectionné"
                      : `${selectedBeneficiary.nom || ""} (${selectedBeneficiary.code || "—"})`
                  }
                  description={
                    beneficiaryType === "vdp" ? (
                      <div>
                        <div>{selectedBeneficiary.entite_nom || "Bénéficiaire sélectionné."}</div>
                        <div>CNIB : {selectedBeneficiary.numero_cnib || "—"}</div>
                        <div>Contact : {selectedBeneficiary.contacts || "—"}</div>
                        <div>
                          Naissance : {formatDate(selectedBeneficiary.date_naissance)} à {selectedBeneficiary.lieu_naissance || "—"}
                        </div>
                      </div>
                    ) : (
                      `Structure ${beneficiaryScope.replace("_", " ")} sélectionnée.`
                    )
                  }
                />
              )}
              <Space>
                {beneficiaryType === "vdp" ? (
                  <Button onClick={() => setShowVdpDrawer(true)} icon={<FileAddOutlined />}>
                    Ajouter un VDP
                  </Button>
                ) : (
                  <Button onClick={() => setShowEntiteDrawer(true)} icon={<FileAddOutlined />}>
                    Ajouter une entité
                  </Button>
                )}
              </Space>
            </Space>
          </Card>
        );
      case 2:
        return (
          <Card title="Étape 3 – Sélection des armes">
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <Input.Search
                value={armeQuery}
                onChange={(event) => handleArmeSearch(event.target.value)}
                onSearch={handleArmeSearch}
                allowClear
                placeholder="Référence, type, entité..."
                enterButton={<SearchOutlined />}
              />
              <Table
                size="small"
                rowKey="key"
                loading={resourceLoading}
                pagination={{ pageSize: 6 }}
                dataSource={armesResults}
                columns={[
                  ...ARMES_COLUMNS,
                  {
                    title: "Action",
                    key: "action",
                    render: (_, record) => (
                      <Button type="link" onClick={() => addArme(record)}>
                        Sélectionner
                      </Button>
                    )
                  }
                ]}
              />
              <Table
                size="small"
                rowKey="key"
                pagination={false}
                dataSource={selectedArmes}
                columns={[
                  ...SELECTED_ARME_COLUMNS,
                  {
                    title: "Action",
                    key: "remove",
                    render: (_, record) => (
                      <Button danger type="link" onClick={() => removeArme(record)}>
                        Retirer
                      </Button>
                    )
                  }
                ]}
              />
              <Button icon={<FileAddOutlined />} onClick={() => setShowArmeModal(true)}>
                Ajouter une arme
              </Button>
            </Space>
          </Card>
        );
      default:
        return (
          <Card title="Étape 4 – Validation">
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <Alert
                type="success"
                showIcon
                message="Vérifiez les informations avant de valider la dotation."
              />
              <Card type="inner" title="Résumé">
                {summaryData.map((item) => (
                  <Paragraph key={item.label}>
                    <Text strong>{item.label} :</Text> {item.value}
                  </Paragraph>
                ))}
              </Card>
              <Card type="inner" title="Armes sélectionnées">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="key"
                  dataSource={selectedArmes}
                  columns={SELECTED_ARME_COLUMNS}
                />
              </Card>
              <Card type="inner" title="Bénéficiaire">
                {summaryDetails ? (
                  <Descriptions size="small" column={2}>
                    {summaryDetails.map((item) => (
                      <Descriptions.Item key={item.label} label={item.label}>
                        {item.value}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                ) : (
                  <Text type="warning">Aucun bénéficiaire sélectionné.</Text>
                )}
              </Card>
              <Card type="inner" title="Synthèse des armes">
                <Descriptions size="small" column={2} layout="vertical">
                  <Descriptions.Item label="Nombre d'armes">{selectedArmes.length}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Space>
          </Card>
        );
    }
  };

  return (
    <div className="dotation-arme-form">
      <div className="dotation-arme-form__stack">
        <Card className="dotation-arme-form__hero" bordered={false}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={14}>
              <Title level={3} style={{ marginBottom: 4 }}>
                {id ? "Mise à jour d'une dotation" : "Nouvelle dotation d'arme"}
              </Title>
              <Text type="secondary">
                Sélectionnez les ressources, rattachez le bénéficiaire puis validez la dotation en trois étapes guidées.
              </Text>
            </Col>
            <Col xs={24} md={10}>
              <Row gutter={12}>
                <Col span={12}>
                  <Statistic title="Dotations" value={heroStats.total} />
                </Col>
                <Col span={12}>
                  <Statistic title="Armes sélectionnées" value={selectedArmes.length} />
                </Col>
                <Col span={12}>
                  <Statistic title="Individuelles" value={heroStats.individuelle} />
                </Col>
                <Col span={12}>
                  <Statistic title="Collectives" value={heroStats.collective} />
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        <Divider className="dotation-arme-form__divider" />

        <Progress
          percent={progressPercent}
          status={progressPercent === 100 ? "success" : "active"}
          className="dotation-arme-form__progress"
        />

        <Card
          loading={loading}
          title={
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/dotation-arme")} />
              <Title level={4} style={{ margin: 0 }}>
                {id ? "Modifier une dotation d'arme" : "Nouvelle dotation d'arme"}
              </Title>
            </Space>
          }
        >
          <Steps
            current={currentStep}
            items={[
              { title: "Paramétrage" },
              { title: "Bénéficiaire" },
              { title: "Ressources" },
              { title: "Validation" }
            ]}
            style={{ marginBottom: 24 }}
          />
          {renderStepContent()}

          <Space style={{ marginTop: 24, justifyContent: "space-between", width: "100%" }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={prevStep}>Étape précédente</Button>
              )}
              <Button onClick={resetForm}>Réinitialiser</Button>
            </Space>
            <Space>
              {currentStep < 3 && (
                <Button type="primary" onClick={nextStep}>
                  Continuer
                </Button>
              )}
              {currentStep === 3 && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleSubmit}>
                  Valider la dotation
                </Button>
              )}
            </Space>
          </Space>
        </Card>
      </div>

      <Modal
        open={showArmeModal}
        title="Ajout rapide d'une arme"
        okText="Enregistrer"
        cancelText="Annuler"
        onCancel={() => setShowArmeModal(false)}
        destroyOnHidden
        onOk={async () => {
          const form = document.getElementById("quick-weapon-form");
          const data = new FormData(form);
          const payload = Object.fromEntries(data.entries());
          if (!payload.numero_serie?.trim()) {
            message.warning("Le numéro de série est requis.");
            return;
          }
          try {
            setLoading(true);
            const created = await api.createArme({
              numero_serie: payload.numero_serie.trim(),
              designation: payload.designation?.trim() || null,
              type: payload.type || null,
              categorie: payload.categorie || null,
              lot: payload.lot ? Number(payload.lot) : null
            });
            const normalized = normalizeArmeRow(created);
            setArmesCatalog((prev) => [...prev, normalized]);
            setArmesResults((prev) => [...prev, normalized]);
            message.success("Arme ajoutée avec succès.");
            setShowArmeModal(false);
          } catch (error) {
            console.error("[DotationArmeForm] createArme:", error);
            message.error("Création de l'arme impossible.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <form id="quick-weapon-form">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input name="numero_serie" placeholder="Numéro de série *" required />
            <Input name="designation" placeholder="Désignation" />
            <Input name="type" placeholder="Type" />
            <Input name="categorie" placeholder="Catégorie" />
            <Input name="lot" type="number" placeholder="Lot" />
          </Space>
        </form>
      </Modal>

      <Drawer
        title="Ajout rapide d'une entité"
        placement="right"
        width={500}
        open={showEntiteDrawer}
        onClose={() => setShowEntiteDrawer(false)}
        extra={
          <Button
            type="primary"
            loading={loading}
            onClick={async () => {
              const form = document.getElementById("quick-entite-form");
              const data = new FormData(form);
              const payload = Object.fromEntries(data.entries());
              if (!payload.nom?.trim() || !payload.type?.trim()) {
                message.warning("Le nom et le type sont requis.");
                return;
              }
              try {
                setLoading(true);
                const created = await api.createEntite({
                  nom: payload.nom.trim(),
                  code: payload.code?.trim() || null,
                  type: payload.type.trim(),
                  description: payload.description?.trim() || null
                });
                const normalized = { ...created, key: `entite-${created.id}` };
                setAllEntites(prev => [...prev, normalized]);
                setBeneficiaryResults(prev => [...prev, normalized]);
                message.success("Entité ajoutée avec succès.");
                setShowEntiteDrawer(false);
              } catch (error) {
                console.error("[DotationArmeForm] createEntite:", error);
                message.error("Création de l'entité impossible.");
              } finally {
                setLoading(false);
              }
            }}
          >
            Enregistrer
          </Button>
        }
      >
        <form id="quick-entite-form">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input name="nom" placeholder="Nom *" required />
            <Input name="code" placeholder="Code" />
            <Input name="type" placeholder="Type * (ex. coordination)" required />
            <Input.TextArea name="description" rows={4} placeholder="Description" />
          </Space>
        </form>
      </Drawer>

            <Drawer
              title="Ajout rapide d'un VDP"
              placement="right"
              width={800}
              open={showVdpDrawer}
              onClose={() => setShowVdpDrawer(false)}
              destroyOnClose
            >
              <VdpForm
                key={vdpFormKey}
                onSuccess={(newVdp) => {
                  const normalized = { ...newVdp, key: `vdp-${newVdp.id}` };
                  setAllVdps(prev => [...prev, normalized]);
                  setBeneficiaryResults(prev => [...prev, normalized]);
                  message.success("VDP ajouté avec succès.");
                  setShowVdpDrawer(false);
                  setSelectedBeneficiary(normalized);
                  setBeneficiaryDetails(normalized);
                  setVdpFormKey((k) => k + 1);
                }}
              />
            </Drawer>
          </div>
        );
      };
      
      export default DotationArmeForm;