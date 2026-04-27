// src/components/ArmeList.js
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ReloadOutlined,
  PlusOutlined,
  ProfileOutlined,
  SearchOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  PrinterOutlined,
  FilterOutlined,
  SettingOutlined,
  UpOutlined,
  DownOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ColumnWidthOutlined,
  BarChartOutlined,
  FilePdfOutlined,
  TableOutlined
} from "@ant-design/icons";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Tooltip,
  message,
  Form,
  Input,
  Modal,
  Typography,
  Checkbox,
  Descriptions,
} from "antd";
import moment from "moment";
import PrintLayoutConfigModal from "./PrintLayoutConfigModal";
import { loadPrintLayout, savePrintLayout } from "../config/printLayout";
import "./ArmeList.css";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun } from "docx";
import { saveAs } from "file-saver";
import ExportHeaderFooterConfig from './ExportHeaderFooterConfig';
import api from '../api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const DEFAULT_COLUMN_KEYS = [
  "rowNumber",
  "numero_serie",
  "type",
  "categorie",
  "designation",
  "entite_nom",
  "sous_entite_nom",
  "region_nom",
  "province_nom",
  "commune_nom",
  "source_nom",
  "statut",
  "position",
  "mobilite",
  "date_entree",
  "date_sortie",
];

const DEFAULT_COLUMN_ORDER = [...DEFAULT_COLUMN_KEYS];

const COLUMN_LABELS = {
  rowNumber: "N°",
  numero_serie: "N° Série",
  type: "Type",
  categorie: "Cat.",
  designation: "Dés.",
  entite_nom: "Entité",
  sous_entite_nom: "Sous-entité",
  region_nom: "Rég.",
  province_nom: "Prov.",
  commune_nom: "Comm.",
  source_nom: "Source",
  statut: "Statut",
  position: "Position",      // Ajouté
  mobilite: "Mobilité",      // Ajouté
  date_entree: "Entrée",
  date_sortie: "Sortie",
};

const COLUMN_OPTIONS = [
  { label: "Numéro de série", value: "numero_serie" },
  { label: "Type", value: "type" },
  { label: "Catégorie", value: "categorie" },
  { label: "Désignation", value: "designation" },
  { label: "Entité", value: "entite_nom" },
  { label: "Sous-entité", value: "sous_entite_nom" },
  { label: "Région", value: "region_nom" },
  { label: "Province", value: "province_nom" },
  { label: "Commune", value: "commune_nom" },
  { label: "Source", value: "source_nom" },
  { label: "Statut", value: "statut" },
  { label: "Position", value: "position" },
  { label: "Mobilité", value: "mobilite" },
  { label: "Date d'entrée", value: "date_entree" },
  { label: "Date de sortie", value: "date_sortie" },
];
const DEFAULT_DIMENSIONS = [];
const DEFAULT_GEO_LEVELS = [];
const DEFAULT_PRINT_LAYOUT = {
  headerTitle: "Liste des armes",
  headerSubtitle: "",
  footerLeft: "",
  footerRight: "",
};

const makeDimension = (key, label, accessor) => ({ key, label, accessor });

const DIMENSION_DEFINITIONS = [
  makeDimension("type", "Répartition par type", row => row.type || "Non renseigné"),
  makeDimension("categorie", "Répartition par catégorie", row => row.categorie || "Non renseignée"),
  makeDimension("statut", "Répartition par statut", row => row.statut || "Indéfini"),
  makeDimension("designation", "Répartition par désignation", row => row.designation || "Non renseignée"),
  makeDimension("entite_nom", "Répartition par entité", row => row.entite_nom || "Non renseignée"),
  makeDimension("source_nom", "Répartition par source", row => row.source_nom || "Non renseignée")
];

const DIMENSIONS = [
  makeDimension("region", "Région", row => row.region ?? row.region_nom ?? "Non renseignée"),
  makeDimension("province", "Province", row => row.province ?? row.province_nom ?? "Non renseignée"),
  makeDimension("commune", "Commune", row => row.commune ?? row.commune_nom ?? "Non renseignée"),
  makeDimension("entite", "Entité", row => row.entite ?? row.entite_nom ?? "Non renseignée"),
  makeDimension("source_nom", "Source", row => row.source_nom ?? "Non renseignée"),
  makeDimension("type", "Type", row => row.type ?? "Non renseigné"),
  makeDimension("categorie", "Catégorie", row => row.categorie ?? "Non renseignée"),
  makeDimension("statut", "Statut", row => row.statut ?? "Indéfini")
];

const CROSS_GEO_DIMENSIONS = [
  { key: "region_nom", label: "Région" },
  { key: "province_nom", label: "Province" },
  { key: "commune_nom", label: "Commune" },
  { key: "entite_nom", label: "Entité" },
  { key: "sous_entite_nom", label: "Sous-entité" }
];

const CROSS_ARME_DIMENSIONS = [
  { key: "type", label: "Type" },
  { key: "categorie", label: "Catégorie" },
  { key: "designation", label: "Désignation" },
  { key: "source_nom", label: "Source" },
];

// Liste des dimensions croisables (sans doublons)
const CROSS_DIMENSIONS = [
  ...CROSS_GEO_DIMENSIONS,
  ...CROSS_ARME_DIMENSIONS
];

const PIVOT_KEY_SEPARATOR = "__@@__";
const DIMENSION_LABEL_MAP = CROSS_DIMENSIONS.reduce((acc, dim) => {
  acc[dim.key] = dim.label;
  return acc;
}, {});
const formatDimensionLabel = key => DIMENSION_LABEL_MAP[key] || key;
const formatParts = parts =>
  Array.isArray(parts) && parts.length ? parts.join(" | ") : "—";

const buildPivot = (rows, rowDims, colDims) => {
  if (!rowDims.length || !colDims.length || !rows.length) {
    return {
      rowDims,
      colDims,
      rowKeys: [],
      colKeys: [],
      rowParts: new Map(),
      colParts: new Map(),
      cells: new Map(),
      rowTotals: new Map(),
      colTotals: new Map(),
      grandTotal: 0
    };
  }
  const normalise = value => {
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
  };
  const partsFor = (dims, record) => dims.map(dim => normalise(record[dim]));
  const rowKeySet = new Set();
  const colKeySet = new Set();
  const rowParts = new Map();
  const colParts = new Map();
  const cells = new Map();
  let grandTotal = 0;

  rows.forEach(record => {
    const rowPartsCurrent = partsFor(rowDims, record);
    const colPartsCurrent = partsFor(colDims, record);
    const rowKey = rowPartsCurrent.join(PIVOT_KEY_SEPARATOR);
    const colKey = colPartsCurrent.join(PIVOT_KEY_SEPARATOR);
    rowKeySet.add(rowKey);
    colKeySet.add(colKey);
    if (!rowParts.has(rowKey)) rowParts.set(rowKey, rowPartsCurrent);
    if (!colParts.has(colKey)) colParts.set(colKey, colPartsCurrent);
    const rowMap = cells.get(rowKey) || new Map();
    rowMap.set(colKey, (rowMap.get(colKey) || 0) + 1);
    cells.set(rowKey, rowMap);
    grandTotal += 1;
  });

  // Convert to arrays then sort lexicographiquement par parties pour grouper identiques
  const rowKeys = Array.from(rowKeySet);
  const colKeys = Array.from(colKeySet);

  const lexSort = (aParts, bParts) => {
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const a = (aParts[i] || "").toString();
      const b = (bParts[i] || "").toString();
      const cmp = a.localeCompare(b);
      if (cmp !== 0) return cmp;
    }
    return 0;
  };

  rowKeys.sort((a, b) => lexSort(rowParts.get(a) || [], rowParts.get(b) || []));
  colKeys.sort((a, b) => lexSort(colParts.get(a) || [], colParts.get(b) || []));

  const rowTotals = new Map();
  const colTotals = new Map();

  rowKeys.forEach(rowKey => {
    const rowMap = cells.get(rowKey) || new Map();
    const total = colKeys.reduce(
      (acc, colKey) => acc + (rowMap.get(colKey) || 0),
      0
    );
    rowTotals.set(rowKey, total);
  });

  colKeys.forEach(colKey => {
    const total = rowKeys.reduce((acc, rowKey) => {
      const rowMap = cells.get(rowKey);
      return acc + (rowMap?.get(colKey) || 0);
    }, 0);
    colTotals.set(colKey, total);
  });

  return {
    rowDims,
    colDims,
    rowKeys,
    colKeys,
    rowParts,
    colParts,
    cells,
    rowTotals,
    colTotals,
    grandTotal
  };
};

const pivotTableMarkup = pivot => {
  const { rowDims, colDims, rowKeys, colKeys, rowParts, colParts, cells, rowTotals, colTotals, grandTotal } = pivot;
  const rowHeader = rowDims
    .map(dim => `<th>${formatDimensionLabel(dim)}</th>`)
    .join("");
  const colHeader = colKeys
    .map(colKey => `<th>${formatParts(colParts.get(colKey))}</th>`)
    .join("");
  const header = `<tr>${rowHeader}${colHeader}<th>Total</th></tr>`;
  const body = rowKeys
    .map(rowKey => {
      const parts = rowParts.get(rowKey) || [];
      const rowCells = rowDims
        .map((_, index) => `<td>${parts[index] ?? "—"}</td>`)
        .join("");
      const valueCells = colKeys
        .map(colKey => `<td>${(cells.get(rowKey)?.get(colKey) ?? 0)}</td>`)
        .join("");
      const total = rowTotals.get(rowKey) ?? 0;
      return `<tr>${rowCells}${valueCells}<td>${total}</td></tr>`;
    })
    .join("");
  const footer = `<tr><th colspan="${rowDims.length || 1}">Total</th>${colKeys
    .map(colKey => `<th>${colTotals.get(colKey) ?? 0}</th>`)
    .join("")}<th>${grandTotal}</th></tr>`;
  return `<table style="width:100%;border-collapse:collapse;">
    <thead>${header}</thead>
    <tbody>${body || `<tr><td colspan="${rowDims.length + colDims.length + colKeys.length + 1}">Aucune donnée</td></tr>`}</tbody>
    <tfoot>${footer}</tfoot>
  </table>`;
};

const exportPivotToExcel = pivot => {
  const html = `<html><head><meta charset="utf-8" /></head><body>${pivotTableMarkup(pivot)}</body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  saveAs(blob, "analyse_croisee_armes.xls");
};

const exportPivotToPDF = pivot => {
  const doc = new jsPDF("landscape");
  doc.setFontSize(14);
  doc.text("Analyse croisée des armes", 15, 16);
  const head = [
    ...pivot.rowDims.map(formatDimensionLabel),
    ...pivot.colKeys.map(colKey => formatParts(pivot.colParts.get(colKey))),
    "Total"
  ];
  const body = pivot.rowKeys.map(rowKey => {
    const parts = pivot.rowParts.get(rowKey) || [];
    const rowValues = pivot.colKeys.map(
      colKey => pivot.cells.get(rowKey)?.get(colKey) ?? 0
    );
    return [
      ...pivot.rowDims.map((_, index) => parts[index] ?? "—"),
      ...rowValues,
      pivot.rowTotals.get(rowKey) ?? 0
    ];
  });
  const totalsRow = [
    ...(pivot.rowDims.length ? Array(pivot.rowDims.length).fill("Total") : ["Total"]),
    ...pivot.colKeys.map(colKey => pivot.colTotals.get(colKey) ?? 0),
    pivot.grandTotal
  ];
  autoTable(doc, {
    head: [head],
    body: body.length ? [...body, totalsRow] : [totalsRow],
    startY: 24,
    styles: { fontSize: 9, cellPadding: 2 }
  });
  doc.save("analyse_croisee_armes.pdf");
};

const printPivot = ({ content, styles = "" }) => {
  const popup = window.open("", "_blank", "width=1200,height=800");
  if (!popup) return;
  popup.document.write(`
    <html>
      <head>
        <title>Analyse croisée des armes</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #999; padding: 6px 8px; text-align: center; }
          th { background: #e3f1e6; }
          ${styles}
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
};

const computeRowSpanMatrix = pivot => {
  const { rowKeys, rowParts, rowDims } = pivot;
  const spans = rowKeys.map(() => Array(rowDims.length).fill(1));
  rowDims.forEach((_, dimIdx) => {
    let prevValue = null;
    let prevGroup = null;
    let spanStart = 0;
    rowKeys.forEach((rowKey, rowIdx) => {
      const parts = rowParts.get(rowKey) || [];
      const value = parts[dimIdx] ?? "—";
      const groupKey =
        dimIdx === 0
          ? "__root__"
          : rowDims
              .slice(0, dimIdx)
              .map((__, prefixIdx) => parts[prefixIdx] ?? "—")
              .join("|");
      if (rowIdx > 0 && value === prevValue && groupKey === prevGroup) {
        spans[spanStart][dimIdx] += 1;
        spans[rowIdx][dimIdx] = 0;
      } else {
        spanStart = rowIdx;
        spans[rowIdx][dimIdx] = 1;
        prevValue = value;
        prevGroup = groupKey;
      }
    });
  });
  return spans;
};

const CROSS_TABLE_DEFAULTS = {
  rows: ["region_nom"],
  cols: ["type"],
  mergeHeaders: false,
};

function CrossTableDimensionSelector({ rows, cols, setRows, setCols, crossModalFullScreen, setCrossModalFullScreen }) {
  const allDims = [
    ...CROSS_GEO_DIMENSIONS,
    ...CROSS_ARME_DIMENSIONS
  ];
  const availableForRows = allDims.filter(d => !cols.includes(d.key));
  const availableForCols = allDims.filter(d => !rows.includes(d.key));
  return (
    <div style={{ display: "flex", gap: 32, marginBottom: 24, flexWrap: "wrap" }}>
      <div>
        <strong>Lignes :</strong>
        <Select
          mode="multiple"
          style={{ minWidth: 220, maxWidth: 320 }}
          value={rows}
          onChange={setRows}
          placeholder="Choisir dimension(s) ligne"
          options={availableForRows.map(d => ({ label: d.label, value: d.key }))}
        />
      </div>
      <div>
        <strong>Colonnes :</strong>
        <Select
          mode="multiple"
          style={{ minWidth: 220, maxWidth: 320 }}
          value={cols}
          onChange={setCols}
          placeholder="Choisir dimension(s) colonne"
          options={availableForCols.map(d => ({ label: d.label, value: d.key }))}
        />
      </div>
      <div>
        <Button
          type={crossModalFullScreen ? "default" : "primary"}
          onClick={() => setCrossModalFullScreen(f => !f)}
        >
          {crossModalFullScreen ? "Réduire" : "Plein écran"}
        </Button>
      </div>
    </div>
  );
}

function ArmeList() {
  const [headerFooterConfig, setHeaderFooterConfig] = React.useState({});

  const [data, setData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
	period: [moment().startOf("day"), moment().endOf("day")],
	type: undefined,
	categorie: undefined,
	designation: undefined,
	region_id: undefined,
	entite_id: undefined,
	source_id: undefined,
	sous_entite_id: undefined,
	coordination_regionale_id: undefined,
	coordination_provinciale_id: undefined,
	coordination_communale_id: undefined
  });
  const [provinces, setProvinces] = useState([]);
  const [regions, setRegions] = useState([]);
  const [entites, setEntites] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [sources, setSources] = useState([]);
  const [coordRegionales, setCoordRegionales] = useState([]);
  const [coordProvinciales, setCoordProvinciales] = useState([]);
  const [coordCommunales, setCoordCommunales] = useState([]);
  const [subEntites, setSubEntites] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMN_KEYS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [uniqueTypes, setUniqueTypes] = useState([]);
  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [uniqueDesignations, setUniqueDesignations] = useState([]);
  const [statDimensions, setStatDimensions] = useState(DEFAULT_DIMENSIONS);
  const [geoLevels, setGeoLevels] = useState(DEFAULT_GEO_LEVELS);
  const [printLayout, setPrintLayout] = useState(DEFAULT_PRINT_LAYOUT);
  const [printConfigVisible, setPrintConfigVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");
  const [columnModalVisible, setColumnModalVisible] = useState(false);
  const [crossModalVisible, setCrossModalVisible] = useState(false);
  const [crossRows, setCrossRows] = useState(["region_nom"]);
  const [crossCols, setCrossCols] = useState(["type"]);
  const [mergeRowHeaders, setMergeRowHeaders] = useState(false);
  const printRef = useRef(null);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const detailCardRef = useRef(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [rowDetails, setRowDetails] = useState({});

  const openDetail = useCallback((record) => {
    setDetailRecord(record);
    setDetailVisible(true);
  }, []);

  const audioCtxRef = useRef(null);
  const playSound = useCallback(
    (key = "click") => {
      if (typeof window === "undefined") return;
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = audioCtxRef.current || new AudioContextCtor();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const profile =
        key === "success"
          ? { frequency: 640, type: "sine", duration: 0.38, gain: 0.08 }
          : { frequency: 520, type: "sine", duration: 0.24, gain: 0.06 };
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = profile.type;
      oscillator.frequency.setValueAtTime(profile.frequency, now);
      gain.gain.setValueAtTime(profile.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + profile.duration);
    },
    []
  );

  const withSound = useCallback(
    (fn, sound = "click") => {
      if (typeof fn !== "function") {
        return () => {};
      }
      return (...args) => {
        playSound(sound);
        return fn(...args);
      };
    },
    [playSound]
  );
  useEffect(() => () => { audioCtxRef.current?.close?.(); }, []);

  const applyTokens = useCallback(
    (value, total = filtered.length) =>
      (value || "")
        .replace(/\{\{date\}\}/g, moment().format("DD/MM/YYYY"))
        .replace(/\{\{total\}\}/g, String(total)),
    [filtered.length]
  );

  const dimensionStats = useMemo(() => {
    return DIMENSION_DEFINITIONS.map(def => {
      const counter = new Map();
      filtered.forEach(row => {
        const value = def.accessor(row);
        counter.set(value, (counter.get(value) || 0) + 1);
      });
      return {
        key: def.key,
        label: def.label,
        data: Array.from(counter, ([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8),
      };
    });
  }, [filtered]);

  const regionMap = useMemo(
    () => new Map(regions.map(r => [String(r.id), r.nom])),
    [regions]
  );
  const provinceMap = useMemo(
    () => new Map(provinces.map(p => [String(p.id), p.nom])),
    [provinces]
  );
  const communeMap = useMemo(
    () => new Map(communes.map(c => [String(c.id), c.nom])),
    [communes]
  );
  const entiteMap = useMemo(
    () => new Map(entites.map(e => [String(e.id), e.nom])),
    [entites]
  );
  const sourceMap = useMemo(
    () => new Map(sources.map(src => [String(src.id), src.nom || src.code || src.description || "—"])),
    [sources]
  );
  const summarySource = useMemo(
    () => (filters.source_id ? sources.find(src => String(src.id) === String(filters.source_id)) || null : null),
    [filters.source_id, sources]
  );
  const enrichRow = useCallback(
    row => ({
      ...row,
      entite_nom: row.entite_nom || entiteMap.get(String(row.entite_id)) || row.entite || "—",
      sous_entite_nom:
        row.sous_entite_nom ||
        (row.sous_entite && row.sous_entite.nom) ||
        row.sous_entite ||
        "—",
      region_nom: row.region_nom || regionMap.get(String(row.region_id)) || "—",
      province_nom: row.province_nom || provinceMap.get(String(row.province_id)) || "—",
      commune_nom: row.commune_nom || communeMap.get(String(row.commune_id)) || "—",
      source_nom: row.source_nom || sourceMap.get(String(row.source_arme_id)) || "—",
    }),
    [entiteMap, regionMap, provinceMap, communeMap, sourceMap]
  );

  const buildGeoValue = useCallback(
    (record, keys) => {
      for (const key of keys) {
        if (record[key]) return record[key];
      }
      return "—";
    },
    []
  );

  const columnDefs = useMemo(() => ({
    rowNumber: {
      title: "N°",
      key: "rowNumber",
      dataIndex: "__rowNumber",
      width: 72,
      align: "center",
      fixed: "left",
      render: (_, record) => record.__rowNumber,
      print: (record) => record.__rowNumber || "—",
    },
    numero_serie: {
      title: "N° Série",
      dataIndex: "numero_serie",
      key: "numero_serie",
      width: 140,
      ellipsis: true,
      sorter: (a, b) => (a.numero_serie || "").localeCompare(b.numero_serie || ""),
      render: (value) => value || "—",
      print: (record) => record.numero_serie || "—",
    },
    type: {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 120,
      ellipsis: true,
      filters: uniqueTypes.map((t) => ({ text: t, value: t })),
      onFilter: (value, record) => record.type === value,
      render: (value) => value || "—",
      print: (record) => record.type || "—",
    },
    categorie: {
      title: "Cat.",
      dataIndex: "categorie",
      key: "categorie",
      width: 110,
      ellipsis: true,
      render: (value) => value || "—",
      print: (record) => record.categorie || "—",
    },
    designation: {
      title: "Dés.",
      dataIndex: "designation",
      key: "designation",
      width: 150,
      ellipsis: true,
      render: (value) => value || "—",
      print: (record) => record.designation || "—",
    },
    entite_nom: {
      title: "Entité",
      dataIndex: "entite_nom",
      key: "entite_nom",
      width: 160,
      ellipsis: true,
      render: (_, record) => record.entite_nom || "—",
      print: (record) => record.entite_nom || "—",
    },
    sous_entite_nom: {
      title: "Sous-entité",
      dataIndex: "sous_entite_nom",
      key: "sous_entite_nom",
      width: 160,
      ellipsis: true,
      render: (_, record) => record.sous_entite_nom || "—",
      print: (record) => record.sous_entite_nom || "—",
    },
    region_nom: {
      title: "Rég.",
      dataIndex: "region_nom",
      key: "region_nom",
      width: 110,
      ellipsis: true,
      render: (_, record) => record.region_nom || buildGeoValue(record, ["region_nom"]),
      print: (record) => record.region_nom || buildGeoValue(record, ["region_nom"]),
    },
    province_nom: {
      title: "Prov.",
      dataIndex: "province_nom",
      key: "province_nom",
      width: 110,
      ellipsis: true,
      render: (_, record) => record.province_nom || buildGeoValue(record, ["province_nom"]),
      print: (record) => record.province_nom || buildGeoValue(record, ["province_nom"]),
    },
    commune_nom: {
      title: "Comm.",
      dataIndex: "commune_nom",
      key: "commune_nom",
      width: 140,
      ellipsis: true,
      render: (_, record) => record.commune_nom || buildGeoValue(record, ["commune_nom"]),
      print: (record) => record.commune_nom || buildGeoValue(record, ["commune_nom"]),
    },
    source_nom: {
      title: "Source",
      dataIndex: "source_nom",
      key: "source_nom",
      width: 150,
      ellipsis: true,
      render: (value) => value || "—",
      print: (record) => record.source_nom || "—",
    },
    statut: {
      title: "Statut",
      dataIndex: "statut",
      key: "statut",
      width: 110,
      render: (value) => <Tag color="green">{value || "—"}</Tag>,
      print: (record) => record.statut || "—",
    },
    position: {
      title: "Position",
      dataIndex: "position",
      key: "position",
      width: 120,
      ellipsis: true,
      render: (value) => value || "—",
      print: (record) => record.position || "—",
    },
    mobilite: {
      title: "Mobilité",
      dataIndex: "mobilite",
      key: "mobilite",
      width: 120,
      ellipsis: true,
      render: (value) => value || "—",
      print: (record) => record.mobilite || "—",
    },
    date_entree: {
      title: "Entrée",
      dataIndex: "date_entree",
      key: "date_entree",
      width: 120,
      ellipsis: true,
      render: (v) => (v ? moment(v).format("DD/MM/YYYY") : "—"),
      print: (record) => (record.date_entree ? moment(record.date_entree).format("DD/MM/YYYY") : "—"),
    },
    date_sortie: {
      title: "Sortie",
      dataIndex: "date_sortie",
      key: "date_sortie",
      width: 120,
      ellipsis: true,
      render: (v) => (v ? moment(v).format("DD/MM/YYYY") : "—"),
      print: (record) => (record.date_sortie ? moment(record.date_sortie).format("DD/MM/YYYY") : "—"),
    },
  }), [uniqueTypes, buildGeoValue]);

  const actionColumn = useMemo(
    () => ({
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            onClick={withSound(() => navigate(`/dashboard/armes/edit/${record.id}`), "success")}
          >
            Modifier
          </Button>
          <Tooltip title="Voir la fiche">
            <Button
              size="small"
              onClick={withSound(() => openDetail(record), "success")}
            >
              Détails
            </Button>
          </Tooltip>
        </Space>
      ),
    }),
    [navigate, withSound, openDetail]
  );
  const baseColumns = useMemo(
    () =>
      columnOrder
        .filter((key) => key === "rowNumber" || visibleColumns.includes(key))
        .map((key) => columnDefs[key])
        .filter(Boolean),
    [columnOrder, columnDefs, visibleColumns]
  );

  const tableColumns = useMemo(
    () => [...baseColumns, actionColumn],
    [baseColumns, actionColumn]
  );
  const printableColumns = useMemo(() => baseColumns, [baseColumns]);
  const previewData = useMemo(() => {
    if (!previewSearch) return filtered;
    const needle = previewSearch.toLowerCase();
    const matches = filtered.filter((record) =>
      printableColumns.some((col) => {
        const raw = (col.print && col.print(record)) ?? record[col.dataIndex];
        return String(raw ?? "—").toLowerCase().includes(needle);
      })
    );
    return matches.map((item, idx) => ({ ...item, __rowNumber: idx + 1 }));
  }, [filtered, printableColumns, previewSearch]);
  const buildPrintableSummary = useCallback(
    (records) => {
      const periodLabel =
        filters.period?.length === 2
          ? `${filters.period[0].format("DD/MM/YYYY")} → ${filters.period[1].format("DD/MM/YYYY")}`
          : "Non précisé";
      const sourceLabel = summarySource ? summarySource.nom || summarySource.code : "Toutes";
      return `
        <div class="print-summary">
          <h2>Bilan journalier des armes</h2>
          <div><strong>Période :</strong> ${periodLabel}</div>
          <div><strong>Type :</strong> ${filters.type || "Tous"}</div>
          <div><strong>Catégorie :</strong> ${filters.categorie || "Toutes"}</div>
          <div><strong>Désignation :</strong> ${filters.designation || "Toutes"}</div>
          <div><strong>Entité :</strong> ${entites.find((e) => String(e.id) === String(filters.entite_id))?.nom || "Toutes"}</div>
          <div><strong>Région :</strong> ${regions.find((r) => String(r.id) === String(filters.region_id))?.nom || "Toutes"}</div>
          <div><strong>Source :</strong> ${sourceLabel}</div>
          <div><strong>Total armes filtrées :</strong> ${records.length}</div>
        </div>
      `;
    },
    [filters, entites, regions, sources]
  );
  // Ajoute ce helper pour générer l'entête HTML à partir de la config
  function renderHeaderFooterHTML(cfg) {
    if (!cfg) return "";
    // Entête
    const entete = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:2;min-width:180px;text-align:${cfg.minInstitAlign||'left'};">
          <div>
            ${(Array.isArray(cfg.institutions) ? cfg.institutions : []).map(inst =>
              `<div style="font-weight:${inst.bold?'bold':'normal'};font-style:${inst.italic?'italic':'normal'};text-decoration:${inst.underline?'underline':'none'};color:${inst.color||'#222'};font-size:${cfg.institFontSize||14}px;">${inst.text||""}</div>`
            ).join(cfg.separator ? `<div style="font-weight:bold;color:${cfg.separatorColor||'#222'};">${cfg.separator.repeat(cfg.separatorLength||14)}</div>` : "")}
          </div>
        </div>
        <div style="flex:1;text-align:center;">
          ${cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="Logo" style="max-height:60px;"/>` : ""}
        </div>
        <div style="flex:1;min-width:180px;text-align:${cfg.styleOptions?.pays?.align||'right'};font-family:${cfg.styleOptions?.pays?.fontFamily||'inherit'};">
          <div style="font-weight:${cfg.styleOptions?.pays?.bold?'bold':'normal'};font-style:${cfg.styleOptions?.pays?.italic?'italic':'normal'};text-decoration:${cfg.styleOptions?.pays?.underline?'underline':'none'};color:${cfg.styleOptions?.pays?.color};font-size:${cfg.styleOptions?.pays?.fontSize}px;">
            ${cfg.pays||""}
          </div>
          ${cfg.styleOptions?.paysSeparator?.char && cfg.styleOptions?.paysSeparator?.count > 0
            ? `<div style="color:${cfg.styleOptions.paysSeparator.color};font-weight:${cfg.styleOptions.paysSeparator.bold?'bold':'normal'};font-style:${cfg.styleOptions.paysSeparator.italic?'italic':'normal'};text-decoration:${cfg.styleOptions.paysSeparator.underline?'underline':'none'};font-family:${cfg.styleOptions.paysSeparator.fontFamily};font-size:${cfg.styleOptions.paysSeparator.fontSize}px;text-align:${cfg.styleOptions.paysSeparator.align};">
                ${cfg.styleOptions.paysSeparator.char.repeat(cfg.styleOptions.paysSeparator.count)}
              </div>`
            : ""}
          <div style="font-style:${cfg.styleOptions?.devise?.italic?'italic':'normal'};font-weight:${cfg.styleOptions?.devise?.bold?'bold':'normal'};text-decoration:${cfg.styleOptions?.devise?.underline?'underline':'none'};color:${cfg.styleOptions?.devise?.color};font-size:${cfg.styleOptions?.devise?.fontSize}px;">
            ${cfg.devise||""}
          </div>
        </div>
      </div>
      <hr style="margin:8px 0;"/>
    `;
    // Pied de page
    const pied = `
      <div style="display:flex;justify-content:${cfg.signataireAlign||'right'};margin-top:24px;">
        <div style="text-align:${cfg.signataireAlign||'right'};margin-left:${cfg.signataireAlign==='left'?cfg.signataireOffset:0}px;margin-right:${cfg.signataireAlign==='right'?cfg.signataireOffset:0}px;margin-top:${cfg.signataireOffsetY||0}px;">
          <div>${cfg.signataire||""}</div>
          <div>${cfg.grade||""}</div>
          <div>${cfg.titre||""}</div>
          ${cfg.signatureUrl ? `<img src="${cfg.signatureUrl}" alt="Signature" style="max-height:40px;"/>` : ""}
        </div>
      </div>
    `;
    return { entete, pied };
  }

  // Ajoute cette fonction utilitaire pour générer le titre dynamique selon les filtres
  function getDocumentTitle(cfg, filters, regions, entites) {
    // Priorité à la config paramétrable
    if (cfg && (cfg.documentTitle || cfg.headerTitle)) {
      return cfg.documentTitle || cfg.headerTitle;
    }
    // Sinon, construit dynamiquement selon les filtres
    let title = "Liste des armes";
    const parts = [];
    if (filters.region_id) {
      const region = regions.find(r => String(r.id) === String(filters.region_id));
      if (region) parts.push(`Région : ${region.nom}`);
    }
    if (filters.entite_id) {
      const entite = entites.find(e => String(e.id) === String(filters.entite_id));
      if (entite) parts.push(`Entité : ${entite.nom}`);
    }
    if (filters.type) parts.push(`Type : ${filters.type}`);
    if (filters.categorie) parts.push(`Catégorie : ${filters.categorie}`);
    if (filters.designation) parts.push(`Désignation : ${filters.designation}`);
    if (parts.length) title += " — " + parts.join(" | ");
    return title;
  }

  const buildPrintableMarkup = useCallback(
    (records) => {
      const layout = { ...DEFAULT_PRINT_LAYOUT, ...printLayout };
      const headRow = printableColumns.map((col) => `<th>${col.title}</th>`).join("");
      const bodyRows = records.length
        ? records
            .map(
              (record) =>
                `<tr>${printableColumns
                  .map((col) => `<td>${(col.print && col.print(record)) || record[col.dataIndex] || "—"}</td>`)
                  .join("")}</tr>`
            )
            .join("")
        : `<tr><td colspan="${Math.max(1, printableColumns.length)}">Aucune donnée</td></tr>`;
      const cfg = headerFooterConfig || {};
      const { entete, pied } = renderHeaderFooterHTML(cfg);
      const docTitle = getDocumentTitle(cfg, filters, regions, entites);
      const sourceLabel = summarySource ? summarySource.nom || summarySource.code : "Toutes";
      return `
        <div style="margin-bottom:24px;">
          ${entete}
          <div style="text-align:center;font-size:1.6em;font-weight:bold;margin:12px 0 18px 0;">
            ${docTitle}
          </div>
          <div class="print-summary">
            <div><strong>Période :</strong> ${filters.period?.length === 2 ? `${filters.period[0].format("DD/MM/YYYY")} → ${filters.period[1].format("DD/MM/YYYY")}` : "Non précisé"}</div>
            <div><strong>Type :</strong> ${filters.type || "Tous"}</div>
            <div><strong>Catégorie :</strong> ${filters.categorie || "Toutes"}</div>
            <div><strong>Désignation :</strong> ${filters.designation || "Toutes"}</div>
            <div><strong>Entité :</strong> ${entites.find((e) => String(e.id) === String(filters.entite_id))?.nom || "Toutes"}</div>
            <div><strong>Région :</strong> ${regions.find((r) => String(r.id) === String(filters.region_id))?.nom || "Toutes"}</div>
            <div><strong>Source :</strong> ${sourceLabel}</div>
            <div><strong>Total armes filtrées :</strong> ${records.length}</div>
          </div>
        </div>
        <div>
          <table class="print-table">
            <thead><tr>${headRow}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
        <div style="margin-top:32px;">
          ${pied}
        </div>
      `;
    },
    [applyTokens, printableColumns, printLayout, headerFooterConfig, summarySource]
  );
  const defaultPrintableMarkup = useMemo(
    () => buildPrintableMarkup(filtered),
    [buildPrintableMarkup, filtered]
  );
  const handlePrint = useCallback(
    (records = filtered) => {
      const markup = buildPrintableMarkup(records);
      const win = window.open("", "_blank", "width=1200,height=900");
      if (!win) return;
      win.document.write(`
        <html>
          <head>
            <title>Liste des armes</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #1f2f25; }
              .print-header { text-align: center; margin-bottom: 18px; }
              .print-header h1 { margin: 0; font-size: 22px; }
              .print-summary { margin-bottom: 12px; font-size: 13px; }
              .print-summary div { margin-bottom: 4px; }
              .print-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              .print-table th, .print-table td { border: 1px solid #9bb6a1; padding: 6px 8px; font-size: 12px; text-align: left; }
              .print-table th { background: #e3f1e6; text-transform: uppercase; letter-spacing: 0.6px; }
              .print-footer { display: flex; justify-content: space-between; margin-top: 18px; font-size: 12px; }
            </style>
          </head>
          <body>${markup}</body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    },
    [buildPrintableMarkup, filtered]
  );
  const exportToExcel = useCallback(
    (records = filtered) => {
      if (!printableColumns.length) {
        message.warning("Sélectionnez au moins une colonne");
        return;
      }
      if (!records.length) {
        message.warning("Aucune donnée à exporter");
        return;
      }
      const headRow = `<tr>${printableColumns.map((col) => `<th>${col.title}</th>`).join("")}</tr>`;
      const bodyRows = records
        .map(
          (record) =>
            `<tr>${printableColumns
              .map((col) => {
                const value = (col.print && col.print(record)) ?? record[col.dataIndex] ?? "—";
                return `<td>${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`;
              })
              .join("")}</tr>`
        )
        .join("");
      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
          <head><meta charset="utf-8" /></head>
          <body><table>${headRow}${bodyRows}</table></body>
        </html>`;
      const blob = new Blob([html], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "armes.xls";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success("Export Excel généré");
    },
    [filtered, printableColumns]
  );
  useEffect(() => {
    if (!previewVisible) setPreviewSearch("");
  }, [previewVisible]);

  const loadLookups = useCallback(async () => {
    try {
      const [regionsData, provincesData, communesData, entitesData, sourcesData, subEntitesData, coordRegionaleData, coordProvincialeData, coordCommunaleData] = await Promise.all([
        api.getRegionsList(),
        api.getProvincesList(),
        api.getCommunesList(),
        api.getEntitesList(),
        api.getSourcesArmement(),
        api.getSousEntitesList(),
        api.getCoordinationRegionaleList(),
        api.getCoordinationProvincialeList(),
        api.getCoordinationCommunaleList(),
      ]);
      setRegions(Array.isArray(regionsData) ? regionsData : []);
      setProvinces(Array.isArray(provincesData) ? provincesData : []);
      setCommunes(Array.isArray(communesData) ? communesData : []);
      setEntites(Array.isArray(entitesData) ? entitesData : []);
      setSources(Array.isArray(sourcesData) ? sourcesData : []);
      setSubEntites(Array.isArray(subEntitesData) ? subEntitesData : []);
      setCoordRegionales(Array.isArray(coordRegionaleData) ? coordRegionaleData : []);
      setCoordProvinciales(Array.isArray(coordProvincialeData) ? coordProvincialeData : []);
      setCoordCommunales(Array.isArray(coordCommunaleData) ? coordCommunaleData : []);
    } catch {
      message.error("Erreur chargement référentiels");
    }
  }, []);
  
  const filteredSubEntites = useMemo(() => {
    if (!filters.entite_id) return subEntites;
    return subEntites.filter(s => String(s.entite_id) === String(filters.entite_id));
  }, [subEntites, filters.entite_id]);
  
  const filteredCoordProvinciales = useMemo(() => {
    if (!filters.coordination_regionale_id) return coordProvinciales;
    return coordProvinciales.filter(c => String(c.parent_id) === String(filters.coordination_regionale_id));
  }, [coordProvinciales, filters.coordination_regionale_id]);
  
  const filteredCoordCommunales = useMemo(() => {
    if (!filters.coordination_provinciale_id) return coordCommunales;
    return coordCommunales.filter(c => String(c.parent_id) === String(filters.coordination_provinciale_id));
  }, [coordCommunales, filters.coordination_provinciale_id]);
  
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        startDate: filters.period?.[0]?.format("YYYY-MM-DD"),
        endDate: filters.period?.[1]?.format("YYYY-MM-DD"),
        type: filters.type,
        categorie: filters.categorie,
        designation: filters.designation,
        region_id: filters.region_id,
        entite_id: filters.entite_id,
        source_arme_id: filters.source_id,
      };
      const list = await window.electronAPI.getArmesList(params).catch(() => []);
      const rows = Array.isArray(list) ? list : list?.rows || [];
      setRawData(rows);
      setUniqueTypes(Array.from(new Set(rows.map(r => r.type).filter(Boolean))));
      setUniqueCategories(Array.from(new Set(rows.map(r => r.categorie).filter(Boolean))));
      setUniqueDesignations(Array.from(new Set(rows.map(r => r.designation).filter(Boolean))));
    } catch (err) {
      message.error("Erreur chargement armes");
      setRawData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { const enriched = rawData.map(enrichRow); setData(enriched); }, [rawData, enrichRow]);
  useEffect(() => { loadLookups(); }, [loadLookups]);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const storedLayout = loadPrintLayout();
    if (storedLayout) {
      setPrintLayout(prev => ({ ...prev, ...storedLayout }));
    }
  }, []);

  useEffect(() => {
    const subset = data.filter((item) => {
      if (filters.type && item.type !== filters.type) return false;
      if (filters.categorie && item.categorie !== filters.categorie) return false;
      if (filters.designation && item.designation !== filters.designation) return false;
      if (filters.region_id && String(item.region_id) !== String(filters.region_id)) return false;
      if (filters.entite_id && String(item.entite_id) !== String(filters.entite_id)) return false;
      if (filters.source_id && String(item.source_arme_id) !== String(filters.source_id)) return false;
      if (filters.coordination_regionale_id && String(item.coordination_regionale_id || item.region_id) !== String(filters.coordination_regionale_id)) return false;
      if (filters.coordination_provinciale_id && String(item.coordination_provinciale_id || item.province_id) !== String(filters.coordination_provinciale_id)) return false;
      if (filters.coordination_communale_id && String(item.coordination_communale_id || item.commune_id) !== String(filters.coordination_communale_id)) return false;
      return true;
    });
    const numbered = subset.map((item, idx) => ({ ...item, __rowNumber: idx + 1 }));
    setFiltered(numbered);
  }, [data, filters]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      byStatus: filtered.reduce((acc, item) => {
        const key = item.statut || "Indéfini";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      byMobilite: filtered.reduce((acc, item) => {
        const key = item.mobilite || "Indéfinie";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    }),
    [filtered]
  );

  const handleFilterChange = (field, value) => {
    let next = { ...filters, [field]: value };
    if (field === "entite_id") {
      next = {
        ...next,
        sous_entite_id: undefined,
        coordination_regionale_id: undefined,
        coordination_provinciale_id: undefined,
        coordination_communale_id: undefined
      };
    }
    if (field === "sous_entite_id" && value) {
      next = {
        ...next,
        coordination_regionale_id: undefined,
        coordination_provinciale_id: undefined,
        coordination_communale_id: undefined
      };
    }
    if (field === "coordination_regionale_id") {
      next = {
        ...next,
        coordination_regionale_id: value,
        coordination_provinciale_id: undefined,
        coordination_communale_id: undefined
      };
    }
    if (field === "coordination_provinciale_id") {
      next = {
        ...next,
        coordination_provinciale_id: value,
        coordination_communale_id: undefined
      };
    }
    setFilters(next);
  };

  const toggleColumnVisibility = useCallback((key) => {
    if (key === "rowNumber") return;
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }, []);
  const toggleColumn = (key, checked) => {
    setVisibleColumns(prev => {
      if (checked) return Array.from(new Set([...prev, key]));
      return prev.filter(item => item !== key);
    });
  };

  const moveColumn = useCallback((key, direction) => {
    setColumnOrder((prev) => {
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
    setFilters(filtersInitialState);
    setStatDimensions(DEFAULT_DIMENSIONS);
    setGeoLevels(DEFAULT_GEO_LEVELS);
    form.resetFields();
  };

  // Ajout : calcul dynamique du tableau croisé pour l'analyse croisée
  const crossPivotTable = useMemo(() => {
    if (!crossRows.length || !crossCols.length) return { rows: [], cols: [], data: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };

    // Obtenir toutes les valeurs distinctes pour chaque dimension sélectionnée
    const rowKeys = Array.from(new Set(filtered.map(item => crossRows.map(dim => item[dim] || "—").join(" / "))));
    const colKeys = Array.from(new Set(filtered.map(item => crossCols.map(dim => item[dim] || "—").join(" / "))));

    // Construction du tableau croisé
    const data = {};
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;

    filtered.forEach(item => {
      const rowKey = crossRows.map(dim => item[dim] || "—").join(" / ");
      const colKey = crossCols.map(dim => item[dim] || "—").join(" / ");
      data[rowKey] = data[rowKey] || {};
      data[rowKey][colKey] = (data[rowKey][colKey] || 0) + 1;
      rowTotals[rowKey] = (rowTotals[rowKey] || 0) + 1;
      colTotals[colKey] = (colTotals[colKey] || 0) + 1;
      grandTotal += 1;
    });

    return { rows: rowKeys, cols: colKeys, data, rowTotals, colTotals, grandTotal };
  }, [filtered, crossRows, crossCols]);

  // Utilitaire pour générer la structure hiérarchique pour le tableau croisé
  function buildHierarchicalRows(data, rowDims, colDims) {
    // data: filtered
    // rowDims: ex ["region_nom", "province_nom", ...]
    // colDims: ex ["type", ...]
    // Retourne : { rows: [], cols: [], tree: [], flatRows: [] }
    // tree: [{ key, label, children: [...], total, depth }]
    // flatRows: [{ keys: [val1, val2, ...], label, depth, data: {colKey: count}, total }]
    if (!rowDims.length) return { rows: [], cols: [], tree: [], flatRows: [] };
    // Obtenir toutes les valeurs distinctes pour chaque dimension de colonne
    const colKeys = Array.from(new Set(data.map(item => colDims.map(dim => item[dim] || "—").join(" / "))));

    // Construction de l'arbre hiérarchique
    function groupByLevel(items, dims, depth = 0, parentKeys = []) {
      if (!dims.length) return [];
      const [currentDim, ...restDims] = dims;
      const groups = {};
      items.forEach(item => {
        const key = item[currentDim] || "—";
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      return Object.entries(groups).map(([key, groupItems]) => {
        const node = {
          key: [...parentKeys, key].join(" / "),
          label: key,
          depth,
          items: groupItems,
          children: restDims.length ? groupByLevel(groupItems, restDims, depth + 1, [...parentKeys, key]) : [],
        };
        return node;
      });
    }

    // Aplatir l'arbre pour affichage
    function flattenTree(tree, colKeys, colDims) {
      const rows = [];
      function walk(node, parentKeys = []) {
        const keys = [...parentKeys, node.label];
        // Calculer les totaux pour chaque colonne
        const data = {};
        colKeys.forEach(colKey => {
          data[colKey] = node.items.filter(item =>
            colDims.length
              ? colDims.every((dim, idx) => (item[dim] || "—") === colKey.split(" / ")[idx])
              : true
          ).length;
        });
        const total = node.items.length;
        rows.push({ keys, label: node.label, depth: node.depth, data, total, isSubtotal: false });
        if (node.children && node.children.length) {
          node.children.forEach(child => walk(child, keys));
          // Sous-total pour ce groupe
          rows.push({
            keys,
            label: `Sous-total ${node.label}`,
            depth: node.depth,
            data: colKeys.reduce((acc, k) => {
              acc[k] = node.items.filter(item =>
                colDims.length
                  ? colDims.every((dim, idx) => (item[dim] || "—") === k.split(" / ")[idx])
                  : true
              ).length;
              return acc;
            }, {}),
            total: node.items.length,
            isSubtotal: true,
          });
        }
      }
      tree.forEach(node => walk(node));
      return rows;
    }

    const tree = groupByLevel(data, rowDims, 0, []);
    const flatRows = flattenTree(tree, colKeys, colDims);
    return { rows: rowDims, cols: colKeys, tree, flatRows };
  }

  // Pour l'analyse croisée
  const crossPivotHier = useMemo(() => {
    if (!crossRows.length || !crossCols.length) return { rows: [], cols: [], tree: [], flatRows: [] };
    return buildHierarchicalRows(filtered, crossRows, crossCols);
  }, [filtered, crossRows, crossCols]);

  // Export Excel du tableau croisé hiérarchique
  function exportCrossToExcel() {
    const { flatRows, cols } = crossPivotHier;
    let html = `<table><thead><tr>`;
    crossRows.forEach((dim, i) => {
      const found = [...CROSS_GEO_DIMENSIONS, ...CROSS_ARME_DIMENSIONS].find(d => d.key === dim);
      html += `<th>${found ? found.label : dim}</th>`;
    });
    cols.forEach(colKey => html += `<th>${colKey}</th>`);
    html += `<th>Total</th></tr></thead><tbody>`;
    flatRows.forEach(row => {
      html += `<tr${row.isSubtotal ? ' style="font-weight:bold;background:#e3f1e6;"' : ''}>`;
      crossRows.forEach((_, i) => {
        html += `<td style="padding-left:${row.depth * 16}px">${row.keys[i] || ""}</td>`;
      });
      cols.forEach(colKey => html += `<td>${row.data[colKey] || ""}</td>`);
      html += `<td>${row.total}</td></tr>`;
    });
    html += `</tbody></table>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    saveAs(blob, "analyse_croisee_armes.xls");
  }

  // Export PDF du tableau croisé hiérarchique
  function exportCrossToPDF() {
    const { flatRows, cols } = crossPivotHier;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Analyse croisée des armes", 105, 16, { align: "center" });
    const head = [
      ...crossRows.map(dim => {
        const found = [...CROSS_GEO_DIMENSIONS, ...CROSS_ARME_DIMENSIONS].find(d => d.key === dim);
        return found ? found.label : dim;
      }),
      ...cols,
      "Total"
    ];
    const body = flatRows.map(row =>
      [
        ...crossRows.map((_, i) => (row.keys[i] || "")),
        ...cols.map(colKey => row.data[colKey] || ""),
        row.total
      ]
    );
    const totalsRow = [
      ...(crossRows.length ? Array(crossRows.length).fill("Total") : ["Total"]),
      ...cols.map(colKey => crossPivotHier.colTotals.get(colKey) ?? 0),
      crossPivotHier.grandTotal
    ];
    autoTable(doc, {
      head: [head],
      body,
      startY: 22,
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [227,241,230], textColor: 31, halign: "center" },
      bodyStyles: { halign: "center" },
      didParseCell: function (data) {
        if (flatRows[data.row.index]?.isSubtotal) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [227,241,230];
        }
      }
    });
    doc.save("analyse_croisee_armes.pdf");
  }

  // Export Word du tableau croisé hiérarchique
  async function exportCrossToWord() {
    const { flatRows, cols } = crossPivotHier;
    const tableRows = [
      new TableRow({
        children: [
          ...crossRows.map(dim => {
            const found = [...CROSS_GEO_DIMENSIONS, ...CROSS_ARME_DIMENSIONS].find(d => d.key === dim);
            return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: found ? found.label : dim, bold: true })] })] });
          }),
          ...cols.map(colKey => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: colKey, bold: true })] })] })),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total", bold: true })] })] })
        ]
      }),
      ...flatRows.map(row =>
        new TableRow({
          children: [
            ...crossRows.map((_, i) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: row.keys[i] || "" })] })],
                shading: row.isSubtotal ? { fill: "E3F1E6" } : undefined
              })
            ),
            ...cols.map(colKey =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: String(row.data[colKey] || "") })] })],
                shading: row.isSubtotal ? { fill: "E3F1E6" } : undefined
              })
            ),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: String(row.total) })] })],
              shading: row.isSubtotal ? { fill: "E3F1E6" } : undefined
            })
          ]
        })
      )
    ];
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: "Analyse croisée des armes", heading: "Heading1", alignment: "center" }),
          new DocxTable({ rows: tableRows })
        ]
      }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "analyse_croisee_armes.docx");
  }

  // Impression du tableau croisé : mode paysage si beaucoup de colonnes
  function printCrossTable() {
    const container = document.querySelector(".cross-table-print-container");
    if (!container) {
      message.error("Aucun tableau croisé à imprimer.");
      return;
    }
    const orientation = (crossPivotHier.cols.length || 0) > 6 ? "landscape" : "portrait";
    const tableHtml = container.innerHTML;
    const printWindow = window.open("", "", "width=1200,height=800");
    if (!printWindow) {
      message.error("Impossible d’ouvrir la fenêtre d’impression.");
      return;
    }
    const styles = `
      <style>
        @media print {
          @page { size: A4 ${orientation}; margin: 10mm; }
        }
        body { font-family: Arial, sans-serif; margin: 0; padding: 12px; }
        .arme-cross-table { width: 100%; border-collapse: collapse; }
        .arme-cross-table th,
        .arme-cross-table td { border: 1px solid #000; padding: 6px 8px; text-align: center; }
        .arme-cross-table th { background: #e3f1e6; }
      </style>
    `;
    printWindow.document.write(`
      <html>
        <head>
          <title>Analyse croisée des armes</title>
          ${styles}
        </head>
        <body>
          <div class="cross-table-print-container">${tableHtml}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  // Charger la config globale depuis app_config (clé: 'header_footer')
  useEffect(() => {
    (async () => {
      try {
        const configs = await api.getAppConfigList();
        const found = configs.find(c => c.nom_param === "header_footer");
        if (found) {
          let val = {};
          try { val = JSON.parse(found.valeur); } catch {}
          setHeaderFooterConfig(val);
        }
      } catch {}
    })();
  }, []);

  const dimensionOptions = useMemo(
    () => CROSS_DIMENSIONS.map(dim => ({ label: dim.label, value: dim.key })),
    []
  );

  const rowCheckboxOptions = useMemo(
    () =>
      dimensionOptions.map(option => ({
        ...option,
        disabled: crossCols.includes(option.value)
      })),
    [dimensionOptions, crossCols]
  );

  const colCheckboxOptions = useMemo(
    () =>
      dimensionOptions.map(option => ({
        ...option,
        disabled: crossRows.includes(option.value)
      })),
    [dimensionOptions, crossRows]
  );

  const crossPivot = useMemo(
    () => buildPivot(filtered, crossRows, crossCols),
    [filtered, crossRows, crossCols]
  );

  const canExportPivot = useMemo(
    () => crossRows.length && crossCols.length && crossPivot.grandTotal > 0,
    [crossRows, crossCols, crossPivot]
  );

  const handlePivotExcel = useCallback(() => {
    if (!canExportPivot) {
      message.warning("Aucune donnée à exporter.");
      return;
    }
    exportPivotToExcel(crossPivot);
  }, [canExportPivot, crossPivot]);

  const handlePivotPDF = useCallback(() => {
    if (!canExportPivot) {
      message.warning("Aucune donnée à exporter.");
      return;
    }
    exportPivotToPDF(crossPivot);
  }, [canExportPivot, crossPivot]);

  const rowSpanMatrix = useMemo(
    () => (mergeRowHeaders ? computeRowSpanMatrix(crossPivot) : null),
    [mergeRowHeaders, crossPivot]
  );

  const resetCrossSettings = useCallback(() => {
    setCrossRows(["region_nom"]);
    setCrossCols(["type"]);
    setMergeRowHeaders(false);
  }, []);

  const handleRowDimChange = useCallback(
    values => {
      if (values.length > 3) {
        message.warning("Maximum 3 dimensions par axe.");
        values = values.slice(0, 3);
      }
      setCrossRows(values);
    },
    []
  );

  const handleColDimChange = useCallback(
    values => {
      if (values.length > 3) {
        message.warning("Maximum 3 dimensions par axe.");
        values = values.slice(0, 3);
      }
      setCrossCols(values);
    },
    []
  );

  const handlePivotPrint = useCallback(() => {
    if (!canExportPivot) {
      message.warning("Aucune donnée à imprimer.");
      return;
    }
    const container = document.querySelector(".cross-table-print-container table");
    const tableHTML = container ? container.outerHTML : pivotTableMarkup(crossPivot);
    const { entete, pied } = renderHeaderFooterHTML(headerFooterConfig);
    const title = `${getDocumentTitle(headerFooterConfig, filters, regions, entites)} — Analyse croisée`;
    const content = `
      <div style="margin-bottom:24px;">
        ${entete}
        <div style="text-align:center;font-size:1.4em;font-weight:bold;margin:12px 0;">
          ${title}
        </div>
      </div>
      ${tableHTML}
      <div style="margin-top:32px;">${pied}</div>
    `;
    printPivot({ content });
  }, [canExportPivot, crossPivot, headerFooterConfig, filters, regions, entites]);

  const handleOpenCrossAnalysis = useCallback(() => {
    if (!filtered.length) {
      message.warning("Aucune donnée disponible pour l’analyse approfondie.");
      return;
    }
    const headerFragments = renderHeaderFooterHTML(headerFooterConfig);
    const documentTitle = getDocumentTitle(headerFooterConfig, filters, regions, entites);
    navigate("/dashboard/analyse-croisee", {
      state: {
        rows: filtered.map(({ __rowNumber, ...rest }) => rest),
        headerFooterHTML: headerFragments,
        documentTitle
      }
    });
  }, [filtered, headerFooterConfig, filters, regions, entites, navigate]);

  return (
    <div className="arme-list-page">
      <div className="arme-list-overlay" />
      <Card className="arme-list-shell" variant="borderless">
        <div className="arme-list-header">
          <div>
            <Title level={3} className="arme-list-title">Gestion des armes</Title>
            <Text className="arme-list-subtitle">
              Visualisez, filtrez et imprimez les armes enregistrées par type, catégorie et entité.
            </Text>
          </div>
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={withSound(() => navigate("/dashboard/armes/add"), "success")}>
              Ajouter une arme
            </Button>
            <Button icon={<FileTextOutlined />} onClick={withSound(() => navigate("/dashboard/config-armes"))}>
              Configurations
            </Button>
            <Button icon={<ProfileOutlined />} onClick={withSound(() => setPreviewVisible(true), "success")}>
              Aperçu & impression
            </Button>
            <Button icon={<ColumnWidthOutlined />} onClick={withSound(() => setColumnModalVisible(true), "success")}>
              Colonnes
            </Button>
            <Button icon={<ReloadOutlined />} onClick={withSound(loadData)} loading={loading}>
              Actualiser
            </Button>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => setCrossModalVisible(true)}
              type="default"
              style={{ fontWeight: 600, background: "#e3f1e6", borderColor: "#9bb6a1", color: "#1f2f25" }}
            >
              Analyse croisée
            </Button>
            <Button
              icon={<TableOutlined />}
              onClick={withSound(handleOpenCrossAnalysis, "success")}
              type="default"
            >
              Analyse croisée approfondie
            </Button>
          </Space>
        </div>

        <Card className="arme-list-filters" size="small">
          <Form form={form} initialValues={filters}>
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item name="period" noStyle>
                  <RangePicker
                    value={filters.period}
                    onChange={value => handleFilterChange("period", value)}
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
                  onChange={value => handleFilterChange("type", value)}
                  style={{ width: "100%" }}
                >
                  {uniqueTypes.map(t => <Option key={t}>{t}</Option>)}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Catégorie"
                  value={filters.categorie}
                  onChange={value => handleFilterChange("categorie", value)}
                  style={{ width: "100%" }}
                >
                  {uniqueCategories.map(c => <Option key={c}>{c}</Option>)}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Désignation"
                  value={filters.designation}
                  onChange={(value) => handleFilterChange("designation", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {uniqueDesignations.map((d) => (
                    <Option key={d}>{d}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Région"
                  value={filters.region_id}
                  onChange={value => handleFilterChange("region_id", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {regions.map((r) => <Option key={r.id} value={r.id}>{r.nom}</Option>)}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Entité"
                  value={filters.entite_id}
                  onChange={value => handleFilterChange("entite_id", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {entites.map((e) => <Option key={e.id} value={e.id}>{e.nom}</Option>)}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Sous-entité"
                  value={filters.sous_entite_id}
                  onChange={value => handleFilterChange("sous_entite_id", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {filteredSubEntites.map(se => (
                    <Option key={se.id} value={se.id}>
                      {se.nom}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Coordination régionale"
                  value={filters.coordination_regionale_id}
                  onChange={value => handleFilterChange("coordination_regionale_id", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {coordRegionales.map(cr => (
                    <Option key={cr.id} value={cr.id}>
                      {cr.nom}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Coordination provinciale"
                  value={filters.coordination_provinciale_id}
                  onChange={value => handleFilterChange("coordination_provinciale_id", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {filteredCoordProvinciales.map(cp => (
                    <Option key={cp.id} value={cp.id}>
                      {cp.nom}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} md={4}>
                <Select
                  allowClear
                  placeholder="Coordination communale"
                  value={filters.coordination_communale_id}
                  onChange={value => handleFilterChange("coordination_communale_id", value)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="children"
                >
                  {filteredCoordCommunales.map(cc => (
                    <Option key={cc.id} value={cc.id}>
                      {cc.nom}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
          </Form>
        </Card>
        <Row gutter={16} className="arme-list-advanced">
          <Col xs={24} md={12}>
            <Card size="small" className="arme-list-advanced-card" title="Cartes de répartition">
              <Checkbox.Group
                value={statDimensions}
                onChange={withSound((value) => setStatDimensions(value))}
                options={[

                  { label: "Type", value: "type" },
                  { label: "Cat.", value: "categorie" },
                  { label: "Dés.", value: "designation" },
                  { label: "Entité", value: "entite" },
                ]}
              />
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {statDimensions.includes("type") && (
                  <Card size="small" className="arme-list-dimension-card" title="Répartition par type">
                    {/* ...contenu de la carte type... */}
                    {/* Exemple : */}
                    {dimensionStats.find(d => d.key === "type")?.data.map(item => (
                      <div key={item.name} className="arme-list-dimension-entry">
                        <div className="arme-list-dimension-entry__header">
                          <span className="arme-list-dimension-entry__label">{item.name}</span>
                          <span className="arme-list-dimension-entry__value">{item.value}</span>
                        </div>
                        <div className="arme-list-dimension-entry__bar">
                          <div
                            className="arme-list-dimension-entry__bar-fill"
                            style={{
                              width: `${Math.round((item.value / (dimensionStats.find(d => d.key === "type")?.data[0]?.value || 1)) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </Card>
                )}
                {statDimensions.includes("categorie") && (
                  <Card size="small" className="arme-list-dimension-card" title="Répartition par catégorie">
                    {dimensionStats.find(d => d.key === "categorie")?.data.map(item => (
                      <div key={item.name} className="arme-list-dimension-entry">
                        <div className="arme-list-dimension-entry__header">
                          <span className="arme-list-dimension-entry__value">{item.value}</span>
                        </div>
                        <div className="arme-list-dimension-entry__bar">
                          <div
                            className="arme-list-dimension-entry__bar-fill"
                            style={{
                              width: `${Math.round((item.value / (dimensionStats.find(d => d.key === "categorie")?.data[0]?.value || 1)) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </Card>
                )}
                {statDimensions.includes("designation") && (
                  <Card size="small" className="arme-list-dimension-card" title="Répartition par désignation">
                    {dimensionStats.find(d => d.key === "designation")?.data.map(item => (
                     
                      <div key={item.name} className="arme-list-dimension-entry">
                        <div className="arme-list-dimension-entry__header">
                          <span className="arme-list-dimension-entry__label">{item.name}</span>
                          <span className="arme-list-dimension-entry__value">{item.value}</span>
                        </div>
                        <div className="arme-list-dimension-entry__bar">
                          <div
                            className="arme-list-dimension-entry__bar-fill"
                            style={{
                              width: `${ Math.round((item.value / (dimensionStats.find(d => d.key === "designation")?.data[0]?.value || 1)) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </Card>
                )}
                {statDimensions.includes("entite") && (
                  <Card size="small" className="arme-list-dimension-card" title="Répartition par entité">
                    {/* Calcul dynamique pour entité */}
                    {(() => {
                      const counter = new Map();
                      filtered.forEach(row => {
                        const value = row.entite_nom || "Non renseignée";
                        counter.set(value, (counter.get(value) || 0) + 1);
                      });
                      const data = Array.from(counter, ([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 8);
                      const max = data[0]?.value || 1;
                      return data.map(item => (
                        <div key={item.name} className="arme-list-dimension-entry">
                          <div className="arme-list-dimension-entry__header">
                            <span className="arme-list-dimension-entry__label">{item.name}</span>
                            <span className="arme-list-dimension-entry__value">{item.value}</span>
                          </div>
                          <div className="arme-list-dimension-entry__bar">
                            <div
                              className="arme-list-dimension-entry__bar-fill"
                              style={{
                                width: `${Math.round((item.value / max) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </Card>
                )}
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" className="arme-list-advanced-card" title="Niveaux géographiques">
              <Checkbox.Group
                value={geoLevels}
                onChange={withSound((value) => setGeoLevels(value))}
                options={[

                  { label: "Rég.", value: "region" },
                  { label: "Prov.", value: "province" },
                  { label: "Comm.", value: "commune" },
                ]}
              />
              {/* Affichage dynamique des répartitions géographiques sous forme de tableau */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {geoLevels.includes("region") && (
                  <Card size="small" className="arme-list-dimension-card" title="Répartition par région">
                    <table style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Région</th>
                          <th style={{ textAlign: "right" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const counter = new Map();
                          filtered.forEach(row => {
                            const value = row.region_nom || "Non renseignée";
                            counter.set(value, (counter.get(value) || 0) + 1);
                          });
                          const data = Array.from(counter, ([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 20);
                          return data.map(item => (
                            <tr key={item.name}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: "right" }}>{item.value}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </Card>
                )}
                {geoLevels.includes("province") && (
                  <Card size="small" className="arme-list-dimension-card" title="Répartition par province">
                    <table style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Province</th>
                          <th style={{ textAlign: "right" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const counter = new Map();
                          filtered.forEach(row => {
                            const value = row.province_nom || "Non renseignée";
                            counter.set(value, (counter.get(value) || 0) + 1);
                          });
                          const data = Array.from(counter, ([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 20);
                          return data.map(item => (
                            <tr key={item.name}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: "right" }}>{item.value}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </Card>
                )}
                {geoLevels.includes("commune") && (
                  <Card size="small" className="arme-list-dimension-card" title="Répartition par commune">
                    <table style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Commune</th>
                          <th style={{ textAlign: "right" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const counter = new Map();
                          filtered.forEach(row => {
                            const value = row.commune_nom || "Non renseignée";
                            counter.set(value, (counter.get(value) || 0) + 1);
                          });
                          const data = Array.from(counter, ([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 20);
                          return data.map(item => (
                            <tr key={item.name}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: "right" }}>{item.value}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </Card>
                )}
              </div>
            </Card>
          </Col>
        </Row>
        <div className="arme-list-reset-bar">
          <Button icon={<FilterOutlined />} onClick={withSound(resetFilters, "success")}>
            Réinitialiser les filtres
          </Button>
        </div>
        <Card className="arme-list-table-card" size="small" variant="borderless">
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
        <Card className="arme-list-preview-card" size="small" variant="borderless">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Text strong>Aperçu dynamique</Text>
            <Text type="secondary">
              Ajustez les colonnes ici, puis exportez ou imprimez depuis l’aperçu dédié pour conserver un tableau stable.
            </Text>
            <Space wrap>
              <Button
                type="primary"
                icon={<ProfileOutlined />}
                onClick={withSound(() => setPreviewVisible(true), "success")}
              >
                Ouvrir l’aperçu détaillé
              </Button>
              <Button icon={<PrinterOutlined />} onClick={withSound(() => handlePrint(), "success")}>
                Imprimer directement
              </Button>
              <Button icon={<FileExcelOutlined />} onClick={withSound(() => exportToExcel(), "success")}>
                Exporter en Excel
              </Button>
            </Space>
          </Space>
        </Card>
        <div
          ref={printRef}
          style={{ display: "none" }}
          dangerouslySetInnerHTML={{ __html: defaultPrintableMarkup }}
        />
        <Modal
          open={previewVisible}
          title="Aperçu détaillé"
          width="90%"
          footer={null}
          destroyOnHidden
          onCancel={withSound(() => setPreviewVisible(false))}
        >
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <>
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
                    <Button icon={<ReloadOutlined />} onClick={withSound(loadData)}>
                      Rafraîchir
                    </Button>
                    <Button
                      type="primary"
                      icon={<PrinterOutlined />}
                      onClick={withSound(() => handlePrint(previewData), "success")}
                    >
                      Imprimer
                    </Button>
                    <Button
                      icon={<FileExcelOutlined />}
                      onClick={withSound(() => exportToExcel(previewData), "success")}
                    >
                      Export Excel
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
            </>
          </Space>
        </Modal>
        <Modal
          open={columnModalVisible}
          title="Colonnes du tableau"
          width={520}
          footer={null}
          destroyOnHidden
          onCancel={withSound(() => setColumnModalVisible(false))}
          className="arme-columns-modal"
        >
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {columnOrder.map((key, index) => {
              const label = COLUMN_LABELS[key] || key;
              const locked = key === "rowNumber";
              const visible = key === "rowNumber" || visibleColumns.includes(key);
              return (
                <div key={key} className={`arme-columns-modal__item ${visible ? "is-active" : ""}`}>
                  <span className="arme-columns-modal__label">{label}</span>
                  <Space size={4}>
                    <Tooltip title={visible ? "Masquer" : "Afficher"}>
                      <Button
                        size="small"
                        icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={withSound(() => toggleColumnVisibility(key))}
                        disabled={locked}
                      />
                    </Tooltip>
                    <Tooltip title="Monter">
                      <Button
                        size="small"
                        icon={<UpOutlined />}
                        onClick={withSound(() => moveColumn(key, -1))}
                        disabled={locked || index <= 1}
                      />
                    </Tooltip>
                    <Tooltip title="Descendre">
                      <Button
                        size="small"
                        icon={<DownOutlined />}
                        onClick={withSound(() => moveColumn(key, 1))}
                        disabled={locked || index === columnOrder.length - 1}
                      />
                    </Tooltip>
                  </Space>
                </div>
              );
            })}
            <Button type="link" onClick={withSound(resetColumnOrder, "success")} className="arme-columns-modal__reset">
              Réinitialiser l’ordre par défaut
            </Button>
          </Space>
        </Modal>
        <Modal
          open={crossModalVisible}
          title="Analyse croisée"
          width="85%"
          footer={null}
          destroyOnHidden
          onCancel={withSound(() => setCrossModalVisible(false))}
        >
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Space wrap align="center" size="large">
              <Space direction="vertical" size="small">
                <Text strong>Dimensions lignes</Text>
                <Checkbox.Group
                  options={rowCheckboxOptions}
                  value={crossRows}
                  onChange={handleRowDimChange}
                  style={{ display: "flex", flexDirection: "row", gap: 12, flexWrap: "wrap" }}
                />
              </Space>
              <Space direction="vertical" size="small">
                <Text strong>Dimensions colonnes</Text>
                <Checkbox.Group
                  options={colCheckboxOptions}
                  value={crossCols}
                  onChange={handleColDimChange}
                  style={{ display: "flex", flexDirection: "row", gap: 12, flexWrap: "wrap" }}
                />
              </Space>
              <Space wrap size="small">
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={withSound(handlePivotExcel, "success")}
                  disabled={!canExportPivot}
                >
                  Export Excel
                </Button>
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={withSound(handlePivotPDF, "success")}
                  disabled={!canExportPivot}
                >
                  Export PDF
                </Button>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={withSound(handlePivotPrint, "success")}
                  disabled={!canExportPivot}
                >
                  Imprimer
                </Button>
                <Button onClick={withSound(resetCrossSettings, "success")} disabled={!crossRows.length && !crossCols.length}>
                  Réinitialiser
                </Button>
                <Checkbox
                  checked={mergeRowHeaders}
                  onChange={event => setMergeRowHeaders(event.target.checked)}
                >
                  Fusionner les regroupements
                </Checkbox>
              </Space>
              <Tag color="blue">{crossPivot.grandTotal} enregistrements</Tag>
            </Space>
            {!(crossRows.length && crossCols.length) ? (
              <Card size="small">
                <Text type="secondary">
                  Sélectionnez au moins une dimension pour les lignes et les colonnes afin de générer le tableau croisé.
                </Text>
              </Card>
            ) : (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <div className="cross-table-print-container">
                  <table className="arme-cross-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {crossRows.map(dim => (
                          <th key={`row-${dim}`} style={{ background: "#e3f1e6" }}>
                            {formatDimensionLabel(dim)}
                          </th>
                        ))}
                        {crossPivot.colKeys.map(colKey => (
                          <th key={`col-${colKey}`} style={{ background: "#e3f1e6" }}>
                            {formatParts(crossPivot.colParts.get(colKey))}
                          </th>
                        ))}
                        <th style={{ background: "#e3f1e6" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crossPivot.rowKeys.map((rowKey, rowIndex) => {
                        const parts = crossPivot.rowParts.get(rowKey) || [];
                        return (
                          <tr key={rowKey}>
                            {crossRows.map((dim, index) => {
                              const rowSpan = mergeRowHeaders ? rowSpanMatrix?.[rowIndex]?.[index] ?? 1 : 1;
                              if (mergeRowHeaders && rowSpan === 0) {
                                return null;
                              }
                              return (
                                <td
                                  key={`${rowKey}-part-${dim}`}
                                  rowSpan={mergeRowHeaders ? rowSpan : undefined}
                                >
                                  {parts[index] ?? "—"}
                                </td>
                              );
                            })}
                            {crossPivot.colKeys.map(colKey => (
                              <td key={`${rowKey}-${colKey}`}>
                                {crossPivot.cells.get(rowKey)?.get(colKey) ?? 0}
                              </td>
                            ))}
                            <td>{crossPivot.rowTotals.get(rowKey) ?? 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {crossPivot.colKeys.length > 0 && (
                      <tfoot>
                        <tr>
                          <th colSpan={crossRows.length || 1}>Total</th>
                          {crossPivot.colKeys.map(colKey => (
                            <th key={`total-${colKey}`}>{crossPivot.colTotals.get(colKey) ?? 0}</th>
                          ))}
                          <th>{crossPivot.grandTotal}</th>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <Space wrap>
                  <Button
                    icon={<FileExcelOutlined />}
                    onClick={withSound(handlePivotExcel, "success")}
                    disabled={!canExportPivot}
                  >
                    Export Excel
                  </Button>
                  <Button
                    icon={<FilePdfOutlined />}
                    onClick={withSound(handlePivotPDF, "success")}
                    disabled={!canExportPivot}
                  >
                    Export PDF
                  </Button>
                  <Button
                    icon={<PrinterOutlined />}
                    onClick={withSound(handlePivotPrint, "success")}
                    disabled={!canExportPivot}
                  >
                    Imprimer
                  </Button>
                </Space>
              </Space>
            )}
          </Space>
        </Modal>
        <PrintLayoutConfigModal
          open={printConfigVisible}
          initialValues={printLayout}
          onCancel={withSound(() => setPrintConfigVisible(false))}
          onSave={withSound((values) => {
            savePrintLayout(values);
            setPrintLayout(prev => ({ ...prev, ...values }));
            setPrintConfigVisible(false);
            message.success("Mise en page mise à jour");
          }, "success")}
        />
      </Card>
      <Modal
        open={detailVisible}
        title={`Détails arme ${detailRecord?.numero_serie || ""}`}
        onCancel={withSound(() => setDetailVisible(false))}
        footer={[
          <Button key="close" onClick={withSound(() => setDetailVisible(false))}>
            Fermer
          </Button>,
          detailRecord && (
            <Button
              key="edit"
              type="primary"
              onClick={withSound(() => {
                setDetailVisible(false);
                navigate(`/dashboard/armes/edit/${detailRecord.id}`);
              }, "success")}
            >
              Modifier
            </Button>
          )
        ]}
      >
        {detailRecord ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Numéro de série">
              {detailRecord.numero_serie || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Désignation">
              {detailRecord.designation || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Type / Catégorie">
              {[detailRecord.type, detailRecord.categorie].filter(Boolean).join(" · ") || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Entité">
              {detailRecord.entite_nom || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Statut">
              {detailRecord.statut || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Position / Mobilité">
              {[detailRecord.position, detailRecord.mobilite].filter(Boolean).join(" · ") || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Source">
              {detailRecord.source_nom || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Dates">
              { [
                detailRecord.date_entree && `Entrée : ${moment(detailRecord.date_entree).format("DD/MM/YYYY")}`,
                detailRecord.date_sortie && `Sortie : ${moment(detailRecord.date_sortie).format("DD/MM/YYYY")}`
              ].filter(Boolean).join(" | ") || "—"}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">Aucun enregistrement sélectionné.</Text>
        )}
      </Modal>
    </div>
  );
}

export default ArmeList;