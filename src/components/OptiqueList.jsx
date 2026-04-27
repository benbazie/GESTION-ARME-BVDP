// src/components/OptiqueList.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Form,
  Input,
  Modal,
  Typography,
  message,
} from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  ProfileOutlined,
  PrinterOutlined,
  FileExcelOutlined,
  ColumnWidthOutlined,
  SearchOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  UpOutlined,
  DownOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import moment from "moment";
import "./MunitionList.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import resolveApiBase from "../utils/resolveApiBase";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text, Title } = Typography;

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

const getAuthToken = async () => {
  try {
    const stored = localStorage.getItem("auth-token") || localStorage.getItem("auth_token");
    if (stored) return stored;
  } catch {}
  const bridge = await waitForElectronAPI();
  if (bridge) {
    try {
      if (typeof bridge.getToken === "function") {
        const value = await bridge.getToken();
        if (value) return value;
      }
    } catch {}
    try {
      if (typeof bridge.call === "function") {
        const value = await bridge.call("getToken");
        if (value) return value;
      }
    } catch {}
  }
  return null;
};

const fetchJson = async (endpoint, params = {}, options = {}) => {
  const base = resolveApiBase();
  const cleanedBase = base.replace(/\/$/, "");
  let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (cleanedBase.endsWith("/api") && path.startsWith("/api")) {
    path = path.replace(/^\/api/, "");
  }
  if (!path.startsWith("/")) path = `/${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = await getAuthToken();
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

const normalizeArray = input => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.rows)) return input.rows;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.items)) return input.items;
  return [];
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
  "designation",
  "type",
  "categorie",
  "numero_serie",
  "etat",
  "entite",
  "region",
  "date_entree",
  "date_sortie",
];

const DEFAULT_COLUMN_ORDER = [...DEFAULT_COLUMN_KEYS];

const COLUMN_LABELS = {
  rowNumber: "N°",
  designation: "Désignation",
  type: "Type",
  categorie: "Catégorie",
  numero_serie: "N° Série",
  etat: "État",
  entite: "Entité",
  region: "Région",
  date_entree: "Entrée",
  date_sortie: "Sortie",
};

const DIMENSION_DEFINITIONS = {
  type: { label: "Répartition par type", accessor: row => row.type || "Non renseigné" },
  categorie: { label: "Répartition par catégorie", accessor: row => row.categorie || "Non renseignée" },
  etat: { label: "Répartition par état", accessor: row => row.etat || "Indéfini" },
};

function OptiqueList() {
  const [form] = Form.useForm();
  const [rawData, setRawData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);

  const [configs, setConfigs] = useState([]);
  const [entites, setEntites] = useState([]);
  const [regions, setRegions] = useState([]);

  const [filters, setFilters] = useState({
    period: null,
    type: undefined,
    categorie: undefined,
    etat: undefined,
    entite_id: undefined,
  });

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMN_KEYS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");
  const [columnModalVisible, setColumnModalVisible] = useState(false);
  const [headerFooterConfig, setHeaderFooterConfig] = useState({});
  const navigate = useNavigate();

  const configMap = useMemo(
    () => new Map(configs.map(cfg => [String(cfg.id), cfg])),
    [configs]
  );
  const entiteMap = useMemo(
    () => new Map(entites.map(item => [String(item.id), item.nom])),
    [entites]
  );
  const regionMap = useMemo(
    () => new Map(regions.map(item => [String(item.id), item.nom])),
    [regions]
  );

  const enrichedData = useMemo(
    () =>
      rawData.map((row, index) => {
        const cfg = configMap.get(String(row.config_optique_id)) || {};
        return {
          ...row,
          __rowNumber: index + 1,
          designation: row.designation || cfg.designation || "—",
          type: row.type || cfg.type || "—",
          categorie: row.categorie || cfg.categorie || "—",
          entite: row.entite || entiteMap.get(String(row.entite_id)) || "—",
          region: row.region || regionMap.get(String(row.region_id)) || "—",
        };
      }),
    [rawData, configMap, entiteMap, regionMap]
  );

  const uniqueTypes = useMemo(
    () => Array.from(new Set(enrichedData.map(item => item.type).filter(Boolean))).sort(),
    [enrichedData]
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(enrichedData.map(item => item.categorie).filter(Boolean))).sort(),
    [enrichedData]
  );
  const uniqueEtats = useMemo(
    () => Array.from(new Set(enrichedData.map(item => item.etat).filter(Boolean))).sort(),
    [enrichedData]
  );

  const dimensionStats = useMemo(() => {
    return Object.entries(DIMENSION_DEFINITIONS).map(([key, def]) => {
      const counter = new Map();
      filtered.forEach(row => {
        const value = def.accessor(row);
        counter.set(value, (counter.get(value) || 0) + 1);
      });
      return {
        key,
        label: def.label,
        data: Array.from(counter, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
      };
    });
  }, [filtered]);

  const tableColumns = useMemo(() => {
    const base = columnOrder
      .filter(key => key === "rowNumber" || visibleColumns.includes(key))
      .map(key => {
        switch (key) {
          case "rowNumber":
            return { title: "N°", dataIndex: "__rowNumber", key: "rowNumber", width: 70, align: "center", fixed: "left" };
          case "designation":
            return { title: "Désignation", dataIndex: "designation", key: "designation", ellipsis: true, width: 200 };
          case "type":
            return { title: "Type", dataIndex: "type", key: "type", width: 150 };
          case "categorie":
            return { title: "Catégorie", dataIndex: "categorie", key: "categorie", width: 150 };
          case "numero_serie":
            return { title: "N° Série", dataIndex: "numero_serie", key: "numero_serie", width: 180 };
          case "etat":
            return {
              title: "État",
              dataIndex: "etat",
              key: "etat",
              width: 130,
              render: value => <Tag color={value === "Doté" ? "green" : "gold"}>{value || "—"}</Tag>,
            };
          case "entite":
            return { title: "Entité", dataIndex: "entite", key: "entite", width: 200 };
          case "region":
            return { title: "Région", dataIndex: "region", key: "region", width: 160 };
          case "date_entree":
            return {
              title: "Entrée",
              dataIndex: "date_entree",
              key: "date_entree",
              width: 140,
              render: value => (value ? moment(value).format("DD/MM/YYYY") : "—"),
            };
          case "date_sortie":
            return {
              title: "Sortie",
              dataIndex: "date_sortie",
              key: "date_sortie",
              width: 140,
              render: value => (value ? moment(value).format("DD/MM/YYYY") : "—"),
            };
          default:
            return null;
        }
      })
      .filter(Boolean);

    base.push({
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/dashboard/optique/edit/${record.id}`)}>
            Modifier
          </Button>
          <Button size="small" onClick={() => navigate(`/dashboard/dotation-optique?optique=${record.id}`)}>
            Historique
          </Button>
        </Space>
      ),
    });

    return base;
  }, [columnOrder, visibleColumns]);

  const printableColumns = useMemo(() => tableColumns.filter(col => col.key !== "actions"), [tableColumns]);

  const fetchConfigs = useCallback(async () => {
    const raw = await safeCall(["getConfigOptiqueList", "getConfigOptiques", "getConfigOptique"]).catch(
      () => null
    );
    if (raw) {
      setConfigs(normalizeArray(raw));
      return;
    }
    const http = await fetchJson("/api/config_optique");
    setConfigs(normalizeArray(http));
  }, []);

  const fetchEntites = useCallback(async () => {
    const raw = await safeCall(["getEntitesList", "getEntites"]).catch(() => null);
    if (raw) {
      setEntites(normalizeArray(raw));
      return;
    }
    const http = await fetchJson("/api/entites");
    setEntites(normalizeArray(http));
  }, []);

  const fetchRegions = useCallback(async () => {
    const raw = await safeCall(["getRegionsList", "getRegions"]).catch(() => null);
    if (raw) {
      setRegions(normalizeArray(raw));
      return;
    }
    const http = await fetchJson("/api/regions");
    setRegions(normalizeArray(http));
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        startDate: filters.period?.[0]?.format("YYYY-MM-DD"),
        endDate: filters.period?.[1]?.format("YYYY-MM-DD"),
        type: filters.type,
        categorie: filters.categorie,
        etat: filters.etat,
        entite_id: filters.entite_id,
      };
      let list = await safeCall(["getOptiquesList", "getOptiques", "getOptiqueList"], params);
      let array = normalizeArray(list);

      if (!array.length) {
        const httpList = await api.getOptiquesList(params).catch(() => []);
        array = normalizeArray(httpList);
      }

      if (!array.length) {
        const restList = await fetchJson("/api/optiques", params).catch(() => []);
        array = normalizeArray(restList);
      }

      if (!array.length) {
        message.warning("Aucune optique trouvée dans la base.");
      }

      setRawData(array);
    } catch (err) {
      message.error("Erreur lors du chargement des optiques.");
      setRawData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchConfigs();
    fetchEntites();
    fetchRegions();
  }, [fetchConfigs, fetchEntites, fetchRegions]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const subset = enrichedData.filter(item => {
      if (filters.type && item.type !== filters.type) return false;
      if (filters.categorie && item.categorie !== filters.categorie) return false;
      if (filters.etat && item.etat !== filters.etat) return false;
      if (filters.entite_id && String(item.entite_id) !== String(filters.entite_id)) return false;

      if (filters.period?.length === 2) {
        const date = item.date_entree ? moment(item.date_entree) : null;
        if (date) {
          if (date.isBefore(filters.period[0], "day") || date.isAfter(filters.period[1], "day")) return false;
        }
      }
      return true;
    });
    setFiltered(subset);
  }, [enrichedData, filters]);

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
              font-size:${cfg.styleOptions?.paysSeparator.fontSize || 12}px;">
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
    const fragments = ["Inventaire des optiques"];
    if (filters.type) fragments.push(`Type: ${filters.type}`);
    if (filters.categorie) fragments.push(`Catégorie: ${filters.categorie}`);
    if (filters.etat) fragments.push(`État: ${filters.etat}`);
    if (filters.entite_id) {
      const entite = entites.find(e => String(e.id) === String(filters.entite_id));
      if (entite) fragments.push(`Entité: ${entite.nom}`);
    }
    return fragments.join(" — ");
  }, [headerFooterConfig, filters, entites]);

  const buildSummaryLines = useCallback(dataset => {
    const lines = [`Total: ${dataset.length}`];
    if (filters.period?.length === 2) {
      lines.push(`Période: ${filters.period[0].format("DD/MM/YYYY")} → ${filters.period[1].format("DD/MM/YYYY")}`);
    }
    if (filters.type) lines.push(`Type: ${filters.type}`);
    if (filters.categorie) lines.push(`Catégorie: ${filters.categorie}`);
    if (filters.etat) lines.push(`État: ${filters.etat}`);
    if (filters.entite_id) {
      const entite = entites.find(e => String(e.id) === String(filters.entite_id));
      if (entite) lines.push(`Entité: ${entite.nom}`);
    }
    return lines;
  }, [filters, entites]);

  const buildPrintableMarkup = useCallback((dataset) => {
    const { entete, pied } = renderHeaderFooterHTML(headerFooterConfig);
    const title = getDocumentTitle();
    const summaryLines = buildSummaryLines(dataset);
    const headRow = printableColumns.map(col => `<th>${col.title}</th>`).join("");
    const bodyRows = dataset.length
      ? dataset.map(row => `<tr>${
          printableColumns.map(col => `<td>${col.dataIndex ? row[col.dataIndex] ?? "—" : row[col.key] ?? "—"}</td>`).join("")
        }</tr>`).join("")
      : `<tr><td colspan="${Math.max(1, printableColumns.length)}">Aucune donnée</td></tr>`;
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
  }, [renderHeaderFooterHTML, headerFooterConfig, getDocumentTitle, buildSummaryLines, printableColumns]);

  const printableMarkup = useMemo(() => buildPrintableMarkup(filtered), [buildPrintableMarkup, filtered]);

  const handlePrint = (dataset = filtered) => {
    if (!dataset.length) {
      message.warning("Aucune donnée à imprimer.");
      return;
    }
    const markup = buildPrintableMarkup(dataset);
    const html = `
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
    `;
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const exportToExcel = (dataset = filtered) => {
    if (!dataset.length) {
      message.warning("Aucune donnée à exporter.");
      return;
    }
    const headRow = printableColumns.map(col => `<th>${col.title}</th>`).join("");
    const bodyRows = dataset
      .map(row => {
        const cells = printableColumns.map(col => {
          const value = col.dataIndex ? row[col.dataIndex] : row[col.key];
          return `<td>${String(value ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`;
        });
        return `<tr>${cells.join("")}</tr>`;
      })
      .join("");

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8" /></head>
        <body><table>${headRow}${bodyRows}</table></body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "optiques.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success("Export Excel généré.");
  };

  const exportToWord = (dataset = filtered) => {
    if (!dataset.length) {
      message.warning("Aucune donnée à exporter.");
      return;
    }
    const title = getDocumentTitle();
    const summaryLines = buildSummaryLines(dataset);
    const headerRow = new TableRow({
      children: printableColumns.map(col =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(col.title), bold: true })] })],
        })
      ),
    });
    const bodyRows = dataset.map(row =>
      new TableRow({
        children: printableColumns.map(col => {
          const value = col.dataIndex ? row[col.dataIndex] : row[col.key];
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
      .then(blob => saveAs(blob, "optiques.docx"))
      .then(() => message.success("Export Word généré."))
      .catch(() => message.error("Échec de l’export Word."));
  };

  const previewData = useMemo(() => {
    if (!previewSearch) return filtered;
    const needle = previewSearch.toLowerCase();
    return filtered.filter(row =>
      printableColumns.some(col => {
        const value = col.dataIndex ? row[col.dataIndex] : row[col.key];
        return String(value ?? "").toLowerCase().includes(needle);
      })
    );
  }, [filtered, printableColumns, previewSearch]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      dotees: filtered.filter(item => item.etat === "Doté").length,
      stock: filtered.filter(item => item.etat === "Non doté" || item.etat === "En magasin").length,
    }),
    [filtered]
  );

  const toggleColumnVisibility = key => {
    if (key === "rowNumber") return;
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]
    );
  };

  const moveColumn = (key, direction) => {
    setColumnOrder(prev => {
      const index = prev.indexOf(key);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 1 || nextIndex >= prev.length) return prev;
      const clone = [...prev];
      [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
      return clone;
    });
  };

  const resetColumnOrder = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setVisibleColumns(DEFAULT_COLUMN_KEYS);
  };

  const resetFilters = () => {
    form.resetFields();
    setFilters({
      period: null,
      type: undefined,
      categorie: undefined,
      etat: undefined,
      entite_id: undefined,
    });
  };

  useEffect(() => {
    if (!previewVisible) setPreviewSearch("");
  }, [previewVisible]);

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
            <Title level={3} className="munition-list-title">Gestion des optiques</Title>
            <Text className="munition-list-subtitle">
              Filtrez les optiques par type, état ou entité puis exportez vos tableaux en un clic.
            </Text>
          </div>
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("add")}
            >
              Ajouter une optique
            </Button>
            <Button icon={<ProfileOutlined />} onClick={() => setPreviewVisible(true)}>
              Aperçu & impression
            </Button>
            <Button icon={<ColumnWidthOutlined />} onClick={() => setColumnModalVisible(true)}>
              Colonnes
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchList}
              loading={loading}
            >
              Actualiser
            </Button>
          </Space>
        </div>

        <Card className="munition-list-filters" size="small">
          <Form form={form} initialValues={filters}>
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item name="period" noStyle>
                  <RangePicker
                    value={filters.period}
                    onChange={value => setFilters(prev => ({ ...prev, period: value }))}
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
                  onChange={value => setFilters(prev => ({ ...prev, type: value }))}
                  style={{ width: "100%" }}
                >
                  {uniqueTypes.map(type => (
                    <Option key={type}>{type}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Catégorie"
                  value={filters.categorie}
                  onChange={value => setFilters(prev => ({ ...prev, categorie: value }))}
                  style={{ width: "100%" }}
                >
                  {uniqueCategories.map(cat => (
                    <Option key={cat}>{cat}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="État"
                  value={filters.etat}
                  onChange={value => setFilters(prev => ({ ...prev, etat: value }))}
                  style={{ width: "100%" }}
                >
                  {uniqueEtats.map(etat => (
                    <Option key={etat}>{etat}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Entité"
                  value={filters.entite_id}
                  onChange={value => setFilters(prev => ({ ...prev, entite_id: value }))}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {entites.map(item => (
                    <Option key={item.id} value={item.id}>
                      {item.nom}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
          </Form>
        </Card>

        <Row gutter={16} className="munition-list-advanced">
          {dimensionStats.map(block => (
            <Col xs={24} md={12} key={block.key}>
              <Card size="small" className="munition-list-dimension-card" title={block.label}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  {block.data.map(item => (
                    <div key={item.name} className="munition-list-dimension-entry">
                      <div className="munition-list-dimension-entry__header">
                        <span className="munition-list-dimension-entry__label">{item.name}</span>
                        <span className="munition-list-dimension-entry__value">{item.value}</span>
                      </div>
                      <div className="munition-list-dimension-entry__bar">
                        <div
                          className="munition-list-dimension-entry__bar-fill"
                          style={{
                            width: `${(item.value / Math.max(filtered.length, 1)) * 100}%`,
                          }}
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
          <Space>
            <Button icon={<SearchOutlined />} onClick={resetFilters}>
              Réinitialiser les filtres
            </Button>
            <Text strong>Total : {stats.total} — Dotées : {stats.dotees} — Stock : {stats.stock}</Text>
          </Space>
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
              Retrouvez exactement les mêmes données prêtes à exporter en Word/Excel ou à imprimer.
            </Text>
            <Space wrap>
              <Button type="primary" icon={<ProfileOutlined />} onClick={() => setPreviewVisible(true)}>
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
                  onChange={event => setPreviewSearch(event.target.value)}
                />
              </Col>
              <Col xs={24} lg={14}>
                <Space wrap>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchList}
                  >
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

export default OptiqueList;
