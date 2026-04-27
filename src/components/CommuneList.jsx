// src/components/CommuneList.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table,
  Button,
  Select,
  Input,
  Spin,
  Row,
  Col,
  Space,
  message,
  Modal,
  Form,
} from "antd";
import { Link } from "react-router-dom";
import {
  PlusOutlined,
  SearchOutlined,
  PrinterOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import "./CommuneList.css";
import { fetchCommunes, fetchProvinces, fetchRegions } from "../api";

const { Option } = Select;

const waitForElectronAPI = (timeout = 2000) =>
  new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    if (window.electronAPI) return resolve(window.electronAPI);
    const start = Date.now();
    const tick = () => {
      if (window.electronAPI) return resolve(window.electronAPI);
      if (Date.now() - start >= timeout) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });

const safeCall = async (variants = [], ...args) => {
  const names = Array.isArray(variants) ? variants : [variants];
  const api = await waitForElectronAPI();
  for (const name of names) {
    try {
      if (api && typeof api[name] === "function") {
        return await api[name](...args);
      }
      if (api && typeof api.call === "function") {
        return await api.call(name, ...(args.length ? args : [{}]));
      }
      if (window.api?.call) {
        return await window.api.call(name, ...(args.length ? args : [{}]));
      }
      if (typeof window.api?.[name] === "function") {
        return await window.api[name](...args);
      }
    } catch (error) {
      if (error?.status === 401) throw error;
      console.warn(`[safeCall] ${name} failed`, error);
    }
  }
  return null;
};

const buildApiEndpoint = (path) => {
  const base = resolveApiBaseUrl().replace(/\/$/, "");
  if (!path.startsWith("/")) return `${base}/${path}`;
  if (base.endsWith("/api") && path.startsWith("/api/")) {
    return `${base}${path.slice(4)}`;
  }
  return `${base}${path}`;
};

const resolveApiBaseUrl = () => {
  const fromWindow = window.API_BASE_URL || window.__API_BASE__;
  const fromStorage = localStorage?.getItem("apiBaseUrl");
  const candidate = fromWindow || fromStorage;
  if (candidate) return candidate.replace(/\/$/, "");
  const origin = window.location.origin;
  if (origin && !origin.startsWith("file://")) return origin.replace(/\/$/, "");
  return "http://localhost:3001";
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

const buildJsonHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage?.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const buildAuthHeaders = () => {
  if (typeof window === "undefined") return {};
  const storages = [window.localStorage, window.sessionStorage].filter(Boolean);
  const keys = ["token", "authToken", "auth_token", "jwt", "accessToken", "access_token"];
  const fromStorage = () => {
    for (const store of storages) {
      for (const key of keys) {
        const value = store?.getItem?.(key);
        if (value) return value;
      }
    }
    return null;
  };
  const rawToken =
    fromStorage() ||
    window.__AUTH_TOKEN__ ||
    window.authToken ||
    window.API_TOKEN ||
    null;
  if (!rawToken) return {};
  const value = rawToken.trim().startsWith("Bearer ")
    ? rawToken.trim()
    : `Bearer ${rawToken.trim()}`;
  return { Authorization: value };
};

const httpJson = async (path, options = {}) => {
  const base = (getRestBaseUrl() || "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const finalPath =
    base.toLowerCase().endsWith("/api") && normalizedPath.startsWith("/api/")
      ? normalizedPath.substring(4) || "/"
      : normalizedPath;

  const { headers: customHeaders = {}, method, ...rest } = options;

  const resp = await fetch(`${base}${finalPath}`, {
    method: method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
      ...customHeaders,
    },
    ...rest,
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText);
    throw new Error(detail || `HTTP ${resp.status}`);
  }
  return resp.status === 204 ? null : resp.json();
};

// Ajoute un helper dédié pour garantir la suppression
const deleteCommuneById = async (communeId, { hard = true } = {}) => {
  if (communeId == null) throw new Error("Identifiant de commune requis.");
  const suffix = hard ? "?hard=true" : "";
  return httpJson(`/api/communes/${communeId}${suffix}`, { method: "DELETE" });
};

const tryBridgeDelete = async (communeId, hard) => {
  const payloads = hard
    ? [{ id: communeId, hard: true }, communeId]
    : [communeId, { id: communeId }];
  for (const payload of payloads) {
    const result = await safeCall(["deleteCommune", "removeCommune"], payload);
    if (result === null || result === undefined) continue;
    if (result.error || result.ok === false) continue;
    return true;
  }
  return false;
};

const printableCommuneColumns = [
  { label: "Région", accessor: (row) => row.region_nom || "—" },
  { label: "Province", accessor: (row) => row.province_nom || "—" },
  { label: "Commune", accessor: (row) => row.nom || "—" },
  { label: "Code", accessor: (row) => row.code || "—" },
];

const buildCommuneTableMarkup = (rows) => {
  if (!rows.length) {
    return "<tbody><tr><td colspan='4'>Aucune commune</td></tr></tbody>";
  }
  const head = `<thead><tr>${printableCommuneColumns
    .map((col) => `<th>${col.label}</th>`)
    .join("")}</tr></thead>`;
  const body = `<tbody>${rows
    .map(
      (row) =>
        `<tr>${printableCommuneColumns
          .map((col) => `<td>${col.accessor(row)}</td>`)
          .join("")}</tr>`
    )
    .join("")}</tbody>`;
  return `${head}${body}`;
};

const CommuneList = () => {
  // États pour les données
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [loading, setLoading] = useState(true);

  // États des filtres (mode multiple)
  const [filterRegions, setFilterRegions] = useState([]); // tableau d'IDs sous forme de string
  const [filterProvinces, setFilterProvinces] = useState([]); // tableau d'IDs sous forme de string
  const [search, setSearch] = useState("");

  // Pagination
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // Batch update
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [formModal] = Form.useForm();

  // Contrôle de la visibilité de la zone d'impression détaillée
  const [showPrintList, setShowPrintList] = useState(false);

  // Ajoute ces hooks pour gérer les coordinations hiérarchiques
  const [coordRegionaleId, setCoordRegionaleId] = useState(null);
  const [coordProvincialeId, setCoordProvincialeId] = useState(null);
  const [coordRegionales, setCoordRegionales] = useState([]);
  const [coordProvinciales, setCoordProvinciales] = useState([]);

  // Ajoute cette ligne :
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Ajoute ces états pour le batch region
  const [batchRegionModalVisible, setBatchRegionModalVisible] = useState(false);
  const [formBatchRegion] = Form.useForm();

  const isElectron = () => typeof window !== 'undefined' && window.electronAPI;

  // Définir les fonctions de chargement AVANT les useEffect
  const loadRegions = useCallback(async () => {
    try {
      const list = await fetchRegions();
      setRegions(Array.isArray(list) ? list : []);
    } catch (err) {
      // Utilisez message.error si Antd, sinon console.error
      if (typeof message !== "undefined") message.error("Erreur lors du chargement des régions");
      else console.error("Erreur lors du chargement des régions");
    }
  }, []);

  const loadProvinces = useCallback(async () => {
    try {
      const list = await fetchProvinces();
      setProvinces(Array.isArray(list) ? list : []);
    } catch (err) {
      if (typeof message !== "undefined") message.error("Erreur lors du chargement des provinces");
      else console.error("Erreur lors du chargement des provinces");
    }
  }, []);

  // Chargement des communes
  // Ne mettez PAS regions ou provinces dans les dépendances de loadCommunes
  const loadCommunes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCommunes();
      const normalized = Array.isArray(data) ? data.map(c => ({
        ...c,
        region_nom: c.region_nom || (regions.find(r => String(r.id) === String(c.region_id))?.nom || ""),
        province_nom: c.province_nom || (provinces.find(p => String(p.id) === String(c.province_id))?.nom || "")
      })) : [];
      setCommunes(normalized);
    } catch (error) {
      if (typeof message !== "undefined") message.error("Erreur lors du chargement des communes");
      else console.error("Erreur lors du chargement des communes");
      setCommunes([]);
    } finally {
      setLoading(false);
    }
  }, [regions, provinces]);

  // Charge les régions au montage
  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  // Charge les provinces après les régions
  useEffect(() => {
    if (regions.length > 0) {
      loadProvinces();
    }
  }, [regions.length, loadProvinces]);

  // Charge les communes après régions et provinces
  useEffect(() => {
    if (regions.length > 0 && provinces.length > 0) {
      loadCommunes();
    }
  }, [regions.length, provinces.length, loadCommunes]);

  // Charge les coordinations régionales
  const loadCoordRegionales = useCallback(async () => {
    const data = await safeCall(["getCoordinationRegionales", "getCoordinationRegionaleList"], {});
    setCoordRegionales(Array.isArray(data) ? data : []);
  }, []);

  // Charge les coordinations provinciales filtrées par coordination régionale
  const loadCoordProvinciales = useCallback(async (regionaleId) => {
    if (!regionaleId) { setCoordProvinciales([]); return; }
    const data = await safeCall(["getCoordinationProvinciales", "getCoordinationProvincialeList"], { parent_id: regionaleId });
    setCoordProvinciales(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  // Chargement des provinces une fois que les régions sont chargées
  useEffect(() => {
    if (regions.length > 0) {
      loadProvinces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions.length]);

  // Chargement des communes une fois que régions et provinces sont chargées
  useEffect(() => {
    if (regions.length > 0 && provinces.length > 0) {
      loadCommunes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions.length, provinces.length]);

  // Lors de la sélection d'une coordination régionale, recharge les provinciales
  useEffect(() => {
    loadCoordProvinciales(coordRegionaleId);
    setCoordProvincialeId(null); // reset le choix provincial
  }, [coordRegionaleId, loadCoordProvinciales]);

  // Gestion de la recherche
  const onSearchChange = (e) => {
    setSearch(e.target.value);
  };

  // Mise à jour des filtres multiples
  const onRegionsFilterChange = (values) => {
    setFilterRegions(values);
  };

  const onProvincesFilterChange = (values) => {
    setFilterProvinces(values);
  };

  // Filtrer les communes selon les critères appliqués
  const getFilteredCommunes = () => {
    let result = [...communes];
    if (filterRegions.length > 0) {
      result = result.filter((c) =>
        filterRegions.includes(String(c.region_id))
      );
    }
    if (filterProvinces.length > 0) {
      result = result.filter((c) =>
        filterProvinces.includes(String(c.province_id))
      );
    }
    if (search.trim() !== "") {
      result = result.filter((c) =>
        c.nom.toLowerCase().includes(search.toLowerCase())
      );
    }
    return result;
  };

  // Titre dynamique du rapport
  const getDynamicTitle = () => {
    if (filterProvinces.length > 0) {
      const provNames = provinces
        .filter((p) => filterProvinces.includes(String(p.id)))
        .map((p) => p.nom)
        .join(", ");
      return `Liste des communes des provinces : ${provNames}`;
    }
    if (filterRegions.length > 0) {
      const regNames = regions
        .filter((r) => filterRegions.includes(String(r.id)))
        .map((r) => r.nom)
        .join(", ");
      return `Liste des communes des régions : ${regNames}`;
    }
    return "Liste de toutes les communes";
  };

  // Récapitulatif regroupé par région :
  // Pour chaque région, le nombre distinct de provinces et le nombre total de communes.
  const getRecapData = () => {
    const data = getFilteredCommunes();
    const recapObj = {};
    data.forEach((c) => {
      const reg = c.region_nom || "Inconnue";
      if (!recapObj[reg]) {
        recapObj[reg] = { provinces: new Set(), nbCommunes: 0 };
      }
      recapObj[reg].nbCommunes += 1;
      if (c.province_id) {
        recapObj[reg].provinces.add(c.province_id);
      }
    });
    return Object.entries(recapObj).map(([region, { provinces, nbCommunes }]) => ({
      region,
      nbProvinces: provinces.size,
      nbCommunes,
    }));
  };

  // Définition des colonnes du tableau
  const columns = [
    {
      title: "#",
      key: "index",
      width: 50,
      align: "center",
      render: (_, __, idx) =>
        (pagination.current - 1) * pagination.pageSize + idx + 1,
    },
    {
      title: "Région",
      dataIndex: "region_nom",
      key: "region_nom",
      width: 180,
      sorter: (a, b) => (a.region_nom || "").localeCompare(b.region_nom || ""),
    },
    {
      title: "Province",
      dataIndex: "province_nom",
      key: "province_nom",
      width: 180,
      sorter: (a, b) => (a.province_nom || "").localeCompare(b.province_nom || ""),
    },
    {
      title: "Commune",
      dataIndex: "nom",
      key: "nom",
      width: 180,
    },
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      width: 120,
      align: "center",
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      align: "center",
      render: (_, record) => (
        <Space>
          <Link to={`/dashboard/communes/edit/${record.id}`}>
            <Button type="link" icon={<EditOutlined />} />
          </Link>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  // Configuration de la sélection multiple pour batch update
  const rowSelection = {
    selectedRowKeys,
    onChange: (newKeys) => setSelectedRowKeys(newKeys),
  };

  // Batch update via modal
  const openBatchModal = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Veuillez sélectionner au moins une commune.");
      return;
    }
    setBatchModalVisible(true);
  };

  const handleBatchUpdate = async () => {
    try {
      const values = await formModal.validateFields();
      const newProvinceId = values.newProvince;
      for (const communeId of selectedRowKeys) {
        const currentCommune = communes.find((c) => c.id === communeId);
        if (!currentCommune) continue;
        await safeCall(["updateCommune", "patchCommune"], {
          id: communeId,
          nom: currentCommune.nom,
          code: currentCommune.code,
          province_id: newProvinceId,
        });
      }
      message.success("Mise à jour batch réussie");
      setBatchModalVisible(false);
      setSelectedRowKeys([]);
      loadCommunes();
    } catch (error) {
      message.error("Erreur lors de la mise à jour");
    }
  };

  // Ajoute la fonction pour ouvrir le batch region
  const openBatchRegionModal = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Veuillez sélectionner au moins une commune.");
      return;
    }
    setBatchRegionModalVisible(true);
  };

  // Ajoute la fonction pour appliquer le batch region
  const handleBatchRegionUpdate = async () => {
    try {
      const values = await formBatchRegion.validateFields();
      const newRegionId = values.newRegion;
      for (const communeId of selectedRowKeys) {
        const currentCommune = communes.find((c) => c.id === communeId);
        if (!currentCommune) continue;
        await safeCall(["updateCommune", "patchCommune"], {
          id: communeId,
          nom: currentCommune.nom,
          code: currentCommune.code,
          province_id: currentCommune.province_id,
          region_id: newRegionId,
        });
      }
      message.success("Mise à jour batch région réussie");
      setBatchRegionModalVisible(false);
      setSelectedRowKeys([]);
      loadCommunes();
    } catch (error) {
      message.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCommuneById(id);
      message.success("Commune supprimée avec succès");
      setCommunes(prev => prev.filter(c => c.id !== id));
      await loadCommunes();
    } catch (error) {
      console.error("[CommuneList] delete", error);
      message.error("Erreur lors de la suppression");
    }
  };

  const printableRows = useMemo(
    () => getFilteredCommunes() || communes,
    [getFilteredCommunes, communes]
  );

  // Impression
  const handlePrint = useCallback(() => {
    const markup = buildCommuneTableMarkup(printableRows);
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Communes</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2f3d; }
            h2 { margin-top: 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d6dbe5; padding: 8px 10px; text-align: left; font-size: 13px; }
            th { background: #f2f6ff; text-transform: uppercase; letter-spacing: .05em; }
          </style>
        </head>
        <body>
          <h2>Liste des communes</h2>
          <table>${markup}</table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }, [printableRows]);

  const handleExportExcel = useCallback(() => {
    if (!printableRows.length) {
      message.warning("Aucune commune à exporter.");
      return;
    }
    const header = `<tr>${printableCommuneColumns
      .map((col) => `<th>${col.label}</th>`)
      .join("")}</tr>`;
    const body = printableRows
      .map(
        (row) =>
          `<tr>${printableCommuneColumns
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
    link.download = "communes.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success("Export Excel généré.");
  }, [printableRows]);

  // Ajoute/Modifie la fonction pour préparer le payload strict
  const prepareCommunePayload = (values) => ({
    nom: values.nom?.trim() || "",
    code: values.code?.trim() || "",
    commune_id: values.commune_id,
    province_id: values.province_id,
    region_id: values.region_id,
    parent_id: values.parent_id, // id de la coordination provinciale
  });

  // Exemple pour ajout :
  const handleAddCommune = async (values) => {
    const payload = prepareCommunePayload(values);
    if (!payload.nom || !payload.code || !payload.province_id || !payload.region_id) {
      Modal.error({ title: "Champs obligatoires manquants", content: "nom, code, province, région" });
      return;
    }
    await safeCall(["addCommune", "createCommune"], payload);
    loadCommunes();
  };

  // Ajoute ce hook pour le formulaire du modal d'ajout/édition
  const [form] = Form.useForm();

  return (
    <div className="commune-list-container">
      {/* Section des filtres et actions (non imprimable) */}
      <div className="no-print">
        <h2 className="commune-list-title">
          {getDynamicTitle()} ({getFilteredCommunes().length})
        </h2>
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            <Col span={8}>
              <div style={{ marginBottom: 4, fontWeight: "600", color: "#0077cc" }}>
                Filtrer par région
              </div>
              <Select
                mode="multiple"
                style={{ width: "100%" }}
                placeholder="Sélectionnez une ou plusieurs régions"
                value={filterRegions}
                onChange={onRegionsFilterChange}
              >
                {regions.map((region) => (
                  <Option key={region.id} value={String(region.id)}>
                    {region.nom}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 4, fontWeight: "600", color: "#0077cc" }}>
                Filtrer par province
              </div>
              <Select
                mode="multiple"
                style={{ width: "100%" }}
                placeholder="Sélectionnez une ou plusieurs provinces"
                value={filterProvinces}
                onChange={onProvincesFilterChange}
              >
                {provinces.map((prov) => (
                  <Option key={prov.id} value={String(prov.id)}>
                    {prov.nom} ({prov.code})
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 4, fontWeight: "600", color: "#0077cc" }}>
                Recherche par nom de commune
              </div>
              <Input
                style={{ width: "100%" }}
                placeholder="Tapez votre recherche..."
                value={search}
                onChange={onSearchChange}
                prefix={<SearchOutlined />}
              />
            </Col>
          </Row>
        </div>
        <div className="action-bar" style={{ marginBottom: 20, textAlign: "right" }}>
          <Link to="/dashboard/communes/add">
            <Button type="primary" icon={<PlusOutlined />}>Ajouter une Commune</Button>
          </Link>
          <Button type="default" onClick={openBatchModal} style={{ marginLeft: 10 }}>
            Modifier la province (batch)
          </Button>
          <Button type="default" onClick={openBatchRegionModal} style={{ marginLeft: 10 }}>
            Modifier la région (batch)
          </Button>
          <Button type="primary" onClick={handlePrint} style={{ marginLeft: 10 }} icon={<PrinterOutlined />}>
            Imprimer
          </Button>
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
            Exporter
          </Button>
        </div>
      </div>

      {/* Tableau principal */}
      {loading ? (
        <Spin size="large" style={{ display: "block", margin: "100px auto" }} />
      ) : (
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={getFilteredCommunes()}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            onChange: (page, pageSize) =>
              setPagination({ current: page, pageSize }),
          }}
          bordered
          className="commune-list-table"
        />
      )}

      {/* Récapitulatif sous forme de tableau, placé en bas */}
      <div className="commune-summary no-print" style={{ marginTop: 20 }}>
        <h3 className="commune-summary-title">Récapitulatif par région</h3>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Région</th>
              <th>Nombre de provinces</th>
              <th>Nombre de communes</th>
            </tr>
          </thead>
          <tbody>
            {getRecapData().map(({ region, nbProvinces, nbCommunes }) => (
              <tr key={region}>
                <td>{region}</td>
                <td>{nbProvinces}</td>
                <td>{nbCommunes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Button onClick={() => setShowPrintList(!showPrintList)}>
            {showPrintList ? "Cacher la liste détaillée" : "Voir la liste détaillée"}
          </Button>
        </div>
      </div>

      {/* Zone d'impression simplifiée */}
      <div className="print-area">
        {showPrintList && (
          <div className="print-content">
            <Table
              columns={columns}
              dataSource={getFilteredCommunes()}
              rowKey="id"
              pagination={false}
              bordered
            />
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 20px;
            background: #fff;
          }
          .no-print {
            display: none;
          }
          .summary-table th,
          .summary-table td {
            font-size: 16px;
            padding: 8px;
          }
        }
      `}</style>

      {/* Modal pour batch update */}
      <Modal
        title="Modifier la province pour les communes sélectionnées"
        visible={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleBatchUpdate}
        okText="Valider"
      >
        <Form form={formModal} layout="vertical">
          <Form.Item
            name="newProvince"
            label="Nouvelle province"
            rules={[{ required: true, message: "Veuillez sélectionner une province" }]}
          >
            <Select placeholder="Sélectionnez une province">
              {provinces.map((prov) => (
                <Option key={prov.id} value={prov.id}>
                  {prov.nom} ({prov.code})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

        open={batchRegionModalVisible}
      <Modal
        title="Modifier la région pour les communes sélectionnées"
        visible={batchRegionModalVisible}
        onCancel={() => setBatchRegionModalVisible(false)}
        onOk={handleBatchRegionUpdate}
        okText="Valider"
      >
        <Form form={formBatchRegion} layout="vertical">
          <Form.Item
            name="newRegion"
            label="Nouvelle région"
            rules={[{ required: true, message: "Veuillez sélectionner une région" }]}
          >
            <Select placeholder="Sélectionnez une région">
              {regions.map((reg) => (
                <Option key={reg.id} value={reg.id}>
                  {reg.nom} ({reg.code})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

        open={isModalVisible}
      <Modal
        title="Ajouter ou Modifier une Commune"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            // Récupère la région et la province à partir de la coordination provinciale sélectionnée
            const selectedProv = coordProvinciales.find(p => p.id === values.parent_id);
            const payload = {
              nom: values.nom?.trim() || "",
              code: values.code?.trim() || "",
              commune_id: values.commune_id,
              province_id: selectedProv?.province_id,
              region_id: selectedProv?.region_id,
              parent_id: values.parent_id,
            };
            if (!payload.nom || !payload.code || !payload.commune_id || !payload.parent_id) {
              Modal.error({ title: "Champs obligatoires manquants", content: "nom, code, commune, coordination provinciale" });
              return;
            }
            await safeCall(["addCoordinationCommunale", "createCoordinationCommunale"], payload);
            loadCommunes();
          }}
        >
          <Form.Item label="Coordination régionale" name="coordRegionaleId" rules={[{ required: true, message: "Sélectionnez une coordination régionale" }]}>
            <Select
              placeholder="Sélectionnez une coordination régionale"
              onChange={setCoordRegionaleId}
              value={coordRegionaleId}
              allowClear
            >
              {coordRegionales.map(cr => (
                <Option key={cr.id} value={cr.id}>{cr.nom}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Coordination provinciale" name="parent_id" rules={[{ required: true, message: "Sélectionnez une coordination provinciale" }]}>
            <Select
              placeholder="Sélectionnez une coordination provinciale"
              onChange={setCoordProvincialeId}
              value={coordProvincialeId}
              allowClear
              disabled={!coordRegionaleId}
            >
              {coordProvinciales.map(cp => (
                <Option key={cp.id} value={cp.id}>{cp.nom}</Option>
              ))}
            </Select>
          </Form.Item>
          {/* ...autres champs comme nom, code, commune_id... */}
        </Form>
      </Modal>
    </div>
  );
};

export default CommuneList;
