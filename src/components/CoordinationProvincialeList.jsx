import React, { useEffect, useState, useMemo } from "react";
import { Table, Button, Space, Card, Row, Col, Input, Select, message, Popconfirm, Modal, Descriptions } from "antd";
import { PlusOutlined, PrinterOutlined, DownloadOutlined, ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./CoordinationProvincialeList.css";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import api from "../api";

const { Option } = Select;

const renderHeaderFooterHTML = cfg => {
  if (!cfg) return { entete: "", pied: "" };
  const institutions = Array.isArray(cfg.institutions) ? cfg.institutions : [];
  const entete = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="flex:2;">
        ${institutions.map(inst => `<div style="font-weight:${inst.bold ? "bold" : "normal"};font-style:${inst.italic ? "italic" : "normal"};text-decoration:${inst.underline ? "underline" : "none"};color:${inst.color || "#222"};">${inst.text || ""}</div>`).join("")}
      </div>
      <div style="text-align:center;">${cfg.logoUrl ? `<img src="${cfg.logoUrl}" alt="logo" style="max-height:60px;" />` : ""}</div>
      <div style="flex:1;text-align:right;">
        <div>${cfg.pays || ""}</div>
        <div>${cfg.devise || ""}</div>
      </div>
    </div>
    <hr style="margin:8px 0;" />
  `;
  const pied = `
    <div style="margin-top:32px;text-align:${cfg.signataireAlign || "right"};">
      <div>${cfg.signataire || ""}</div>
      <div>${cfg.grade || ""}</div>
      <div>${cfg.titre || ""}</div>
      ${cfg.signatureUrl ? `<img src="${cfg.signatureUrl}" alt="signature" style="max-height:40px;" />` : ""}
    </div>
  `;
  return { entete, pied };
};

const getDocumentTitle = (cfg, filters, regions, provinces, regionales) => {
  if (cfg?.documentTitle || cfg?.headerTitle) return cfg.documentTitle || cfg.headerTitle;
  const parts = [];
  if (filters.region) {
    const label = regions.find(r => String(r.id) === String(filters.region))?.nom;
    if (label) parts.push(`Région : ${label}`);
  }
  if (filters.province) {
    const label = provinces.find(p => String(p.id) === String(filters.province))?.nom;
    if (label) parts.push(`Province : ${label}`);
  }
  if (filters.regionale) {
    const label = regionales.find(r => String(r.id) === String(filters.regionale))?.nom;
    if (label) parts.push(`Coord. Régionale : ${label}`);
  }
  return `Liste des Coordinations Provinciales${parts.length ? " — " + parts.join(" | ") : ""}`;
};

export default function CoordinationProvincialeList() {
  const [headerFooterConfig, setHeaderFooterConfig] = useState(null);
  const [data, setData] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [regions, setRegions] = useState([]);
  const [regionales, setRegionales] = useState([]);
  const [filterProvince, setFilterProvince] = useState(null);
  const [filterRegion, setFilterRegion] = useState(null);
  const [filterRegionale, setFilterRegionale] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.electronAPI.getCoordinationProvincialeList?.() || window.electronAPI.getCoordinationProvinciales?.(),
      window.electronAPI.getProvinces?.(),
      window.electronAPI.getRegions?.(),
      window.electronAPI.getCoordinationRegionaleList?.() || window.electronAPI.getCoordinationRegionales?.()
    ]).then(([provinciales, provs, regs, regios]) => {
      setData(Array.isArray(provinciales) ? provinciales : []);
      setProvinces(Array.isArray(provs) ? provs : []);
      setRegions(Array.isArray(regs) ? regs : []);
      setRegionales(Array.isArray(regios) ? regios : []);
    }).catch(() => {
      message.error("Erreur lors du chargement des données");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const configs = await api.getAppConfigList?.();
        const found = configs?.find(c => c.nom_param === "header_footer");
        if (found?.valeur) setHeaderFooterConfig(JSON.parse(found.valeur));
      } catch (_) {}
    })();
  }, []);

  const getNom = (arr, id) => (arr.find(x => String(x.id) === String(id))?.nom || "");

  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterProvince) d = d.filter(r => String(r.province_id) === String(filterProvince));
    if (filterRegion) d = d.filter(r => String(r.region_id) === String(filterRegion));
    if (filterRegionale) d = d.filter(r => String(r.parent_id) === String(filterRegionale));
    if (search.trim()) d = d.filter(r =>
      (r.nom || "").toLowerCase().includes(search.toLowerCase())
      || getNom(provinces, r.province_id).toLowerCase().includes(search.toLowerCase())
    );
    return d;
  }, [data, filterProvince, filterRegion, filterRegionale, search, provinces]);

  // Export CSV
  const handleExportCSV = () => {
    const rows = [["#", "Nom", "Code", "Province", "Région", "Coord. Régionale"]];
    data.forEach((r, idx) => {
      rows.push([
        idx + 1,
        r.nom,
        r.code,
        getNom(provinces, r.province_id),
        getNom(regions, r.region_id),
        getNom(regionales, r.parent_id)
      ]);
    });
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coordinations_provinciales.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Excel
  const handleExportExcel = () => {
    const rows = [["#", "Nom", "Code", "Province", "Région", "Coord. Régionale"]];
    data.forEach((r, idx) => {
      rows.push([
        idx + 1,
        r.nom,
        r.code,
        getNom(provinces, r.province_id),
        getNom(regions, r.region_id),
        getNom(regionales, r.parent_id)
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CoordinationsProvinciales");
    XLSX.writeFile(wb, "coordinations_provinciales.xlsx");
  };

  // Export Word
  const handleExportWord = () => {
    let html = `<table border="1" style="border-collapse:collapse;"><tr><th>#</th><th>Nom</th><th>Code</th><th>Province</th><th>Région</th><th>Coord. Régionale</th></tr>`;
    data.forEach((r, idx) => {
      html += `<tr>
        <td>${idx + 1}</td>
        <td>${r.nom}</td>
        <td>${r.code}</td>
        <td>${getNom(provinces, r.province_id)}</td>
        <td>${getNom(regions, r.region_id)}</td>
        <td>${getNom(regionales, r.parent_id)}</td>
      </tr>`;
    });
    html += "</table>";
    const blob = new Blob(
      [`<html><head><meta charset="utf-8"></head><body>${html}</body></html>`],
      { type: "application/msword" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coordinations_provinciales.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: data.length > 6 ? "landscape" : "portrait",
      unit: "pt",
      format: "a4"
    });
    doc.text("Liste des Coordinations Provinciales", 40, 30);
    autoTable(doc, {
      startY: 50,
      head: [["#", "Nom", "Code", "Province", "Région", "Coord. Régionale"]],
      body: data.map((r, idx) => [
        idx + 1,
        r.nom,
        r.code,
        getNom(provinces, r.province_id),
        getNom(regions, r.region_id),
        getNom(regionales, r.parent_id)
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [24, 144, 255] },
      margin: { left: 20, right: 20 }
    });
    doc.save("coordinations_provinciales.pdf");
  };

  // Impression paysage si trop large
  const handlePrint = () => {
    const { entete, pied } = renderHeaderFooterHTML(headerFooterConfig);
    const docTitle = getDocumentTitle(
      headerFooterConfig,
      { region: filterRegion, province: filterProvince, regionale: filterRegionale },
      regions,
      provinces,
      regionales
    );
    const summary = `
      <div class="print-summary">
        <div><strong>Région :</strong> ${filterRegion ? getNom(regions, filterRegion) : "Toutes"}</div>
        <div><strong>Province :</strong> ${filterProvince ? getNom(provinces, filterProvince) : "Toutes"}</div>
        <div><strong>Coord. Régionale :</strong> ${filterRegionale ? getNom(regionales, filterRegionale) : "Toutes"}</div>
        <div><strong>Total filtré :</strong> ${filteredData.length}</div>
      </div>
    `;
    const rowsHtml = filteredData
      .map((r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${r.nom || "—"}</td>
          <td>${r.code || "—"}</td>
          <td>${getNom(provinces, r.province_id) || "—"}</td>
          <td>${getNom(regions, r.region_id) || "—"}</td>
          <td>${getNom(regionales, r.parent_id) || "—"}</td>
        </tr>
      `)
      .join("");
    const html = `
      <div>${entete}</div>
      <div style="text-align:center;font-size:20px;font-weight:bold;margin:12px 0;">${docTitle}</div>
      ${summary}
      <table class="print-table">
        <thead>
          <tr>
            <th>#</th><th>Nom</th><th>Code</th><th>Province</th><th>Région</th><th>Coord. Régionale</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || `<tr><td colspan="6">Aucune donnée</td></tr>`}</tbody>
      </table>
      <div>${pied}</div>
    `;
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2f25; }
            .print-summary div { margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #c7d4dd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f0f6fb; text-transform: uppercase; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleDelete = async (record) => {
    const api = window.electronAPI || window.api || {};
    const remover =
      api.deleteCoordinationProvinciale ||
      api.removeCoordinationProvinciale ||
      (api.call ? (id) => api.call("deleteCoordinationProvinciale", id) : null);

    if (typeof remover !== "function") {
      message.error("Suppression indisponible.");
      return;
    }
    try {
      await remover(record.id ?? record);
      message.success("Coordination supprimée.");
      setData(prev => prev.filter(item => item.id !== record.id));
    } catch (error) {
      console.error("[CoordinationProvincialeList] delete", error);
      message.error("Échec de la suppression.");
    }
  };

  const openDetail = (record) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const columns = [
    {
      title: "N°",
      dataIndex: "numero",
      key: "numero",
      width: 60,
      align: "center",
      render: (_, __, idx) => idx + 1
    },
    {
      title: "Nom",
      dataIndex: "nom",
      key: "nom",
      render: (v) => <b>{v}</b>
    },
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      align: "center"
    },
    {
      title: "Province",
      dataIndex: "province_id",
      key: "province_id",
      render: (id) => getNom(provinces, id)
    },
    {
      title: "Région",
      dataIndex: "region_id",
      key: "region_id",
      render: (id) => getNom(regions, id)
    },
    {
      title: "Coord. Régionale",
      dataIndex: "parent_id",
      key: "parent_id",
      render: (id) => getNom(regionales, id)
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>Détails</Button>
          <Button type="link" onClick={() => navigate(`/dashboard/coordinations/provinciale/edit/${record.id}`)}>Modifier</Button>
          <Popconfirm
            title="Supprimer cette coordination ?"
            okText="Oui"
            cancelText="Non"
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const stats = useMemo(() => {
    const total = filteredData.length;
    const parRegion = {};
    filteredData.forEach(r => {
      const reg = getNom(regions, r.region_id) || "Inconnue";
      parRegion[reg] = (parRegion[reg] || 0) + 1;
    });
    return { total, parRegion };
  }, [filteredData, regions]);

  return (
    <div className="coord-provinciale-list-container">
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <span style={{ fontSize: 22, fontWeight: 700 }}>Liste des Coordinations Provinciales</span>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()} />
                <Button onClick={handleExportCSV}>CSV</Button>
                <Button onClick={handleExportExcel}>Excel</Button>
                <Button onClick={handleExportWord}>Word</Button>
                <Button onClick={handleExportPDF}>PDF</Button>
                <Button onClick={handlePrint}>Imprimer</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/dashboard/coordinations/provinciale/add")}>
                  Ajouter
                </Button>
              </Space>
            </Col>
          </Row>
        }
        style={{ margin: "24px" }}
        className="coord-provinciale-list-card"
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Recherche..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filtrer par région"
              allowClear
              style={{ width: "100%" }}
              value={filterRegion}
              onChange={setFilterRegion}
            >
              {regions.map(r => (
                <Option key={r.id} value={r.id}>{r.nom}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filtrer par province"
              allowClear
              style={{ width: "100%" }}
              value={filterProvince}
              onChange={setFilterProvince}
            >
              {provinces.map(p => (
                <Option key={p.id} value={p.id}>{p.nom}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filtrer par coordination régionale"
              allowClear
              style={{ width: "100%" }}
              value={filterRegionale}
              onChange={setFilterRegionale}
            >
              {regionales.map(r => (
                <Option key={r.id} value={r.id}>{r.nom}</Option>
              ))}
            </Select>
          </Col>
        </Row>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{ pageSize: 12 }}
          bordered
          className="coord-provinciale-table"
          loading={loading}
        />
        <Card
          type="inner"
          title="Statistiques"
          style={{ marginTop: 24, background: "#f6faff", border: "1px solid #e6f7ff" }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
            Total : {stats.total} coordination{stats.total > 1 ? "s" : ""}
          </div>
          <div>
            {Object.entries(stats.parRegion).map(([region, count]) => (
              <div key={region} style={{ marginBottom: 4 }}>
                <span style={{ color: "#1890ff", fontWeight: 500 }}>{region}</span> : <b>{count}</b>
              </div>
            ))}
          </div>
        </Card>
      </Card>
      <Modal
        open={detailOpen}
        title={detailRecord ? detailRecord.nom : "Détails coordination provinciale"}
        onCancel={() => setDetailOpen(false)}
        footer={null}
      >
        {detailRecord && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Nom">{detailRecord.nom}</Descriptions.Item>
            <Descriptions.Item label="Code">{detailRecord.code || "—"}</Descriptions.Item>
            <Descriptions.Item label="Province">{getNom(provinces, detailRecord.province_id) || "—"}</Descriptions.Item>
            <Descriptions.Item label="Région">{getNom(regions, detailRecord.region_id) || "—"}</Descriptions.Item>
            <Descriptions.Item label="Coordination régionale">{getNom(regionales, detailRecord.parent_id) || "—"}</Descriptions.Item>
            <Descriptions.Item label="Description">{detailRecord.description || "—"}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
