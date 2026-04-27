// src/components/LocaliteList.js
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  PrinterOutlined,
  ReloadOutlined,
  DownloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import moment from 'moment';
import api from '../api';
import './LocaliteList.css';

const { Option } = Select;

const PRINT_HEADERS = ['Région','Province','Commune','Localité','Code'];
const formatCsvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const buildCsvPayload = (rows = []) => [
  PRINT_HEADERS.map(formatCsvCell).join(';'),
  ...rows.map(row => [
    row.region_nom || '',
    row.province_nom || '',
    row.commune_nom || '',
    row.nom || '',
    row.code || ''
  ].map(formatCsvCell).join(';'))
].join('\n');

const buildPrintableMarkup = (rows = []) => {
  const body = rows.length
    ? rows.map((row, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${row.region_nom || '—'}</td>
          <td>${row.province_nom || '—'}</td>
          <td>${row.commune_nom || '—'}</td>
          <td>${row.nom || '—'}</td>
          <td>${row.code || '—'}</td>
        </tr>`).join('')
    : '<tr><td colspan="6">Aucune localité filtrée</td></tr>';

  return `
    <section style="font-family: Arial, sans-serif; color:#1f2f25; padding:16px;">
      <header style="text-align:center; margin-bottom:18px;">
        <h1 style="margin:0; font-size:22px;">Liste des localités</h1>
        <p style="margin:4px 0 0 0; font-size:13px; color:#4f6555;">
          Édité le ${moment().format('DD/MM/YYYY')} — ${rows.length} enregistrements
        </p>
      </header>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #9bb6a1; padding:6px 8px;">#</th>
            ${PRINT_HEADERS.map(header => `<th style="border:1px solid #9bb6a1; padding:6px 8px;">${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <footer style="margin-top:24px; font-size:11px; color:#4f6555;">
        Impression générée depuis l'interface d'administration
      </footer>
    </section>
  `;
};

const waitForElectronAPI = (timeout = 2000) =>
  new Promise(resolve => {
    if (typeof window === "undefined") return resolve(null);
    if (window.electronAPI || window.api) return resolve(window.electronAPI || window.api);
    const start = Date.now();
    const tick = () => {
      if (window.electronAPI || window.api) return resolve(window.electronAPI || window.api);
      if (Date.now() - start >= timeout) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });

const notifyAuthExpired = (() => {
  let lastShownAt = 0;
  return () => {
    const now = Date.now();
    if (now - lastShownAt < 2000) return;
    lastShownAt = now;
    message.error("Session expirée ou jeton manquant. Merci de vous reconnecter.");
  };
})();

const getRestBaseUrl = () => {
  if (typeof window === "undefined") return "";
  const sanitize = value => String(value).replace(/\/+$/, "");
  const direct =
    window.API_BASE_URL ||
    window.__API_BASE__ ||
    window.API_BASE ||
    window.__API_BASE_URL__ ||
    null;
  if (direct) return sanitize(direct);
  try {
    const fromBridge = window.electronAPI?.getApiBaseUrl?.();
    if (typeof fromBridge === "string" && fromBridge.trim()) return sanitize(fromBridge);
  } catch (_) {}

  const stored = localStorage?.getItem("api-base-url") || localStorage?.getItem("apiBaseUrl");
  if (stored) return sanitize(stored);

  const { protocol, hostname, port } = window.location || {};
  if (protocol && /^https?:$/.test(protocol)) {
    return sanitize(`${protocol}//${hostname}${port ? `:${port}` : ""}`);
  }
  return "http://localhost:3001";
};

const TOKEN_KEYS = ['jwt', 'auth-token', 'auth_token', 'token'];

const readStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_KEYS) {
    try {
      const localValue = window.localStorage?.getItem(key);
      if (localValue) return localValue;
      const sessionValue = window.sessionStorage?.getItem(key);
      if (sessionValue) return sessionValue;
    } catch {
      /* ignore */
    }
  }
  return null;
};

const buildAuthHeaders = () => {
  const token = readStoredToken();
  if (!token) return {};
  return { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` };
};

const httpJson = async (path, options = {}) => {
  const base = (getRestBaseUrl() || "").replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const resp = await fetch(`${base}${normalized}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
      ...(options.headers || {}),
    },
    body: options.body,
  });
  if (resp.status === 401) {
    notifyAuthExpired();
    throw new Error("401");
  }
  if (!resp.ok) {
    throw new Error(`${resp.status} ${resp.statusText}`);
  }
  if (resp.status === 204) return [];
  return resp.json().catch(() => []);
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  return Array.isArray(value?.result) ? value.result : [];
};

const httpFallback = async (name, payload = {}) => {
  const base = getRestBaseUrl();
  if (!base) throw new Error("API base URL introuvable.");
  const buildUrl = (pathPart) => {
    const cleanBase = (base || "").replace(/\/+$/, "");
    const cleanPath = String(pathPart || "").replace(/^\/+/, "");
    return `${cleanBase}/${cleanPath}`;
  };
  const map = {
    deleteLocalite: () => ({
      method: "DELETE",
      url: buildUrl(`localites/${payload.id}${payload.hard ? "?hard=true" : ""}`),
    }),
    removeLocalite: () => ({
      method: "DELETE",
      url: buildUrl(`localites/${payload.id}${payload.hard ? "?hard=true" : ""}`),
    }),
    updateLocalite: () => ({
      method: "PUT",
      url: buildUrl(`localites/${payload.id}`),
      body: payload,
    }),
    patchLocalite: () => ({
      method: "PUT",
      url: buildUrl(`localites/${payload.id}`),
      body: payload,
    }),
  };
  const configFactory = map[name];
  if (!configFactory) throw new Error(`Aucun fallback HTTP pour ${name}`);
  const { method, url, body } = configFactory();
  const resp = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (resp.status === 401) {
    notifyAuthExpired();
    throw new Error("401");
  }
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  if (resp.status === 204) return null;
  return resp.json().catch(() => null);
};

const safeCall = async (variants = [], ...args) => {
  const bridge = await waitForElectronAPI();
  const names = Array.isArray(variants) ? variants : [variants];
  let lastError = null;

  for (const name of names) {
    const candidates = [
      typeof api?.[name] === "function" ? () => api[name](...args) : null,
      bridge && typeof bridge[name] === "function" ? () => bridge[name](...args) : null,
      bridge && typeof bridge.call === "function" ? () => bridge.call(name, ...(args.length ? args : [{}])) : null,
      () => httpFallback(name, args[0] || {}),
    ].filter(Boolean);

    for (const run of candidates) {
      try {
        return await run();
      } catch (error) {
        lastError = error;
        if (error?.response?.status === 401 || error?.status === 401 || error?.message === "401") {
          console.warn(`[LocaliteList] ${name} → 401`, error);
          notifyAuthExpired();
          throw error;
        }
        console.error(`[LocaliteList] ${name} a échoué`, error);
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("Aucun client API disponible pour cette opération.");
};

const fetchRemoteList = async (variants = [], fallbackPath) => {
  try {
    const result = await safeCall(variants);
    const arr = asArray(result);
    return arr;
  } catch (error) {
    if (error?.response?.status === 401 || error?.status === 401 || error?.message === "401") throw error;
    console.warn(`[LocaliteList] ${variants.join(" | ")} via IPC ko`, error);
  }
  if (!fallbackPath) return [];
  try {
    const result = await httpJson(fallbackPath);
    const arr = asArray(result);
    return arr;
  } catch (error) {
    console.error(`[LocaliteList] fallback ${fallbackPath} ko`, error);
    return [];
  }
};

export default function LocaliteList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterRegions, setFilterRegions] = useState([]);
  const [filterProvinces, setFilterProvinces] = useState([]);
  const [filterCommunes, setFilterCommunes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [isBatchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchRegionId, setBatchRegionId] = useState();
  const [batchProvinceId, setBatchProvinceId] = useState();
  const [detailRecord, setDetailRecord] = useState(null);

  const regionById = useMemo(() => {
    const map = new Map();
    regions.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [regions]);

  const provinceById = useMemo(() => {
    const map = new Map();
    provinces.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [provinces]);

  const communeById = useMemo(() => {
    const map = new Map();
    communes.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [communes]);

  const batchProvinceOptions = useMemo(() => {
    if (!batchRegionId) return provinces;
    return provinces.filter(p => String(p.region_id) === String(batchRegionId));
  }, [provinces, batchRegionId]);

  const batchCommuneOptions = useMemo(() => {
    if (batchProvinceId) {
      return communes.filter(c => String(c.province_id) === String(batchProvinceId));
    }
    if (batchRegionId) {
      const eligibleProvinces = new Set(
        provinces.filter(p => String(p.region_id) === String(batchRegionId)).map(p => String(p.id))
      );
      return communes.filter(c => eligibleProvinces.has(String(c.province_id)));
    }
    return communes;
  }, [communes, provinces, batchProvinceId, batchRegionId]);

  const enrichedLocalites = useMemo(() => {
    return localites.map((loc) => {
      const region = regionById.get(String(loc.region_id));
      const province = provinceById.get(String(loc.province_id));
      const commune = communeById.get(String(loc.commune_id));
      return {
        ...loc,
        region_id: loc.region_id ?? commune?.region_id ?? province?.region_id ?? region?.id ?? null,
        province_id: loc.province_id ?? commune?.province_id ?? province?.id ?? null,
        commune_id: loc.commune_id ?? commune?.id ?? null,
        region_nom: loc.region_nom || region?.nom || "",
        province_nom: loc.province_nom || province?.nom || province?.province_nom || "",
        commune_nom: loc.commune_nom || commune?.nom || "",
      };
    });
  }, [localites, regionById, provinceById, communeById]);

  // Filtrage combiné
  const filteredLocalites = useMemo(() => {
    return enrichedLocalites
      .filter(l =>
        (!filterRegions.length || filterRegions.includes(String(l.region_id))) &&
        (!filterProvinces.length || filterProvinces.includes(String(l.province_id))) &&
        (!filterCommunes.length || filterCommunes.includes(String(l.commune_id))) &&
        (!search || l.nom?.toLowerCase().includes(search.toLowerCase()))
      );
  }, [enrichedLocalites, filterRegions, filterProvinces, filterCommunes, search]);

  const handlePrint = useCallback(() => {
    if (!filteredLocalites.length) {
      message.warning("Aucune donnée à imprimer");
      return;
    }
    const markup = buildPrintableMarkup(filteredLocalites);
    const win = window.open('', '', 'width=1200,height=800');
    if (!win) {
      message.error("Impossible d'ouvrir la fenêtre d'impression");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Localités</title></head><body>${markup}</body></html>`);
    win.document.close();

    const closeAfterPrint = () => {
      win.removeEventListener('afterprint', closeAfterPrint);
      win.close();
    };
    win.addEventListener('afterprint', closeAfterPrint);

    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        closeAfterPrint();
      }
    };

    if ('requestAnimationFrame' in win) {
      win.requestAnimationFrame(triggerPrint);
    } else {
      setTimeout(triggerPrint, 150);
    }
  }, [filteredLocalites]);

  const handleExport = useCallback(() => {
    if (!filteredLocalites.length) {
      message.warning("Aucune donnée à exporter");
      return;
    }
    const csv = buildCsvPayload(filteredLocalites);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `localites_${moment().format('YYYYMMDD_HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredLocalites]);

  const openDetails = useCallback((record) => setDetailRecord(record), []);
  const closeDetails = useCallback(() => setDetailRecord(null), []);

  // Colonnes
  const columns = [
    { title: '#', key: 'idx',
      render: (_, __, idx) => idx + 1, width: 50 },
    { title: 'Région',      dataIndex: 'region_nom',   key: 'region_nom' },
    { title: 'Province',    dataIndex: 'province_nom', key: 'province_nom' },
    { title: 'Commune',     dataIndex: 'commune_nom',  key: 'commune_nom' },
    { title: 'Localité',    dataIndex: 'nom',          key: 'nom' },
    { title: 'Code',        dataIndex: 'code',         key: 'code' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<InfoCircleOutlined />} onClick={() => openDetails(r)}>
            Détails
          </Button>
          <Link to={`/dashboard/localites/edit/${r.id}`}>Modifier</Link>
          <Button
            type="link"
            danger
            onClick={() => confirmDelete(r.id)}
          >
            Supprimer
          </Button>
        </Space>
      )
    }
  ];

  // Suppression simple
  const confirmDelete = id => {
    Modal.confirm({
      title: 'Confirmer la suppression',
      onOk: async () => {
        try {
          await safeCall(["deleteLocalite", "removeLocalite"], { id, hard: true });
          setLocalites(prev => prev.filter(loc => String(loc.id) !== String(id)));
          message.success('Localité supprimée');
          setSelectedRowKeys([]);
          await loadLocalites();
        } catch {
          message.error('Erreur lors de la suppression');
        }
      }
    });
  };

  // Mise à jour batch
  const openBatch = () => {
    if (!selectedRowKeys.length) {
      message.warning('Sélectionnez au moins une localité');
      return;
    }
    batchForm.resetFields();
    setBatchRegionId(undefined);
    setBatchProvinceId(undefined);
    setBatchModalVisible(true);
  };

  const handleBatchValuesChange = (changedValues) => {
    if (Object.prototype.hasOwnProperty.call(changedValues, 'newRegion')) {
      const nextRegion = changedValues.newRegion || undefined;
      setBatchRegionId(nextRegion);
      setBatchProvinceId(undefined);
      batchForm.setFieldsValue({ newProvince: undefined, newCommune: undefined });
    }
    if (Object.prototype.hasOwnProperty.call(changedValues, 'newProvince')) {
      const nextProvince = changedValues.newProvince || undefined;
      setBatchProvinceId(nextProvince);
      if (!nextProvince) {
        batchForm.setFieldsValue({ newCommune: undefined });
      }
    }
  };

  const handleBatchUpdate = async () => {
    try {
      const { newRegion, newProvince, newCommune } = await batchForm.validateFields();
      if (![newRegion, newProvince, newCommune].some(Boolean)) {
        message.warning('Choisissez au moins région, province ou commune.');
        return;
      }
      for (const id of selectedRowKeys) {
        const payload = { id };
        if (newRegion) payload.region_id = newRegion;
        if (newProvince) payload.province_id = newProvince;
        if (newCommune) payload.commune_id = newCommune;
        await safeCall(["updateLocalite", "patchLocalite"], payload);
      }
      message.success('Batch mis à jour');
      setBatchModalVisible(false);
      setSelectedRowKeys([]);
      await loadLocalites();
    } catch {
      message.error('Erreur de mise à jour batch');
    }
  };

  const loadLookups = useCallback(async () => {
    const [regionsData, provincesData, communesData] = await Promise.all([
      fetchRemoteList(["getRegionsList", "getRegions"], "/regions"),
      fetchRemoteList(["getProvincesList", "getProvinces"], "/provinces"),
      fetchRemoteList(["getCommunesList", "getCommunes"], "/communes"),
    ]);
    setRegions(regionsData);
    setProvinces(provincesData);
    setCommunes(communesData);
  }, []);

  const loadLocalites = useCallback(async () => {
    const data = await fetchRemoteList(
      ["getLocalitesWithDetails", "getLocalites"],
      "/localites"
    );
    setLocalites(data);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadLookups(), loadLocalites()]);
    } catch (error) {
      if (error?.message !== "401") message.error("Impossible de charger les localités.");
    } finally {
      setLoading(false);
    }
  }, [loadLookups, loadLocalites]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  return (
    <div className="localite-list-container">
      <div className="no-print">
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Select
              mode="multiple"
              placeholder="Filtrer Région"
              value={filterRegions}
              onChange={setFilterRegions}
              style={{ width: '100%' }}
            >
              {regions.map(r => (
                <Option key={r.id} value={String(r.id)}>
                  {r.nom}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              mode="multiple"
              placeholder="Filtrer Province"
              value={filterProvinces}
              onChange={setFilterProvinces}
              style={{ width: '100%' }}
            >
              {provinces.map(p => (
                <Option key={p.id} value={String(p.id)}>
                  {p.nom || p.province_nom}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              mode="multiple"
              placeholder="Filtrer Commune"
              value={filterCommunes}
              onChange={setFilterCommunes}
              style={{ width: '100%' }}
            >
              {communes.map(c => (
                <Option key={c.id} value={String(c.id)}>
                  {c.nom}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Input
              placeholder="Recherche nom..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
          </Col>
        </Row>

        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/dashboard/localites/add')}
          >
            Ajouter
          </Button>

          <Button onClick={openBatch}>
            Modifier Localisation (batch)
          </Button>

          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            Exporter
          </Button>

          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            Imprimer
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={reloadAll}
          >
            Rafraîchir
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys
          }}
          columns={columns}
          dataSource={filteredLocalites}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Spin>

      {/* Modal Batch */}
      <Modal
        title="Batch : région / province / commune"
        visible={isBatchModalVisible}
        onOk={handleBatchUpdate}
        onCancel={() => setBatchModalVisible(false)}
      >
        <Form form={batchForm} layout="vertical" onValuesChange={handleBatchValuesChange}>
          <Form.Item name="newRegion" label="Nouvelle Région">
            <Select placeholder="Sélectionnez une région" allowClear>
              {regions.map(r => (
                <Option key={r.id} value={r.id}>{r.nom}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="newProvince" label="Nouvelle Province">
            <Select placeholder="Sélectionnez une province" allowClear>
              {batchProvinceOptions.map(p => (
                <Option key={p.id} value={p.id}>{p.nom || p.province_nom}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="newCommune" label="Nouvelle Commune">
            <Select placeholder="Sélectionnez une commune" allowClear>
              {batchCommuneOptions.map(c => (
                <Option key={c.id} value={c.id}>{c.nom}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}

