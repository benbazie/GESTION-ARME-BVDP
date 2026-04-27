// (Supprimer entièrement ce fichier)
import { Card, Tabs, Typography, Button, Space, Row, Col, message, Form, Input, Modal, Checkbox, Dropdown, Menu } from "antd";
import {
  TableOutlined,
  BarChartOutlined,
  PieChartOutlined,
  RobotOutlined,
  BulbOutlined,
  LineChartOutlined,
  WarningOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  PrinterOutlined,
  ProfileOutlined,
  ExportOutlined,
  SettingOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from "@ant-design/icons";
import api from "../api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph as DocxParagraph, Table as DocxTable, TableRow, TableCell, TextRun } from "docx";
import ExportHeaderFooterConfig from "../components/ExportHeaderFooterConfig";

const { Title, Paragraph, Text } = Typography;

// --- Dimensions disponibles pour le croisement ---
const CROSS_DIMENSIONS = [
  { key: "type", label: "Type d'arme" },
  { key: "categorie", label: "Catégorie" },
  { key: "designation", label: "Désignation" },
  { key: "etat", label: "État" },
  { key: "statut", label: "Statut" },
  { key: "entite_nom", label: "Entité" },
  { key: "sous_entite_nom", label: "Sous-entité" },
  { key: "region_nom", label: "Région" },
  { key: "province_nom", label: "Province" },
  { key: "commune_nom", label: "Commune" },
  { key: "lot", label: "Lot" },
];

// --- Formulaire et tableau croisé dynamique avec cases à cocher, filtres, tri, import/export en-tête ---
function CrossAnalyseAdvanced() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sélection des dimensions (cases à cocher)
  const [rowDims, setRowDims] = useState(["region_nom"]);
  const [colDims, setColDims] = useState(["type"]);
  // Filtres dynamiques par dimension
  const [filters, setFilters] = useState({});
  // Tri dynamique par dimension
  const [sorts, setSorts] = useState({});
  // En-tête/pied de page importé
  const [headerFooterConfig, setHeaderFooterConfig] = useState({});
  const [showHeaderFooterModal, setShowHeaderFooterModal] = useState(false);

  const [reportTitle, setReportTitle] = useState("");
  const [exportModal, setExportModal] = useState(false);

  // Chargement des données armes enrichies
  useEffect(() => {
    setLoading(true);
    api.getArmesList()
      .then(rows => setData(Array.isArray(rows) ? rows : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  // Génère toutes les valeurs distinctes pour chaque dimension
  const allValues = useMemo(() => {
    const values = {};
    CROSS_DIMENSIONS.forEach(dim => {
      values[dim.key] = Array.from(new Set(data.map(item => item[dim.key] || "—")));
    });
    return values;
  }, [data]);

  // Filtres dynamiques
  const filteredData = useMemo(() => {
    return data.filter(row =>
      Object.entries(filters).every(([dim, vals]) =>
        !vals || !vals.length || vals.includes(row[dim] || "—")
      )
    );
  }, [data, filters]);

  // Tri dynamique
  const sortedData = useMemo(() => {
    let arr = [...filteredData];
    Object.entries(sorts).forEach(([dim, dir]) => {
      if (dir) {
        arr = arr.sort((a, b) => {
          const va = a[dim] || "";
          const vb = b[dim] || "";
          if (dir === "asc") return String(va).localeCompare(String(vb));
          if (dir === "desc") return String(vb).localeCompare(String(va));
          return 0;
        });
      }
    });
    return arr;
  }, [filteredData, sorts]);

  // Génère le titre dynamique du rapport
  const dynamicTitle = useMemo(() => {
    if (reportTitle) return reportTitle;
    const rowLabels = rowDims.map(dim => (CROSS_DIMENSIONS.find(d => d.key === dim)?.label || dim)).join(" / ");
    const colLabels = colDims.map(dim => (CROSS_DIMENSIONS.find(d => d.key === dim)?.label || dim)).join(" / ");
    return `Répartition des armes par ${rowLabels} et ${colLabels}`;
  }, [rowDims, colDims, reportTitle]);

  // Génère le tableau croisé dynamique avec sous-totaux
  const pivot = useMemo(() => {
    if (!rowDims.length || !colDims.length || !sortedData.length) return { rows: [], cols: [], data: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };
    const rowKeys = Array.from(new Set(sortedData.map(item => rowDims.map(dim => item[dim] || "—").join(" / "))));
    const colKeys = Array.from(new Set(sortedData.map(item => colDims.map(dim => item[dim] || "—").join(" / "))));
    const pivotData = {};
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;
    sortedData.forEach(item => {
      const rowKey = rowDims.map(dim => item[dim] || "—").join(" / ");
      const colKey = colDims.map(dim => item[dim] || "—").join(" / ");
      if (!pivotData[rowKey]) pivotData[rowKey] = {};
      pivotData[rowKey][colKey] = (pivotData[rowKey][colKey] || 0) + 1;
      rowTotals[rowKey] = (rowTotals[rowKey] || 0) + 1;
      colTotals[colKey] = (colTotals[colKey] || 0) + 1;
      grandTotal += 1;
    });
    return { rows: rowKeys, cols: colKeys, data: pivotData, rowTotals, colTotals, grandTotal };
  }, [sortedData, rowDims, colDims]);

  // Export Excel
  function exportExcel() {
    let html = `<table><thead><tr><th>#</th>`;
    rowDims.forEach(dim => { html += `<th>${CROSS_DIMENSIONS.find(d => d.key === dim)?.label || dim}</th>`; });
    pivot.cols.forEach(col => { html += `<th>${col}</th>`; });
    html += `<th>Total</th></tr></thead><tbody>`;
    pivot.rows.forEach((rowKey, idx) => {
      html += `<tr><td>${idx + 1}</td>`;
      rowKey.split(" / ").forEach(val => { html += `<td>${val}</td>`; });
      pivot.cols.forEach(colKey => { html += `<td>${pivot.data[rowKey]?.[colKey] || ""}</td>`; });
      html += `<td>${pivot.rowTotals[rowKey]}</td></tr>`;
    });
    html += `<tr><td colSpan="${1 + rowDims.length}"><b>Total</b></td>`;
    pivot.cols.forEach(colKey => { html += `<td><b>${pivot.colTotals[colKey]}</b></td>`; });
    html += `<td><b>${pivot.grandTotal}</b></td></tr>`;
    html += `</tbody></table>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    saveAs(blob, "analyse_croisee_armes.xls");
  }

  // Export PDF (auto portrait/paysage)
  function exportPDF() {
    const orientation = (pivot.cols.length + rowDims.length + 2) > 10 ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation });
    doc.setFontSize(13);
    doc.text(headerFooterConfig.headerTitle || "Analyse croisée", doc.internal.pageSize.getWidth() / 2, 14, { align: "center" });
    doc.setFontSize(10);
    doc.text(dynamicTitle, doc.internal.pageSize.getWidth() / 2, 22, { align: "center" });
    const head = [
      "#",
      ...rowDims.map(dim => CROSS_DIMENSIONS.find(d => d.key === dim)?.label || dim),
      ...pivot.cols,
      "Total"
    ];
    const body = pivot.rows.map((rowKey, idx) => [
      idx + 1,
      ...rowKey.split(" / "),
      ...pivot.cols.map(colKey => pivot.data[rowKey]?.[colKey] || ""),
      pivot.rowTotals[rowKey]
    ]);
    body.push([
      "",
      ...Array(rowDims.length).fill(""),
      ...pivot.cols.map(colKey => pivot.colTotals[colKey]),
      pivot.grandTotal
    ]);
    autoTable(doc, {
      head: [head],
      body,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [227, 241, 230], textColor: 31, halign: "center" },
      bodyStyles: { halign: "center" },
      tableWidth: "auto",
      margin: { left: 8, right: 8 },
    });
    doc.text(headerFooterConfig.footerLeft || "", 12, doc.internal.pageSize.getHeight() - 10, { align: "left" });
    doc.text(headerFooterConfig.footerRight || "", doc.internal.pageSize.getWidth() - 12, doc.internal.pageSize.getHeight() - 10, { align: "right" });
    doc.save("analyse_croisee_armes.pdf");
  }

  // Export Word
  async function exportWord() {
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: "#" })] })] }),
          ...rowDims.map(dim =>
            new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: CROSS_DIMENSIONS.find(d => d.key === dim)?.label || dim, bold: true })] })] })
          ),
          ...pivot.cols.map(colKey =>
            new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: colKey, bold: true })] })] })
          ),
          new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: "Total", bold: true })] })] })
        ]
      }),
      ...pivot.rows.map((rowKey, idx) =>
        new TableRow({
          children: [
            new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: String(idx + 1) })] })] }),
            ...rowKey.split(" / ").map(val =>
              new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: val })] })] })
            ),
            ...pivot.cols.map(colKey =>
              new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: String(pivot.data[rowKey]?.[colKey] || "") })] })] })
            ),
            new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: String(pivot.rowTotals[rowKey]) })] })] })
          ]
        })
      ),
      new TableRow({
        children: [
          new TableCell({ children: [new DocxParagraph("")] }),
          ...Array(rowDims.length).fill(new TableCell({ children: [new DocxParagraph("")] })),
          ...pivot.cols.map(colKey =>
            new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: String(pivot.colTotals[colKey]) })] })] })
          ),
          new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: String(pivot.grandTotal) })] })] })
        ]
      })
    ];
    const doc = new Document({
      sections: [{
        children: [
          new DocxParagraph({ text: headerFooterConfig.headerTitle || "Analyse croisée", heading: "Heading1", alignment: "center" }),
          new DocxParagraph({ text: dynamicTitle, alignment: "center" }),
          new DocxTable({ rows: tableRows }),
          new DocxParagraph({ text: headerFooterConfig.footerLeft || "", alignment: "left" }),
          new DocxParagraph({ text: headerFooterConfig.footerRight || "", alignment: "right" }),
        ]
      }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "analyse_croisee_armes.docx");
  }

  // Impression
  function printTable() {
    setExportModal(true);
  }

  // Gestion des cases à cocher pour lignes/colonnes
  function handleCheckboxChange(dim, type, checked) {
    if (type === "row") {
      setRowDims(prev => checked ? Array.from(new Set([...prev, dim])) : prev.filter(d => d !== dim));
    } else {
      setColDims(prev => checked ? Array.from(new Set([...prev, dim])) : prev.filter(d => d !== dim));
    }
  }

  // Gestion des filtres
  function handleFilterChange(dim, vals) {
    setFilters(prev => ({ ...prev, [dim]: vals }));
  }

  // Gestion du tri
  function handleSortChange(dim, dir) {
    setSorts(prev => ({ ...prev, [dim]: dir }));
  }

  // Rendu du tableau croisé
  function renderTable() {
    return (
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table className="analyse-cross-table" style={{ minWidth: 700, width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ background: "#e3f1e6" }}>#</th>
              {rowDims.map(dim => (
                <th key={dim} style={{ background: "#e3f1e6" }}>
                  <Space>
                    {CROSS_DIMENSIONS.find(d => d.key === dim)?.label || dim}
                    <Dropdown
                      overlay={
                        <Menu>
                          <Menu.Item key="asc" icon={<SortAscendingOutlined />} onClick={() => handleSortChange(dim, "asc")}>Tri croissant</Menu.Item>
                          <Menu.Item key="desc" icon={<SortDescendingOutlined />} onClick={() => handleSortChange(dim, "desc")}>Tri décroissant</Menu.Item>
                          <Menu.Item key="none" onClick={() => handleSortChange(dim, null)}>Aucun tri</Menu.Item>
                        </Menu>
                      }
                      trigger={['click']}
                    >
                      <Button size="small" icon={<FilterOutlined />} />
                    </Dropdown>
                    <Dropdown
                      overlay={
                        <Menu>
                          <Menu.Item key="all">
                            <Checkbox.Group
                              options={allValues[dim]?.map(v => ({ label: v, value: v }))}
                              value={filters[dim] || []}
                              onChange={vals => handleFilterChange(dim, vals)}
                            />
                          </Menu.Item>
                        </Menu>
                      }
                      trigger={['click']}
                    >
                      <Button size="small" icon={<SettingOutlined />} />
                    </Dropdown>
                  </Space>
                </th>
              ))}
              {pivot.cols.map(col => (
                <th key={col} style={{ background: "#e3f1e6" }}>{col}</th>
              ))}
              <th style={{ background: "#e3f1e6" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {pivot.rows.map((rowKey, idx) => (
              <tr key={rowKey}>
                <td style={{ fontWeight: "bold", textAlign: "center" }}>{idx + 1}</td>
                {rowKey.split(" / ").map((val, i) => (
                  <td key={i}>{val}</td>
                ))}
                {pivot.cols.map(colKey => (
                  <td key={colKey} style={{ textAlign: "center" }}>{pivot.data[rowKey]?.[colKey] || ""}</td>
                ))}
                <td style={{ fontWeight: "bold", textAlign: "center" }}>{pivot.rowTotals[rowKey]}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={1 + rowDims.length} style={{ fontWeight: "bold", background: "#f6fff8" }}>Total</td>
              {pivot.cols.map(colKey => (
                <td key={colKey} style={{ fontWeight: "bold", background: "#f6fff8", textAlign: "center" }}>{pivot.colTotals[colKey]}</td>
              ))}
              <td style={{ fontWeight: "bold", background: "#f6fff8", textAlign: "center" }}>{pivot.grandTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Card>
      <Form layout="vertical" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Dimensions en lignes (regroupement)">
              <Checkbox.Group
                options={CROSS_DIMENSIONS.map(d => ({ label: d.label, value: d.key }))}
                value={rowDims}
                onChange={vals => setRowDims(vals)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Dimensions en colonnes (croisement)">
              <Checkbox.Group
                options={CROSS_DIMENSIONS.map(d => ({ label: d.label, value: d.key }))}
                value={colDims}
                onChange={vals => setColDims(vals)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Titre du rapport">
              <Input value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="Titre automatique si vide" />
            </Form.Item>
            <Form.Item>
              <Button icon={<SettingOutlined />} onClick={() => setShowHeaderFooterModal(true)}>
                Importer en-tête/pied de page
              </Button>
            </Form.Item>
            <Form.Item>
              <Button icon={<ExportOutlined />} onClick={() => setExportModal(true)}>
                Exporter / Imprimer
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 18, textAlign: "center" }}>
        {dynamicTitle}
      </div>
      {renderTable()}
      <Modal
        open={exportModal}
        title="Exporter ou imprimer le tableau"
        onCancel={() => setExportModal(false)}
        footer={null}
        width={480}
      >
        <Space style={{ marginTop: 16 }}>
          <Button icon={<FileExcelOutlined />} onClick={exportExcel}>Excel</Button>
          <Button icon={<FileTextOutlined />} onClick={exportPDF}>PDF</Button>
          <Button icon={<ProfileOutlined />} onClick={exportWord}>Word</Button>
          <Button icon={<PrinterOutlined />} onClick={() => { setExportModal(false); setTimeout(() => window.print(), 300); }}>Imprimer</Button>
        </Space>
      </Modal>
      <Modal
        open={showHeaderFooterModal}
        title="Importer l'en-tête et le pied de page"
        onCancel={() => setShowHeaderFooterModal(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <ExportHeaderFooterConfig
          value={headerFooterConfig}
          onChange={setHeaderFooterConfig}
        />
      </Modal>
    </Card>
  );
}

// --- Composant Statistiques globales ---
function GlobalStats() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getDashboardArmes().catch(() => ({ total: 0 })),
      api.getDashboardMunitions().catch(() => ({ total: 0 })),
      api.getDashboardDotations().catch(() => ({ total: 0 })),
      api.getDashboardVdp().catch(() => ({ total: 0 })),
    ]).then(([armes, munitions, dotations, vdp]) => {
      setStats({
        armes: armes.total || 0,
        munitions: munitions.total || 0,
        dotations: dotations.total || 0,
        vdp: vdp.total || 0,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <Row gutter={24} style={{ marginBottom: 24 }}>
      <Col xs={24} md={6}>
        <Card loading={loading}>
          <BarChartOutlined style={{ fontSize: 32, color: "#1f78f0" }} />
          <Title level={4}>Armes</Title>
          <Text strong style={{ fontSize: 24 }}>{stats.armes}</Text>
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card loading={loading}>
          <BarChartOutlined style={{ fontSize: 32, color: "#e67e22" }} />
          <Title level={4}>Munitions</Title>
          <Text strong style={{ fontSize: 24 }}>{stats.munitions}</Text>
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card loading={loading}>
          <BarChartOutlined style={{ fontSize: 32, color: "#27ae60" }} />
          <Title level={4}>Dotations</Title>
          <Text strong style={{ fontSize: 24 }}>{stats.dotations}</Text>
        </Card>
      </Col>
      <Col xs={24} md={6}>
        <Card loading={loading}>
          <BarChartOutlined style={{ fontSize: 32, color: "#8e44ad" }} />
          <Title level={4}>VDP</Title>
          <Text strong style={{ fontSize: 24 }}>{stats.vdp}</Text>
        </Card>
      </Col>
    </Row>
  );
}

// --- Composant IA : analyse automatique, conseils, alertes, graphiques ---
function AnalyseIA() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simule une IA qui analyse les stats et propose des conseils/alertes
  useEffect(() => {
    setLoading(true);
    // Ici tu pourrais appeler une API IA ou un service local
    setTimeout(() => {
      setInsights([
        {
          type: "conseil",
          icon: <BulbOutlined style={{ color: "#f1c40f" }} />,
          text: "Le stock de munitions est inférieur au seuil critique dans 2 entités. Pensez à réapprovisionner.",
        },
        {
          type: "alerte",
          icon: <WarningOutlined style={{ color: "#e74c3c" }} />,
          text: "Plus de 10% des armes sont en mauvais état. Planifiez une maintenance.",
        },
        {
          type: "etat",
          icon: <LineChartOutlined style={{ color: "#1f78f0" }} />,
          text: "La dotation d’armes a augmenté de 15% ce trimestre.",
        },
        {
          type: "suggestion",
          icon: <RobotOutlined style={{ color: "#27ae60" }} />,
          text: "Analyse automatique : il est recommandé de croiser les dotations par entité et par type d’arme pour détecter les déséquilibres.",
        },
      ]);
      setLoading(false);
    }, 1200);
  }, []);

  return (
    <Card loading={loading} title={<span><RobotOutlined /> Analyse IA & Conseils</span>} style={{ marginBottom: 24 }}>
      {insights.map((ins, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          {ins.icon}
          <span style={{ marginLeft: 12 }}>{ins.text}</span>
        </div>
      ))}
      <div style={{ marginTop: 16 }}>
        <Button icon={<BarChartOutlined />} type="primary" onClick={() => message.info("Génération de graphique IA à venir")}>
          Générer un graphique IA
        </Button>
      </div>
    </Card>
  );
}

export default function AnalyseModule() {
  const [activeTab, setActiveTab] = useState("cross");

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 32 }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        Analyses et Tableaux Croisés
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Accédez à tous les outils d’analyse avancée (tableaux croisés, statistiques, IA, rapports dynamiques, etc).
      </Paragraph>
      <AnalyseIA />
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "cross",
              label: (
                <span>
                  <TableOutlined /> Analyse croisée avancée
                </span>
              ),
              children: <CrossAnalyseAdvanced />,
            },
            {
              key: "stats",
              label: (
                <span>
                  <BarChartOutlined /> Statistiques globales
                </span>
              ),
              children: <GlobalStats />,
            },
            {
              key: "rapports",
              label: (
                <span>
                  <PieChartOutlined /> Rapports personnalisés
                </span>
              ),
              children: (
                <div>
                  <p>Rapports personnalisés à venir (exports, génération automatique, etc).</p>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
