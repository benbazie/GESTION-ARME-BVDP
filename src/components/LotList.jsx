import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Table,
  Input,
  Button,
  Space,
  message,
  Empty,
  Card,
  Typography,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  PrinterOutlined,
  FileExcelOutlined,
  FileWordOutlined
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import "./LotList.css";
import { Document, Packer, Paragraph, Table as DocxTable, TableRow, TableCell, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import api from "../api";
import { renderToStaticMarkup } from "react-dom/server";

/* wait for preload to expose electronAPI (timeout ms) */
const waitForElectronAPI = (timeout = 2000) => new Promise((resolve, reject) => {
  if (typeof window === "undefined") return resolve(null);
  if (window.electronAPI) return resolve(window.electronAPI);
  const start = Date.now();
  const tick = () => {
    if (window.electronAPI) return resolve(window.electronAPI);
    if (Date.now() - start > timeout) return resolve(null);
    setTimeout(tick, 50);
  };
  tick();
});

/* create a local copy of electronAPI so we never mutate the original */
const getLocalApi = () => {
  const base = (typeof window !== "undefined" && window.electronAPI) ? window.electronAPI : null;
  return base ? Object.assign({}, base) : null;
}

/* robust safeCall: try electronAPI[name], electronAPI.call, legacy window.api, then fetch fallback */
async function safeCall(variants = [], ...args) {
  const names = Array.isArray(variants) ? variants : [variants];
  const hasWindow = typeof window !== "undefined";

  const tokenFromStorage = () => {
    try {
      return hasWindow && (localStorage.getItem("auth-token") || localStorage.getItem("auth_token")) || null;
    } catch { return null; }
  };

  const fetchFallback = async (name, ...a) => {
    try {
      const raw = String(name || "")
        .replace(/^(get|create|update|delete)/i, "")
        .replace(/List$|ById$|ByID$/i, "")
        .replace(/[A-Z]/g, m => '_' + m.toLowerCase())
        .replace(/^_/, '')
        .toLowerCase()
        .trim();
      if (!raw) return null;

      const verb = /^get/i.test(name) ? "GET" :
                   /^create/i.test(name) ? "POST" :
                   /^update/i.test(name) ? "PUT" :
                   /^delete/i.test(name) ? "DELETE" : "GET";

      const base = (typeof location !== "undefined" && location.origin) ? `${location.origin}` : "http://localhost:3001";
      const url = `${base}/api/${raw}${verb === 'GET' && a[0] && (typeof a[0] === 'string' || typeof a[0] === 'number') ? `/${a[0]}` : ''}`;
      const headers = { "Content-Type": "application/json" };
      const tk = tokenFromStorage();
      if (tk) headers.Authorization = tk.startsWith("Bearer ") ? tk : `Bearer ${tk}`;

      if (verb === "GET") {
        const params = a[0] && typeof a[0] === "object" ? new URLSearchParams(Object.entries(a[0]).filter(([,v])=>v!=null&&v!=='')).toString() : "";
        const final = params ? `${url}?${params}` : url;
        const res = await fetch(final, { method: 'GET', headers });
        if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
        if (!res.ok) return null;
        return await res.json().catch(()=>null);
      }

      if (verb === "POST") {
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(a[0]||{}) });
        if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
        if (!res.ok) return null;
        return await res.json().catch(()=>null);
      }

      if (verb === "PUT") {
        const id = a[0] && (a[0].id || a[0]._id) ? `/${a[0].id||a[0]._id}` : '';
        const res = await fetch(`${url}${id}`, { method: 'PUT', headers, body: JSON.stringify(a[0]||{}) });
        if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
        if (!res.ok) return null;
        return await res.json().catch(()=>null);
      }

      if (verb === "DELETE") {
        const id = a[0] || "";
        const res = await fetch(`${url}/${id}`, { method: 'DELETE', headers });
        if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
        if (!res.ok) return null;
        return await res.json().catch(()=>null);
      }
    } catch (e) {
      if (e && e.status === 401) throw e;
      return null;
    }
    return null;
  };

  for (const name of names) {
    try {
      // 1) direct electronAPI[name] (safe local copy, never mutating window.electronAPI)
      const localApi = getLocalApi();
      if (localApi && typeof localApi[name] === "function") {
        const r = await localApi[name](...args);
        return r;
      }
      // 2) electronAPI.call if available
      if (hasWindow && window.electronAPI && typeof window.electronAPI.call === "function") {
        try {
          const r = await window.electronAPI.call(name, ...(args.length ? args : [{}]));
          return r;
        } catch (e) {
          if (e && e.status === 401) throw e;
        }
      }
      // 3) legacy window.api.call
      if (hasWindow && window.api && typeof window.api.call === "function") {
        try {
          const r = await window.api.call(name, ...(args.length ? args : [{}]));
          return r;
        } catch (e) { /* ignore */ }
      }
      // 4) legacy window.api[name]
      if (hasWindow && window.api && typeof window.api[name] === "function") {
        try {
          const r = await window.api[name](...args);
          return r;
        } catch (e) { /* ignore */ }
      }
      // 5) fetch fallback
      const fetched = await fetchFallback(name, ...args);
      if (fetched !== null) return fetched;
    } catch (err) {
      if (err && err.status === 401) throw err;
      console.warn(`[safeCall] ${name} failed:`, err && (err.message || err));
    }
  }
  return [];
}

const { Title, Text } = Typography;

export default function LotList() {
  const navigate = useNavigate();
  const [lots, setLots] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const [headerFooterConfig, setHeaderFooterConfig] = useState({});

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      // wait briefly for electronAPI to be ready if used
      await waitForElectronAPI(1500);
      await loadLots();
    })();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const loadLots = async () => {
    setLoading(true);
    try {
      const result = await safeCall(
        ['getLotsList', 'getLots', 'getLotList', 'getlots', 'lots'],
        {}
      );
      let rows = [];
      if (Array.isArray(result)) rows = result;
      else if (result && Array.isArray(result.rows)) rows = result.rows;
      else if (result && Array.isArray(result.data)) rows = result.data;
      else if (result && Array.isArray(result.items)) rows = result.items;
      else rows = [];

      if (!mountedRef.current) return;
      setLots(rows);
    } catch (err) {
      console.error("getLots", err);
      if (err && err.status === 401) {
        message.error("Non autorisé. Veuillez vous connecter.");
      } else {
        message.error("Erreur lors du chargement des lots");
      }
      if (mountedRef.current) setLots([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "auth-token" || e.key === "auth_token") {
        loadLots();
      }
    };
    window.addEventListener && window.addEventListener("storage", onStorage);
    return () => window.removeEventListener && window.removeEventListener("storage", onStorage);
  }, []);

  const filtered = useMemo(() => {
    const needle = searchText.toLowerCase().trim();
    const base = lots.filter(lot => {
      const label = String(lot.designation || lot.name || lot.libelle || "");
      return label.toLowerCase().includes(needle);
    });
    return base.map((item, index) => ({ ...item, __rowNumber: index + 1 }));
  }, [lots, searchText]);

  const columns = [
    {
      title: "N°",
      dataIndex: "__rowNumber",
      key: "rowNumber",
      width: 80,
      align: "center",
      exporter: row => row.__rowNumber ?? "—",
    },
    {
      title: "Désignation",
      dataIndex: "designation",
      key: "designation",
      render: (_, record) => record.designation || record.name || record.libelle || "—",
      sorter: (a, b) => String(a.designation || a.name || "").localeCompare(String(b.designation || b.name || "")),
      exporter: record => record.designation || record.name || record.libelle || "—",
    },
    {
      title: "Date de début",
      dataIndex: "periode_debut",
      key: "periode_debut",
      render: (d, r) => {
        const v = d || r.date_debut || r.periode_debut;
        return v ? new Date(v).toLocaleDateString() : "N/A";
      },
      sorter: (a, b) => new Date(a.periode_debut || a.date_debut || 0) - new Date(b.periode_debut || b.date_debut || 0)
    },
    {
      title: "Date de fin",
      dataIndex: "periode_fin",
      key: "periode_fin",
      render: (d, r) => {
        const v = d || r.date_fin || r.periode_fin;
        return v ? new Date(v).toLocaleDateString() : "N/A";
      },
      sorter: (a, b) => new Date(a.periode_fin || a.date_fin || 0) - new Date(b.periode_fin || b.date_fin || 0)
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (_, r) => r.description || r.justificatif || "—",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Link to={`/dashboard/lots/edit/${record.id || record._id || record.uuid || ''}`}>
            <Button type="primary">Modifier</Button>
          </Link>
        </Space>
      )
    }
  ];

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
    const parts = ["Liste des lots"];
    if (searchText.trim()) parts.push(`Recherche : ${searchText.trim()}`);
    return parts.join(" — ");
  }, [headerFooterConfig, searchText]);
  const buildSummaryLines = useCallback(() => {
    const lines = [`Total : ${filtered.length} lot${filtered.length > 1 ? "s" : ""}`];
    if (searchText.trim()) lines.push(`Filtre recherche : "${searchText.trim()}"`);
    return lines;
  }, [filtered, searchText]);
  const formatCellValue = useCallback(value => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (React.isValidElement(value)) return renderToStaticMarkup(value);
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }, []);
  const buildPrintableMarkup = useCallback((dataset) => {
    const { entete, pied } = renderHeaderFooterHTML(headerFooterConfig);
    const summaryLines = buildSummaryLines(dataset);
    const headRow = columns
      .filter(col => col.key !== "actions")
      .map(col => `<th>${col.title}</th>`)
      .join("");
    const bodyRows = dataset.length
      ? dataset
          .map(row => `<tr>${
              columns
                .filter(col => col.key !== "actions")
                .map(col => {
                  const raw = col.exporter ? col.exporter(row) : (typeof col.render === "function" ? col.render(row[col.dataIndex], row, 0) : row[col.dataIndex]);
                  return `<td>${formatCellValue(raw)}</td>`;
                })
                .join("")
            }</tr>`)
          .join("")
      : `<tr><td colspan="${Math.max(1, columns.length - 1)}">Aucune donnée</td></tr>`;
    return `
      ${entete}
      <div style="text-align:center;margin:12px 0 18px 0;">
        <h1 style="margin:0;font-size:20px;">${getDocumentTitle()}</h1>
      </div>
      ${summaryLines.length ? `<div style="margin-bottom:12px;font-size:13px;">${summaryLines.map(line => `<div>${line}</div>`).join("")}</div>` : ""}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${headRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${pied}
    `;
  }, [columns, headerFooterConfig, renderHeaderFooterHTML, getDocumentTitle, buildSummaryLines, formatCellValue]);
  const handlePrint = useCallback(
    (dataset = filtered) => {
      if (!dataset.length) {
        message.warning("Aucune donnée à imprimer.");
        return;
      }
      const markup = buildPrintableMarkup(dataset);
      const win = window.open("", "_blank", "width=1200,height=900");
      if (!win) return;
      win.document.write(`
        <html>
          <head>
            <title>${getDocumentTitle()}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #1f2f25; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #b0c4b1; padding: 6px 8px; font-size: 12px; text-align: left; }
              th { background: #e3f1e6; text-transform: uppercase; letter-spacing: 0.4px; }
            </style>
          </head>
          <body>${markup}</body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    },
    [filtered, buildPrintableMarkup, getDocumentTitle]
  );
  const exportToExcel = useCallback(
    (dataset = filtered) => {
      if (!dataset.length) {
        message.warning("Aucune donnée à exporter.");
        return;
      }
      const html = buildPrintableMarkup(dataset);
      const blob = new Blob([`<html><head><meta charset="utf-8"/></head><body>${html}</body></html>`], {
        type: "application/vnd.ms-excel",
      });
      saveAs(blob, "lots.xls");
    },
    [filtered, buildPrintableMarkup]
  );
  const exportToWord = useCallback(
    (dataset = filtered) => {
      if (!dataset.length) {
        message.warning("Aucune donnée à exporter.");
        return;
      }
      const summaryLines = buildSummaryLines(dataset);
      const headerRow = new TableRow({
        children: columns
          .filter(col => col.key !== "actions")
          .map(col =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: String(col.title), bold: true })] })],
            })
          ),
      });
      const bodyRows = dataset.map(row =>
        new TableRow({
          children: columns
            .filter(col => col.key !== "actions")
            .map(col => {
              const value =
                typeof col.render === "function"
                  ? col.render(row[col.dataIndex], row, 0) ?? row[col.dataIndex]
                  : row[col.dataIndex];
              return new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: formatCellValue(raw) })] })],
              });
            }),
        })
      );
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: getDocumentTitle(), heading: "Heading1", alignment: AlignmentType.CENTER }),
              ...(summaryLines.length ? [new Paragraph({ text: " " }), ...summaryLines.map(line => new Paragraph({ text: line }))] : []),
              new DocxTable({ rows: [headerRow, ...bodyRows] }),
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
        .then(blob => saveAs(blob, "lots.docx"))
        .then(() => message.success("Export Word généré."))
        .catch(() => message.error("Échec de l’export Word."));
    },
    [filtered, columns, buildSummaryLines, getDocumentTitle, headerFooterConfig]
  );

  return (
    <div className="lot-list-page">
      <div className="lot-list-overlay" />
      <Card className="lot-list-shell" bordered={false}>
        <div className="lot-list-header">
          <div>
            <Title level={3} className="lot-list-title">Gestion des lots</Title>
            <Text className="lot-list-subtitle">
              Consultez, recherchez et mettez à jour les lots d’armement en un coup d’œil.
            </Text>
          </div>
          <Space className="lot-list-actions" wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/dashboard/lots/add")}
            >
              Ajouter un lot
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadLots}>
              Rafraîchir
            </Button>
          </Space>
        </div>

        <Card className="lot-list-search-card" size="small" bordered={false}>
          <Input
            className="lot-list-search-input"
            placeholder="Rechercher par désignation..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
          />
        </Card>

        <Card className="lot-list-table-card" size="small" bordered={false}>
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey={r => r.id || r._id || r.uuid || Math.random().toString(36).slice(2, 9)}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            bordered
            loading={loading}
            locale={{ emptyText: <Empty description="Aucun lot trouvé" /> }}
            summary={() => (
              <Table.Summary>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} colSpan={columns.length - 1}>
                    {`${filtered.length} lot${filtered.length > 1 ? "s" : ""}`}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
        <Card className="lot-list-preview-card" size="small" bordered={false}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Text strong>Impression & export</Text>
            <Text type="secondary">Utilise la configuration d’entête/pied définie dans l’administration.</Text>
            <Space wrap>
              <Button onClick={() => handlePrint()} icon={<PrinterOutlined />}>
                Imprimer
              </Button>
              <Button onClick={() => exportToExcel()} icon={<FileExcelOutlined />}>
                Export Excel
              </Button>
              <Button onClick={() => exportToWord()} icon={<FileWordOutlined />}>
                Export Word
              </Button>
            </Space>
          </Space>
        </Card>
      </Card>
    </div>
  );
}
