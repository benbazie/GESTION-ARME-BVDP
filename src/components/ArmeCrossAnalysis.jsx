import React, { useState, useMemo, useCallback } from "react";
import { Space, Button, Checkbox, Tag, Card, Typography, message, Select, Row, Col, Divider } from "antd";
import { FileExcelOutlined, FilePdfOutlined, PrinterOutlined, FileWordOutlined } from "@ant-design/icons";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation, useNavigate } from "react-router-dom";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun, HeadingLevel } from "docx";

const { Text } = Typography;

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
  { key: "lot", label: "Lot" },
  { key: "position", label: "Position" },
  { key: "mobilite", label: "Mobilité" }
];

const CROSS_DIMENSIONS = [...CROSS_GEO_DIMENSIONS, ...CROSS_ARME_DIMENSIONS];
const PIVOT_KEY_SEPARATOR = "__@@__";
const DIMENSION_LABEL_MAP = CROSS_DIMENSIONS.reduce((acc, dim) => {
  acc[dim.key] = dim.label;
  return acc;
}, {});

const formatDimensionLabel = key => DIMENSION_LABEL_MAP[key] || key;
const formatParts = parts => (Array.isArray(parts) && parts.length ? parts.join(" | ") : "—");
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
  const normalise = value => (value === null || value === undefined || value === "" ? "—" : String(value));
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
    const rowKey = rowPartsCurrent.join("__@@__");
    const colKey = colPartsCurrent.join("__@@__");
    rowKeySet.add(rowKey);
    colKeySet.add(colKey);
    if (!rowParts.has(rowKey)) rowParts.set(rowKey, rowPartsCurrent);
    if (!colParts.has(colKey)) colParts.set(colKey, colPartsCurrent);
    const rowMap = cells.get(rowKey) || new Map();
    rowMap.set(colKey, (rowMap.get(colKey) || 0) + 1);
    cells.set(rowKey, rowMap);
    grandTotal += 1;
  });
  const lexSort = (aParts, bParts) => {
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
      const a = (aParts[i] || "").toString();
      const b = (bParts[i] || "").toString();
      const cmp = a.localeCompare(b);
      if (cmp !== 0) return cmp;
    }
    return 0;
  };
  const rowKeys = Array.from(rowKeySet).sort((a, b) => lexSort(rowParts.get(a) || [], rowParts.get(b) || []));
  const colKeys = Array.from(colKeySet).sort((a, b) => lexSort(colParts.get(a) || [], colParts.get(b) || []));
  const rowTotals = new Map();
  const colTotals = new Map();
  rowKeys.forEach(rowKey => {
    const rowMap = cells.get(rowKey) || new Map();
    const total = colKeys.reduce((acc, colKey) => acc + (rowMap.get(colKey) || 0), 0);
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
  const rowHeader = rowDims.map(dim => `<th>${formatDimensionLabel(dim)}</th>`).join("");
  const colHeader = colKeys.map(colKey => `<th>${formatParts(colParts.get(colKey))}</th>`).join("");
  const header = `<tr>${rowHeader}${colHeader}<th>Total</th></tr>`;
  const body = rowKeys
    .map(rowKey => {
      const parts = rowParts.get(rowKey) || [];
      const rowCells = rowDims.map((_, index) => `<td>${parts[index] ?? "—"}</td>`).join("");
      const valueCells = colKeys.map(colKey => `<td>${cells.get(rowKey)?.get(colKey) ?? 0}</td>`).join("");
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

const exportPivotToExcel = (pivot, { pageTitle, headerFooterHTML, filtersHtml } = {}) => {
  const html = `<html><head><meta charset="utf-8" /></head><body>${headerFooterHTML?.entete || ""}${
    pageTitle ? `<div style="text-align:center;font-size:18px;font-weight:bold;margin:16px 0;">${pageTitle}</div>` : ""
  }${
    filtersHtml ? `<div style="margin:12px 0;font-size:13px;"><strong>Filtres appliqués :</strong><ul style="margin:6px 0 0 18px;">${filtersHtml}</ul></div>` : ""
  }${pivotTableMarkup(pivot)}<div style="margin-top:24px;">${headerFooterHTML?.pied || ""}</div></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  saveAs(blob, "analyse_croisee_armes.xls");
};

const exportPivotToPDF = (pivot, { pageTitle, headerFooterHTML, filtersPlain } = {}) => {
  const doc = new jsPDF("landscape");
  let cursorY = 16;
  doc.setFontSize(11);
  htmlToPlainLines(headerFooterHTML?.entete).forEach(line => {
    doc.text(line, 15, cursorY);
    cursorY += 6;
  });
  if (pageTitle) {
    doc.setFontSize(14);
    doc.text(pageTitle, 15, cursorY + 4);
    cursorY += 14;
  }
  doc.setFontSize(10);
  (filtersPlain || []).forEach(line => {
    doc.text(line, 15, cursorY);
    cursorY += 5;
  });
  const startY = Math.max(cursorY, 28);
  doc.setFontSize(9);
  const head = [
    ...pivot.rowDims.map(formatDimensionLabel),
    ...pivot.colKeys.map(colKey => formatParts(pivot.colParts.get(colKey))),
    "Total"
  ];
  const body = pivot.rowKeys.map(rowKey => {
    const parts = pivot.rowParts.get(rowKey) || [];
    const rowValues = pivot.colKeys.map(colKey => pivot.cells.get(rowKey)?.get(colKey) ?? 0);
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
    startY,
    styles: { fontSize: 9, cellPadding: 2 }
  });
  let footerY = doc.autoTable.previous.finalY + 10;
  doc.setFontSize(10);
  htmlToPlainLines(headerFooterHTML?.pied).forEach(line => {
    doc.text(line, 15, footerY);
    footerY += 5;
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
          body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
          th { background: #e0f2fe; }
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

const buildPivotDisplayRows = (pivot, rowDims, colDims) => {
  if (!rowDims.length || !colDims.length) return [];
  const { rowKeys, rowParts, colKeys, cells, rowTotals } = pivot;
  if (!rowKeys.length) return [];
  const display = [];
  const stack = [];
  const normalise = value => (value === null || value === undefined || value === "" ? "—" : value);
  const flushTo = level => {
    while (stack.length > level) {
      const entry = stack.pop();
      display.push({
        type: "subtotal",
        depth: entry.depth,
        label: `Sous-total ${formatDimensionLabel(rowDims[entry.depth])} : ${entry.label}`,
        values: entry.colTotals.slice(),
        total: entry.rowTotal
      });
    }
  };
  rowKeys.forEach(rowKey => {
    const parts = (rowParts.get(rowKey) || []).map(normalise);
    let sharedDepth = 0;
    while (sharedDepth < stack.length && stack[sharedDepth].label === parts[sharedDepth]) {
      sharedDepth += 1;
    }
    flushTo(sharedDepth);
    for (let depth = stack.length; depth < parts.length; depth += 1) {
      stack.push({
        depth,
        label: parts[depth],
        colTotals: Array(colKeys.length).fill(0),
        rowTotal: 0
      });
    }
    const values = colKeys.map(colKey => cells.get(rowKey)?.get(colKey) ?? 0);
    const total = rowTotals.get(rowKey) ?? 0;
    display.push({ type: "data", rowKey, parts, values, total });
    stack.forEach(entry => {
      entry.rowTotal += total;
      values.forEach((value, idx) => {
        entry.colTotals[idx] += value;
      });
    });
  });
  flushTo(0);
  return display;
};

const buildPivotColumnEntries = pivot => {
  const { colKeys, colParts } = pivot;
  return colKeys.map((colKey, colIndex) => ({
    key: `col-${colKey}`,
    label: formatParts(colParts.get(colKey)),
    colKey,
    colIndex
  }));
};

const normaliseValue = value => {
  if (value === null || value === undefined || value === "") return "Non renseigné";
  return String(value);
};

const buildChartSeries = (rows, dimension) => {
  const counter = new Map();
  rows.forEach(row => {
    const key = normaliseValue(row[dimension]);
    counter.set(key, (counter.get(key) || 0) + 1);
  });
  return Array.from(counter, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
};

const stripHTMLTags = html =>
  (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
const htmlToPlainLines = html => stripHTMLTags(html).split(/\n+/).map(line => line.trim()).filter(Boolean);

const CHART_TYPES = [
  { value: "bar", label: "Histogramme" },
  { value: "line", label: "Courbe" },
  { value: "pie", label: "Camembert" }
];
const CHART_COLORS = ["#1f6f8b", "#99a8b2", "#f3a712", "#f28f6b", "#7fb685", "#533a71", "#ff6f91", "#9b5de5", "#00bbf9", "#00f5d4", "#ffba08", "#e36414"];
const renderBarChart = (data, dimension) => {
  if (!data.length) return <Text>Aucune donnée à afficher.</Text>;
  const width = 620;
  const height = 260;
  const padding = 40;
  const chartHeight = height - padding * 2;
  const barWidth = (width - padding * 2) / data.length;
  const maxValue = Math.max(...data.map(item => item.value));
  return (
    <svg width={width} height={height} style={{ display: "block", margin: "0 auto" }}>
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" />
      {data.map((item, index) => {
        const barHeight = maxValue ? (item.value / maxValue) * chartHeight : 0;
        const x = padding + index * barWidth + barWidth * 0.1;
        const y = height - padding - barHeight;
        const color = CHART_COLORS[index % CHART_COLORS.length];
        return (
          <g key={item.label}>
            <rect x={x} y={y} width={barWidth * 0.8} height={barHeight} fill={color} rx={4} />
            <text x={x + barWidth * 0.4} y={y - 6} textAnchor="middle" fontSize="11" fill="#1f2933">
              {item.value}
            </text>
            <text x={x + barWidth * 0.4} y={height - padding + 16} textAnchor="middle" fontSize="11" fill="#475569">
              {item.label.length > 14 ? `${item.label.slice(0, 11)}…` : item.label}
            </text>
          </g>
        );
      })}
      <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="#475569">
        Dimension : {formatDimensionLabel(dimension)}
      </text>
    </svg>
  );
};

const renderLineChart = (data, dimension) => {
  if (!data.length) return <Text>Aucune donnée à afficher.</Text>;
  const width = 620;
  const height = 260;
  const padding = 40;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  const maxValue = Math.max(...data.map(item => item.value));
  const points = data.map((item, index) => {
    const x = padding + (chartWidth / Math.max(1, data.length - 1)) * index;
    const y = height - padding - (maxValue ? (item.value / maxValue) * chartHeight : 0);
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", margin: "0 auto" }}>
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" />
      <path d={path} fill="none" stroke="#1f6f8b" strokeWidth={2} />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r={5} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fill="#1f2933">
            {point.value}
          </text>
          <text x={point.x} y={height - padding + 16} textAnchor="middle" fontSize="11" fill="#475569">
            {point.label.length > 14 ? `${point.label.slice(0, 11)}…` : point.label}
          </text>
        </g>
      ))}
      <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="#475569">
        Dimension : {formatDimensionLabel(dimension)}
      </text>
    </svg>
  );
};

const renderPieChart = data => {
  if (!data.length) return <Text>Aucune donnée à afficher.</Text>;
  const radius = 100;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulative = 0;
  return (
    <Space direction="vertical" align="center" size="small" style={{ width: "100%" }}>
      <svg width="320" height="240" viewBox="-110 -120 220 240" style={{ display: "block" }}>
        {data.map((item, index) => {
          const startAngle = (cumulative / total) * 2 * Math.PI;
          cumulative += item.value;
          const endAngle = (cumulative / total) * 2 * Math.PI;
          const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
          const x1 = radius * Math.cos(startAngle);
          const y1 = radius * Math.sin(startAngle);
          const x2 = radius * Math.cos(endAngle);
          const y2 = radius * Math.sin(endAngle);
          const pathData = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          return <path key={item.label} d={pathData} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="#fff" strokeWidth={1} />;
        })}
      </svg>
      <Space wrap size="small" align="center" style={{ maxWidth: 640, justifyContent: "center" }}>
        {data.map((item, index) => (
          <Tag key={item.label} color={CHART_COLORS[index % CHART_COLORS.length]} style={{ color: "#0f172a" }}>
            {item.label}: {item.value}
          </Tag>
        ))}
      </Space>
    </Space>
  );
};

const renderChart = (type, data, dimension) => {
  switch (type) {
    case "bar":
      return renderBarChart(data, dimension);
    case "line":
      return renderLineChart(data, dimension);
    case "pie":
      return renderPieChart(data);
    default:
      return null;
  }
};

const TABLE_COLOR_SCHEMES = {
  ocean: { label: "Océan", headerBg: "linear-gradient(135deg,#0f4c75,#3282b8)", headerText: "#f8fafc", bodyBg: "#ffffff", stripeBg: "#f5f7fb", bodyBorder: "#d4d9e2", subtotalBg: "#fff4e6", subtotalText: "#78350f", subtotalBorder: "#fcd34d", totalBg: "linear-gradient(135deg,#0f4c75,#3282b8)", totalText: "#f8fafc" },
  forest: { label: "Forêt", headerBg: "linear-gradient(135deg,#0b5345,#1abc9c)", headerText: "#ecfdf5", bodyBg: "#ffffff", stripeBg: "#edf8f3", bodyBorder: "#c8e6c9", subtotalBg: "#d9f99d", subtotalText: "#1a2e05", subtotalBorder: "#bef264", totalBg: "linear-gradient(135deg,#145a32,#239b56)", totalText: "#ecfdf5" },
  sunset: { label: "Crépuscule", headerBg: "linear-gradient(135deg,#b5179e,#f72585)", headerText: "#fff7fb", bodyBg: "#ffffff", stripeBg: "#fff0f6", bodyBorder: "#f8d3ea", subtotalBg: "#fde68a", subtotalText: "#78350f", subtotalBorder: "#fcd34d", totalBg: "linear-gradient(135deg,#f97316,#fb923c)", totalText: "#fff7ed" },
  aurora: { label: "Aurore", headerBg: "linear-gradient(135deg,#1d4350,#a43931)", headerText: "#fef9f5", bodyBg: "#ffffff", stripeBg: "#fdf1ed", bodyBorder: "#f0d1c5", subtotalBg: "#fee2e2", subtotalText: "#7f1d1d", subtotalBorder: "#fca5a5", totalBg: "linear-gradient(135deg,#243949,#517fa4)", totalText: "#f1f5f9" },
  lagoon: { label: "Lagune", headerBg: "linear-gradient(135deg,#0c5a5a,#19a186)", headerText: "#e6fffa", bodyBg: "#ffffff", stripeBg: "#ecfffb", bodyBorder: "#b9f5d0", subtotalBg: "#dcfce7", subtotalText: "#14532d", subtotalBorder: "#bbf7d0", totalBg: "linear-gradient(135deg,#13a58c,#2bc0b4)", totalText: "#ecfffa" },
  graphite: { label: "Graphite", headerBg: "linear-gradient(135deg,#28313b,#485461)", headerText: "#e5e9f0", bodyBg: "#ffffff", stripeBg: "#f3f4f6", bodyBorder: "#d1d5db", subtotalBg: "#e7e5e4", subtotalText: "#2e2e2e", subtotalBorder: "#cbd5e1", totalBg: "linear-gradient(135deg,#20262e,#515c6d)", totalText: "#f4f5f7" },
  glacier: { label: "Glacier", headerBg: "linear-gradient(135deg,#74ebd5,#acb6e5)", headerText: "#102a43", bodyBg: "#ffffff", stripeBg: "#edf5ff", bodyBorder: "#c3d5f6", subtotalBg: "#dbeafe", subtotalText: "#1e3a8a", subtotalBorder: "#bfdbfe", totalBg: "linear-gradient(135deg,#2193b0,#6dd5ed)", totalText: "#f0f9ff" },
  ember: { label: "Braise", headerBg: "linear-gradient(135deg,#ff512f,#dd2476)", headerText: "#fff5f5", bodyBg: "#ffffff", stripeBg: "#ffecec", bodyBorder: "#fac7cf", subtotalBg: "#fed7aa", subtotalText: "#7c2d12", subtotalBorder: "#fb923c", totalBg: "linear-gradient(135deg,#ff5f6d,#ffc371)", totalText: "#fff7f0" },
  meadow: { label: "Prairie", headerBg: "linear-gradient(135deg,#56ab2f,#a8e063)", headerText: "#f6ffe3", bodyBg: "#ffffff", stripeBg: "#f4fde5", bodyBorder: "#d0e9b0", subtotalBg: "#dcfce7", subtotalText: "#14532d", subtotalBorder: "#bbf7d0", totalBg: "linear-gradient(135deg,#3ca55c,#b5ac49)", totalText: "#f8fff0" },
  cobalt: { label: "Cobalt", headerBg: "linear-gradient(135deg,#1e3c72,#2a5298)", headerText: "#e2ecff", bodyBg: "#ffffff", stripeBg: "#eef3ff", bodyBorder: "#c8d5ff", subtotalBg: "#dbeafe", subtotalText: "#1d4ed8", subtotalBorder: "#bfdbfe", totalBg: "linear-gradient(135deg,#0f52ba,#3a7bd5)", totalText: "#f0f9ff" },
  coral: { label: "Corail", headerBg: "linear-gradient(135deg,#ff9966,#ff5e62)", headerText: "#fff7f3", bodyBg: "#ffffff", stripeBg: "#fff1ed", bodyBorder: "#f8cdc0", subtotalBg: "#ffe4e6", subtotalText: "#9f1239", subtotalBorder: "#fbb6ce", totalBg: "linear-gradient(135deg,#ed6ea0,#ec8c69)", totalText: "#fff8f5" },
  quartz: { label: "Quartz", headerBg: "linear-gradient(135deg,#bdc3c7,#2c3e50)", headerText: "#f8fafc", bodyBg: "#ffffff", stripeBg: "#f7f8fb", bodyBorder: "#d3d6da", subtotalBg: "#e5e7eb", subtotalText: "#334155", subtotalBorder: "#cbd5f5", totalBg: "linear-gradient(135deg,#536976,#292e49)", totalText: "#f8fafc" },
  arctic: { label: "Arctique", headerBg: "linear-gradient(135deg,#2b5876,#4e4376)", headerText: "#eef2ff", bodyBg: "#ffffff", stripeBg: "#f1f5ff", bodyBorder: "#cfd6f6", subtotalBg: "#dbeafe", subtotalText: "#1d4ed8", subtotalBorder: "#bfdbfe", totalBg: "linear-gradient(135deg,#4e4376,#2b5876)", totalText: "#eff6ff" },
  plume: { label: "Prune", headerBg: "linear-gradient(135deg,#41295a,#2f0743)", headerText: "#f8f5ff", bodyBg: "#ffffff", stripeBg: "#f5ecff", bodyBorder: "#dfd2f6", subtotalBg: "#f3e8ff", subtotalText: "#581c87", subtotalBorder: "#d8b4fe", totalBg: "linear-gradient(135deg,#662d8c,#ed1e79)", totalText: "#fdf4ff" },
  tide: { label: "Marée", headerBg: "linear-gradient(135deg,#2193b0,#6dd5ed)", headerText: "#102a43", bodyBg: "#ffffff", stripeBg: "#e8f8ff", bodyBorder: "#c3e1f4", subtotalBg: "#bae6fd", subtotalText: "#0b3c5d", subtotalBorder: "#7dd3fc", totalBg: "linear-gradient(135deg,#134e5e,#71b280)", totalText: "#ecfeff" },
  sand: { label: "Sable", headerBg: "linear-gradient(135deg,#c79081,#dfa579)", headerText: "#fff7ed", bodyBg: "#ffffff", stripeBg: "#fef6ec", bodyBorder: "#eadccf", subtotalBg: "#fdecc8", subtotalText: "#7c3f07", subtotalBorder: "#fbd38d", totalBg: "linear-gradient(135deg,#b08968,#e3c5a2)", totalText: "#fdf7f1" },
  emberlight: { label: "Flamme douce", headerBg: "linear-gradient(135deg,#ff9a9e,#fad0c4)", headerText: "#701a3f", bodyBg: "#ffffff", stripeBg: "#fff5f7", bodyBorder: "#facee1", subtotalBg: "#fcd5ce", subtotalText: "#7f1d1d", subtotalBorder: "#f9a8a8", totalBg: "linear-gradient(135deg,#f857a6,#ff5858)", totalText: "#fff5f5" },
  eclipse: { label: "Éclipse", headerBg: "linear-gradient(135deg,#232526,#414345)", headerText: "#e5e7eb", bodyBg: "#ffffff", stripeBg: "#f2f2f2", bodyBorder: "#d4d4d4", subtotalBg: "#e7e5e4", subtotalText: "#312e81", subtotalBorder: "#c7c7d6", totalBg: "linear-gradient(135deg,#0f2027,#203a43)", totalText: "#e5e7eb" },
  terra: { label: "Terra", headerBg: "linear-gradient(135deg,#603813,#b29f94)", headerText: "#fdf6f0", bodyBg: "#ffffff", stripeBg: "#f8f1e9", bodyBorder: "#e1d5c8", subtotalBg: "#fef3c7", subtotalText: "#7c2d12", subtotalBorder: "#fcd34d", totalBg: "linear-gradient(135deg,#8e5c2f,#c58d59)", totalText: "#fff9eb" },
  mesa: { label: "Mesa", headerBg: "linear-gradient(135deg,#ad5389,#3c1053)", headerText: "#f6efff", bodyBg: "#ffffff", stripeBg: "#f3e8ff", bodyBorder: "#dec9ff", subtotalBg: "#ede9fe", subtotalText: "#3730a3", subtotalBorder: "#c7d2fe", totalBg: "linear-gradient(135deg,#3c1053,#7f5a83)", totalText: "#f5f3ff" },
  gale: { label: "Zéphyr", headerBg: "linear-gradient(135deg,#1c92d2,#f2fcfe)", headerText: "#0f172a", bodyBg: "#ffffff", stripeBg: "#edf8ff", bodyBorder: "#cde4f6", subtotalBg: "#bae6fd", subtotalText: "#0c4a6e", subtotalBorder: "#7dd3fc", totalBg: "linear-gradient(135deg,#36d1dc,#5b86e5)", totalText: "#eef5ff" }
};
const FILTER_DIMENSIONS = ["type", "categorie", "statut", "region_nom", "province_nom", "entite_nom", "lot", "position", "mobilite"];

const buildFiltersSummary = filters => {
  const items = Object.entries(filters)
    .filter(([, values]) => values.length)
    .map(([key, values]) => `<li><strong>${formatDimensionLabel(key)} :</strong> ${values.join(", ")}</li>`);
  return items.join("");
};

const buildFiltersSummaryPlain = filters =>
  Object.entries(filters)
    .filter(([, values]) => values.length)
    .map(([key, values]) => `${formatDimensionLabel(key)} : ${values.join(", ")}`);

const ArmeCrossAnalysis = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const dataSource = useMemo(() => (Array.isArray(state?.rows) ? state.rows : []), [state]);
  const headerFooterHTML = useMemo(() => {
    if (!state?.headerFooterHTML) return { entete: "", pied: "" };
    if (typeof state.headerFooterHTML === "string") return { entete: state.headerFooterHTML, pied: "" };
    return {
      entete: state.headerFooterHTML.entete || "",
      pied: state.headerFooterHTML.pied || ""
    };
  }, [state]);
  const documentTitle = state?.documentTitle || "";
  const [crossRows, setCrossRows] = useState(["region_nom"]);
  const [crossCols, setCrossCols] = useState(["type"]);
  const [mergeRowHeaders, setMergeRowHeaders] = useState(false);
  const [chartDimension, setChartDimension] = useState("type");
  const [chartType, setChartType] = useState("bar");
  const [dimensionFilters, setDimensionFilters] = useState(() =>
    FILTER_DIMENSIONS.reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {})
  );
  const [tableTheme, setTableTheme] = useState("ocean");
  const themeOptions = useMemo(
    () => Object.entries(TABLE_COLOR_SCHEMES).map(([value, cfg]) => ({ value, label: cfg.label })),
    []
  );
  const theme = useMemo(() => TABLE_COLOR_SCHEMES[tableTheme] ?? TABLE_COLOR_SCHEMES.ocean, [tableTheme]);

  const dimensionOptions = useMemo(() => CROSS_DIMENSIONS.map(dim => ({ label: dim.label, value: dim.key })), []);

  const filterOptions = useMemo(() => {
    const registry = FILTER_DIMENSIONS.reduce((acc, key) => {
      acc[key] = [];
      return acc;
    }, {});
    dataSource.forEach(item => {
      FILTER_DIMENSIONS.forEach(key => {
        const label = normaliseValue(item[key]);
        if (!registry[key].some(option => option.value === label)) {
          registry[key].push({ label, value: label });
        }
      });
    });
    FILTER_DIMENSIONS.forEach(key => registry[key].sort((a, b) => a.label.localeCompare(b.label)));
    return registry;
  }, [dataSource]);

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

  const filteredData = useMemo(
    () =>
      dataSource.filter(item =>
        FILTER_DIMENSIONS.every(key => {
          const active = dimensionFilters[key];
          if (!active.length) return true;
          return active.includes(normaliseValue(item[key]));
        })
      ),
    [dataSource, dimensionFilters]
  );

  const hasActiveFilters = useMemo(
    () => FILTER_DIMENSIONS.some(key => dimensionFilters[key].length),
    [dimensionFilters]
  );

  const crossPivot = useMemo(
    () => buildPivot(filteredData, crossRows, crossCols),
    [filteredData, crossRows, crossCols]
  );

  const canExportPivot = useMemo(
    () => crossRows.length && crossCols.length && crossPivot.grandTotal > 0,
    [crossRows, crossCols, crossPivot]
  );

  const rowSpanMatrix = useMemo(
    () => (mergeRowHeaders ? computeRowSpanMatrix(crossPivot) : null),
    [mergeRowHeaders, crossPivot]
  );

  const pivotDisplayRows = useMemo(
    () => buildPivotDisplayRows(crossPivot, crossRows, crossCols),
    [crossPivot, crossRows, crossCols]
  );

  const pivotColumnEntries = useMemo(
    () => buildPivotColumnEntries(crossPivot, crossCols),
    [crossPivot, crossCols]
  );
  const chartSeries = useMemo(() => buildChartSeries(filteredData, chartDimension), [filteredData, chartDimension]);
  const chartElement = useMemo(
    () => renderChart(chartType, chartSeries, chartDimension),
    [chartType, chartSeries, chartDimension]
  );

  const filtersSummaryHtml = useMemo(() => buildFiltersSummary(dimensionFilters), [dimensionFilters]);
  const filtersSummaryPlain = useMemo(() => buildFiltersSummaryPlain(dimensionFilters), [dimensionFilters]);
  const headerLines = useMemo(() => htmlToPlainLines(headerFooterHTML.entete), [headerFooterHTML]);
  const footerLines = useMemo(() => htmlToPlainLines(headerFooterHTML.pied), [headerFooterHTML]);

  const recapTitle = useMemo(() => {
    const rowLabel = crossRows.length ? crossRows.map(formatDimensionLabel).join(" / ") : "les dimensions sélectionnées";
    const colLabel = crossCols.length ? crossCols.map(formatDimensionLabel).join(" / ") : "";
    const suffix = colLabel ? `${rowLabel} et ${colLabel}` : rowLabel;
    return `Récapitulatif des armes par ${suffix}`;
  }, [crossRows, crossCols]);
  const pageTitle = documentTitle ? `${documentTitle} — ${recapTitle}` : recapTitle;

  const handlePivotExcel = useCallback(() => {
    if (!canExportPivot) {
      message.warning("Aucune donnée à exporter.");
      return;
    }
    exportPivotToExcel(crossPivot, { pageTitle, headerFooterHTML, filtersHtml: filtersSummaryHtml });
  }, [canExportPivot, crossPivot, pageTitle, headerFooterHTML, filtersSummaryHtml]);

  const handlePivotPDF = useCallback(() => {
    if (!canExportPivot) {
      message.warning("Aucune donnée à exporter.");
      return;
    }
    exportPivotToPDF(crossPivot, { pageTitle, headerFooterHTML, filtersPlain: filtersSummaryPlain });
  }, [canExportPivot, crossPivot, pageTitle, headerFooterHTML, filtersSummaryPlain]);

  const handlePivotPrint = useCallback(() => {
    if (!canExportPivot) {
      message.warning("Aucune donnée à imprimer.");
      return;
    }
    const container = document.querySelector(".cross-table-print-container table");
    const tableHTML = container ? container.outerHTML : pivotTableMarkup(crossPivot);
    const { entete = "", pied = "" } = headerFooterHTML;
    const content = `
      <div style="margin-bottom:24px;">
        ${entete}
        <div style="text-align:center;font-size:1.4em;font-weight:bold;margin:12px 0;">
          ${pageTitle}
        </div>
      </div>
      ${filtersSummaryHtml ? `<div style="margin-bottom:16px;font-size:13px;"><strong>Filtres appliqués :</strong><ul style="margin:8px 0 0 18px;">${filtersSummaryHtml}</ul></div>` : ""}
      ${tableHTML}
      <div style="margin-top:32px;">${pied}</div>
    `;
    printPivot({ content });
  }, [canExportPivot, crossPivot, headerFooterHTML, pageTitle, filtersSummaryHtml]);

  const exportChartToWord = useCallback(() => {
    if (!chartSeries.length) {
      message.warning("Aucune donnée graphique à exporter.");
      return;
    }
    const chartLabel = CHART_TYPES.find(item => item.value === chartType)?.label || chartType;
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            ...headerLines.map(line => new Paragraph({ text: line })),
            new Paragraph({ text: pageTitle, heading: HeadingLevel.HEADING_2 }),
            ...filtersSummaryPlain.map(line => new Paragraph({ text: line })),
            new Paragraph({ text: `Visualisation (${chartLabel})` }),
            new Paragraph({ text: `Dimension analysée : ${formatDimensionLabel(chartDimension)}` }),
            new DocxTable({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Valeur", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Effectif", bold: true })] })] })
                  ]
                }),
                ...chartSeries.map(item =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: item.label || "Non renseigné" })] }),
                      new TableCell({ children: [new Paragraph({ text: String(item.value ?? 0) })] })
                    ]
                  })
                )
              ]
            }),
            ...footerLines.map(line => new Paragraph({ text: line }))
          ]
        }
      ]
    });
    Packer.toBlob(doc)
      .then(blob => {
        saveAs(blob, `graphique_${chartType}_${chartDimension}.docx`);
        message.success("Export Word généré.");
      })
      .catch(() => message.error("Export Word impossible."));
  }, [chartSeries, chartType, chartDimension, pageTitle, headerLines, filtersSummaryPlain, footerLines]);

  const resetCrossSettings = useCallback(() => {
    setCrossRows(["region_nom"]);
    setCrossCols(["type"]);
    setMergeRowHeaders(false);
  }, []);

  const handleRowDimChange = useCallback(values => {
    if (values.length > 3) {
      message.warning("Maximum 3 dimensions par axe.");
      values = values.slice(0, 3);
    }
    setCrossRows(values);
  }, []);

  const handleColDimChange = useCallback(values => {
    if (values.length > 3) {
      message.warning("Maximum 3 dimensions par axe.");
      values = values.slice(0, 3);
    }
    setCrossCols(values);
  }, []);

  const handleFilterChange = useCallback((dimension, values) => {
    setDimensionFilters(prev => ({ ...prev, [dimension]: values }));
  }, []);

  const resetDimensionFilters = useCallback(() => {
    setDimensionFilters(
      FILTER_DIMENSIONS.reduce((acc, key) => {
        acc[key] = [];
        return acc;
      }, {})
    );
  }, []);

  return (
    <div className="arme-cross-analysis-page" style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Space wrap align="center" size="large">
          <Button onClick={() => navigate(-1)}>Retour</Button>
          <Tag color="cyan">{filteredData.length} enregistrements filtrés</Tag>
          <Tag color="geekblue">{crossPivot.grandTotal} enregistrements pivot</Tag>
        </Space>
        {headerFooterHTML.entete && (
          <Card size="small" bordered={false} style={{ borderRadius: 12, background: theme.stripeBg }}>
            <div dangerouslySetInnerHTML={{ __html: headerFooterHTML.entete }} />
          </Card>
        )}
        <Card
          size="small"
          title={recapTitle}
          style={{ borderRadius: 12, background: "#f5f6f8", border: "1px solid #d8dbe5" }}
          extra={
            <Space size="small" wrap>
              <Typography.Text strong>Palette</Typography.Text>
              <Select value={tableTheme} onChange={setTableTheme} options={themeOptions} style={{ minWidth: 180 }} size="small" />
            </Space>
          }
        >
          <Row gutter={[8, 8]}>
            {FILTER_DIMENSIONS.map(dimension => (
              <Col xs={24} sm={12} md={8} lg={6} xl={6} key={dimension}>
                <Space direction="vertical" size={2} style={{ width: "100%" }}>
                  <Typography.Text strong>{formatDimensionLabel(dimension)}</Typography.Text>
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="Sélectionner…"
                    value={dimensionFilters[dimension]}
                    onChange={values => handleFilterChange(dimension, values)}
                    options={filterOptions[dimension]}
                    maxTagCount="responsive"
                    showSearch
                    optionFilterProp="label"
                    size="small"
                    style={{ width: "100%" }}
                  />
                </Space>
              </Col>
            ))}
          </Row>
          <Space style={{ marginTop: 12 }} wrap>
            <Button size="small" onClick={resetDimensionFilters} disabled={!hasActiveFilters}>
              Réinitialiser les filtres
            </Button>
          </Space>
        </Card>
        <Space wrap align="center" size="large">
          <Space wrap align="center" size="small">
            <Text strong>Dimensions lignes</Text>
            <Checkbox.Group
              options={rowCheckboxOptions}
              value={crossRows}
              onChange={handleRowDimChange}
              style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
            />
          </Space>
          <Space wrap align="center" size="small">
            <Text strong>Dimensions colonnes</Text>
            <Checkbox.Group
              options={colCheckboxOptions}
              value={crossCols}
              onChange={handleColDimChange}
              style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
            />
          </Space>
          <Space wrap size="small">
            <Button
              icon={<FileExcelOutlined />}
              onClick={handlePivotExcel}
              disabled={!canExportPivot}
            >
              Export Excel
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              onClick={handlePivotPDF}
              disabled={!canExportPivot}
            >
              Export PDF
            </Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={handlePivotPrint}
              disabled={!canExportPivot}
            >
              Imprimer
            </Button>
            <Button onClick={resetCrossSettings} disabled={!crossRows.length && !crossCols.length}>
              Réinitialiser
            </Button>
            <Checkbox checked={mergeRowHeaders} onChange={event => setMergeRowHeaders(event.target.checked)}>
              Fusionner les regroupements
            </Checkbox>
          </Space>
          <Tag color="blue">{crossPivot.grandTotal} enregistrements</Tag>
        </Space>
        <Divider />
        {!(crossRows.length && crossCols.length) ? (
          <Card size="small">
            <Text type="secondary">
              Sélectionnez au moins une dimension pour les lignes et les colonnes afin de générer le tableau croisé.
            </Text>
          </Card>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div className="cross-table-print-container">
              <table
                className="arme-cross-table"
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
                  borderRadius: 12,
                  overflow: "hidden"
                }}
              >
                <thead>
                  <tr>
                    {crossRows.map(dim => (
                      <th
                        key={`row-${dim}`}
                        style={{
                          background: theme.headerBg,
                          color: theme.headerText,
                          padding: "10px 12px"
                        }}
                      >
                        {formatDimensionLabel(dim)}
                      </th>
                    ))}
                    {pivotColumnEntries.map(entry => (
                      <th
                        key={entry.key}
                        style={{
                          background: theme.headerBg,
                          color: theme.headerText,
                          padding: "10px 12px"
                        }}
                      >
                        {entry.label}
                      </th>
                    ))}
                    <th
                      style={{
                        background: theme.headerBg,
                        color: theme.headerText,
                        padding: "10px 12px"
                      }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pivotDisplayRows.length === 0 ? (
                    <tr>
                      <td colSpan={crossRows.length + pivotColumnEntries.length + 1}>
                        Aucune donnée pour cette combinaison.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      let dataRowIndex = 0;
                      return pivotDisplayRows.map((row, idx) => {
                        if (row.type === "data") {
                          const currentIndex = dataRowIndex;
                          dataRowIndex += 1;
                          const zebraBg = currentIndex % 2 === 1 ? theme.stripeBg : theme.bodyBg;
                          return (
                            <tr key={row.rowKey}>
                                                            {crossRows.map((dim, dimIndex) => {
                                                              const span = mergeRowHeaders ? rowSpanMatrix?.[currentIndex]?.[dimIndex] ?? 1 : 1;
                                                              if (span === 0) return null;
                                                              return (
                                                                <td
                                                                  key={`${row.rowKey}-${dim}`}
                                                                  rowSpan={span}
                                                                  style={{
                                                                    background: zebraBg,
                                                                    border: `1px solid ${theme.bodyBorder}`,
                                                                    padding: "8px 10px"
                                                                  }}
                                                                >
                                                                  {row.parts[dimIndex] ?? "—"}
                                                                </td>
                                                              );
                                                            })}
                                                            {pivotColumnEntries.map(entry => (
                                                              <td
                                                                key={`${row.rowKey}-${entry.colKey}`}
                                                                style={{
                                                                  background: zebraBg,
                                                                  border: `1px solid ${theme.bodyBorder}`,
                                                                  padding: "8px 10px",
                                                                  textAlign: "center"
                                                                }}
                                                              >
                                                                {row.values[entry.colIndex] ?? 0}
                                                              </td>
                                                            ))}
                                                            <td
                                                              style={{
                                                                background: zebraBg,
                                                                border: `1px solid ${theme.bodyBorder}`,
                                                                padding: "8px 10px",
                                                                textAlign: "center",
                                                                fontWeight: "bold"
                                                              }}
                                                            >
                                                              {row.total}
                                                            </td>
                                                          </tr>
                                                        );
                                                      }
                                                      return (
                                                        <tr key={`subtotal-${idx}`}>
                                                          <td
                                                            colSpan={crossRows.length}
                                                            style={{
                                                              background: theme.subtotalBg,
                                                              color: theme.subtotalText,
                                                              border: `1px solid ${theme.subtotalBorder}`,
                                                              padding: "8px 10px",
                                                              fontWeight: "bold"
                                                            }}
                                                          >
                                                            {row.label}
                                                          </td>
                                                          {pivotColumnEntries.map(entry => (
                                                            <td
                                                              key={`subtotal-${idx}-${entry.colKey}`}
                                                              style={{
                                                                background: theme.subtotalBg,
                                                                color: theme.subtotalText,
                                                                border: `1px solid ${theme.subtotalBorder}`,
                                                                padding: "8px 10px",
                                                                textAlign: "center",
                                                                fontWeight: "bold"
                                                              }}
                                                            >
                                                              {row.values[entry.colIndex] ?? 0}
                                                            </td>
                                                          ))}
                                                          <td
                                                            style={{
                                                              background: theme.subtotalBg,
                                                              color: theme.subtotalText,
                                                              border: `1px solid ${theme.subtotalBorder}`,
                                                              padding: "8px 10px",
                                                              textAlign: "center",
                                                              fontWeight: "bold"
                                                            }}
                                                          >
                                                            {row.total}
                                                          </td>
                                                        </tr>
                                                      );
                                                    });
                                                  })()
                                                )}
                                              </tbody>
                                              <tfoot>
                                                <tr>
                                                  <td
                                                    colSpan={crossRows.length}
                                                    style={{
                                                      background: theme.totalBg,
                                                      color: theme.totalText,
                                                      padding: "10px 12px",
                                                      fontWeight: "bold"
                                                    }}
                                                  >
                                                    Total général
                                                  </td>
                                                  {pivotColumnEntries.map(entry => (
                                                    <td
                                                      key={`total-${entry.colKey}`}
                                                      style={{
                                                        background: theme.totalBg,
                                                        color: theme.totalText,
                                                        padding: "10px 12px",
                                                        textAlign: "center",
                                                        fontWeight: "bold"
                                                      }}
                                                    >
                                                      {crossPivot.colTotals.get(entry.colKey) ?? 0}
                                                    </td>
                                                  ))}
                                                  <td
                                                    style={{
                                                      background: theme.totalBg,
                                                      color: theme.totalText,
                                                      padding: "10px 12px",
                                                      textAlign: "center",
                                                      fontWeight: "bold"
                                                    }}
                                                  >
                                                    {crossPivot.grandTotal}
                                                  </td>
                                                </tr>
                                              </tfoot>
                                            </table>
                                          </div>
                                        </Space>
                                      )}
                                      <Divider />
                                      <Card
                                        size="small"
                                        title={recapTitle}
                                        style={{ borderRadius: 12, border: `1px solid ${theme.bodyBorder}` }}
                                        extra={
                                          <Space size="small" wrap>
                                            <Select
                                              value={chartDimension}
                                              onChange={setChartDimension}
                                              options={dimensionOptions}
                                              style={{ minWidth: 140 }}
                                              size="small"
                                            />
                                            <Select
                                              value={chartType}
                                              onChange={setChartType}
                                              options={CHART_TYPES}
                                              style={{ minWidth: 120 }}
                                              size="small"
                                            />
                                            <Button
                                              icon={<FileWordOutlined />}
                                              onClick={exportChartToWord}
                                              disabled={!chartSeries.length}
                                              size="small"
                                            >
                                              Export Word
                                            </Button>
                                          </Space>
                                        }
                                      >
                                                                              {chartElement}
                                                                            </Card>
                                              {headerFooterHTML.pied && (
                                                <Card size="small" bordered={false} style={{ borderRadius: 12, background: theme.stripeBg }}>
                                                  <div dangerouslySetInnerHTML={{ __html: headerFooterHTML.pied }} />
                                                </Card>
                                              )}
                                            </Space>
                                          </div>
                                        );
                                      };
                                      
                                      export default ArmeCrossAnalysis;
