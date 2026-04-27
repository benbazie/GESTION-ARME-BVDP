// src/components/ProvinceList.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  Card,
  Select,
  Button,
  Row,
  Col,
  Space,
  Spin,
  Modal,
  Typography,
  Descriptions,
  Popconfirm,
  message,
} from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import "./ProvinceList.css";
import api from "../api";

const { Option } = Select;
const { confirm } = Modal;
const { Title, Text } = Typography;

const waitForElectronAPI = (timeout = 2000) =>
  new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    if (window.electronAPI || window.safeElectronAPI || window.api) {
      return resolve(window.electronAPI || window.safeElectronAPI || window.api);
    }
    const start = Date.now();
    const tick = () => {
      if (window.electronAPI || window.safeElectronAPI || window.api) {
        return resolve(window.electronAPI || window.safeElectronAPI || window.api);
      }
      if (Date.now() - start >= timeout) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });

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

const loadRegionsSafe = async () => {
  const bridge = window.electronAPI || window.api || {};
  if (typeof api?.getRegionsList === "function") {
    try {
      const rows = await api.getRegionsList();
      if (Array.isArray(rows)) return rows;
    } catch (err) {
      console.warn("[ProvinceList] api.getRegionsList fallback → bridge", err);
    }
  }
  if (typeof bridge.getRegions === "function") {
    const rows = await bridge.getRegions();
    if (Array.isArray(rows)) return rows;
  }
  return [];
};

const removeProvince = async (provinceId) => {
  if (typeof api.deleteProvinces === "function") return api.deleteProvinces(provinceId);
  if (typeof api.deleteProvince === "function") return api.deleteProvince(provinceId);
  const bridge = window.electronAPI || window.api || {};
  if (typeof bridge.deleteProvince === "function") return bridge.deleteProvince(provinceId);
  if (typeof bridge.call === "function") return bridge.call("deleteProvince", provinceId);
  throw new Error("Aucun client API disponible pour supprimer la province.");
};

const getRestBaseUrl = () => {
  const stored =
    localStorage?.getItem("api-base-url") ||
    localStorage?.getItem("apiBaseUrl");
  if (stored) return stored.replace(/\/+$/, "");

  const explicit =
    window.API_BASE_URL ||
    window.__API_BASE__ ||
    window.API_BASE ||
    import.meta?.env?.VITE_API_BASE_URL;
  if (explicit) return String(explicit).replace(/\/+$/, "");

  const { protocol, hostname, port } = window.location;
  if (port === "5173") return "http://localhost:3001";
  return `${protocol}//${hostname}${port ? `:${port}` : ""}`.replace(/\/+$/, "");
};

const buildAuthHeaders = () => {
  const token = localStorage?.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const deleteProvinceRemote = async (provinceId) => {
  const normalizedId = Number(provinceId) || provinceId;
  const tryChannel = async (fn) => {
    if (typeof fn !== "function") return false;
    try {
      await fn(normalizedId);
      return true;
    } catch (error) {
      console.warn("[ProvinceList] delete channel failed:", error);
      return false;
    }
  };

  const bridge = window.electronAPI || window.api || {};

  if (await tryChannel(() => api?.deleteProvinces?.(normalizedId))) return;
  if (await tryChannel(() => api?.deleteProvince?.(normalizedId))) return;
  if (await tryChannel(() => bridge.deleteProvince?.(normalizedId))) return;
  if (await tryChannel(() => bridge.call?.("deleteProvince", normalizedId))) return;

  const base = (getRestBaseUrl() || "").replace(/\/+$/, "");
  const apiBase = /\/api$/i.test(base) ? base : `${base}/api`;
  const resp = await fetch(`${apiBase}/provinces/${normalizedId}?hard=true`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText);
    throw new Error(detail || `HTTP ${resp.status}`);
  }
};

const deleteProvinceSafely = async (rawId) => {
  const provinceId = Number(rawId);
  if (Number.isNaN(provinceId)) throw new Error("Identifiant de province invalide.");
  const tryCall = async (fn) => {
    if (typeof fn !== "function") return false;
    await fn(provinceId);
    return true;
  };
  if (
    await tryCall(api?.deleteProvinces) ||
    await tryCall(api?.deleteProvince) ||
    await tryCall(window.electronAPI?.deleteProvince) ||
    await (async () => {
      if (typeof window.electronAPI?.call !== "function") return false;
      await window.electronAPI.call("deleteProvince", provinceId);
      return true;
    })()
  ) return true;

  const endpoint = `${resolveApiBaseUrl()}/api/provinces/${provinceId}`;
  const resp = await fetch(endpoint, { method: "DELETE", headers: buildApiHeaders() });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText);
    throw new Error(detail || "Suppression HTTP impossible.");
  }
  return true;
};

const deleteProvinceRecord = async (provinceId) => {
  const id = Number(provinceId) || provinceId;
  const client = window.api || {};
  if (typeof client.deleteProvinces === "function") {
    await client.deleteProvinces(id);
    return;
  }
  if (typeof client.deleteProvince === "function") {
    await client.deleteProvince(id);
    return;
  }
  if (window.electronAPI?.deleteProvince) {
    await window.electronAPI.deleteProvince(id);
    return;
  }
  if (typeof window.electronAPI?.call === "function") {
    await window.electronAPI.call("deleteProvince", id);
    return;
  }
  throw new Error("Aucune API de suppression disponible.");
};

const printableProvinceColumns = [
  { label: "Région", accessor: (row) => row.region_nom || "—" },
  { label: "Code région", accessor: (row) => row.region_code || "—" },
  { label: "Province", accessor: (row) => row.nom || "—" },
  { label: "Code province", accessor: (row) => row.code || "—" },
];

export default function ProvinceList() {
  const [provinces, setProvinces] = useState([]);
  const [regions, setRegions] = useState([]);
  const [allProvinces, setAllProvinces] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filterRegion, setFilterRegion] = useState("all");
  const [loading, setLoading] = useState(false);
  const [coordRegionales, setCoordRegionales] = useState([]);
  const [selectedCoordRegionale, setSelectedCoordRegionale] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const navigate = useNavigate();

  const regionIndex = useMemo(
    () =>
      regions.reduce((acc, region) => {
        acc[String(region.id)] = region;
        return acc;
      }, {}),
    [regions]
  );

  const filterByRegion = useCallback((provincesData, regionId) => {
    if (regionId === "all") return provincesData;
    return provincesData.filter((p) => String(p.region_id) === String(regionId));
  }, []);

  // Fetch regions
  const loadRegions = useCallback(async () => {
    try {
      const list = await api.fetchRegions();
      setRegions(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("getRegions:", err);
      Modal.error({ title: "Erreur", content: "Impossible de charger les régions." });
    }
  }, []);

  const getRegions = useCallback(async () => {
    try {
      const list = await loadRegionsSafe();
      setRegions(list);
    } catch (error) {
      console.error("[ProvinceList] getRegions:", error);
      message.error("Impossible de charger les régions.");
      setRegions([]);
    }
  }, []);

  // Fetch provinces with region info
  const loadProvinces = useCallback(async () => {
    setLoading(true);
    try {
      const provider = window.api?.getProvincesList ? window.api : null;
      const response = provider
        ? await provider.getProvincesList()
        : await api.getProvincesList();
      const rows = Array.isArray(response)
        ? response
        : Array.isArray(response?.rows)
        ? response.rows
        : [];
      const normalized = rows.map((province) => {
        const region = regionIndex[String(province.region_id)] || {};
        return {
          ...province,
          key: province.id,
          region_nom: province.region_nom ?? region.nom ?? "",
          region_code: province.region_code ?? region.code ?? "",
        };
      });
      setAllProvinces(normalized);
    } catch (err) {
      console.error("[ProvinceList] loadProvinces:", err);
      Modal.error({ title: "Erreur", content: "Impossible de charger les provinces." });
    } finally {
      setLoading(false);
    }
  }, [regionIndex]);

  // Load regional coordinations
  const loadCoordRegionales = useCallback(async () => {
    const data = await safeCall(["getCoordinationRegionales", "getCoordinationRegionaleList"], {});
    setCoordRegionales(Array.isArray(data) ? data : []);
  }, []);

  // Handle region select change
  const onRegionChange = (value) => {
    setFilterRegion(value);
  };

  // Confirm deletion
  const onDelete = (id) => {
    confirm({
      title: "Supprimer cette province ?",
      icon: <ExclamationCircleOutlined />,
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        try {
          await safeCall(["deleteProvince", "removeProvince"], { id });
          await loadProvinces();
        } catch (err) {
          console.error("deleteProvince:", err);
          Modal.error({ title: "Erreur", content: "Échec de la suppression." });
        }
      },
    });
  };

  // Summary per region
  const summary = Object.entries(
    allProvinces.reduce((acc, p) => {
      const name = p.region_nom || "Inconnu";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {})
  );

  // Charge les régions une seule fois au montage
  useEffect(() => {
    getRegions();
  }, [getRegions]);

  useEffect(() => {
    if (regions.length) {
      loadProvinces();
    }
  }, [regions.length, loadProvinces]);

  useEffect(() => {
    setFiltered(filterByRegion(allProvinces, filterRegion));
  }, [allProvinces, filterByRegion, filterRegion]);

  const columns = [
    {
      title: "#",
      key: "index",
      width: 60,
      align: "center",
      render: (_, __, idx) => idx + 1,
    },
    {
      title: "Région",
      dataIndex: "region_nom",
      key: "region_nom",
      render: value => value || "—",
    },
    {
      title: "Code région",
      dataIndex: "region_code",
      key: "region_code",
      render: value => value || "—",
    },
    {
      title: "Province",
      dataIndex: "nom",
      key: "nom",
      sorter: (a, b) => (a.nom || "").localeCompare(b.nom || ""),
      width: 180,
    },
    {
      title: "Code Province",
      dataIndex: "code",
      key: "code",
      width: 140,
      align: "center",
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openDetail(record)}>Détails</Button>
          <Button type="link" onClick={() => navigate(`/dashboard/provinces/edit/${record.id}`)}>Modifier</Button>
          <Popconfirm
            title="Supprimer cette province ?"
            okText="Oui"
            cancelText="Non"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Ajoute/Modifie la fonction pour préparer le payload strict
  const prepareProvincePayload = (values) => ({
    nom: values.nom?.trim() || "",
    code: values.code?.trim() || "",
    region_id: values.region_id,
  });

  // Exemple pour ajout :
  const handleAddProvince = async (values) => {
    const payload = prepareProvincePayload(values);
    if (!payload.nom || !payload.code || !payload.region_id) {
      Modal.error({ title: "Champs obligatoires manquants", content: "nom, code, région" });
      return;
    }
    await safeCall(["addProvince", "createProvince"], payload);
    loadProvinces();
  };

  // Ajoute/Modifie la fonction pour préparer le payload strict pour coordination provinciale
  const prepareCoordinationProvincialePayload = (values) => {
    // Génère le code automatiquement si non fourni
    let code = values.code?.trim();
    if (!code) {
      // Exemple : concatène code région + code province ou nom
      const region = regions.find(r => String(r.id) === String(values.region_id));
      const prov = allProvinces.find(p => String(p.id) === String(values.province_id));
      code = [
        region?.code || region?.nom || '',
        prov?.code || prov?.nom || ''
      ].filter(Boolean).join('-').toUpperCase();
    }
    return {
      nom: values.nom?.trim() || "",
      code,
      province_id: values.province_id,
      region_id: values.region_id,
      parent_id: values.parent_id, // id de la coordination régionale
      description: values.description?.trim() || ""
    };
  };

  // Exemple pour ajout d'une coordination provinciale :
  const handleAddCoordinationProvinciale = async (values) => {
    const payload = prepareCoordinationProvincialePayload(values);
    if (!payload.nom || !payload.code || !payload.province_id || !payload.region_id || !payload.parent_id) {
      Modal.error({ title: "Champs obligatoires manquants", content: "nom, code, province, région, coordination régionale" });
      return;
    }
    await safeCall(["addCoordinationProvinciale", "createCoordinationProvinciale"], payload);
    loadProvinces();
  };

  const getProvinces = useCallback(async () => {
    try {
      const list =
        (await window.electronAPI.getProvinces?.()) ||
        (await loadProvincesSafe());
      const safeList = Array.isArray(list) ? list : [];
      setProvinces(safeList);
      return safeList;
    } catch (error) {
      console.error("[ProvinceList] getProvinces:", error);
      message.error("Impossible de charger les provinces.");
      setProvinces([]);
      return [];
    }
  }, []);

  const handleDelete = useCallback(async (provinceId) => {
    const normalizedId = Number(provinceId) || provinceId;
    const hide = message.loading("Suppression en cours…", 0);
    try {
      await deleteProvinceRemote(normalizedId);
      setProvinces(prev => prev.filter(p => String(p.id) !== String(normalizedId)));
      setAllProvinces(prev => prev.filter(p => String(p.id) !== String(normalizedId)));
      await loadProvinces();
      message.success("Province supprimée.");
    } catch (error) {
      console.error("[ProvinceList] delete", error);
      message.error("Suppression impossible.");
    } finally {
      hide();
    }
  }, [loadProvinces]);

  const openDetail = (record) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const printableRows = useMemo(() => filtered, [filtered]);

  const buildProvinceTableMarkup = useCallback(() => {
    if (!printableRows.length) {
      return "<tbody><tr><td colspan='4'>Aucune province</td></tr></tbody>";
    }
    const head = `<thead><tr>${printableProvinceColumns
      .map((col) => `<th>${col.label}</th>`)
      .join("")}</tr></thead>`;
    const body = `<tbody>${printableRows
      .map(
        (row) =>
          `<tr>${printableProvinceColumns
            .map((col) => `<td>${col.accessor(row)}</td>`)
            .join("")}</tr>`
      )
      .join("")}</tbody>`;
    return `${head}${body}`;
  }, [printableRows]);

  const handlePrint = useCallback(() => {
    const markup = buildProvinceTableMarkup();
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Provinces</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2f3d; }
            h2 { margin-top: 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d6dbe5; padding: 8px 10px; text-align: left; font-size: 13px; }
            th { background: #f2f6ff; text-transform: uppercase; letter-spacing: .05em; }
          </style>
        </head>
        <body>
          <h2>Liste des provinces</h2>
          <table>${markup}</table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }, [buildProvinceTableMarkup]);

  const handleExportExcel = useCallback(() => {
    if (!printableRows.length) {
      message.warning("Aucune province à exporter.");
      return;
    }
    const header = `<tr>${printableProvinceColumns
      .map((col) => `<th>${col.label}</th>`)
      .join("")}</tr>`;
    const body = printableRows
      .map(
        (row) =>
          `<tr>${printableProvinceColumns
            .map((col) => `<td>${col.accessor(row)}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body><table>${header}${body}</table></body>
      </html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "provinces.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success("Export Excel généré.");
  }, [printableRows]);

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={4}>Liste des Provinces</Title>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadProvinces} />
                <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
                  Exporter
                </Button>
                <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                  Imprimer
                </Button>
                <Link to="/dashboard/provinces/add">
                  <Button type="primary" icon={<PlusOutlined />}>
                    Ajouter
                  </Button>
                </Link>
              </Space>
            </Col>
          </Row>
        }
        style={{ margin: "24px" }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Text>Filtrer par Région :</Text>
            <Select
              value={filterRegion}
              onChange={onRegionChange}
              style={{ width: "100%", marginTop: 4 }}
            >
              <Option value="all">Toutes</Option>
              {regions.map((r) => (
                <Option key={r.id} value={String(r.id)}>
                  {r.nom}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
        />

        <Card
          type="inner"
          title="Résumé par Région"
          style={{ marginTop: 24 }}
        >
          <Table
            dataSource={summary.map(([region, count]) => ({
              region,
              count,
              key: region,
            }))}
            columns={[
              { title: "Région", dataIndex: "region", key: "region" },
              { title: "Nbre de Provinces", dataIndex: "count", key: "count" },
            ]}
            pagination={false}
            size="small"
            bordered
          />
        </Card>

        <Modal
          open={detailOpen}
          title={detailRecord ? `Province : ${detailRecord.nom}` : "Détails province"}
          footer={null}
          onCancel={() => setDetailOpen(false)}
        >
          {detailRecord && (
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Nom">{detailRecord.nom || "—"}</Descriptions.Item>
              <Descriptions.Item label="Code">{detailRecord.code || "—"}</Descriptions.Item>
              <Descriptions.Item label="Région">{detailRecord.region_nom || "—"}</Descriptions.Item>
              <Descriptions.Item label="Description">{detailRecord.description || "—"}</Descriptions.Item>
              <Descriptions.Item label="Dernière mise à jour">{detailRecord.updated_at || "—"}</Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
      </Card>
    </Spin>
  );
}

