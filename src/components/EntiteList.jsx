// src/components/EntiteList.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Select,
  Card,
  message,
  Popconfirm,
  Tabs,
  Space,
  Spin,
  Input,
  Alert
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PrinterOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../contexts/AuthContext";
import api from "../api";
import './EntiteList.css';
// LES ENTITE RELEVE DE LA BVDP , INCLURE EXPLICITEMENT LES ENTIE MERE ET SOUS AU MEME RANG 
const { TabPane } = Tabs;
const { Option } = Select;

const waitForBridge = (timeout = 1500) =>
  new Promise(resolve => {
    if (typeof window === "undefined") return resolve(null);
    if (window.electronAPI) return resolve(window.electronAPI);
    const start = Date.now();
    (function poll() {
      if (window.electronAPI) return resolve(window.electronAPI);
      if (Date.now() - start >= timeout) return resolve(null);
      setTimeout(poll, 40);
    })();
  });

const ensureArray = (value) =>
  Array.isArray(value)
    ? value
    : Array.isArray(value?.rows)
    ? value.rows
    : Array.isArray(value?.data)
    ? value.data
    : [];

const fetchList = async (methods, fallback) => {
  const bridge = await waitForBridge();
  const names = Array.isArray(methods) ? methods : [methods];
  for (const name of names) {
    try {
      if (bridge?.[name]) return ensureArray(await bridge[name]({}));
      if (bridge?.call)  return ensureArray(await bridge.call(name, {}));
    } catch {
      /* try next */
    }
  }
  if (typeof fallback === "function") {
    const response = await fallback();
    return ensureArray(response);
  }
  return [];
};

export default function EntiteList() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [filterMere, setFilterMere] = useState({});
  const [filterSous, setFilterSous] = useState({});
  const [sessionExpired, setSessionExpired] = useState("");
  const [loading, setLoading] = useState(false);

  const [meres, setMeres] = useState([]);
  const [sousEntites, setSousEntites] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [localites, setLocalites] = useState([]);

  const handleSessionError = useCallback(
    (error) => {
      const status = error?.response?.status;
      const message = error?.response?.data?.error || error?.message || "";
      if (status === 401 || status === 403 || /token|session/i.test(message)) {
        logout();
        localStorage.removeItem("jwt");
        setSessionExpired(message || "Session expirée.");
        setTimeout(() => (window.location.href = "/login"), 1200);
        return true;
      }
      return false;
    },
    [logout]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [meresRaw, sousRaw, regionsRaw, provincesRaw, communesRaw, localitesRaw] = await Promise.all([
        fetchList(["getEntitesList", "getEntites"], () => api.getEntitesList()),
        fetchList(["getSousEntitesList", "getSousEntites"], () => api.getSousEntitesList()),
        fetchList(["getRegionsList", "getRegions"], () => api.getRegionsList()),
        fetchList(["getProvincesList", "getProvinces"], () => api.getProvincesList()),
        fetchList(["getCommunesList", "getCommunes"], () => api.getCommunesList()),
        fetchList(["getLocalitesList", "getLocalites"], () => api.getLocalitesList()),
      ]);
      setMeres(meresRaw);
      setSousEntites(sousRaw);
      setRegions(regionsRaw);
      setProvinces(provincesRaw);
      setCommunes(communesRaw);
      setLocalites(localitesRaw);
      setSessionExpired("");
    } catch (error) {
      if (!handleSessionError(error)) {
        message.error("Impossible de charger les entités.");
      }
    } finally {
      setLoading(false);
    }
  }, [handleSessionError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (sessionExpired) {
    return (
      <div style={{ maxWidth: 500, margin: "80px auto" }}>
        <Alert message="Session expirée" description={sessionExpired} type="error" showIcon />
        <Button type="primary" style={{ marginTop: 16 }} onClick={() => (window.location.href = "/login")}>
          Se reconnecter
        </Button>
      </div>
    );
  }

  const findName = useCallback(
    (list = [], id) => (list.find(item => Number(item.id) === Number(id))?.nom || ""),
    []
  );

  const filterRecords = useCallback(
    (records = [], filters = {}) =>
      records.filter((record) =>
        Object.entries(filters).every(([key, value]) =>
          !value ? true : String(record[key] ?? "").toLowerCase().includes(String(value).toLowerCase())
        )
      ),
    []
  );

  const filteredMeres = useMemo(
    () => filterRecords(meres, filterMere),
    [meres, filterMere, filterRecords]
  );
  const filteredSous = useMemo(
    () => filterRecords(sousEntites, filterSous),
    [sousEntites, filterSous, filterRecords]
  );

  const aggByEntityType = useMemo(() => {
    const map = {};
    filteredSous.forEach((row) => {
      const key = `${findName(meres, row.entite_id)}|${row.type || "—"}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([key, count]) => {
      const [entity, type] = key.split("|");
      return { entity, type, count };
    });
  }, [filteredSous, meres, findName]);

  const aggByRegionProv = useMemo(() => {
    const map = {};
    filteredSous.forEach((row) => {
      const key = `${findName(regions, row.region_id)}|${findName(provinces, row.province_id)}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([key, count]) => {
      const [region, province] = key.split("|");
      return { region, province, count };
    });
  }, [filteredSous, regions, provinces, findName]);

  const columnsMeres = useMemo(() => [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Nom', dataIndex: 'nom', key: 'nom' },
    { title: 'Code', dataIndex: 'code', key: 'code' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Région',
      key: 'region_id',
      render: (_, r) => findName(regions, r.region_id)
    },
    {
      title: 'Province',
      key: 'province_id',
      render: (_, r) => findName(provinces, r.province_id)
    },
    {
      title: 'Commune',
      key: 'commune_id',
      render: (_, r) => findName(communes, r.commune_id)
    },
    {
      title: 'Localité',
      key: 'localite_id',
      render: (_, r) => findName(localites, r.localite_id)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/entites/form/mere/${record.id}`)}
          />
          <Popconfirm
            title="Supprimer ?"
            onConfirm={async () => {
              try {
                await fetchList(["deleteEntites"], () => api.deleteEntite(record.id));
                message.success('Supprimé');
                loadAll();
              } catch (error) {
                if (!handleSessionError(error)) message.error('Suppression impossible.');
              }
            }}
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      )
    }
  ], [regions, provinces, communes, localites, navigate, loadAll, handleSessionError]);

  const columnsSous = useMemo(() => [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Nom', dataIndex: 'nom', key: 'nom' },
    { title: 'Code', dataIndex: 'code', key: 'code' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Entité Mère',
      key: 'entite_id',
      render: (_, r) => findName(meres, r.entite_id)
    },
    {
      title: 'Région',
      key: 'region_id',
      render: (_, r) => findName(regions, r.region_id)
    },
    {
      title: 'Province',
      key: 'province_id',
      render: (_, r) => findName(provinces, r.province_id)
    },
    {
      title: 'Commune',
      key: 'commune_id',
      render: (_, r) => findName(communes, r.commune_id)
    },
    {
      title: 'Localité',
      key: 'localite_id',
      render: (_, r) => findName(localites, r.localite_id)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/entites/form/sous/${record.id}`)}
          />
          <Popconfirm
            title="Supprimer ?"
            onConfirm={async () => {
              try {
                await fetchList(["deleteSousEntites"], () => api.deleteSousEntite(record.id));
                message.success('Supprimée');
                loadAll();
              } catch (error) {
                if (!handleSessionError(error)) message.error('Suppression impossible.');
              }
            }}
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      )
    }
  ], [meres, regions, provinces, communes, localites, navigate, loadAll, handleSessionError]);

  const columns = [
	{ title: 'Nom', dataIndex: 'nom', key: 'nom' },
	{ title: 'Code', dataIndex: 'code', key: 'code' },
	{ title: 'Entité mère', dataIndex: 'entite_parent_nom', key: 'entite_parent_nom', render: (_, record) => `${record.entite_parent_nom || '—'} (${record.entite_parent_code || '—'})` },
	{ title: 'Sous-entité', dataIndex: 'sous_entite_nom', key: 'sous_entite_nom', render: (_, record) => `${record.sous_entite_nom || '—'} (${record.sous_entite_code || '—'})` },
	{
		title: 'Région',
		key: 'region_id',
		render: (_, r) => findName(regions, r.region_id)
	},
	{
		title: 'Province',
		key: 'province_id',
		render: (_, r) => findName(provinces, r.province_id)
	},
	{
		title: 'Actions',
		key: 'actions',
		render: (_, record) => (
			<Space>
				<Button
					icon={<EditOutlined />}
					onClick={() => navigate(getEditRoute(record))}
				/>
				<Popconfirm
					title="Supprimer ?"
					onConfirm={async () => {
						try {
							await fetchList(["deleteEntites"], () => api.deleteEntite(record.id));
							message.success('Supprimé');
							loadAll();
						} catch (error) {
							if (!handleSessionError(error)) message.error('Suppression impossible.');
						}
					}}
				>
					<Button icon={<DeleteOutlined />} danger />
				</Popconfirm>
			</Space>
		)
	}
];

  const getEditRoute = (record) => {
	const isSous = Boolean(record.entite_id);
	const mode = isSous ? 'sous' : 'mere';
	const targetId = record.id;
	return `/dashboard/entites/form/${mode}/${targetId}`;
};

  // UI
  return (
    <div className="entite-list">
      <video className="bg-video" autoPlay loop muted>
        <source src="/assets/video/futuristic.mp4" type="video/mp4" />
      </video>
      <div className="overlay">
        <h1>Gestion des Entités</h1>
        <Space wrap className="toolbar">
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => navigate('/dashboard/entites/form/mere')}
          >
            Nouvelle Entité
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
            Imprimer
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAll}>
            Rafraîchir
          </Button>
        </Space>

        <Spin spinning={loading}>
          <Tabs defaultActiveKey="meres" type="card">
            <TabPane tab="Entités Mères" key="meres">
              <Space className="filters" style={{ marginBottom: 12 }}>
                <Input
                  placeholder="Code"
                  suffix={<SearchOutlined />}
                  onChange={e => setFilterMere({ ...filterMere, code: e.target.value })}
                />
                <Select
                  placeholder="Région"
                  allowClear
                  style={{ minWidth: 200 }}
                  onChange={val => setFilterMere({ ...filterMere, region_id: val })}
                >
                  {(regions || []).map(r => (
                    <Option key={r.id} value={r.id}>{r.nom}</Option>
                  ))}
                </Select>
              </Space>
              <Table
                dataSource={filteredMeres}
                columns={columnsMeres}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                bordered
              />
              <Card className="recap" style={{ marginTop: 12 }}>
                <p>Total : {(filteredMeres || []).length} entité(s) mère</p>
              </Card>
            </TabPane>

            <TabPane tab="Sous-Entités" key="sous">
              <Space className="filters" style={{ marginBottom: 12 }}>
                <Select
                  placeholder="Entité mère"
                  allowClear
                  style={{ minWidth: 200 }}
                  onChange={val => setFilterSous({ ...filterSous, entite_id: val })}
                >
                  {(meres || []).map(m => (
                    <Option key={m.id} value={m.id}>{m.nom}</Option>
                  ))}
                </Select>
                <Select
                  placeholder="Type"
                  allowClear
                  style={{ minWidth: 160 }}
                  onChange={val => setFilterSous({ ...filterSous, type: val })}
                >
                  <Option value="BIR">BIR</Option>
                  <Option value="BM">BM</Option>
                  <Option value="Division">Division</Option>
                  <Option value="CNF">CNF</Option>
                </Select>
              </Space>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                style={{ marginBottom: 12 }}
                onClick={() => navigate('/dashboard/entites/form/sous')}
              >
                Nouvelle Sous-Entité
              </Button>
              <Table
                dataSource={filteredSous}
                columns={columnsSous}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                bordered
              />
              <Card className="recap" style={{ marginTop: 12 }}>
                <h3>Récapitulatif</h3>
                <p>Par entité/type :</p>
                <ul>
                  {aggByEntityType.map((i, idx) => (
                    <li key={idx}>{i.entity || '—'} – {i.type || '—'} : {i.count}</li>
                  ))}
                </ul>
                <p>Par région/province :</p>
                <ul>
                  {aggByRegionProv.map((i, idx) => (
                    <li key={idx}>{i.region || '—'} – {i.province || '—'} : {i.count}</li>
                  ))}
                </ul>
              </Card>
            </TabPane>
          </Tabs>
        </Spin>
      </div>
    </div>
  );
}
