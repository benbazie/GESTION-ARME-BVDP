// src/components/VdpList.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Row,
  Col,
  Space,
  Modal,
  Divider,
  Statistic,
  Checkbox,
  Tooltip,
  message,
  Typography,
  Descriptions,
  Spin,
  Tag,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  BarChartOutlined,
  FilterOutlined,
  ColumnWidthOutlined,
  ProfileOutlined,
  SearchOutlined,
  PrinterOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  FileWordOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./VdpList.css";
import Header from './impression/Header';
import Footer from './impression/Footer';
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun, AlignmentType, ImageRun } from "docx";
import { renderToStaticMarkup } from "react-dom/server";
import moment from "moment";

const { Option } = Select;
const { Text, Title } = Typography;

const CROSS_DIMENSIONS = [
  { key: "region_nom", label: "Région" },
  { key: "province_nom", label: "Province" },
  { key: "commune_nom", label: "Commune" },
  { key: "localite_nom", label: "Localité" },
  { key: "statut_vdp", label: "Statut VDP" },
  { key: "sexe", label: "Sexe" },
  { key: "type_vdp", label: "Type VDP" },
];
const DEFAULT_ROW_DIMENSIONS = ["region_nom"];
const DEFAULT_COL_DIMENSIONS = ["statut_vdp"];

const ALL_COLUMN_KEYS = [
  "rowNumber",
  "photo",
  "id",
  "nom",
  "prenom",
  "sexe",
  "date_naissance",
  "lieu_naissance",
  "statut_vdp",
  "statut_matrimonial",
  "nb_enfants",
  "type_vdp",
  "numero_cnib",
  "date_cnib",
  "date_recrutement",
  "entite",
  "sous_entite",
  "coordination",
  "contacts",
  "contact_urgence1",
  "contact_urgence2",
  "contact_urgence3",
  "nom_personne_prevenir",
  "lien_personne_prevenir",
  "region",
  "province",
  "commune",
  "localite",
  "observation",
  "code_qr",
];

export default function VdpList() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [entities, setEntities] = useState([]);
  const [subEntities, setSubEntities] = useState([]);
  const [coordinations, setCoordinations] = useState([]);
  const [filters, setFilters] = useState({
    region_id: undefined,
    province_id: undefined,
    commune_id: undefined,
    statut_vdp: undefined,
    sexe: undefined,
    entite_id: undefined,
    sous_entite_id: undefined,
    coordination_id: undefined,
    search: "",
  });
  const [crossModalVisible, setCrossModalVisible] = useState(false);
  const [crossRows, setCrossRows] = useState(DEFAULT_ROW_DIMENSIONS);
  const [crossCols, setCrossCols] = useState(DEFAULT_COL_DIMENSIONS);
  const pivotSectionId = "vdp-pivot-section";
  const [deletingId, setDeletingId] = useState(null);
  const [headerFooterConfig, setHeaderFooterConfig] = useState({});
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(ALL_COLUMN_KEYS);
  const [columnOrder, setColumnOrder] = useState(ALL_COLUMN_KEYS);
  const [columnConfigModalVisible, setColumnConfigModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const navigate = useNavigate();

  const closeCrossModal = useCallback(() => {
    setCrossModalVisible(false);
  }, []);

  const availableRowDimensions = useMemo(
    () => CROSS_DIMENSIONS.filter((dim) => !crossCols.includes(dim.key)),
    [crossCols]
  );

  const availableColDimensions = useMemo(
    () => CROSS_DIMENSIONS.filter((dim) => !crossRows.includes(dim.key)),
    [crossRows]
  );

  const handleRowDimensionsChange = useCallback(
    (values) => setCrossRows(values.length ? values : DEFAULT_ROW_DIMENSIONS),
    []
  );

  const handleColDimensionsChange = useCallback(
    (values) => setCrossCols(values.length ? values : DEFAULT_COL_DIMENSIONS),
    []
  );

  const resolveName = useCallback(
    (collection, id) =>
      id ? collection.find((item) => String(item.id) === String(id))?.nom || "—" : "—",
    []
  );

  const buildPrintLayout = useCallback(() => {
    const cfg = headerFooterConfig && typeof headerFooterConfig === "object" ? headerFooterConfig : null;
    const baseTitle = cfg?.documentTitle || cfg?.headerTitle || "Liste des VDP";
    const filterParts = [];
    if (filters.region_id) filterParts.push(`Région : ${resolveName(regions, filters.region_id)}`);
    if (filters.province_id) filterParts.push(`Province : ${resolveName(provinces, filters.province_id)}`);
    if (filters.commune_id) filterParts.push(`Commune : ${resolveName(communes, filters.commune_id)}`);
    if (filters.entite_id) filterParts.push(`Entité : ${resolveName(entities, filters.entite_id)}`);
    if (filters.sous_entite_id) filterParts.push(`Sous-entité : ${resolveName(subEntities, filters.sous_entite_id)}`);
    if (filters.coordination_id) filterParts.push(`Coordination : ${resolveName(coordinations, filters.coordination_id)}`);
    const documentTitle = filterParts.length ? `${baseTitle} — ${filterParts.join(" | ")}` : baseTitle;

    if (!cfg) return { headerHtml: "", footerHtml: "", documentTitle };

    const separator = cfg.separator ? `<div style="font-weight:bold;color:${cfg.separatorColor || "#222"};">${cfg.separator.repeat(cfg.separatorLength || 14)}</div>` : "";
    const institutions = Array.isArray(cfg.institutions)
      ? cfg.institutions
          .map((inst) => `<div style="font-weight:${inst?.bold ? "bold" : "normal"};font-style:${inst?.italic ? "italic" : "normal"};text-decoration:${inst?.underline ? "underline" : "none"};color:${inst?.color || "#222"};font-size:${cfg.institFontSize || 14}px;">${inst?.text || ""}</div>`)
          .join(separator || "")
      : "";

    const headerHtml = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div style="flex:2;min-width:180px;text-align:${cfg.minInstitAlign || "left"};">
          ${cfg.ministere ? `<div style="font-weight:bold;font-size:${cfg.ministereFontSize || 16}px;">${cfg.ministere || ""}</div>` : ""}
          ${separator}
          ${institutions}
        </div>
        <div style="flex:1;text-align:center;">
          ${cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="Logo" style="max-height:60px;object-fit:contain;" />` : ""}
        </div>
        <div style="flex:1;min-width:180px;text-align:${cfg.styleOptions?.pays?.align || "right"};font-family:${cfg.styleOptions?.pays?.fontFamily || "inherit"};">
          ${cfg.pays ? `<div style="font-weight:${cfg.styleOptions?.pays?.bold ? "bold" : "normal"};font-style:${cfg.styleOptions?.pays?.italic ? "italic" : "normal"};text-decoration:${cfg.styleOptions?.pays?.underline ? "underline" : "none"};color:${cfg.styleOptions?.pays?.color || "#222"};font-size:${cfg.styleOptions?.pays?.fontSize || 16}px;">${cfg.pays}</div>` : ""}
          ${
            cfg.styleOptions?.paysSeparator?.char && cfg.styleOptions?.paysSeparator?.count
              ? `<div style="color:${cfg.styleOptions.paysSeparator.color || "#222"};font-weight:${cfg.styleOptions.paysSeparator.bold ? "bold" : "normal"};font-style:${cfg.styleOptions.paysSeparator.italic ? "italic" : "normal"};text-decoration:${cfg.styleOptions.paysSeparator.underline ? "underline" : "none"};font-family:${cfg.styleOptions.paysSeparator.fontFamily || "inherit"};font-size:${cfg.styleOptions.paysSeparator.fontSize || 14}px;text-align:${cfg.styleOptions.paysSeparator.align || "right"};">${cfg.styleOptions.paysSeparator.char.repeat(cfg.styleOptions.paysSeparator.count)}</div>`
              : ""
          }
          ${cfg.devise ? `<div style="font-style:${cfg.styleOptions?.devise?.italic ? "italic" : "normal"};font-weight:${cfg.styleOptions?.devise?.bold ? "bold" : "normal"};text-decoration:${cfg.styleOptions?.devise?.underline ? "underline" : "none"};color:${cfg.styleOptions?.devise?.color || "#222"};font-size:${cfg.styleOptions?.devise?.fontSize || 14}px;">${cfg.devise}</div>` : ""}
        </div>
      </div>
    `;

    const footerHtml = cfg.signataire
      ? `
        <div style="display:flex;justify-content:${cfg.signataireAlign || "right"};margin-top:24px;">
          <div style="text-align:${cfg.signataireAlign || "right"};margin-left:${cfg.signataireAlign === "left" ? cfg.signataireOffset || 0 : 0}px;margin-right:${cfg.signataireAlign === "right" ? cfg.signataireOffset || 0 : 0}px;margin-top:${cfg.signataireOffsetY || 0}px;">
            <div>${cfg.signataire}</div>
            ${cfg.grade ? `<div>${cfg.grade}</div>` : ""}
            ${cfg.titre ? `<div>${cfg.titre}</div>` : ""}
            ${cfg.signatureUrl ? `<img src="${cfg.signatureUrl}" alt="Signature" style="max-height:40px;object-fit:contain;" />` : ""}
          </div>
        </div>
      `
      : "";

    return { headerHtml, footerHtml, documentTitle };
  }, [headerFooterConfig, filters, resolveName, regions, provinces, communes, entities, subEntities, coordinations]);

  const openFiche = useCallback(async (record) => {
    setPreviewVisible(true);
    setPreviewLoading(true);
    try {
      let detail = record;
      if (record?.id && typeof api?.getVdpById === "function") {
        try {
          detail = await api.getVdpById(record.id);
        } catch {
          /* fallback */
        }
      }
      setPreviewData(detail || record || null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const closeFiche = useCallback(() => {
    setPreviewVisible(false);
    setPreviewData(null);
  }, []);

  const { region_id: filterRegion, province_id: filterProvince, commune_id: filterCommune, entite_id: filterEntite, sous_entite_id: filterSousEntite, coordination_id: filterCoordination } = filters;

  // sous-entités filtrées par entité sélectionnée
  const filteredSubEntities = useMemo(
    () => subEntities.filter(s => !filterEntite || String(s.entite_id) === String(filterEntite)),
    [subEntities, filterEntite]
  );

  const ensureDataUrl = useCallback((value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    return /^data:image\//i.test(value) ? value : `data:image/png;base64,${value}`;
  }, []);

  const isDataUrl = useCallback(
    (value) => typeof value === "string" && /^data:image\//i.test(value),
    []
  );

  // Chargement des données
  useEffect(() => {
    (async () => {
      setLoading(true);
      const ensureArray = (input) => {
        if (Array.isArray(input)) return input;
        if (Array.isArray(input?.data)) return input.data;
        if (Array.isArray(input?.rows)) return input.rows;
        return [];
      };
      const fetchList = async (...names) => {
        for (const name of names) {
          const fn = typeof api?.[name] === "function" ? api[name] : null;
          if (!fn) continue;
          try {
            const result = await fn();
            if (result != null) return result;
          } catch (err) {
            console.warn(`[VdpList] ${name} failed:`, err);
          }
        }
        return [];
      };

      try {
        const [
          vdpsRaw,
          regsRaw,
          provsRaw,
          commsRaw,
          locsRaw,
          entsRaw,
          sousEntsRaw,
          coordsRaw,
        ] = await Promise.all([
          fetchList("getVdpList"),
          fetchList("getRegionsList", "getRegions"),
          fetchList("getProvincesList", "getProvinces"),
          fetchList("getCommunesList", "getCommunes"),
          fetchList("getLocalitesList", "getLocalites"),
          fetchList("getEntitesList", "getEntites"),
          fetchList("getSousEntitesList", "getSousEntites"),
          fetchList("getCoordinationsList", "getCoordinations"),
        ]);

        const regsList = ensureArray(regsRaw);
        const provsList = ensureArray(provsRaw);
        const commsList = ensureArray(commsRaw);
        const locsList = ensureArray(locsRaw);
        const entsList = ensureArray(entsRaw);
        const sousEntsList = ensureArray(sousEntsRaw);
        const coordsList = ensureArray(coordsRaw);

        setRegions(regsList);
        setProvinces(provsList);
        setCommunes(commsList);
        setLocalites(locsList);
        setEntities(entsList);
        setSubEntities(sousEntsList);
        setCoordinations(coordsList);

        const vdpsList = ensureArray(vdpsRaw);
        setData(
          vdpsList.map((v, i) => {
            const resolvedRegionId =
              v.region_id ??
              v.regionId ??
              (v.region_nom ? regsList.find(r => r.nom === v.region_nom)?.id : undefined);
            const resolvedProvinceId =
              v.province_id ??
              v.provinceId ??
              (v.province_nom ? provsList.find(p => p.nom === v.province_nom)?.id : undefined);
            const resolvedCommuneId =
              v.commune_id ??
              v.communeId ??
              (v.commune_nom ? commsList.find(c => c.nom === v.commune_nom)?.id : undefined);
            const resolvedLocaliteId =
              v.localite_id ??
              v.localiteId ??
              (v.localite_nom ? locsList.find(l => l.nom === v.localite_nom)?.id : undefined);

            return {
              ...v,
              key: v.id,
              __rowNumber: i + 1,
              region_id: resolvedRegionId ?? null,
              province_id: resolvedProvinceId ?? null,
              commune_id: resolvedCommuneId ?? null,
              localite_id: resolvedLocaliteId ?? null,
              entite_id: v.entite_id ?? v.entiteId ?? null,
              sous_entite_id: v.sous_entite_id ?? v.sousEntiteId ?? null,
              coordination_id: v.coordination_id ?? v.coordinationId ?? null,
            };
          })
        );
      } catch (e) {
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Chargement de la configuration d'en-tête/pied de page
  useEffect(() => {
    (async () => {
      try {
        const configs = await api.getAppConfigList();
        const found = configs.find(item => item.nom_param === "header_footer");
        if (found?.valeur) setHeaderFooterConfig(JSON.parse(found.valeur));
      } catch {
        /* noop */
      }
    })();
  }, []);

  // Filtres dynamiques
  useEffect(() => {
    let res = [...data];
    if (filters.region_id)
      res = res.filter((v) => String(v.region_id) === String(filters.region_id));
    if (filters.province_id)
      res = res.filter((v) => String(v.province_id) === String(filters.province_id));
    if (filters.commune_id)
      res = res.filter((v) => String(v.commune_id) === String(filters.commune_id));
    if (filters.statut_vdp)
      res = res.filter((v) => v.statut_vdp === filters.statut_vdp);
    if (filters.sexe)
      res = res.filter((v) => v.sexe === filters.sexe);

    // nouveaux filtres entité / sous-entité / coordination
    if (filters.entite_id)
      res = res.filter((v) => String(v.entite_id) === String(filters.entite_id));
    if (filters.sous_entite_id)
      res = res.filter((v) => String(v.sous_entite_id) === String(filters.sous_entite_id));
    if (filters.coordination_id)
      res = res.filter((v) => String(v.coordination_id) === String(filters.coordination_id));

    if (filters.search)
      res = res.filter(
        (v) =>
          (v.nom && v.nom.toLowerCase().includes(filters.search.toLowerCase())) ||
          (v.prenom && v.prenom.toLowerCase().includes(filters.search.toLowerCase())) ||
          (v.numero_cnib && v.numero_cnib.includes(filters.search))
      );
    setFiltered(res);
  }, [data, filters]);

  // Colonnes du tableau principal
  const columnDefs = useMemo(() => {
    const fmtDate = (value) => (value ? moment(value).format("DD/MM/YYYY") : "—");
    const normalizePhotoValue = (photo) => {
      if (!photo) return null;
      if (/^data:|^https?:\/\//i.test(photo)) return photo;
      return `data:image/jpeg;base64,${photo}`;
    };
    const resolveLabel = (collection, id) =>
      collection.find((item) => String(item.id) === String(id))?.nom || "—";

    return {
      rowNumber: {
        key: "rowNumber",
        title: "#",
        dataIndex: "__rowNumber",
        width: 60,
        align: "center",
        fixed: "left",
        exporter: (row) => (row.__rowNumber != null ? row.__rowNumber : "—"),
      },
      photo: {
        key: "photo",
        title: "Photo",
        dataIndex: "photo",
        width: 90,
        align: "center",
        render: (value) => {
          const src = normalizePhotoValue(value);
          if (!src) return <span style={{ color: "#bbb" }}>—</span>;
          return (
            <img
              src={src}
              alt="Photo"
              style={{
                width: 54,
                height: 54,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #e3f1e6",
                background: "#f6fff8",
              }}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src =
                  "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg";
              }}
            />
          );
        },
        exporter: (row) => normalizePhotoValue(row.photo) || "",
      },
      id: {
        key: "id",
        title: "ID",
        dataIndex: "id",
        sorter: (a, b) => (a.id || 0) - (b.id || 0),
        exporter: (row) => (row.id != null ? row.id : "—"),
      },
      nom: {
        key: "nom",
        title: "Nom",
        dataIndex: "nom",
        sorter: (a, b) => (a.nom || "").localeCompare(b.nom || ""),
        render: (value) => <span style={{ fontWeight: 700 }}>{value || "—"}</span>,
        exporter: (row) => row.nom || "—",
      },
      prenom: {
        key: "prenom",
        title: "Prénom",
        dataIndex: "prenom",
        sorter: (a, b) => (a.prenom || "").localeCompare(b.prenom || ""),
        exporter: (row) => row.prenom || "—",
      },
      sexe: {
        key: "sexe",
        title: "Sexe",
        dataIndex: "sexe",
        filters: [
          { text: "Masculin", value: "Masculin" },
          { text: "Féminin", value: "Féminin" },
          { text: "Autre", value: "Autre" },
        ],
        onFilter: (value, record) => record.sexe === value,
        render: (value) =>
          value === "Masculin" ? (
            <Tag color="blue">Masculin</Tag>
          ) : value === "Féminin" ? (
            <Tag color="magenta">Féminin</Tag>
          ) : (
            <Tag color="default">{value || "—"}</Tag>
          ),
        exporter: (row) => row.sexe || "—",
      },
      date_naissance: {
        key: "date_naissance",
        title: "Date de naissance",
        dataIndex: "date_naissance",
        render: (value) => fmtDate(value),
        exporter: (row) => fmtDate(row.date_naissance),
      },
      lieu_naissance: {
        key: "lieu_naissance",
        title: "Lieu de naissance",
        dataIndex: "lieu_naissance",
        exporter: (row) => row.lieu_naissance || "—",
      },
      statut_vdp: {
        key: "statut_vdp",
        title: "Statut",
        dataIndex: "statut_vdp",
        filters: [
          { text: "En service", value: "En service" },
          { text: "Radié", value: "Radié" },
          { text: "Tombé", value: "Tombé" },
          { text: "Autre", value: "Autre" },
        ],
        onFilter: (value, record) => record.statut_vdp === value,
        render: (value) => {
          const color =
            value === "En service"
              ? "green"
              : value === "Radié"
              ? "volcano"
              : value === "Tombé"
              ? "red"
              : "default";
          return <Tag color={color}>{value || "—"}</Tag>;
        },
        exporter: (row) => row.statut_vdp || "—",
      },
      statut_matrimonial: {
        key: "statut_matrimonial",
        title: "Statut matrimonial",
        dataIndex: "statut_matrimonial",
        exporter: (row) => row.statut_matrimonial || "—",
      },
      nb_enfants: {
        key: "nb_enfants",
        title: "Nb enfants",
        dataIndex: "nb_enfants",
        exporter: (row) => (row.nb_enfants != null ? row.nb_enfants : "—"),
      },
      type_vdp: {
        key: "type_vdp",
        title: "Type VDP",
        dataIndex: "type_vdp",
        filters: [
          { text: "National", value: "National" },
          { text: "Communal", value: "Communal" },
          { text: "Dozo", value: "Dozo" },
        ],
        onFilter: (value, record) => record.type_vdp === value,
        exporter: (row) => row.type_vdp || "—",
      },
      numero_cnib: {
        key: "numero_cnib",
        title: "N° CNIB",
        dataIndex: "numero_cnib",
        exporter: (row) => row.numero_cnib || "—",
      },
      date_cnib: {
        key: "date_cnib",
        title: "Date CNIB",
        dataIndex: "date_cnib",
        render: (value) => fmtDate(value),
        exporter: (row) => fmtDate(row.date_cnib),
      },
      date_recrutement: {
        key: "date_recrutement",
        title: "Date de recrutement",
        dataIndex: "date_recrutement",
        render: (value) => fmtDate(value),
        exporter: (row) => fmtDate(row.date_recrutement),
      },
      entite: {
        key: "entite",
        title: "Entité",
        dataIndex: "entite_id",
        render: (id) => resolveLabel(entities, id),
        exporter: (row) => resolveLabel(entities, row.entite_id),
      },
      sous_entite: {
        key: "sous_entite",
        title: "Sous-entité",
        dataIndex: "sous_entite_id",
        render: (id) => resolveLabel(subEntities, id),
        exporter: (row) => resolveLabel(subEntities, row.sous_entite_id),
      },
      coordination: {
        key: "coordination",
        title: "Coordination",
        dataIndex: "coordination_id",
        render: (id) => resolveLabel(coordinations, id),
        exporter: (row) => resolveLabel(coordinations, row.coordination_id),
      },
      contacts: {
        key: "contacts",
        title: "Contacts",
        dataIndex: "contacts",
        exporter: (row) => row.contacts || "—",
      },
      contact_urgence1: {
        key: "contact_urgence1",
        title: "Urgence 1",
        dataIndex: "contact_urgence1",
        exporter: (row) => row.contact_urgence1 || "—",
      },
      contact_urgence2: {
        key: "contact_urgence2",
        title: "Urgence 2",
        dataIndex: "contact_urgence2",
        exporter: (row) => row.contact_urgence2 || "—",
      },
      contact_urgence3: {
        key: "contact_urgence3",
        title: "Urgence 3",
        dataIndex: "contact_urgence3",
        exporter: (row) => row.contact_urgence3 || "—",
      },
      nom_personne_prevenir: {
        key: "nom_personne_prevenir",
        title: "Personne à prévenir",
        dataIndex: "nom_personne_prevenir",
        exporter: (row) => row.nom_personne_prevenir || "—",
      },
      lien_personne_prevenir: {
        key: "lien_personne_prevenir",
        title: "Lien",
        dataIndex: "lien_personne_prevenir",
        exporter: (row) => row.lien_personne_prevenir || "—",
      },
      region: {
        key: "region",
        title: "Région",
        dataIndex: "region_id",
        render: (id) => resolveLabel(regions, id),
        exporter: (row) => resolveLabel(regions, row.region_id),
      },
      province: {
        key: "province",
        title: "Province",
        dataIndex: "province_id",
        render: (id) => resolveLabel(provinces, id),
        exporter: (row) => resolveLabel(provinces, row.province_id),
      },
      commune: {
        key: "commune",
        title: "Commune",
        dataIndex: "commune_id",
        render: (id) => resolveLabel(communes, id),
        exporter: (row) => resolveLabel(communes, row.commune_id),
      },
      localite: {
        key: "localite",
        title: "Localité",
        dataIndex: "localite_id",
        render: (id) => resolveLabel(localites, id),
        exporter: (row) => resolveLabel(localites, row.localite_id),
      },
      observation: {
        key: "observation",
        title: "Observation",
        dataIndex: "observation",
        exporter: (row) => row.observation || "—",
      },
      code_qr: {
        key: "code_qr",
        title: "Code QR",
        dataIndex: "code_qr",
        render: (value) => {
          const src = ensureDataUrl(value);
          return src ? (
            <img
              src={src}
              alt="QR code"
              style={{
                width: 56,
                height: 56,
                borderRadius: 6,
                border: "1px solid #e3f1e6",
                background: "#f6fff8",
                objectFit: "cover",
              }}
            />
          ) : (
            <span style={{ color: "#bbb" }}>—</span>
          );
        },
        exporter: (row) => ensureDataUrl(row.code_qr) || "",
      },
    };
  }, [ensureDataUrl, entities, subEntities, coordinations, regions, provinces, communes, localites]);

  const orderedColumnKeys = useMemo(() => {
    const normalized = columnOrder.filter((key) => ALL_COLUMN_KEYS.includes(key));
    const missing = ALL_COLUMN_KEYS.filter((key) => !normalized.includes(key));
    return [...normalized, ...missing];
  }, [columnOrder]);

  const toggleColumnVisibility = useCallback(
    (key, checked) => {
      if (key === "rowNumber") return;
      setVisibleColumnKeys((prev) => {
        if (checked) {
          const next = prev.includes(key) ? prev : [...prev, key];
          return orderedColumnKeys.filter(
            (item) => item === "rowNumber" || next.includes(item)
          );
        }
        return prev.filter((item) => item !== key);
      });
    },
    [orderedColumnKeys]
  );

  const moveColumn = useCallback((key, direction) => {
    if (key === "rowNumber") return;
    setColumnOrder((prev) => {
      const draft = prev.filter((item) => ALL_COLUMN_KEYS.includes(item));
      const index = draft.indexOf(key);
      const target = index + direction;
      if (index < 1 || target < 1 || target >= draft.length) return prev;
      const copy = [...draft];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      const missing = ALL_COLUMN_KEYS.filter((item) => !copy.includes(item));
      return [...copy, ...missing];
    });
  }, []);

  useEffect(() => {
    const keys = Object.keys(columnDefs);
    setColumnOrder((prev) => {
      const filtered = prev.filter((key) => keys.includes(key));
      keys.forEach((key) => {
        if (!filtered.includes(key)) filtered.push(key);
      });
      return filtered;
    });
    setVisibleColumnKeys((prev) => {
      const filtered = prev.filter((key) => keys.includes(key));
      return filtered.length ? filtered : keys;
    });
  }, [columnDefs]);

  const baseColumns = useMemo(
    () =>
      columnOrder
        .filter((key) => key === "rowNumber" || visibleColumnKeys.includes(key))
        .map((key) => columnDefs[key])
        .filter(Boolean),
    [columnOrder, visibleColumnKeys, columnDefs]
  );

  const listExportColumns = useMemo(
    () => baseColumns.filter(Boolean),
    [baseColumns]
  );

  const exportListToCsv = useCallback(() => {
    if (!filtered.length) {
      message.warning("Aucune donnée à exporter.");
      return;
    }
    const header = listExportColumns.map((col) => col.title || col.key);
    const escapeCell = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((row) =>
      listExportColumns.map((col) => {
        const raw =
          typeof col.exporter === "function"
            ? col.exporter(row)
            : col.dataIndex
            ? row[col.dataIndex]
            : "";
        return escapeCell(raw);
      }).join(";")
    );
    const payload = ["\ufeff" + header.map(escapeCell).join(";"), ...rows].join("\n");
    saveAs(
      new Blob([payload], { type: "text/csv;charset=utf-8" }),
      `VDP_Liste_${moment().format("YYYYMMDD_HHmmss")}.csv`
    );
    message.success("Export CSV généré.");
  }, [filtered, listExportColumns]);

  const printList = useCallback(() => {
    if (!filtered.length) {
      message.warning("Aucune donnée à imprimer.");
      return;
    }
    const { headerHtml, footerHtml, documentTitle } = buildPrintLayout();
    const escapeHtml = (input) =>
      input == null
        ? ""
        : String(input)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    const headRow = listExportColumns
      .map((col) => `<th style="padding:6px 8px;border:1px solid #b0c4b1;background:#dbe7db;">${escapeHtml(col.title || col.key)}</th>`)
      .join("");
    const bodyRows = filtered
      .map((row) => {
        const cells = listExportColumns
          .map((col) => {
            const key = col.key || col.dataIndex;
            const raw =
              typeof col.exporter === "function"
                ? col.exporter(row)
                : col.dataIndex
                ? row[col.dataIndex]
                : "";
            if (key === "photo" || key === "code_qr") {
              const src = ensureDataUrl(raw);
              const content = src
                ? `<img src="${src}" alt="${key}" style="width:54px;height:54px;border-radius:8px;object-fit:cover;border:1px solid #b0c4b1;" />`
                : `<span style="color:#bbb">—</span>`;
              return `<td style="padding:6px 8px;border:1px solid #b0c4b1;text-align:center;">${content}</td>`;
            }
            const normalized = raw == null || raw === "" ? "—" : escapeHtml(raw);
            return `<td style="padding:6px 8px;border:1px solid #b0c4b1;">${normalized}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    const html = `
      <html>
        <head>
          <title>${escapeHtml(documentTitle)}</title>
          <style>
            @media print { @page { size: A4 portrait; margin: 12mm; } }
            body { font-family: Arial, sans-serif; color: #1f2f25; padding: 12px 18px; }
            .vdp-print-header { margin-bottom: 18px; }
            .vdp-print-footer { margin-top: 28px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          </style>
        </head>
        <body>
          ${headerHtml ? `<div class="vdp-print-header">${headerHtml}</div>` : ""}
          <h2 style="text-align:center;margin:0;">${escapeHtml(documentTitle)}</h2>
          <table>
            <thead><tr>${headRow}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
          ${footerHtml ? `<div class="vdp-print-footer">${footerHtml}</div>` : ""}
        </body>
      </html>
    `;
    const win = window.open("", "", "width=1200,height=800");
    if (!win) {
      message.error("Impossible d'ouvrir la fenêtre d'impression.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }, [filtered, listExportColumns, buildPrintLayout, ensureDataUrl]);

  const handleViewVdp = useCallback(
    (record) => {
      navigate(`/dashboard/vdp/fiche/${record.id}`);
    },
    [navigate]
  );

  const handleEditVdp = useCallback(
    (record) => {
      navigate(`/dashboard/vdp/edit/${record.id}`);
    },
    [navigate]
  );

  const deleteVdp = useCallback(
    (record) => {
      setDeletingId(record.id);
      Modal.confirm({
        title: "Confirmer la suppression",
        content: `Êtes-vous sûr de vouloir supprimer le VDP "${record.nom} ${record.prenom || ""}" ?`,
        okText: "Supprimer",
        okType: "danger",
        cancelText: "Annuler",
        onOk: async () => {
          setLoading(true);
          try {
            await api.deleteVdp(record.id);
            setData((prev) => prev.filter((v) => v.id !== record.id));
            setFiltered((prev) => prev.filter((v) => v.id !== record.id));
            message.success("VDP supprimé.");
          } catch (err) {
            message.error("Erreur lors de la suppression du VDP.");
          } finally {
            setLoading(false);
            setDeletingId(null);
          }
        },
        onCancel: () => {
          setDeletingId(null);
        },
      });
    },
    [deletingId]
  );

  const actionColumn = useMemo(
    () => ({
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 160,
      render: (text, record) => (
        <Space size="middle">
          <Button
            icon={<ProfileOutlined />}
            size="small"
            onClick={() => handleViewVdp(record)}
          />
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditVdp(record)}
          />
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            loading={deletingId === record.id}
            onClick={() => deleteVdp(record)}
          />
        </Space>
      ),
    }),
    [handleViewVdp, handleEditVdp, deleteVdp, deletingId]
  );

  const tableColumns = useMemo(
    () => [...baseColumns, actionColumn],
    [baseColumns, actionColumn]
  );

  // Rendu
  return (
    <div className="vdp-list-page">
      <Header />
      <div className="vdp-list-content">
        <div className="vdp-list-header">
          <Title level={2} className="vdp-list-heading">
            Gestion des VDP
          </Title>
        </div>
        <div className="vdp-list-filters">
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Sélectionner une région"
                value={filters.region_id}
                onChange={(value) => setFilters((prev) => ({ ...prev, region_id: value }))}
                style={{ width: "100%" }}
                allowClear
              >
                {regions.map((region) => (
                  <Option key={region.id} value={region.id}>
                    {region.nom}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Sélectionner une province"
                value={filters.province_id}
                onChange={(value) => setFilters((prev) => ({ ...prev, province_id: value }))}
                style={{ width: "100%" }}
                allowClear
              >
                {provinces.map((province) => (
                  <Option key={province.id} value={province.id}>
                    {province.nom}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Sélectionner une commune"
                value={filters.commune_id}
                onChange={(value) => setFilters((prev) => ({ ...prev, commune_id: value }))}
                style={{ width: "100%" }}
                allowClear
              >
                {communes.map((commune) => (
                  <Option key={commune.id} value={commune.id}>
                    {commune.nom}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Sélectionner une localité"
                value={filters.localite_id}
                onChange={(value) => setFilters((prev) => ({ ...prev, localite_id: value }))}
                style={{ width: "100%" }}
                allowClear
              >
                {localites.map((localite) => (
                  <Option key={localite.id} value={localite.id}>
                    {localite.nom}
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Sélectionner un statut"
                value={filters.statut_vdp}
                onChange={(value) => setFilters((prev) => ({ ...prev, statut_vdp: value }))}
                style={{ width: "100%" }}
                allowClear
              >
                <Option value="En service">En service</Option>
                <Option value="Radié">Radié</Option>
                <Option value="Tombé">Tombé</Option>
                <Option value="Autre">Autre</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                placeholder="Sélectionner un sexe"
                value={filters.sexe}
                onChange={(value) => setFilters((prev) => ({ ...prev, sexe: value }))}
                style={{ width: "100%" }}
                allowClear
              >
                <Option value="Masculin">Masculin</Option>
                <Option value="Féminin">Féminin</Option>
                <Option value="Autre">Autre</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Input
                placeholder="Rechercher par nom, prénom ou CNIB"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                style={{ width: "100%" }}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => {
                  setFiltered((prev) => {
                    let next = [...data];
                    if (filters.region_id)
                      next = next.filter((v) => String(v.region_id) === String(filters.region_id));
                    if (filters.province_id)
                      next = next.filter((v) => String(v.province_id) === String(filters.province_id));
                    if (filters.commune_id)
                      next = next.filter((v) => String(v.commune_id) === String(filters.commune_id));
                    if (filters.statut_vdp)
                      next = next.filter((v) => v.statut_vdp === filters.statut_vdp);
                    if (filters.sexe)
                      next = next.filter((v) => v.sexe === filters.sexe);
                    if (filters.search)
                      next = next.filter(
                        (v) =>
                          (v.nom && v.nom.toLowerCase().includes(filters.search.toLowerCase())) ||
                          (v.prenom && v.prenom.toLowerCase().includes(filters.search.toLowerCase())) ||
                          (v.numero_cnib && v.numero_cnib.includes(filters.search))
                      );
                    return next;
                  });
                  message.success("Filtres appliqués.");
                }}
                style={{ width: "100%" }}
              >
                Rechercher
              </Button>
            </Col>
          </Row>
        </div>
        <div className="vdp-list-actions" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/dashboard/vdp/add")}
            >
              Ajouter un VDP
            </Button>
            <Button icon={<ColumnWidthOutlined />} onClick={() => setColumnConfigModalVisible(true)}>
              Colonnes
            </Button>
            <Button icon={<PrinterOutlined />} onClick={printList}>
              Imprimer la liste
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={exportListToCsv}>
              Export CSV liste
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() =>
                setFilters({
                  region_id: undefined,
                  province_id: undefined,
                  commune_id: undefined,
                  statut_vdp: undefined,
                  sexe: undefined,
                  entite_id: undefined,
                  sous_entite_id: undefined,
                  coordination_id: undefined,
                  search: "",
                })
              }
            >
              Réinitialiser
            </Button>
          </Space>
        </div>
        <div className="vdp-list-table">
          <Table
            dataSource={filtered}
            columns={tableColumns}
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
            }}
            rowKey="id"
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>
      <Footer />
      <Modal
        title="Dimensions croisées"
        visible={crossModalVisible}
        onCancel={closeCrossModal}
        footer={null}
        width={800}
      >
        <div style={{ maxHeight: 600, overflowY: "auto" }}>
          <Divider orientation="left">Lignes</Divider>
          <Select
            mode="multiple"
            placeholder="Sélectionner les dimensions de ligne"
            value={crossRows}
            onChange={handleRowDimensionsChange}
            style={{ width: "100%", marginBottom: 16 }}
          >
            {availableRowDimensions.map((dim) => (
              <Option key={dim.key} value={dim.key}>
                {dim.label}
              </Option>
            ))}
          </Select>
          <Divider orientation="left">Colonnes</Divider>
          <Select
            mode="multiple"
            placeholder="Sélectionner les dimensions de colonne"
            value={crossCols}
            onChange={handleColDimensionsChange}
            style={{ width: "100%", marginBottom: 16 }}
          >
            {availableColDimensions.map((dim) => (
              <Option key={dim.key} value={dim.key}>
                {dim.label}
              </Option>
            ))}
          </Select>
          <div style={{ textAlign: "right" }}>
            <Button onClick={closeCrossModal} style={{ marginRight: 8 }}>
              Annuler
            </Button>
            <Button
              type="primary"
              onClick={() => {
                closeCrossModal();
                message.success("Dimensions croisées mises à jour.");
              }}
            >
              Appliquer
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={columnConfigModalVisible}
        visible={columnConfigModalVisible}
        onCancel={() => setColumnConfigModalVisible(false)}
        footer={null}
        width={520}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {orderedColumnKeys.map((key, index) => {
            const label = columnDefs[key]?.title || key;
            const locked = key === "rowNumber";
            const visible = key === "rowNumber" || visibleColumnKeys.includes(key);
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Checkbox
                  checked={visible}
                  disabled={locked}
                  onChange={(event) => toggleColumnVisibility(key, event.target.checked)}
                >
                  {label}
                </Checkbox>
                <Space size="small">
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={locked || index <= 1}
                    onClick={() => moveColumn(key, -1)}
                  />
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={locked || index >= orderedColumnKeys.length - 1}
                    onClick={() => moveColumn(key, 1)}
                  />
                </Space>
              </div>
            );
          })}
        </Space>
      </Modal>
    </div>
  );
}