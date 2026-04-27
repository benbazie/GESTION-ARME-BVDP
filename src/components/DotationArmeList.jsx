// src/components/DotationArmeList.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Col,
  Drawer,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Descriptions,
  Badge,
  Skeleton,
  message,
  Checkbox
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./DotationArmeList.css";

const { Title, Text } = Typography;

const ensureDataUrl = (input) => {
  if (!input) return null;
  if (typeof input === "string") {
    if (input.startsWith("data:")) return input;
    const trimmed = input.replace(/\s+/g, "");
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      return `data:image/png;base64,${trimmed}`;
    }
    return null;
  }
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    const view = input instanceof Uint8Array ? input : new Uint8Array(input);
    let binary = "";
    view.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return `data:image/png;base64,${btoa(binary)}`;
  }
  return null;
};

const ARME_FIELD_LABELS = {
  numero_serie: "N° série",
  designation: "Désignation",
  type: "Type",
  categorie: "Catégorie",
  statut: "Statut",
  etat: "État",
  position: "Position",
  mobilite: "Mobilité",
  entite_nom: "Entité",
  region_nom: "Région",
  province_nom: "Province",
  commune_nom: "Commune",
  localite_nom: "Localité",
  date_entree: "Date d'entrée",
  date_sortie: "Date de sortie",
  calibre: "Calibre",
  annee_fabrication: "Année fabrication",
  marque: "Marque",
  modele: "Modèle",
  pays_origine: "Pays d'origine",
  ownership_type: "Type rattachement",
  created_by_name: "Créée par",
  updated_by_name: "Maj par"
};

// Remplacement / amélioration de collectArmesForRecord
const collectArmesForRecord = (record = {}) => {
  const items = Array.isArray(record.items) ? record.items : [];
  const armes = items
    .map((item) => {
      if (!item) return null;
      // fallback source : item.resource || item.arme || item (item parfois contient tout)
      const src = item.resource || item.arme || item;
      // privilégie fields préfixés (arme_*) s'ils existent
      const id = item.arme_id ?? item.resource_id ?? src.id ?? item.id;
      const numero_serie = item.arme_numero_serie || src.numero_serie || src.reference || null;
      const designation = item.arme_designation || src.designation || src.description || src.nom || null;
      const statut = item.statut || item.status || src.statut || src.etat || null;
      const lotId =
        item.lot_id ??
        item.arme_lot_id ??
        item.resource_lot_id ??
        src.lot_id ??
        src.lot?.id ??
        src.lotId ??
        null;
      const lotNom =
        item.lot_nom ||
        src.lot_nom ||
        src.lot?.nom ||
        src.lot?.name ||
        null;
      return {
        ...src,
        ...item,
        id,
        arme_id: id,
        numero_serie,
        designation,
        statut,
        lot_id: lotId ?? item.lot ?? null,
        lot_nom: lotNom,
        resource_type: item.resource_type || "arme"
      };
    })
    .filter(Boolean);

  if (armes.length) return armes;

  // fallback si pas d'items mais record contenait des champs arme directs
  const fallbackId = record.arme_id || record.resource_id || record.arme?.id || null;
  if (!fallbackId) return [];
  const src = record.arme || record;
  return [
    {
      ...src,
      id: fallbackId,
      arme_id: fallbackId,
      numero_serie: src.numero_serie || src.reference || null,
      designation: src.designation || src.description || src.nom || null,
      statut: src.statut || src.etat || null,
      lot_id: src.lot_id || src.lot?.id || null,
      lot_nom: src.lot_nom || src.lot?.nom || src.lot?.name || null,
      resource_type: "arme"
    }
  ];
};

const COLUMN_DEFINITIONS = {
  code: { title: "Code", dataIndex: "code", sorter: (a, b) => (a.code || "").localeCompare(b.code || ""), render: (value) => value || "—" },
  dotation_type: { title: "Type", dataIndex: "dotation_type", render: (value) => <Tag color={value === "individuelle" ? "green" : "purple"}>{value === "individuelle" ? "Individuelle" : "Collective"}</Tag> },
  date_dotation: { title: "Date", dataIndex: "date_dotation", sorter: (a, b) => dayjs(a.date_dotation).unix() - dayjs(b.date_dotation).unix(), render: (value) => (value ? dayjs(value).format("DD/MM/YYYY") : "—") },
  statut: { title: "Statut", dataIndex: "statut", render: (status) => <Tag color={status === "clôturée" ? "green" : status === "annulée" ? "red" : "gold"}>{status || "en_cours"}</Tag> },
  observation: { title: "Observation", dataIndex: "observation", render: (value) => value || "—" },
  source_nom: { title: "Source", dataIndex: "source_nom", render: (value) => value || "—" },
  armes_count: { title: "Nb armes", dataIndex: "items_count", align: "center", sorter: (a, b) => (a.items_count || 0) - (b.items_count || 0), render: (value) => value ?? 0 },
  armesSummary: { title: "Armes (n° série)", dataIndex: "armesSummary", render: (value) => value || "—" },
  armesDetailsText: {
    title: "Détails armes",
    dataIndex: "armesDetailsText",
    render: (_, record) =>
      record.armesDetailsEntries?.length
        ? record.armesDetailsEntries.map((line, idx) => <Text key={idx} type="secondary">{line}</Text>)
        : "—"
  },
  vdp_nom: { title: "Nom", dataIndex: "vdp_nom", render: (value) => value || "—" },
  vdp_prenom: { title: "Prénom", dataIndex: "vdp_prenom", render: (value) => value || "—" },
  vdp_photo: {
    title: "Photo",
    dataIndex: "vdp_photo_src",
    render: (src) =>
      src ? <img src={src} alt="VDP" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 6 }} /> : "—"
  },
  vdp_code_qr: {
    title: "QR Code",
    dataIndex: "vdp_qr_src",
    render: (src) =>
      src ? <img src={src} alt="QR" style={{ width: 46, height: 46, objectFit: "contain" }} /> : "—"
  },
  vdp_sexe: { title: "Sexe", dataIndex: "vdp_sexe", render: (value) => value || "—" },
  vdp_statut: { title: "Statut VDP", dataIndex: "vdp_statut", render: (value) => value || "—" },
  vdp_type: { title: "Type VDP", dataIndex: "vdp_type", render: (value) => value || "—" },
  vdp_date_naissance: { title: "Date naissance", dataIndex: "vdp_date_naissance", render: (value) => (value ? dayjs(value).format("DD/MM/YYYY") : "—") },
  vdp_date_recrutement: { title: "Date recrutement", dataIndex: "vdp_date_recrutement", render: (value) => (value ? dayjs(value).format("DD/MM/YYYY") : "—") },
  lieu_naissance: { title: "Lieu naissance", dataIndex: "lieu_naissance", render: (value) => value || "—" },
  numero_cnib: { title: "CNIB", dataIndex: "numero_cnib", render: (value) => value || "—" },
  date_cnib: { title: "Date CNIB", dataIndex: "date_cnib", render: (value) => (value ? dayjs(value).format("DD/MM/YYYY") : "—") },
  statut_matrimonial: { title: "Statut matrimonial", dataIndex: "statut_matrimonial", render: (value) => value || "—" },
  nb_enfants: { title: "Nb enfants", dataIndex: "nb_enfants", align: "center", render: (value) => value ?? "—" },
  contacts: { title: "Contacts", dataIndex: "contacts", render: (value) => value || "—" },
  contact_urgence1: { title: "Urgence 1", dataIndex: "contact_urgence1", render: (value) => value || "—" },
  contact_urgence2: { title: "Urgence 2", dataIndex: "contact_urgence2", render: (value) => value || "—" },
  contact_urgence3: { title: "Urgence 3", dataIndex: "contact_urgence3", render: (value) => value || "—" },
  nom_personne_prevenir: { title: "Personne à prévenir", dataIndex: "nom_personne_prevenir", render: (value) => value || "—" },
  lien_personne_prevenir: { title: "Lien", dataIndex: "lien_personne_prevenir", render: (value) => value || "—" },
  entite_nom: { title: "Entité", dataIndex: "entite_nom", render: (value) => value || "—" },
  entite_code: { title: "Code entité", dataIndex: "entite_code", render: (value) => value || "—" },
  coordination_nom: { title: "Coordination", dataIndex: "coordination_nom", render: (value) => value || "—" },
  sous_entite_nom: { title: "Sous-entité", dataIndex: "sous_entite_nom", render: (value) => value || "—" },
  region_nom: { title: "Région", dataIndex: "region_nom", render: (value) => value || "—" },
  province_nom: { title: "Province", dataIndex: "province_nom", render: (value) => value || "—" },
  commune_nom: { title: "Commune", dataIndex: "commune_nom", render: (value) => value || "—" },
  localite_nom: { title: "Localité", dataIndex: "localite_nom", render: (value) => value || "—" },
  created_at: { title: "Créée le", dataIndex: "created_at", render: (value) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—") },
  created_by_name: { title: "Créée par", dataIndex: "created_by_name", render: (value) => value || "—" },
  updated_at: { title: "Maj le", dataIndex: "updated_at", render: (value) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—") },
  updated_by_name: { title: "Maj par", dataIndex: "updated_by_name", render: (value) => value || "—" }
};

const COLUMN_GROUPS = [
  { key: "dotation", title: "Dotation", columns: ["code", "dotation_type", "date_dotation", "statut", "observation", "source_nom", "items_count"] },
  {
    key: "beneficiary_vdp",
    title: "Bénéficiaire – VDP",
    columns: [
      "vdp_photo",
      "vdp_code_qr",
      "vdp_nom",
      "vdp_prenom",
      "vdp_sexe",
      "vdp_statut",
      "vdp_type",
      "vdp_date_naissance",
      "lieu_naissance",
      "numero_cnib",
      "date_cnib",
      "vdp_date_recrutement",
      "statut_matrimonial",
      "nb_enfants",
      "contacts",
      "contact_urgence1",
      "contact_urgence2",
      "contact_urgence3",
      "nom_personne_prevenir",
      "lien_personne_prevenir"
    ]
  },
  {
    key: "beneficiary_structure",
    title: "Bénéficiaire – Structure",
    columns: [
      "entite_nom",
      "entite_code",
      "coordination_nom",
      "sous_entite_nom",
      "region_nom",
      "province_nom",
      "commune_nom",
      "localite_nom"
    ]
  },
  { key: "armes", title: "Armes", columns: ["armesSummary", "armesDetailsText"] },
  { key: "suivi", title: "Suivi & Métadonnées", columns: ["created_at", "created_by_name", "updated_at", "updated_by_name"] }
];

const COMMON_COLUMNS = new Set([
  "code",
  "dotation_type",
  "date_dotation",
  "statut",
  "observation",
  "source_nom",
  "armes_count",
  "armesSummary",
  "armesDetailsText",
  "created_at",
  "created_by_name",
  "updated_at",
  "updated_by_name"
]);

const VDP_SPECIFIC_COLUMNS = new Set([
  "vdp_nom",
  "vdp_prenom",
  "vdp_photo",
  "vdp_code_qr",
  "vdp_sexe",
  "vdp_statut",
  "vdp_type",
  "vdp_date_naissance",
  "lieu_naissance",
  "numero_cnib",
  "date_cnib",
  "vdp_date_recrutement",
  "statut_matrimonial",
  "nb_enfants",
  "contacts",
  "contact_urgence1",
  "contact_urgence2",
  "contact_urgence3",
  "nom_personne_prevenir",
  "lien_personne_prevenir"
]);

const STRUCTURE_SPECIFIC_COLUMNS = new Set([
  "entite_nom",
  "entite_code",
  "coordination_nom",
  "sous_entite_nom",
  "region_nom",
  "province_nom",
  "commune_nom",
  "localite_nom"
]);

const VDP_FIELD_MAP = Object.freeze({
  nom: "vdp_nom",
  prenom: "vdp_prenom",
  sexe: "vdp_sexe",
  statut_vdp: "vdp_statut",
  type_vdp: "vdp_type",
  date_naissance: "vdp_date_naissance",
  lieu_naissance: "lieu_naissance",
  numero_cnib: "numero_cnib",
  date_cnib: "date_cnib",
  date_recrutement: "vdp_date_recrutement",
  statut_matrimonial: "statut_matrimonial",
  nb_enfants: "nb_enfants",
  contacts: "contacts",
  contact_urgence1: "contact_urgence1",
  contact_urgence2: "contact_urgence2",
  contact_urgence3: "contact_urgence3",
  nom_personne_prevenir: "nom_personne_prevenir",
  lien_personne_prevenir: "lien_personne_prevenir",
  photo: "vdp_photo",
  code_qr: "vdp_code_qr"
});

const DEFAULT_VISIBLE_COLUMNS = Object.freeze({
  individuelle: ["code","dotation_type","date_dotation","statut","armesSummary","source_nom","vdp_nom","created_at"],
  collective: ["code","dotation_type","date_dotation","statut","armesSummary","armes_count","source_nom","entite_nom","created_at"]
});

const COLUMN_ORDER = [
  "code",
  "dotation_type",
  "date_dotation",
  "statut",
  "observation",
  "source_nom",
  "armesSummary",
  "armesDetailsText",
  "armes_count",
  "vdp_photo",
  "vdp_code_qr",
  "vdp_nom",
  "vdp_prenom",
  "vdp_sexe",
  "vdp_statut",
  "vdp_type",
  "vdp_date_naissance",
  "lieu_naissance",
  "numero_cnib",
  "date_cnib",
  "vdp_date_recrutement",
  "statut_matrimonial",
  "nb_enfants",
  "contacts",
  "contact_urgence1",
  "contact_urgence2",
  "contact_urgence3",
  "nom_personne_prevenir",
  "lien_personne_prevenir",
  "entite_nom",
  "entite_code",
  "coordination_nom",
  "sous_entite_nom",
  "region_nom",
  "province_nom",
  "commune_nom",
  "localite_nom",
  "created_at",
  "created_by_name",
  "updated_at",
  "updated_by_name"
];

const DotationArmeList = () => {
  const navigate = useNavigate();
  const printRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [dotations, setDotations] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("individuelle");
  const [pivotState, setPivotState] = useState({});
  const [drawerState, setDrawerState] = useState({ open: false, mode: "vdp", record: null, data: [] });
  const [filters, setFilters] = useState({ statut: null });
  const [rowDetails, setRowDetails] = useState({});
  const detailCache = useRef({});
  const vdpDetailCache = useRef({});
  const sourcesArmementCache = useRef({ loaded: false, byId: {} });
  const [visibleColumns, setVisibleColumns] = useState(() => [...DEFAULT_VISIBLE_COLUMNS.individuelle]);
  const [columnOrder, setColumnOrder] = useState(COLUMN_ORDER);
  const [columnsDrawerOpen, setColumnsDrawerOpen] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  useEffect(() => {
    const defaults = DEFAULT_VISIBLE_COLUMNS[activeTab] || DEFAULT_VISIBLE_COLUMNS.individuelle;
    const needsReset =
      !visibleColumns.length ||
      (activeTab === "collective" && visibleColumns.includes("vdp_nom")) ||
      (activeTab === "individuelle" && visibleColumns.includes("entite_nom"));
    if (needsReset) setVisibleColumns([...defaults]);
  }, [activeTab, visibleColumns]);

  const toArray = useCallback((value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.rows)) return value.rows;
    if (Array.isArray(value?.data)) return value.data;
    return [];
  }, []);

  const enrichDotationsWithVdp = useCallback(
    async (rows = []) => {
      if (!rows.length) return rows;

      const isEmpty = (value) => value == null || value === "";
      const idsToFetch = new Set();

      rows.forEach((item) => {
        const rawType = (item.beneficiary_type || item.beneficiaryType || "").toString().toLowerCase();
        const isVdp = rawType ? rawType === "vdp" : Boolean(item.vdp_id);
        if (!isVdp || !item.vdp_id) return;

        const cached = vdpDetailCache.current[item.vdp_id];
        const needsEnrichment =
          !cached &&
          [
            item.vdp_prenom,
            item.numero_cnib,
            item.contacts,
            item.contact_urgence1,
            item.vdp_type,
            item.vdp_statut
          ].some(isEmpty);

        if (needsEnrichment || !cached) idsToFetch.add(item.vdp_id);
      });

      if (idsToFetch.size) {
        await Promise.all(
          Array.from(idsToFetch).map(async (id) => {
            if (vdpDetailCache.current[id] !== undefined) return;
            try {
              vdpDetailCache.current[id] = await api.getVdpById(id);
            } catch (error) {
              console.warn("[DotationArmeList] enrich VDP:", id, error);
              vdpDetailCache.current[id] = null;
            }
          })
        );
      }

      return rows.map((item) => {
        const detail = item.vdp_id ? vdpDetailCache.current[item.vdp_id] : null;
        if (!detail) return item;

        const merged = { ...item };
        Object.entries(VDP_FIELD_MAP).forEach(([sourceKey, targetKey]) => {
          const value = detail[sourceKey];
          if (!isEmpty(value) && isEmpty(merged[targetKey])) merged[targetKey] = value;
        });

        if (isEmpty(merged.vdp_nom) && detail.nom) merged.vdp_nom = detail.nom;
        if (isEmpty(merged.vdp_prenom) && detail.prenom) merged.vdp_prenom = detail.prenom;

        return merged;
      });
    },
    []
  );

  const enrichDotationsWithSourcesArmement = useCallback(
    async (rows = []) => {
      if (!rows.length) return rows;

      if (!sourcesArmementCache.current.loaded) {
        try {
          const raw = await api.getSourcesArmement();
          const list = toArray(raw);
          const byId = {};
          list.forEach((row) => {
            const id = row?.id;
            if (id == null) return;
            byId[String(id)] = row;
          });
          sourcesArmementCache.current = { loaded: true, byId };
        } catch (error) {
          console.warn("[DotationArmeList] enrich sources_armes:", error);
          sourcesArmementCache.current = { loaded: true, byId: {} };
        }
      }

      const resolveSourceName = (source) =>
        source?.nom || source?.name || source?.libelle || source?.label || source?.code || null;

      const inferSourceArmeId = (row) => {
        if (row?.source_arme_id != null) return row.source_arme_id;
        const items = Array.isArray(row?.items) ? row.items : [];
        if (items.length === 1 && items[0]?.source_arme_id != null) return items[0].source_arme_id;
        return null;
      };

      return rows.map((row) => {
        const sourceArmeId = inferSourceArmeId(row);
        if (sourceArmeId == null || sourceArmeId === "") return row;
        const detail = sourcesArmementCache.current.byId[String(sourceArmeId)] || null;
        const resolved = row.source_nom || row.source_arme_nom || resolveSourceName(detail) || String(sourceArmeId);
        return {
          ...row,
          source_arme_id: sourceArmeId,
          source_arme_nom: resolved,
          source_nom: resolved
        };
      });
    },
    [toArray]
  );

  const fetchDotations = useCallback(async () => {
    setLoading(true);
    try {
      let rows = [];
      try {
        const detailed = await api.getDotationsWithDetails();
        rows = toArray(detailed);
      } catch (error) {
        if (!error?.response || error.response.status !== 404) throw error;
      }
      if (!rows.length) {
        const fallback = await api.getDotations();
        rows = toArray(fallback);
      }
      const normalized = rows.map((item) => ({
        ...item,
        items_count: item.items_count ?? (Array.isArray(item.items) ? item.items.length : 0)
      }));
      const enriched = await enrichDotationsWithVdp(normalized);
      const enrichedWithSources = await enrichDotationsWithSourcesArmement(enriched);
      setDotations(enrichedWithSources);
    } catch (error) {
      console.error("[DotationArmeList] fetch:", error);
      message.error("Impossible de charger les dotations.");
      setDotations([]);
    } finally {
      setLoading(false);
    }
  }, [toArray, enrichDotationsWithVdp, enrichDotationsWithSourcesArmement]);

  useEffect(() => {
    fetchDotations();
  }, [fetchDotations]);

  // Dans la transformation principale : inclure beneficiaryTitle / beneficiarySummary dans l'objet final
  const decoratedDotations = useMemo(() => {
    return dotations.map((item) => {
      const rawType = (item.dotation_type || item.dotationType || "").toString().toLowerCase();
      const rawBeneficiary = (item.beneficiary_type || item.beneficiaryType || "").toString().toLowerCase();
      const beneficiary_type = rawBeneficiary === "entite" ? "entite" : "vdp";
      const normalizedType =
        rawType === "collective"
          ? "collective"
          : beneficiary_type === "entite"
          ? "collective"
          : "individuelle";
      const isVdp = beneficiary_type === "vdp";
      const fullName = `${item.vdp_nom || ""} ${item.vdp_prenom || ""}`.trim();
      const vdpDetails = isVdp
        ? [
            fullName || "VDP",
            item.numero_cnib && `CNIB : ${item.numero_cnib}`,
            item.contacts && `Contacts : ${item.contacts}`
          ].filter(Boolean).join(" • ")
        : null;
      const entiteDetails = !isVdp
        ? [
            item.entite_nom || item.coordination_nom || "Structure",
            item.entite_code && `Code : ${item.entite_code}`,
            item.region_nom && `Région : ${item.region_nom}`,
            item.province_nom && `Province : ${item.province_nom}`
          ].filter(Boolean).join(" • ")
        : null;
      const beneficiarySummary = vdpDetails || entiteDetails || "—";
      const beneficiaryTitle = isVdp
        ? fullName || "VDP"
        : item.entite_nom || item.coordination_nom || "Structure";

      const beneficiaryDetailsEntries = isVdp
        ? [
            item.vdp_sexe && `Sexe : ${item.vdp_sexe}`,
            item.vdp_statut && `Statut : ${item.vdp_statut}`,
            item.vdp_type && `Type : ${item.vdp_type}`,
            item.vdp_date_naissance && `Naissance : ${dayjs(item.vdp_date_naissance).format("DD/MM/YYYY")}`,
            item.vdp_date_recrutement && `Recrutement : ${dayjs(item.vdp_date_recrutement).format("DD/MM/YYYY")}`,
            item.contact_urgence1 && `Urgence 1 : ${item.contact_urgence1}`,
            item.contact_urgence2 && `Urgence 2 : ${item.contact_urgence2}`,
            item.contact_urgence3 && `Urgence 3 : ${item.contact_urgence3}`,
            item.nom_personne_prevenir && `Personne à prévenir : ${item.nom_personne_prevenir}`,
            item.lien_personne_prevenir && `Lien : ${item.lien_personne_prevenir}`,
            item.entite_nom && `Entité : ${item.entite_nom}`,
            item.coordination_nom && `Coordination : ${item.coordination_nom}`,
            item.region_nom && `Région : ${item.region_nom}`,
            item.province_nom && `Province : ${item.province_nom}`,
            item.commune_nom && `Commune : ${item.commune_nom}`,
            item.localite_nom && `Localité : ${item.localite_nom}`
          ]
        : [
            item.entite_nom && `Structure : ${item.entite_nom}`,
            item.coordination_nom && `Coordination : ${item.coordination_nom}`,
            item.entite_code && `Code : ${item.entite_code}`,
            item.region_nom && `Région : ${item.region_nom}`,
            item.province_nom && `Province : ${item.province_nom}`,
            item.commune_nom && `Commune : ${item.commune_nom}`,
            item.localite_nom && `Localité : ${item.localite_nom}`
          ];
      const beneficiaryDetailsText =
        beneficiaryDetailsEntries.filter(Boolean).join(" | ") || "—";

      const armes = collectArmesForRecord(item);
      const armesSummary = armes.length
        ? armes
            .map((arme) => {
              const identifier =
                arme.numero_serie ||
                arme.reference ||
                arme.designation ||
                `ID ${arme.resource_id ?? arme.id ?? "?"}`;
              const statut = arme.statut || arme.status || arme.etat || "statut indéfini";
              return `${identifier} (Arme • ${statut})`;
            })
            .join(" • ")
        : "—";
      const armesDetailsEntries = armes.map((arme) => {
        const detailParts = Object.entries(ARME_FIELD_LABELS)
          .map(([key, label]) => {
            const formatted = arme[key];
            return formatted ? `${label} : ${formatted}` : null;
          })
          .filter(Boolean);
        return detailParts.length ? detailParts.join(" | ") : `Arme ID ${arme.resource_id ?? arme.id ?? "?"}`;
      });

      return {
        ...item,
        items: armes,
        items_count: armes.length,
        armesSummary,
        armesDetailsEntries,
        armesDetailsText: armesDetailsEntries.join(" | "),
        vdp_sexe: item.vdp_sexe || item.sexe || item.vdpSexe || null,
        vdp_statut: item.vdp_statut || item.statut_vdp || null,
        vdp_type: item.vdp_type || item.type_vdp || null,
        vdp_photo_src: ensureDataUrl(item.photo || item.vdp_photo),
        vdp_qr_src: ensureDataUrl(item.code_qr || item.vdp_code_qr),
        vdp_date_naissance: item.vdp_date_naissance || item.date_naissance || null,
        vdp_date_recrutement: item.vdp_date_recrutement || item.date_recrutement || null,
        lieu_naissance: item.lieu_naissance || null,
        date_cnib: item.date_cnib || null,
        statut_matrimonial: item.statut_matrimonial || null,
        nb_enfants: item.nb_enfants ?? null,
        contact_urgence1: item.contact_urgence1 || item.urgence1 || null,
        contact_urgence2: item.contact_urgence2 || item.urgence2 || null,
        contact_urgence3: item.contact_urgence3 || item.urgence3 || null,
        nom_personne_prevenir: item.nom_personne_prevenir || null,
        lien_personne_prevenir: item.lien_personne_prevenir || null,
        // expose pour recherche/affichage
        beneficiary_type,
        dotation_type: normalizedType,
        dotationTypeNormalized: normalizedType,
        beneficiarySummary,
        beneficiaryTitle
      };
    });
  }, [dotations]);

  // Partitionner par dotation_type (individuelle / collective) — correction importante
  const partitionedDotations = useMemo(() => {
    const individuelle = decoratedDotations.filter(
      (item) => item.dotationTypeNormalized === "individuelle"
    );
    const collective = decoratedDotations.filter(
      (item) => item.dotationTypeNormalized === "collective"
    );
    return { individuelle, collective };
  }, [decoratedDotations]);

  const filteredDotations = useMemo(() => {
    const base = partitionedDotations[activeTab] || [];
    return base.filter((item) => {
      if (filters.statut && (item.statut || "en_cours") !== filters.statut) {
        return false;
      }
      if (!search.trim()) return true;
      const needle = search.toLowerCase();
      const fields = [
        item.code,
        item.statut,
        item.dotation_type,
        item.beneficiaryTitle,
        item.beneficiarySummary,
        item.armesSummary,
        item.source_nom,
      ];
      return fields.some((field) => field?.toLowerCase().includes(needle));
    });
  }, [partitionedDotations, activeTab, filters, search]);

  const metrics = useMemo(() => {
    const totale = decoratedDotations.length;
    const ressources = decoratedDotations.reduce(
      (acc, item) => acc + (item.items_count || 0),
      0
    );
    return {
      total: totale,
      individuelle: partitionedDotations.individuelle.length,
      collective: partitionedDotations.collective.length,
      ressources,
      visibles: filteredDotations.length
    };
  }, [decoratedDotations, partitionedDotations, filteredDotations]);

  const loadRowDetail = useCallback(
    async (record) => {
      if (detailCache.current[record.id]) return;
      try {
        const detail = await api.getDotationDetail(record.id);
        const dotationData = detail?.dotation ? { ...detail.dotation } : { ...detail };
        const itemsData = Array.isArray(detail?.items) ? detail.items : dotationData.items || [];
        const [sourceEnriched = {}] = await enrichDotationsWithSourcesArmement([
          {
            ...dotationData,
            items: itemsData
          }
        ]);
        const resolvedItems = sourceEnriched.items ?? itemsData;
        const resolvedDotation = {
          ...record,
          ...dotationData,
          source_arme_id: sourceEnriched.source_arme_id ?? dotationData?.source_arme_id,
          source_arme_nom: sourceEnriched.source_arme_nom ?? dotationData?.source_arme_nom,
          source_nom: sourceEnriched.source_nom ?? dotationData?.source_nom
        };
        const enriched = {
          dotation: resolvedDotation,
          items: resolvedItems,
          beneficiary,
        };
        detailCache.current[record.id] = enriched;
        setRowDetails((prev) => ({ ...prev, [record.id]: enriched }));
      } catch (error) {
        console.error("[DotationArmeList] detail:", error);
      }
    },
    [enrichDotationsWithSourcesArmement]
  );

  const renderExpandedRow = useCallback(
    (record) => {
      const cached = rowDetails[record.id];
      if (!cached) return <Skeleton active paragraph={{ rows: 3 }} />;
      const { dotation = {}, items = [], beneficiary } = cached;
      const detailArmes = collectArmesForRecord({ ...dotation, items });
      return (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Descriptions bordered size="small" column={3} title="Données de dotation">
            <Descriptions.Item label="Code">{dotation.code || `#${record.id}`}</Descriptions.Item>
            <Descriptions.Item label="Type">{dotation.dotation_type || record.dotation_type}</Descriptions.Item>
            <Descriptions.Item label="Statut">{dotation.statut || record.statut || "en_cours"}</Descriptions.Item>
            <Descriptions.Item label="Source">{dotation.source_nom || record.source_nom || "—"}</Descriptions.Item>
            <Descriptions.Item label="Date">
              {dotation.date_dotation ? dayjs(dotation.date_dotation).format("DD/MM/YYYY") : "—"}
            </Descriptions.Item>
          </Descriptions>
          <Descriptions bordered size="small" column={2} title="Bénéficiaire">
            <Descriptions.Item label="Type">
              {dotation.beneficiary_type === "vdp" ? "VDP" : "Entité / Coordination"}
            </Descriptions.Item>
            <Descriptions.Item label="Nom">
              {beneficiary?.nom ||
                `${dotation.vdp_nom || ""} ${dotation.vdp_prenom || ""}`.trim() ||
                dotation.entite_nom ||
                "—"}
            </Descriptions.Item>
            {beneficiary?.prenom && <Descriptions.Item label="Prénom">{beneficiary.prenom}</Descriptions.Item>}
            {beneficiary?.numero_cnib && <Descriptions.Item label="CNIB">{beneficiary.numero_cnib}</Descriptions.Item>}
            {beneficiary?.contacts && <Descriptions.Item label="Contacts">{beneficiary.contacts}</Descriptions.Item>}
            {beneficiary?.code && <Descriptions.Item label="Code">{beneficiary.code}</Descriptions.Item>}
            {dotation.coordination_nom && (
              <Descriptions.Item label="Coordination">{dotation.coordination_nom}</Descriptions.Item>
            )}
          </Descriptions>
          <Table
            size="small"
            rowKey={(item) => `${record.id}-arme-${item.arme_id ?? item.id}`}
            pagination={false}
            dataSource={detailArmes}
            columns={[
              { title: "Type", key: "armeType", render: () => "Arme" },
              {
                title: "Référence",
                key: "reference",
                render: (_, item) => item.reference || item.numero_serie || item.designation || "—"
              },
              {
                title: "Désignation",
                dataIndex: "designation",
                render: (value, item) => value || item.description || "—"
              },
              {
                title: "Quantité",
                dataIndex: "quantite",
                align: "center",
                render: (value) => value ?? 1
              },
              {
                title: "Statut",
                key: "status",
                render: (_, item) => {
                  const statusLabel = (item.status || item.statut || item.etat || "assignée").toString();
                  const normalized = statusLabel.toLowerCase();
                  const color = normalized.includes("clôtur") ? "green" : normalized.includes("retour") ? "gold" : "blue";
                  return <Tag color={color}>{statusLabel}</Tag>;
                }
              }
            ]}
          />
        </Space>
      );
    },
    [rowDetails]
  );

  const deleteDotation = async (dotationId) => {
    try {
      await api.deleteDotation(dotationId);
      message.success("Dotation supprimée.");
      fetchDotations();
    } catch (error) {
      console.error("[DotationArmeList] delete:", error);
      message.error("Suppression impossible.");
    }
  };

  const openFollowDrawer = async (mode, record) => {
    setLoading(true);
    try {
      const data =
        mode === "vdp"
          ? await api.getDotationsByVdp(record.vdp_id)
          : await api.getDotationsByEntite(record.entite_id || record.coordination_id || record.sous_entite_id);
      setDrawerState({ open: true, mode, record, data });
    } catch (error) {
      console.error("[DotationArmeList] follow:", error);
      message.error("Chargement du suivi impossible.");
    } finally {
      setLoading(false);
    }
  };

  const allowedColumns = useMemo(() => {
    const base = new Set(COMMON_COLUMNS);
    if (activeTab === "individuelle") {
      base.delete("armes_count");
    }
    const specifics = activeTab === "individuelle" ? VDP_SPECIFIC_COLUMNS : STRUCTURE_SPECIFIC_COLUMNS;
    specifics.forEach((column) => base.add(column));
    return base;
  }, [activeTab]);

  const orderedColumnKeys = useMemo(() => {
    return columnOrder.filter(
      (key) =>
        allowedColumns.has(key) &&
        visibleColumns.includes(key) &&
        COLUMN_DEFINITIONS[key]
    );
  }, [columnOrder, allowedColumns, visibleColumns]);

  const flatColumns = useMemo(() => {
    return orderedColumnKeys.map((key) => ({
      key,
      dataIndex: key,
      ...COLUMN_DEFINITIONS[key]
    }));
  }, [orderedColumnKeys]);

  const tableScroll = useMemo(
    () => ({ x: Math.max(1200, (orderedColumnKeys.length + 1) * 160) }),
    [orderedColumnKeys]
  );

  const tableColumns = useMemo(() => {
    return [
      ...flatColumns,
      {
        title: "Actions",
        fixed: "right",
        width: 220,
        render: (_, record) => (
          <Space>
            <Tooltip title="Détail">
              <Button
                icon={<EyeOutlined />}
                onClick={() => {
                  // Ajoute l'id à la liste des lignes expandues
                  setExpandedRowKeys((prev) =>
                    prev.includes(record.id)
                      ? prev.filter((k) => k !== record.id)
                      : [...prev, record.id]
                  );
                  // Charge le détail si besoin
                  loadRowDetail(record);
                }}
              />
            </Tooltip>
            <Tooltip title="Modifier">
              <Button icon={<EditOutlined />} onClick={() => navigate(`/dashboard/dotation-arme/${record.id}`)} />
            </Tooltip>
            <Tooltip title="Suivi">
              <Button
                icon={<FilterOutlined />}
                onClick={() =>
                  openFollowDrawer(record.beneficiary_type === "vdp" ? "vdp" : "entite", record)
                }
              />
            </Tooltip>
            <Tooltip title="Supprimer">
              <Button danger icon={<DeleteOutlined />} onClick={() => deleteDotation(record.id)} />
            </Tooltip>
          </Space>
        )
      }
    ];
  }, [flatColumns, navigate, openFollowDrawer, loadRowDetail]);

  const printableColumns = useMemo(() => flatColumns, [flatColumns]);

  const handlePrint = () => {
    if (!printableColumns.length) return;
    const headerRow = printableColumns
      .map((col) => `<th>${col.title}</th>`)
      .join("");
    const bodyRows = filteredDotations
      .map((item) => {
        const cells = printableColumns
          .map((col) => {
            const rendered = col.render ? col.render(item[col.dataIndex], item) : item[col.dataIndex];
            const text =
              typeof rendered === "object"
                ? (Array.isArray(rendered)
                    ? rendered.map((element) => (typeof element === "string" ? element : element?.props?.children ?? "")).join("<br/>")
                    : rendered?.props?.children ?? "")
                : rendered ?? "—";
            return `<td>${text || "—"}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Dotations</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; }
            th { background: #f5f5f5; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <h2>Dotations d'armes</h2>
          <table>
            <thead>
              <tr>${headerRow}</tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="dotation-arme-list">
      <Card className="dotation-arme-list__hero" variant="borderless">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={14}>
            <Title level={3} style={{ marginBottom: 4 }}>
              Pilotage des dotations
            </Title>
            <Text type="secondary">
              Filtrez, analysez et imprimez les dotations individuelles ou collectives avec le détail des bénéficiaires.
            </Text>
          </Col>
          <Col xs={24} md={10}>
            <Row gutter={12}>
              <Col span={12}>
                <Statistic title="Dotations totales" value={metrics.total} />
              </Col>
              <Col span={12}>
                <Statistic title="Dotations filtrées" value={metrics.visibles} />
              </Col>
              <Col span={12}>
                <Statistic title="Individuelles" value={metrics.individuelle} />
              </Col>
              <Col span={12}>
                <Statistic title="Collectives" value={metrics.collective} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>Dotations d'armes</Title>
            <Badge count={metrics.visibles} overflowCount={999} />
          </Space>
        }
        extra={
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="Recherche (code, bénéficiaire, source...)"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 260 }}
            />
            <Select
              allowClear
              placeholder="Statut"
              value={filters.statut}
              onChange={(value) => setFilters((prev) => ({ ...prev, statut: value || null }))}
              style={{ width: 160 }}
            >
              <Select.Option value="en_cours">En cours</Select.Option>
              <Select.Option value="clôturée">Clôturée</Select.Option>
              <Select.Option value="annulée">Annulée</Select.Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchDotations} />
            <Button onClick={() => setColumnsDrawerOpen(true)}>{visibleColumns.length} colonnes</Button>
            <Button icon={<FilePdfOutlined />} onClick={handlePrint}>
              Imprimer
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/dashboard/dotation-arme/add")}
            >
              Nouvelle dotation
            </Button>
          </Space>
        }
        variant="borderless"
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={[
            {
              key: "individuelle",
              label: `Individuelles (${partitionedDotations.individuelle.length})`
            },
            {
              key: "collective",
              label: `Collectives (${partitionedDotations.collective.length})`
            }
          ]}
        />
        <Table
          rowKey="id"
          bordered
          loading={loading}
          columns={tableColumns}
          dataSource={filteredDotations}
          pagination={{ pageSize: 12 }}
          scroll={tableScroll}
          expandable={{
            expandedRowRender: renderExpandedRow,
            expandedRowKeys,
            onExpand: (expanded, record) => {
              if (expanded) {
                setExpandedRowKeys((prev) => [...prev, record.id]);
                loadRowDetail(record);
              } else {
                setExpandedRowKeys((prev) => prev.filter((k) => k !== record.id));
              }
            }
          }}
        />
      </Card>

      <Card style={{ marginTop: 24 }} title="Analyse croisée (pivot)" variant="borderless">
        <PivotTableUI
          data={dotations}
          onChange={setPivotState}
          {...pivotState}
        />
      </Card>

      <Drawer
        title={
          drawerState.mode === "vdp"
            ? `Suivi du VDP – ${drawerState.record?.vdp_nom || ""} ${drawerState.record?.vdp_prenom || ""}`.trim()
            : `Suivi de l'entité – ${drawerState.record?.entite_nom || drawerState.record?.coordination_nom || ""}`
        }
        width={520}
        open={drawerState.open}
        onClose={() => setDrawerState({ open: false, mode: "vdp", record: null, data: [] })}
      >
        {drawerState.data.length === 0 ? (
          <Text type="secondary">Aucune dotation enregistrée pour ce bénéficiaire.</Text>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            {drawerState.data.map((item) => (
              <Card key={item.id} type="inner" title={item.code || `Dotation #${item.id}`}>
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="Date">
                    {dayjs(item.date_dotation).format("DD/MM/YYYY")}
                  </Descriptions.Item>
                  <Descriptions.Item label="Statut">
                    <Tag color={item.statut === "clôturée" ? "green" : "gold"}>{item.statut || "en cours"}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Observation" span={2}>
                    {item.observation || "—"}
                  </Descriptions.Item>
                </Descriptions>
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(resource) => `${item.id}-arme-${resource.arme_id ?? resource.id}`}
                  dataSource={collectArmesForRecord(item)}
                  columns={[
                    { title: "Type", key: "armeType", render: () => "Arme" },
                    {
                      title: "Référence",
                      key: "reference",
                      render: (_, resource) => resource.reference || resource.numero_serie || resource.designation || "—"
                    },
                    {
                      title: "Désignation",
                      dataIndex: "designation",
                      render: (value, resource) => value || resource.description || "—"
                    },
                    {
                      title: "Statut",
                      key: "status",
                      render: (_, resource) => {
                        const statusLabel = (resource.status || resource.statut || resource.etat || "–").toString();
                        const normalized = statusLabel.toLowerCase();
                        const color = normalized.includes("clôtur") ? "green" : normalized.includes("retour") ? "gold" : undefined;
                        return <Tag color={color}>{statusLabel}</Tag>;
                      }
                    }
                  ]}
                />
              </Card>
            ))}
          </Space>
        )}
      </Drawer>

      <Drawer
        title="Configuration des colonnes"
        width={360}
        open={columnsDrawerOpen}
        onClose={() => setColumnsDrawerOpen(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {COLUMN_GROUPS.map((group) => {
            const orderedKeys = columnOrder.filter(
              (key) =>
                group.columns.includes(key) &&
                allowedColumns.has(key) &&
                COLUMN_DEFINITIONS[key]
            );
            if (!orderedKeys.length) return null;
            return (
              <Card key={group.key} size="small" title={group.title}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  {orderedKeys.map((key) => {
                    const checked = visibleColumns.includes(key);
                    const label = COLUMN_DEFINITIONS[key]?.title || key;
                    return (
                      <Space key={key} style={{ width: "100%", justifyContent: "space-between" }}>
                        <Space>
                          <Checkbox
                            checked={checked}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...visibleColumns, key]
                                : visibleColumns.filter((col) => col !== key);
                              setVisibleColumns(next);
                            }}
                          />
                          <span>{label}</span>
                        </Space>
                        <Space.Compact>
                          <Button
                            size="small"
                            disabled={columnOrder.indexOf(key) <= 0}
                            onClick={() => {
                              const idx = columnOrder.indexOf(key);
                              if (idx <= 0) return;
                              const next = columnOrder.slice();
                              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                              setColumnOrder(next);
                            }}
                          >
                            ↑
                          </Button>
                          <Button
                            size="small"
                            disabled={columnOrder.indexOf(key) === columnOrder.length - 1}
                            onClick={() => {
                              const idx = columnOrder.indexOf(key);
                              if (idx === columnOrder.length - 1) return;
                              const next = columnOrder.slice();
                              [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                              setColumnOrder(next);
                            }}
                          >
                            ↓
                          </Button>
                        </Space.Compact>
                      </Space>
                    );
                  })}
                </Space>
              </Card>
            );
          })}
          <Button
            block
            onClick={() => {
              const defaults = DEFAULT_VISIBLE_COLUMNS[activeTab] || DEFAULT_VISIBLE_COLUMNS.individuelle;
              setVisibleColumns([...defaults]);
              setColumnOrder(COLUMN_ORDER);
            }}
          >
            Réinitialiser
          </Button>
        </Space>
      </Drawer>

      <div style={{ display: "none" }}>
        <div ref={printRef}>
          <Title level={4}>Dotations d'armes</Title>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Bénéficiaire</th>
                <th>Détails bénéficiaire</th>
                <th>Armes</th>
                <th>Type</th>
                <th>Date</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredDotations.map((item) => (
                <tr key={`print-${item.id}`}>
                  <td>{item.code || "—"}</td>
                  <td>{item.beneficiaryTitle}</td>
                  <td>{item.beneficiarySummary}</td>
                  <td>{item.armesSummary}</td>
                  <td>{item.dotation_type}</td>
                  <td>
                    {item.date_dotation
                      ? dayjs(item.date_dotation).format("DD/MM/YYYY")
                      : "—"}
                  </td>
                  <td>{item.statut || "en cours"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DotationArmeList;
