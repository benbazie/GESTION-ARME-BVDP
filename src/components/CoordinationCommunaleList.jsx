import React, { useState, useEffect, useMemo } from "react";
import { Table, Button, Space, Card, Row, Col, Input, Select, message } from "antd";
import { PlusOutlined, PrinterOutlined, DownloadOutlined, ReloadOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./CoordinationCommunaleList.css";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const { Option } = Select;

export default function CoordinationCommunaleList() {
  // 1. Tous les useState
  const [data, setData] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [regions, setRegions] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [provinciales, setProvinciales] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterProvince, setFilterProvince] = useState(null);
  const [filterRegion, setFilterRegion] = useState(null);
  const [search, setSearch] = useState("");
  const [pivotRow, setPivotRow] = useState("parent_id");
  const [pivotCol, setPivotCol] = useState("province_id");
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  // Helpers pour noms
  const getNom = (arr, id) => (arr.find(x => String(x.id) === String(id))?.nom || "");

  // 3. Chargement des données (useEffect)
  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.electronAPI.getCoordinationCommunaleList?.() || window.electronAPI.getCoordinationCommunales?.(),
      window.electronAPI.getProvinces?.(),
      window.electronAPI.getRegions?.(),
      window.electronAPI.getCommunes?.(),
      window.electronAPI.getCoordinationProvincialeList?.() || window.electronAPI.getCoordinationProvinciales?.(),
      window.electronAPI.getLocalites?.()
    ]).then(([cc, provs, regs, comms, provincs, locs]) => {
      setData(Array.isArray(cc) ? cc : []);
      setProvinces(Array.isArray(provs) ? provs : []);
      setRegions(Array.isArray(regs) ? regs : []);
      setCommunes(Array.isArray(comms) ? comms : []);
      setProvinciales(Array.isArray(provincs) ? provincs : []);
      setLocalites(Array.isArray(locs) ? locs : []);
    }).catch(() => {
      message.error("Erreur lors du chargement des données");
    }).finally(() => setLoading(false));
  }, []);

  // Dimensions disponibles pour le pivot
  const pivotOptions = [
    { value: "parent_id", label: "Coordination Provinciale", getLabel: id => getNom(provinciales, id) },
    { value: "province_id", label: "Province", getLabel: id => getNom(provinces, id) },
    { value: "region_id", label: "Région", getLabel: id => getNom(regions, id) },
    { value: "commune_id", label: "Commune", getLabel: id => getNom(communes, id) },
    // Ajoute ici d'autres dimensions si besoin
  ];

  // Génère le tableau croisé dynamique
  const pivotData = useMemo(() => {
    const rows = {};
    const rowLabels = new Set();
    const colLabels = new Set();

    data.forEach(item => {
      const rowKey = item[pivotRow];
      const colKey = item[pivotCol];
      rowLabels.add(rowKey);
      colLabels.add(colKey);
      if (!rows[rowKey]) rows[rowKey] = {};
      rows[rowKey][colKey] = (rows[rowKey][colKey] || 0) + 1;
    });

    // Trie les labels pour affichage
    const rowArr = Array.from(rowLabels);
    const colArr = Array.from(colLabels);

    return { rows, rowArr, colArr };
  }, [data, pivotRow, pivotCol]);

  // Suppression
  const handleDelete = async (id) => {
    if (!window.confirm("Confirmer la suppression de cette coordination communale ?")) return;
    setDeletingId(id);
    try {
      await window.electronAPI.deleteCoordinationCommunale?.(id);
      setData(data => data.filter(d => d.id !== id));
      message.success("Coordination communale supprimée.");
    } catch (e) {
      message.error("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  // Export CSV
  const handleExport = () => {
    const rows = [
      ["#", "Nom", "Code", "Commune", "Province", "Région", "Coord. Provinciale"]
    ];
    data.forEach((r, idx) => {
      rows.push([
        idx + 1,
        r.nom,
        r.code,
        getNom(communes, r.commune_id),
        getNom(provinces, r.province_id),
        getNom(regions, r.region_id),
        getNom(provinciales, r.parent_id)
      ]);
    });
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coordinations_communales.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Excel
  const handleExportExcel = () => {
    const rows = [
      ["#", "Nom", "Code", "Commune", "Province", "Région", "Coord. Provinciale"]
    ];
    data.forEach((r, idx) => {
      rows.push([
        idx + 1,
        r.nom,
        r.code,
        getNom(communes, r.commune_id),
        getNom(provinces, r.province_id),
        getNom(regions, r.region_id),
        getNom(provinciales, r.parent_id)
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CoordinationsCommunales");
    XLSX.writeFile(wb, "coordinations_communales.xlsx");
  };

  // Export Word (docx)
  const handleExportWord = () => {
    let html = `<table border="1" style="border-collapse:collapse;"><tr><th>#</th><th>Nom</th><th>Code</th><th>Commune</th><th>Province</th><th>Région</th><th>Coord. Provinciale</th></tr>`;
    data.forEach((r, idx) => {
      html += `<tr>
        <td>${idx + 1}</td>
        <td>${r.nom}</td>
        <td>${r.code}</td>
        <td>${getNom(communes, r.commune_id)}</td>
        <td>${getNom(provinces, r.province_id)}</td>
        <td>${getNom(regions, r.region_id)}</td>
        <td>${getNom(provinciales, r.parent_id)}</td>
      </tr>`;
    });
    html += "</table>";
    const blob = new Blob(
      [
        `<html><head><meta charset="utf-8"></head><body>${html}</body></html>`
      ],
      { type: "application/msword" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coordinations_communales.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF (paysage si trop de colonnes)
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: columns.length > 6 ? "landscape" : "portrait",
      unit: "pt",
      format: "a4"
    });
    doc.text("Liste des Coordinations Communales", 40, 30);
    autoTable(doc, {
      startY: 50,
      head: [[
        "#", "Nom", "Code", "Commune", "Province", "Région", "Coord. Provinciale"
      ]],
      body: data.map((r, idx) => [
        idx + 1,
        r.nom,
        r.code,
        getNom(communes, r.commune_id),
        getNom(provinces, r.province_id),
        getNom(regions, r.region_id),
        getNom(provinciales, r.parent_id)
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [24, 144, 255] },
      margin: { left: 20, right: 20 }
    });
    doc.save("coordinations_communales.pdf");
  };

  // Impression : paysage si trop large
  const handlePrint = () => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        @page { size: ${columns.length > 6 ? "landscape" : "auto"}; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      document.head.removeChild(style);
    }, 1000);
  };

  // Colonnes du tableau (flexible, actions en icônes)
  const columns = [
    {
      title: "N°",
      dataIndex: "numero",
      key: "numero",
      width: 60,
      align: "center",
      fixed: "left",
      render: (_, __, idx) => idx + 1,
      resizable: true,
    },
    {
      title: "Nom",
      dataIndex: "nom",
      key: "nom",
      width: 220,
      render: (v) => <b>{v}</b>,
      resizable: true,
      ellipsis: false,
      onCell: () => ({
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
        }
      }),
    },
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      width: 200,
      align: "center",
      resizable: true,
      ellipsis: false,
      onCell: () => ({
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
        }
      }),
    },
    {
      title: "Commune",
      dataIndex: "commune_id",
      key: "commune_id",
      width: 180,
      render: (id) => getNom(communes, id),
      resizable: true,
      ellipsis: false,
      onCell: () => ({
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
        }
      }),
    },
    {
      title: "Province",
      dataIndex: "province_id",
      key: "province_id",
      width: 180,
      render: (id) => getNom(provinces, id),
      resizable: true,
      ellipsis: false,
      onCell: () => ({
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
        }
      }),
    },
    {
      title: "Région",
      dataIndex: "region_id",
      key: "region_id",
      width: 180,
      render: (id) => getNom(regions, id),
      resizable: true,
      ellipsis: false,
      onCell: () => ({
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
        }
      }),
    },
    {
      title: "Coord. Provinciale",
      dataIndex: "parent_id",
      key: "parent_id",
      width: 220,
      render: (id) => getNom(provinciales, id),
      resizable: true,
      ellipsis: false,
      onCell: () => ({
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
        }
      }),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/coordinations/communale/edit/${record.id}`)}
          />
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    }
  ];

  // Utilise data directement (ou filteredData si tu remets le filtrage)
  return (
    <div className="coord-communale-list-container">
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <span style={{ fontSize: 22, fontWeight: 700 }}>Liste des Coordinations Communales</span>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()} />
                <Button icon={<DownloadOutlined />} onClick={handleExport}>CSV</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>Excel</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportWord}>Word</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportPDF}>PDF</Button>
                <Button icon={<PrinterOutlined />} onClick={handlePrint}>Imprimer</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/dashboard/coordinations/communale/add")}>
                  Ajouter
                </Button>
              </Space>
            </Col>
          </Row>
        }
        style={{ margin: "24px" }}
        className="coord-communale-list-card"
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
        </Row>
        <div style={{ overflowX: "auto" }}>
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            pagination={{ pageSize: 12 }}
            bordered
            className="coord-communale-table strong-grid"
            loading={loading}
            scroll={{ x: "max-content" }}
          />
        </div>
        <div style={{ marginTop: 16, fontWeight: 600 }}>
          Total : {data.length} coordination{data.length > 1 ? "s" : ""}
        </div>
        <style>{`
          .coord-communale-table.strong-grid th,
          .coord-communale-table.strong-grid td {
            border: 2px solid #222 !important;
          }
          .coord-communale-table.strong-grid {
            border: 2px solid #222 !important;
          }
          .coord-communale-table .ant-table-cell {
            white-space: normal !important;
            word-break: break-word !important;
          }
        `}</style>
      </Card>
      <style>{`
        .coord-communale-list-container {
          background: #f8fafc;
          min-height: 100vh;
          padding: 24px;
        }
        .coord-communale-list-card {
          box-shadow: 0 2px 12px #e6f7ff;
          border-radius: 12px;
        }
        .coord-communale-table th, .coord-communale-table td {
          font-size: 15px;
        }
        .coord-communale-table tr:nth-child(even) {
          background: #f6faff;
        }
        .coord-communale-table tr:hover {
          background: #e6f7ff;
        }
        .pivot-table {
          width: 100%;
          border-collapse: collapse;
        }
        .pivot-table th, .pivot-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .pivot-table th {
          background-color: #f2f2f2;
          font-weight: 600;
        }
        .pivot-table tr:hover {
          background-color: #f1f1f1;
        }
      `}</style>
    </div>
  );
}
