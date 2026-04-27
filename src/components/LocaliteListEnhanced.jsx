import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  Button,
  Select,
  Input,
  Spin,
  Row,
  Col,
  Space,
  Modal,
  Form,
  message,
  Typography,
  Checkbox,
  Descriptions,
  Tooltip,
  Tag,
  Card
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  PrinterOutlined,
  ReloadOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  UpOutlined,
  DownOutlined,
  ColumnWidthOutlined,
  BarChartOutlined,
  TableOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import './LocaliteList.css';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun } from "docx";
import { saveAs } from "file-saver";
import moment from "moment";

const { Title, Text } = Typography;
const { Option } = Select;

// Configuration des colonnes par défaut
const DEFAULT_COLUMN_KEYS = [
  "rowNumber",
  "region_nom",
  "province_nom",
  "commune_nom",
  "nom",
  "code"
];

const DEFAULT_COLUMN_ORDER = [...DEFAULT_COLUMN_KEYS];

const COLUMN_LABELS = {
  rowNumber: "N°",
  region_nom: "Région",
  province_nom: "Province",
  commune_nom: "Commune",
  nom: "Localité",
  code: "Code"
};

const COLUMN_OPTIONS = [
  { label: "Région", value: "region_nom" },
  { label: "Province", value: "province_nom" },
  { label: "Commune", value: "commune_nom" },
  { label: "Localité", value: "nom" },
  { label: "Code", value: "code" }
];

// Configuration d'impression par défaut
const DEFAULT_PRINT_LAYOUT = {
  headerTitle: "Liste des localités",
  headerSubtitle: "",
  footerLeft: "",
  footerRight: "",
};

// Fonctions utilitaires pour l'impression et l'export
const applyTokens = (value, total = 0) =>
  (value || "")
    .replace(/\{\{date\}\}/g, moment().format("DD/MM/YYYY"))
    .replace(/\{\{total\}\}/g, String(total));

// Fonction pour générer l'entête/pied HTML
function renderHeaderFooterHTML(cfg) {
  if (!cfg) return "";
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

// Fonction pour obtenir le titre du document
function getDocumentTitle(cfg, filters, regions, provinces, communes) {
  if (cfg && (cfg.documentTitle || cfg.headerTitle)) {
    return cfg.documentTitle || cfg.headerTitle;
  }
  let title = "Liste des localités";
  const parts = [];
  if (filters.region_id) {
    const region = regions.find(r => String(r.id) === String(filters.region_id));
    if (region) parts.push(`Région : ${region.nom}`);
  }
  if (filters.province_id) {
    const province = provinces.find(p => String(p.id) === String(filters.province_id));
    if (province) parts.push(`Province : ${province.nom}`);
  }
  if (filters.commune_id) {
    const commune = communes.find(c => String(c.id) === String(filters.commune_id));
    if (commune) parts.push(`Commune : ${commune.nom}`);
  }
  if (parts.length) title += " — " + parts.join(" | ");
  return title;
}

// Fonction d'export Excel améliorée
const exportToExcel = useCallback((records = []) => {
  if (!records.length) {
    message.warning("Aucune donnée à exporter");
    return;
  }
  const headers = ['N°', 'Région', 'Province', 'Commune', 'Localité', 'Code'];
  const rows = records.map((item, idx) => [
    idx + 1,
    item.region_nom || '',
    item.province_nom || '',
    item.commune_nom || '',
    item.nom || '',
    item.code || ''
  ]);
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" /></head>
      <body><table>${[headers, ...rows].map(row =>
        `<tr>${row.map(cell => `<td>${String(cell).replace(/&/g, "&amp;").replace(/</g, "<")}</td>`).join("")}</tr>`
      ).join("")}</table></body>
    </html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "localites.xls";
  link.click();
  URL.revokeObjectURL(url);
  message.success("Export Excel généré");
}, []);

// Fonction d'export PDF améliorée
const exportToPDF = useCallback((records = [], cfg = {}) => {
  if (!records.length) {
    message.warning("Aucune donnée à exporter");
    return;
  }
  const doc = new jsPDF("landscape");
  doc.setFontSize(14);
  const title = getDocumentTitle(cfg, {}, [], [], []);
  doc.text(title, 105, 16, { align: "center" });

  const head = [['N°', 'Région', 'Province', 'Commune', 'Localité', 'Code']];
  const body = records.map((item, idx) => [
    idx + 1,
    item.region_nom || '—',
    item.province_nom || '—',
    item.commune_nom || '—',
    item.nom || '—',
    item.code || '—'
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 24,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [227,241,230], textColor: 31, halign: "center" },
    bodyStyles: { halign: "center" }
  });
  doc.save("localites.pdf");
  message.success("Export PDF généré");
}, []);

// Fonction d'export Word
const exportToWord = useCallback(async (records = [], cfg = {}) => {
  if (!records.length) {
    message.warning("Aucune donnée à exporter");
    return;
  }

  const title = getDocumentTitle(cfg, {}, [], [], []);
  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "N°", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Région", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Province", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Commune", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Localité", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Code", bold: true })] })] })
      ]
    }),
    ...records.map((item, idx) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1) })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.region_nom || '—' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.province_nom || '—' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.commune_nom || '—' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.nom || '—' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.code || '—' })] })] })
        ]
      })
    )
  ];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: title, heading: "Heading1", alignment: "center" }),
        new DocxTable({ rows: tableRows })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "localites.docx");
  message.success("Export Word généré");
}, []);

// Fonction d'impression améliorée
const handlePrint = useCallback((records = [], cfg = {}) => {
  if (!records.length) {
    message.warning("Aucune donnée à imprimer");
    return;
  }

  const markup = buildPrintableMarkup(records, cfg);
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) return;

  win.document.write(`
    <html>
      <head>
        <title>Liste des localités</title>
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
}, []);

// Fonction pour construire le markup imprimable
const buildPrintableMarkup = useCallback((records = [], cfg = {}) => {
  const headRow = `<tr><th>N°</th><th>Région</th><th>Province</th><th>Commune</th><th>Localité</th><th>Code</th></tr>`;
  const bodyRows = records.length
    ? records.map((record, idx) =>
        `<tr><td>${idx + 1}</td><td>${record.region_nom || "—"}</td><td>${record.province_nom || "—"}</td><td>${record.commune_nom || "—"}</td><td>${record.nom || "—"}</td><td>${record.code || "—"}</td></tr>`
      ).join("")
    : `<tr><td colspan="6">Aucune donnée</td></tr>`;

  const { entete, pied } = renderHeaderFooterHTML(cfg);
  const docTitle = getDocumentTitle(cfg, {}, [], [], []);

  return `
    <div style="margin-bottom:24px;">
      ${entete}
      <div style="text-align:center;font-size:1.6em;font-weight:bold;margin:12px 0 18px 0;">
        ${docTitle}
      </div>
      <div class="print-summary">
        <div><strong>Total localités :</strong> ${records.length}</div>
        <div><strong>Date d'impression :</strong> ${moment().format("DD/MM/YYYY")}</div>
      </div>
    </div>
    <div>
      <table class="print-table">
        <thead>${headRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div style="margin-top:32px;">
      ${pied}
    </div>
  `;
}, []);
