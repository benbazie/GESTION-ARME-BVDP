// src/components/MunitionList.js
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReloadOutlined,
  PlusOutlined,
  ProfileOutlined,
  SearchOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  PrinterOutlined,
  FilterOutlined,
  ColumnWidthOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  UpOutlined,
  DownOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Row,
  Col,
  DatePicker,
  Select,
  Tooltip,
  message,
  Form,
  Input,
  Modal,
  Typography,
  Checkbox,
} from "antd";
import moment from "moment";
import "./MunitionList.css";
import api from "../api";
import resolveApiBase from "../utils/resolveApiBase";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const resolveBridge = () => {
  if (typeof window === "undefined") return null;
  return window.electronAPI || window.safeElectronAPI || window.api || null;
};

const waitForElectronAPI = (timeout = 2000) =>
  new Promise(resolve => {
    const immediate = resolveBridge();
    if (immediate) return resolve(immediate);
    const start = Date.now();
    const tick = () => {
      const candidate = resolveBridge();
      if (candidate) return resolve(candidate);
      if (Date.now() - start >= timeout) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });

const fetchJson = async (endpoint, params = {}, options = {}) => {
  const base = resolveApiBase();
  const cleanedBase = base.replace(/\/$/, "");
  let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (cleanedBase.endsWith("/api") && path.startsWith("/api")) {
    path = path.replace(/^\/api/, "");
  }
  if (!path.startsWith("/")) path = `/${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = (() => {
    try { return localStorage.getItem("auth-token") || localStorage.getItem("auth_token"); } catch { return null; }
  })();
  if (token && !headers.Authorization) headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const method = (options.method || "GET").toUpperCase();
  const query = params && method === "GET"
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString()
    : "";
  if (query) path += path.includes("?") ? `&${query}` : `?${query}`;
  const request = { ...options, method, headers };
  if (method !== "GET" && params && !options.body) request.body = JSON.stringify(params);
  const response = await fetch(`${cleanedBase}${path}`, request);
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
};

const safeCall = async (variants = [], ...args) => {
  const bridge = await waitForElectronAPI();
  const names = Array.isArray(variants) ? variants : [variants];
  let lastError = null;

  for (const name of names) {
    const candidates = [
      bridge && typeof bridge[name] === "function" ? () => bridge[name](...args) : null,
      bridge && typeof bridge.call === "function" ? () => bridge.call(name, ...(args.length ? args : [{}])) : null,
      typeof api[name] === "function" ? () => api[name](...(args.length ? args : [{}])) : null,
      typeof api.call === "function" ? () => api.call(name, ...(args.length ? args : [{}])) : null,
    ].filter(Boolean);

    for (const fn of candidates) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError?.status === 401) throw lastError;
  return null;
};

const DEFAULT_COLUMN_KEYS = [
  "rowNumber",
  "reference",
  "designation",
  "type",
  "calibre",
  "lot",
  "stock_initial",
  "stock_disponible",
  "statut",
  "date_entree",
  "date_peremption",
];

const DEFAULT_COLUMN_ORDER = [...DEFAULT_COLUMN_KEYS];

const COLUMN_LABELS = {
  rowNumber: "N°",
  reference: "Référence",
  designation: "Désignation",
  type: "Type",
  calibre: "Calibre",
  lot: "Lot",
  stock_initial: "Stock initial",
  stock_disponible: "Stock dispo.",
  statut: "Statut",
  date_entree: "Entrée",
  date_peremption: "Péremption",
};

const DEFAULT_DIMENSIONS = ["type", "calibre", "statut"];
const DEFAULT_PRINT_LAYOUT = {
  headerTitle: "Inventaire des munitions",
  headerSubtitle: "Période : {{date}} — Total : {{total}} pièces",
  footerLeft: "",
  footerRight: "",
};

const DIMENSION_DEFINITIONS = {
  type: { label: "Répartition par type", accessor: (row) => row.type || "Non renseigné" },
  calibre: { label: "Répartition par calibre", accessor: (row) => row.calibre || "Non renseigné" },
  statut: { label: "Répartition par statut", accessor: (row) => {
    const stock = row.stock_disponible || 0;
    const seuil = row.seuil_critique || 0;
    if (stock <= 0) return "Rupture";
    if (stock <= seuil) return "Critique";
    return "Normal";
  }},
  localite: { label: "Répartition par localité", accessor: (row) => {
    const localite = localites.find(l => l.id === row.localite_id);
    return localite?.nom || "Non assigné";
  }},
};

function MunitionList() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [rawData, setRawData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    period: null,
    type: undefined,
    calibre: undefined,
    statut: undefined,
    lot_id: undefined,
    localite_id: undefined,
    seuil_critique: undefined,
  });

  const [lots, setLots] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMN_KEYS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [statDimensions, setStatDimensions] = useState(DEFAULT_DIMENSIONS);
  const [printLayout, setPrintLayout] = useState(DEFAULT_PRINT_LAYOUT);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");
  const [columnModalVisible, setColumnModalVisible] = useState(false);
  const [headerFooterConfig, setHeaderFooterConfig] = useState({});

  const printRef = useRef(null);

  const uniqueTypes = useMemo(
    () => Array.from(new Set(rawData.map(row => row.type || row.type_munition).filter(Boolean))).sort(),
    [rawData]
  );
  const uniqueCalibres = useMemo(
    () => Array.from(new Set(rawData.map(row => row.calibre || row.calibre_munition).filter(Boolean))).sort(),
    [rawData]
  );
  const uniqueStatuts = useMemo(
    () => Array.from(new Set(rawData.map(row => row.statut).filter(Boolean))).sort(),
    [rawData]
  );

  const configMap = useMemo(
    () => new Map(configs.map(item => [String(item.id), item])),
    [configs]
  );

  const normalizeArray = (input) => {
    if (Array.isArray(input)) return input;
    if (Array.isArray(input?.rows)) return input.rows;
    if (Array.isArray(input?.data)) return input.data;
    if (Array.isArray(input?.items)) return input.items;
    return [];
  };

  const loadLookups = useCallback(async () => {
    try {
      const [lotDataRaw, configDataRaw, localitesDataRaw] = await Promise.all([
        safeCall(["getLotsList", "getLots"], {}),
        safeCall(["getConfigMunitionsList", "getConfigMunitions", "getConfigMunitionList"], {}),
        safeCall(["getLocalitesList", "getLocalites"], {}),
      ]);
      setLots(normalizeArray(lotDataRaw) || []);
      setConfigs(normalizeArray(configDataRaw) || []);
      setLocalites(normalizeArray(localitesDataRaw) || []);
    } catch (error) {
      message.error("Erreur lors du chargement des référentiels");
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        startDate: filters.period?.[0]?.format("YYYY-MM-DD"),
        endDate: filters.period?.[1]?.format("YYYY-MM-DD"),
        type: filters.type,
        calibre: filters.calibre,
        statut: filters.statut,
        lot_id: filters.lot_id,
      };
      let list = await safeCall(["getMunitionsList", "getMunitions", "getMunitionList"], params);
      let rows = normalizeArray(list);
      if (!rows && api?.call) {
        rows = normalizeArray(await api.call("getMunitionsList", params).catch(() => null));
      }
      if (!rows) {
        const query = new URLSearchParams(
          Object.entries(params).filter(([, value]) => value != null && value !== "")
        ).toString();
        rows = normalizeArray(await fetchJson(`/api/munitions${query ? `?${query}` : ""}`));
      }
      setRawData(rows || []);
    } catch (error) {
      console.error("load munitions", error);
      message.error("Erreur lors du chargement des munitions");
      setRawData([]);
    } finally {
      setLoading(false);
    }
  }, [filters, api]);

  useEffect(() => {
    loadLookups();
    loadData();
  }, [loadLookups, loadData]);

  useEffect(() => {
    const subset = rawData.filter(row => {
      if (filters.type && (row.type || row.type_munition) !== filters.type) return false;
      if (filters.calibre && (row.calibre || row.calibre_munition) !== filters.calibre) return false;
      if (filters.statut && row.statut !== filters.statut) return false;
      if (filters.lot_id && String(row.lot_id || row.lot) !== String(filters.lot_id)) return false;
      if (filters.localite_id && String(row.localite_id) !== String(filters.localite_id)) return false;
      
      // Filtre par état de stock
      if (filters.seuil_critique) {
        const stock = row.stock_disponible || 0;
        const seuil = row.seuil_critique || 0;
        if (filters.seuil_critique === "rupture" && stock > 0) return false;
        if (filters.seuil_critique === "critique" && (stock <= 0 || stock > seuil)) return false;
        if (filters.seuil_critique === "normal" && stock <= seuil) return false;
      }

      if (filters.period?.length === 2) {
        const date = row.date_entree || row.created_at;
        if (date) {
          const m = moment(date);
          if (m.isBefore(filters.period[0], "day") || m.isAfter(filters.period[1], "day")) return false;
        }
      }
      return true;
    });
    setFiltered(subset.map((row, index) => ({ ...row, __rowNumber: index + 1 })));
  }, [rawData, filters, localites]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const columnsDef = useMemo(() => {
    const lotMap = new Map(lots.map(l => [String(l.id), l.designation]));
    return {
      rowNumber: {
        title: "N°",
        dataIndex: "__rowNumber",
        width: 70,
        align: "center",
        fixed: "left",
        print: (record) => record.__rowNumber || "—",
      },
      reference: {
        title: "Référence",
        dataIndex: "reference",
        width: 120,
        fixed: "left",
        sorter: (a, b) => (a.reference || "").localeCompare(b.reference || ""),
        render: (_, row) => <strong>{row.reference || row.code || "—"}</strong>,
      },
      designation: {
        title: "Munition",
        dataIndex: "designation",
        width: 180,
        ellipsis: true,
        render: (_, row) => {
          const config = configMap.get(String(row.config_munition_id));
          return config?.designation || row.designation || "—";
        },
      },
      type: {
        title: "Type",
        dataIndex: "type",
        width: 100,
        render: (_, row) => {
          const type = row.type || row.type_munition || "—";
          return <Tag color="blue">{type}</Tag>;
        },
      },
      calibre: {
        title: "Calibre",
        dataIndex: "calibre", 
        width: 90,
        render: (_, row) => {
          const calibre = row.calibre || row.calibre_munition || "—";
          return <Tag color="green">{calibre}</Tag>;
        },
      },
      stock_disponible: {
        title: "Stock",
        dataIndex: "stock_disponible",
        width: 100,
        align: "right",
        sorter: (a, b) => (a.stock_disponible || 0) - (b.stock_disponible || 0),
        render: (_, row) => {
          const stock = row.stock_disponible || row.quantite || 0;
          const seuil = row.seuil_critique || 0;
          let color = "green";
          if (stock <= 0) color = "red";
          else if (stock <= seuil) color = "orange";
          return <Tag color={color}>{stock}</Tag>;
        },
      },
      seuil_critique: {
        title: "Seuil",
        dataIndex: "seuil_critique",
        width: 80,
        align: "right",
        render: (_, row) => row.seuil_critique || 0,
      },
      localite: {
        title: "Localité",
        dataIndex: "localite_id",
        width: 140,
        render: (localiteId) => {
          const localite = localites.find(l => l.id === localiteId);
          return localite?.nom || "—";
        },
      },
      date_entree: {
        title: "Entrée",
        dataIndex: "date_entree",
        width: 100,
        render: (_, row) => {
          const date = row.date_entree || row.created_at;
          return date ? moment(date).format("DD/MM/YY") : "—";
        },
      },
      date_peremption: {
        title: "Péremption",
        dataIndex: "date_peremption",
        width: 100,
        render: (_, row) => {
          const date = row.date_peremption;
          if (!date) return "—";
          const m = moment(date);
          const isExpired = m.isBefore(moment());
          const color = isExpired ? "red" : "default";
          return <Tag color={color}>{m.format("DD/MM/YY")}</Tag>;
        },
      },
      statut_alerte: {
        title: "État",
        dataIndex: "statut_alerte",
        width: 90,
        render: (_, row) => {
          const stock = row.stock_disponible || 0;
          const seuil = row.seuil_critique || 0;
          if (stock <= 0) return <Tag color="red">Rupture</Tag>;
          if (stock <= seuil) return <Tag color="orange">Critique</Tag>;
          return <Tag color="green">Normal</Tag>;
        },
      },
    };
  }, [lots, configMap, uniqueTypes, uniqueCalibres]);

  const baseColumns = useMemo(
  () =>
    columnOrder
      .filter(key => key === "rowNumber" || visibleColumns.includes(key))
      .map(key => columnsDef[key])
      .filter(Boolean),
  [columnOrder, visibleColumns, columnsDef]
  );

  const tableColumns = useMemo(
    () => [
      ...baseColumns,
      {
        title: "Historique",
        key: "history",
        width: 110,
        render: (_, row) => (
          <Button
            size="small"
            onClick={() => navigate(`/dashboard/munition/history/${row.id}`)}
          >
            Mouvements
          </Button>
        ),
      },
      {
        title: "Alertes",
        key: "alerts",
        width: 110,
        render: (_, row) => (
          <Button
            size="small"
            onClick={() => navigate(`/dashboard/munition/alerts/${row.id}`)}
          >
            Alertes
          </Button>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        fixed: "right",
        width: 150,
        render: (_, row) => (
          <Space>
            <Button size="small" onClick={() => navigate(`/dashboard/munition/edit/${row.id}`)}>
              Modifier
            </Button>
          </Space>
        ),
      },
    ],
    [baseColumns, navigate]
  );

  const dimensionStats = useMemo(() => {
    return Object.entries(DIMENSION_DEFINITIONS).reduce((acc, [key, def]) => {
      if (!statDimensions.includes(key)) return acc;
      const counter = new Map();
      filtered.forEach(row => {
        const value = def.accessor(row);
        counter.set(value, (counter.get(value) || 0) + 1);
      });
      acc.push({
        key,
        label: def.label,
        data: Array.from(counter, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      });
      return acc;
    }, []);
  }, [filtered, statDimensions]);

  const applyTokens = useCallback(
    (value, total = filtered.length) =>
      (value || "")
        .replace(/\{\{date\}\}/g, moment().format("DD/MM/YYYY"))
        .replace(/\{\{total\}\}/g, String(total)),
    [filtered.length]
  );

  const buildPrintableSummary = useCallback(
    (records) => `
      <div class="print-summary">
        <h2>Inventaire des munitions</h2>
        <div><strong>Période :</strong> ${
          filters.period?.length === 2
            ? `${filters.period[0].format("DD/MM/YYYY")} → ${filters.period[1].format("DD/MM/YYYY")}`
            : "Non précisée"
        }</div>
        <div><strong>Type :</strong> ${filters.type || "Tous"}</div>
        <div><strong>Calibre :</strong> ${filters.calibre || "Tous"}</div>
        <div><strong>Statut :</strong> ${filters.statut || "Tous"}</div>
        <div><strong>Total filtré :</strong> ${records.length}</div>
      </div>
    `,
    [filters]
  );

  const renderHeaderFooterHTML = useCallback(cfg => {
    if (!cfg) return { entete: "", pied: "" };
    const separator = cfg.separator
      ? `<div style="font-weight:bold;color:${cfg.separatorColor || "#222"};">${cfg.separator.repeat(cfg.separatorLength || 12)}</div>`
      : "";
    const entete = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div style="flex:2;min-width:160px;text-align:${cfg.minInstitAlign || "left"};">
          ${cfg.ministere ? `<div style="font-weight:bold;font-size:${cfg.ministereFontSize || 16}px;">${cfg.ministere}</div>` : ""}
          ${separator}
          ${(cfg.institutions || []).map(inst => `
            <div style="
              font-weight:${inst.bold ? "bold" : "normal"};
              font-style:${inst.italic ? "italic" : "normal"};
              text-decoration:${inst.underline ? "underline" : "none"};
              color:${inst.color || "#222"};
              font-size:${cfg.institFontSize || 14}px;">
              ${inst.text || ""}
            </div>`).join(separator)}
        </div>
        <div style="flex:1;text-align:center;">
          ${cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="logo" style="max-height:60px;" />` : ""}
        </div>
        <div style="flex:1;min-width:160px;text-align:${cfg.styleOptions?.pays?.align || "right"};">
          ${cfg.pays ? `<div style="
              font-weight:${cfg.styleOptions?.pays?.bold ? "bold" : "normal"};
              font-style:${cfg.styleOptions?.pays?.italic ? "italic" : "normal"};
              text-decoration:${cfg.styleOptions?.pays?.underline ? "underline" : "none"};
              color:${cfg.styleOptions?.pays?.color || "#222"};
              font-size:${cfg.styleOptions?.pays?.fontSize || 14}px;">
              ${cfg.pays}
            </div>` : ""}
          ${cfg.styleOptions?.paysSeparator?.char ? `<div style="
              color:${cfg.styleOptions.paysSeparator.color || "#222"};
              font-weight:${cfg.styleOptions.paysSeparator.bold ? "bold" : "normal"};
              font-style:${cfg.styleOptions.paysSeparator.italic ? "italic" : "normal"};
              text-decoration:${cfg.styleOptions.paysSeparator.underline ? "underline" : "none"};
              font-size:${cfg.styleOptions.paysSeparator.fontSize || 12}px;">
              ${cfg.styleOptions.paysSeparator.char.repeat(cfg.styleOptions.paysSeparator.count || 10)}
            </div>` : ""}
          ${cfg.devise ? `<div style="
              font-style:${cfg.styleOptions?.devise?.italic ? "italic" : "normal"};
              font-weight:${cfg.styleOptions?.devise?.bold ? "bold" : "normal"};
              text-decoration:${cfg.styleOptions?.devise?.underline ? "underline" : "none"};
              color:${cfg.styleOptions?.devise?.color || "#222"};
              font-size:${cfg.styleOptions?.devise?.fontSize || 12}px;">
              ${cfg.devise}
            </div>` : ""}
        </div>
      </div>
    `;
    const pied = cfg.signataire ? `
      <div style="display:flex;justify-content:${cfg.signataireAlign || "right"};margin-top:24px;">
        <div style="text-align:${cfg.signataireAlign || "right"};margin-top:${cfg.signataireOffsetY || 0}px;">
          ${cfg.signataire ? `<div>${cfg.signataire}</div>` : ""}
          ${cfg.grade ? `<div>${cfg.grade}</div>` : ""}
          ${cfg.titre ? `<div>${cfg.titre}</div>` : ""}
          ${cfg.signatureUrl ? `<img src="${cfg.signatureUrl}" alt="signature" style="max-height:48px;" />` : ""}
        </div>
      </div>
    ` : "";
    return { entete, pied };
  }, []);

  const getDocumentTitle = useCallback(() => {
    if (headerFooterConfig?.documentTitle || headerFooterConfig?.headerTitle) {
      return headerFooterConfig.documentTitle || headerFooterConfig.headerTitle;
    }
    const parts = ["Inventaire des munitions"];
    if (filters.type) parts.push(`Type: ${filters.type}`);
    if (filters.calibre) parts.push(`Calibre: ${filters.calibre}`);
    if (filters.statut) parts.push(`Statut: ${filters.statut}`);
    if (filters.lot_id) {
      const lot = lots.find(l => String(l.id) === String(filters.lot_id));
      if (lot) parts.push(`Lot: ${lot.designation || `#${lot.id}`}`);
    }
    if (filters.localite_id) {
      const loc = localites.find(l => String(l.id) === String(filters.localite_id));
      if (loc) parts.push(`Localité: ${loc.nom}`);
    }
    if (filters.seuil_critique) parts.push(`État stock: ${filters.seuil_critique}`);
    return parts.join(" — ");
  }, [headerFooterConfig, filters, lots, localites]);

  const buildSummaryLines = useCallback(dataset => {
    const lines = [`Total: ${dataset.length}`];
    if (filters.period?.length === 2) {
      lines.push(`Période: ${filters.period[0].format("DD/MM/YYYY")} → ${filters.period[1].format("DD/MM/YYYY")}`);
    }
    if (filters.type) lines.push(`Type: ${filters.type}`);
    if (filters.calibre) lines.push(`Calibre: ${filters.calibre}`);
    if (filters.statut) lines.push(`Statut: ${filters.statut}`);
    if (filters.lot_id) {
      const lot = lots.find(l => String(l.id) === String(filters.lot_id));
      if (lot) lines.push(`Lot: ${lot.designation || `#${lot.id}`}`);
    }
    if (filters.localite_id) {
      const loc = localites.find(l => String(l.id) === String(filters.localite_id));
      if (loc) lines.push(`Localité: ${loc.nom}`);
    }
    if (filters.seuil_critique) lines.push(`État stock: ${filters.seuil_critique}`);
    return lines;
  }, [filters, lots, localites]);

  const buildPrintableMarkup = useCallback((dataset) => {
    const { entete, pied } = renderHeaderFooterHTML(headerFooterConfig);
    const title = getDocumentTitle();
    const summaryLines = buildSummaryLines(dataset);
    const headRow = baseColumns.map(col => `<th>${col.title}</th>`).join("");
    const bodyRows = dataset.length
      ? dataset.map(row => `<tr>${
          baseColumns.map(col => `<td>${(col.print ? col.print(row) : row[col.dataIndex]) ?? "—"}</td>`).join("")
        }</tr>`).join("")
      : `<tr><td colspan="${Math.max(1, baseColumns.length)}">Aucune donnée</td></tr>`;
    return `
      ${entete}
      <div style="text-align:center;margin:12px 0 18px 0;">
        <h1 style="margin:0;font-size:20px;">${title}</h1>
      </div>
      <table class="print-table">
        <thead><tr>${headRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${summaryLines.length ? `<div style="margin-top:12px;font-size:13px;">${summaryLines.map(l => `<div>${l}</div>`).join("")}</div>` : ""}
      ${pied}
    `;
  }, [renderHeaderFooterHTML, headerFooterConfig, getDocumentTitle, buildSummaryLines, baseColumns]);

  const handlePrint = useCallback(
    (records = filtered) => {
      if (!baseColumns.length) {
        message.warning("Aucune colonne sélectionnée pour l’impression");
        return;
      }
      if (!records.length) {
        message.warning("Aucune donnée à imprimer");
        return;
      }
      const markup = buildPrintableMarkup(records);
      const win = window.open("", "_blank", "width=1200,height=900");
      if (!win) return;
      win.document.write(`
        <html>
          <head>
            <title>${getDocumentTitle()}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #1f2f25; }
              .print-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              .print-table th, .print-table td { border: 1px solid #9bb6a1; padding: 6px 8px; font-size: 12px; text-align: left; }
              .print-table th { background: #e3f1e6; text-transform: uppercase; letter-spacing: 0.6px; }
            </style>
          </head>
          <body>${markup}</body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    },
    [baseColumns, buildPrintableMarkup, filtered, getDocumentTitle]
  );

  const exportToWord = useCallback(
    (records = filtered) => {
      if (!baseColumns.length) {
        message.warning("Sélectionnez au moins une colonne");
        return;
      }
      if (!records.length) {
        message.warning("Aucune donnée à exporter");
        return;
      }
      const title = getDocumentTitle();
      const summaryLines = buildSummaryLines(records);
      const headerRow = new TableRow({
        children: baseColumns.map(col =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(col.title), bold: true })] })],
          })
        ),
      });
      const bodyRows = records.map(record =>
        new TableRow({
          children: baseColumns.map(col => {
            const value = col.print ? col.print(record) : record[col.dataIndex];
            return new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: String(value ?? "—") })] })],
            });
          }),
        })
      );
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: title, heading: "Heading1", alignment: AlignmentType.CENTER }),
              new Paragraph({ text: " " }),
              new DocxTable({ rows: [headerRow, ...bodyRows] }),
              ...(summaryLines.length ? [new Paragraph({ text: " " }), ...summaryLines.map(line => new Paragraph({ text: line }))] : []),
              ...(headerFooterConfig?.signataire
                ? [
                    new Paragraph({ text: " " }),
                    new Paragraph({ text: headerFooterConfig.signataire, alignment: AlignmentType.RIGHT }),
                    headerFooterConfig.grade ? new Paragraph({ text: headerFooterConfig.grade, alignment: AlignmentType.RIGHT }) : null,
                    headerFooterConfig.titre ? new Paragraph({ text: headerFooterConfig.titre, alignment: AlignmentType.RIGHT }) : null,
                  ].filter(Boolean)
                : []),
            ],
          },
        ],
      });
      Packer.toBlob(doc)
        .then(blob => saveAs(blob, "munitions.docx"))
        .then(() => message.success("Export Word généré"))
        .catch(() => message.error("Échec de l’export Word"));
    },
    [baseColumns, filtered, getDocumentTitle, buildSummaryLines, headerFooterConfig]
  );

  const previewData = useMemo(() => {
    if (!previewSearch) return filtered;
    const needle = previewSearch.toLowerCase();
    return filtered
      .filter(row =>
        baseColumns.some(col => {
          const value = col.print ? col.print(row) : row[col.dataIndex];
          return String(value ?? "").toLowerCase().includes(needle);
        })
      )
      .map((row, index) => ({ ...row, __rowNumber: index + 1 }));
  }, [filtered, baseColumns, previewSearch]);

  useEffect(() => {
    if (!previewVisible) setPreviewSearch("");
  }, [previewVisible]);

  const toggleColumnVisibility = useCallback((key) => {
    if (key === "rowNumber") return;
    setVisibleColumns(prev =>
      prev.includes(key)
        ? prev.filter(item => item !== key)
        : [...prev, key]
    );
  }, []);

  const moveColumn = useCallback((key, direction) => {
    setColumnOrder(prev => {
      if (key === "rowNumber") return prev;
      const index = prev.indexOf(key);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 1 || nextIndex >= prev.length) return prev;
      const clone = [...prev];
      [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
      return clone;
    });
  }, []);

  const resetColumnOrder = useCallback(() => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setVisibleColumns(DEFAULT_COLUMN_KEYS);
  }, []);

  const resetFilters = () => {
    setFilters({
      period: null,
      type: undefined,
      calibre: undefined,
      statut: undefined,
      lot_id: undefined,
      localite_id: undefined,
      seuil_critique: undefined,
    });
    form.resetFields();
  };

  useEffect(() => {
    (async () => {
      try {
        const configs = await api.getAppConfigList();
        const found = configs.find(c => c.nom_param === "header_footer");
        if (found?.valeur) {
          const parsed = JSON.parse(found.valeur);
          setHeaderFooterConfig(parsed);
        }
      } catch {
        /* noop */
      }
    })();
  }, []);

  return (
    <div className="munition-list-page">
      <div className="munition-list-overlay" />
      <Card className="munition-list-shell" variant="borderless">
        <div className="munition-list-header">
          <div>
            <Title level={3} className="munition-list-title">Gestion des munitions</Title>
            <Text className="munition-list-subtitle">
              Surveillez vos stocks de munitions, filtrez par type et calibre, exportez vos états.
            </Text>
          </div>
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/dashboard/munition/add")}
            >
              Nouveau stock
            </Button>
            <Button 
              icon={<FileTextOutlined />} 
              onClick={() => navigate("/munition/gestion-stock")}
            >
              Gestion stock
            </Button>
            <Button icon={<ProfileOutlined />} onClick={() => setPreviewVisible(true)}>
              Aperçu & impression
            </Button>
            <Button icon={<ColumnWidthOutlined />} onClick={() => setColumnModalVisible(true)}>
              Colonnes
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Actualiser
            </Button>
          </Space>
        </div>

        <Card className="munition-list-filters" size="small">
          <Form form={form} initialValues={filters}>
            <Row gutter={12}>
              <Col xs={24} md={6}>
                <Form.Item name="period" noStyle>
                  <RangePicker
                    value={filters.period}
                    onChange={(value) => handleFilterChange("period", value)}
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Type"
                  value={filters.type}
                  onChange={(value) => handleFilterChange("type", value)}
                  style={{ width: "100%" }}
                >
                  {uniqueTypes.map(type => <Option key={type}>{type}</Option>)}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Calibre"
                  value={filters.calibre}
                  onChange={(value) => handleFilterChange("calibre", value)}
                  style={{ width: "100%" }}
                >
                  {uniqueCalibres.map(calibre => <Option key={calibre}>{calibre}</Option>)}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Statut"
                  value={filters.statut}
                  onChange={(value) => handleFilterChange("statut", value)}
                  style={{ width: "100%" }}
                >
                  {uniqueStatuts.map(statut => <Option key={statut}>{statut}</Option>)}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Lot"
                  value={filters.lot_id}
                  onChange={(value) => handleFilterChange("lot_id", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {lots.map(lot => (
                    <Option key={lot.id} value={lot.id}>
                      {lot.designation || `Lot #${lot.id}`}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Localité"
                  value={filters.localite_id}
                  onChange={(value) => handleFilterChange("localite_id", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {localites.map(localite => (
                    <Option key={localite.id} value={localite.id}>
                      {localite.nom}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="État stock"
                  value={filters.seuil_critique}
                  onChange={(value) => handleFilterChange("seuil_critique", value)}
                  style={{ width: "100%" }}
                >
                  <Option value="rupture">Rupture</Option>
                  <Option value="critique">Critique</Option>
                  <Option value="normal">Normal</Option>
                </Select>
              </Col>
            </Row>
          </Form>
        </Card>

        <Row gutter={16} className="munition-list-advanced">
          {dimensionStats.map(dimension => (
            <Col xs={24} md={12} key={dimension.key}>
              <Card
                size="small"
                className="munition-list-dimension-card"
                title={dimension.label}
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  {dimension.data.slice(0, 6).map(item => (
                    <div key={item.name} className="munition-list-dimension-entry">
                      <div className="munition-list-dimension-entry__header">
                        <span className="munition-list-dimension-entry__label">{item.name}</span>
                        <span className="munition-list-dimension-entry__value">{item.value}</span>
                      </div>
                      <div className="munition-list-dimension-entry__bar">
                        <div
                          className="munition-list-dimension-entry__bar-fill"
                          style={{ width: `${(item.value / Math.max(1, filtered.length)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <div className="munition-list-reset-bar">
          <Button icon={<FilterOutlined />} onClick={resetFilters}>
            Réinitialiser les filtres
          </Button>
        </div>

        <Card className="munition-list-table-card" size="small" variant="borderless">
          <Table
            rowKey="id"
            size="middle"
            bordered
            loading={loading}
            columns={tableColumns}
            dataSource={filtered}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: "max-content" }}
          />
        </Card>

        <Card className="munition-list-preview-card" size="small" variant="borderless">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Text strong>Aperçu dynamique</Text>
            <Text type="secondary">
              Préparez vos exports et impressions depuis l’aperçu détaillé.
            </Text>
            <Space wrap>
              <Button
                type="primary"
                icon={<ProfileOutlined />}
                onClick={() => setPreviewVisible(true)}
              >
                Ouvrir l’aperçu détaillé
              </Button>
              <Button icon={<PrinterOutlined />} onClick={() => handlePrint()}>
                Imprimer directement
              </Button>
              <Button icon={<FileExcelOutlined />} onClick={() => exportToExcel()}>
                Exporter en Excel
              </Button>
              <Button icon={<FileWordOutlined />} onClick={() => exportToWord()}>
                Exporter en Word
              </Button>
            </Space>
          </Space>
        </Card>

        <div
          ref={printRef}
          style={{ display: "none" }}
          dangerouslySetInnerHTML={{ __html: buildPrintableMarkup(filtered) }}
        />

        <Modal
          open={previewVisible}
          title="Aperçu détaillé"
          width="90%"
          footer={null}
          destroyOnClose
          onCancel={() => setPreviewVisible(false)}
        >
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Row gutter={[12, 12]} justify="space-between" align="middle">
              <Col xs={24} lg={10}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Rechercher dans le tableau"
                  value={previewSearch}
                  onChange={(event) => setPreviewSearch(event.target.value)}
                />
              </Col>
              <Col xs={24} lg={14}>
                <Space wrap>
                  <Button icon={<ReloadOutlined />} onClick={loadData}>
                    Rafraîchir
                  </Button>
                  <Button
                    type="primary"
                    icon={<PrinterOutlined />}
                    onClick={() => handlePrint(previewData)}
                  >
                    Imprimer
                  </Button>
                  <Button
                    icon={<FileExcelOutlined />}
                    onClick={() => exportToExcel(previewData)}
                  >
                    Export Excel
                  </Button>
                  <Button
                    icon={<FileWordOutlined />}
                    onClick={() => exportToWord(previewData)}
                  >
                    Export Word
                  </Button>
                </Space>
              </Col>
            </Row>
            <Table
              rowKey="id"
              size="middle"
              bordered
              columns={tableColumns}
              dataSource={previewData}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: "max-content", y: 420 }}
            />
          </Space>
        </Modal>

        <Modal
          open={columnModalVisible}
          title="Colonnes du tableau"
          width={520}
          footer={null}
          destroyOnClose
          onCancel={() => setColumnModalVisible(false)}
          className="munition-columns-modal"
        >
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {columnOrder.map((key, index) => {
              const label = COLUMN_LABELS[key] || key;
              const locked = key === "rowNumber";
              const visible = key === "rowNumber" || visibleColumns.includes(key);
              return (
                <div key={key} className={`munition-columns-modal__item ${visible ? "is-active" : ""}`}>
                  <span className="munition-columns-modal__label">{label}</span>
                  <Space size={4}>
                    <Tooltip title={visible ? "Masquer" : "Afficher"}>
                      <Button
                        size="small"
                        icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => toggleColumnVisibility(key)}
                        disabled={locked}
                      />
                    </Tooltip>
                    <Tooltip title="Monter">
                      <Button
                        size="small"
                        icon={<UpOutlined />}
                        onClick={() => moveColumn(key, -1)}
                        disabled={locked || index <= 1}
                      />
                    </Tooltip>
                    <Tooltip title="Descendre">
                      <Button
                        size="small"
                        icon={<DownOutlined />}
                        onClick={() => moveColumn(key, 1)}
                        disabled={locked || index === columnOrder.length - 1}
                      />
                    </Tooltip>
                  </Space>
                </div>
              );
            })}
            <Button type="link" onClick={resetColumnOrder} className="munition-columns-modal__reset">
              Réinitialiser l’ordre par défaut
            </Button>
          </Space>
        </Modal>
      </Card>
    </div>
  );
}

export default MunitionList;
