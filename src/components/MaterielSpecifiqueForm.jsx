// src/components/MaterielSpecifiqueForm.js
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Form,
  Input,
  Button,
  Select,
  DatePicker,
  Card,
  Spin,
  Typography,
  Progress,
  Row,
  Col,
  message,
  Space,
  Divider,
} from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined, SyncOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import api from "../api";
import resolveApiBase from "../utils/resolveApiBase";
import "./MaterielSpecifiqueForm.css";

const { Option } = Select;
const { Title, Text } = Typography;

const REQUIRED_FIELDS = [
  "config_materiel_id",
  "numero_serie",
  "etat",
  "date_entree",
  "ownership_type",
];

const waitForElectronAPI = async () => {
  if (typeof window === "undefined") return null;
  if (window.electronAPI || window.api) return window.electronAPI || window.api;
  return null;
};

const fetchJson = async (endpoint, params = {}, options = {}) => {
  const base = resolveApiBase().replace(/\/$/, "");
  let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (base.endsWith("/api") && path.startsWith("/api")) path = path.replace(/^\/api/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = (() => { try { return localStorage.getItem("auth-token") || localStorage.getItem("auth_token"); } catch { return null; } })();
  if (token && !headers.Authorization) headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const method = (options.method || "GET").toUpperCase();
  const query = method === "GET" && params
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString()
    : "";
  if (query) path += path.includes("?") ? `&${query}` : `?${query}`;
  const request = { ...options, method, headers };
  if (method !== "GET" && params && !options.body) request.body = JSON.stringify(params);
  const response = await fetch(`${base}${path}`, request);
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
};

const normalizeArray = input => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.rows)) return input.rows;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.items)) return input.items;
  return [];
};

const fetchCollection = async (variants, restPath) => {
  const primary = normalizeArray(await safeCall(variants, {}).catch(() => null));
  if (primary.length) return primary;
  const fallback = await fetchJson(restPath).catch(() => null);
  return normalizeArray(fallback);
};

const safeCall = async (variants = [], payload) => {
  const bridge = await waitForElectronAPI();
  const names = Array.isArray(variants) ? variants : [variants];
  let lastError = null;
  const args = payload === undefined ? [] : [payload];

  for (const name of names) {
    const candidates = [
      bridge && typeof bridge[name] === "function" ? () => bridge[name](...args) : null,
      bridge && typeof bridge.call === "function" ? () => bridge.call(name, ...(args.length ? args : [{}])) : null,
      typeof api?.[name] === "function" ? () => api[name](...args) : null,
      typeof api?.call === "function" ? () => api.call(name, ...args) : null,
    ].filter(Boolean);

    for (const fn of candidates) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (error?.status === 401) throw error;
      }
    }
  }

  if (lastError?.status === 401) throw lastError;
  return null;
};

export default function MaterielSpecifiqueForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [entites, setEntites] = useState([]);
  const [sousEntites, setSousEntites] = useState([]);
  const [coordinations, setCoordinations] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);

  const [progressPercent, setProgressPercent] = useState(0);
  const [configLoading, setConfigLoading] = useState(false);
  const [quickInfos, setQuickInfos] = useState({ total: 0, enService: 0, atelier: 0 });

  const ownershipType = Form.useWatch("ownership_type", form);
  const entiteId = Form.useWatch("entite_id", form);
  const regionId = Form.useWatch("region_id", form);
  const provinceId = Form.useWatch("province_id", form);
  const configId = Form.useWatch("config_materiel_id", form);

  const configMap = useMemo(
    () => new Map(configs.map(cfg => [String(cfg.id), cfg])),
    [configs]
  );

  const updateProgress = () => {
    const values = form.getFieldsValue();
    const filled = REQUIRED_FIELDS.reduce(
      (count, key) => (values[key] ? count + 1 : count),
      0
    );
    setProgressPercent(Math.round((filled / REQUIRED_FIELDS.length) * 100));
  };

  const loadConfigs = useCallback(async () => {
    const list = await fetchCollection(
      ["getConfigMaterielList", "getConfigMateriels", "getConfigMateriel"],
      "/api/config_materiel"
    );
    setConfigs(list);
    if (!list.length) {
      message.warning("Aucune configuration matériel disponible, veuillez en créer avant de continuer.");
    }
  }, []);

  const loadEntites = useCallback(async () => {
    setEntites(await fetchCollection(["getEntitesList", "getEntites"], "/api/entites"));
  }, []);

  const loadRegions = useCallback(async () => {
    setRegions(await fetchCollection(["getRegionsList", "getRegions"], "/api/regions"));
  }, []);

  const loadSousEntites = useCallback(async entite => {
    if (!entite) {
      setSousEntites([]);
      setCoordinations([]);
      return;
    }
    const allSous = await fetchCollection(["getSousEntites", "getSousEntitesList"], "/api/sous_entites");
    const filteredSous = allSous.filter(item => String(item.entite_id) === String(entite));
    
    const allCoord = await fetchCollection(["getCoordinations", "getCoordinationsList"], "/api/coordinations");
    const filteredCoord = allCoord.filter(item => String(item.entite_id) === String(entite));
    
    setSousEntites(filteredSous);
    setCoordinations(filteredCoord);
  }, []);

  const loadProvinces = useCallback(async region => {
    if (!region) {
      setProvinces([]);
      setCommunes([]);
      return;
    }
    const list = await fetchCollection(["getProvincesList", "getProvinces"], "/api/provinces");
    setProvinces(list.filter(item => String(item.region_id) === String(region)));
  }, []);

  const loadCommunes = useCallback(async province => {
    if (!province) {
      setCommunes([]);
      return;
    }
    const list = await fetchCollection(["getCommunesList", "getCommunes"], "/api/communes");
    setCommunes(list.filter(item => String(item.province_id) === String(province)));
  }, []);

  const loadQuickInfos = async () => {
    const stats = await safeCall(["getDashboardMaterielSummary", "getDashboardMateriel"]).catch(() => null);
    if (!stats) return;
    setQuickInfos({
      total: stats.total || 0,
      enService: stats.enService || stats["En service"] || 0,
      atelier: stats.maintenance || stats["En réparation"] || 0,
    });
  };

  useEffect(() => {
    loadConfigs();
    loadEntites();
    loadRegions();
    loadQuickInfos();
  }, []);

  useEffect(() => {
    updateProgress();
  }, [ownershipType, configId]);

  useEffect(() => {
    if (entiteId) {
      loadSousEntites(entiteId);
      const entite = entites.find(item => String(item.id) === String(entiteId));
      if (entite?.region_id) {
        form.setFieldsValue({ region_id: entite.region_id });
      }
    } else {
      setSousEntites([]);
      setCoordinations([]);
    }
  }, [entiteId, entites, form]);

  useEffect(() => {
    if (regionId) {
      loadProvinces(regionId);
    }
  }, [regionId]);

  useEffect(() => {
    if (provinceId) {
      loadCommunes(provinceId);
    }
  }, [provinceId]);

  useEffect(() => {
    if (!configId) return;
    const cfg = configMap.get(String(configId));
    if (!cfg) return;
    form.setFieldsValue({
      designation: cfg.designation,
      type: cfg.type,
      categorie: cfg.categorie,
    });
  }, [configId, configMap, form]);

  const fetchItem = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const item =
        (await safeCall(["getMaterielSpecifiqueById", "getMaterielSpecifique"], { id }).catch(() =>
          safeCall(["getMaterielSpecifique"], id).catch(() => null)
        )) || null;
      if (!item) {
        message.error("Matériel introuvable.");
        navigate("/materiels-specifiques");
        return;
      }
      form.setFieldsValue({
        config_materiel_id: item.config_materiel_id,
        numero_serie: item.numero_serie,
        etat: item.etat,
        date_entree: item.date_entree ? moment(item.date_entree) : null,
        date_sortie: item.date_sortie ? moment(item.date_sortie) : null,
        observations: item.observation || "",
        ownership_type: item.entite_id ? "entite" : "region",
        entite_id: item.entite_id,
        sous_entite_id: item.sous_entite_id,
        coordination_id: item.coordination_id,
        region_id: item.region_id,
        province_id: item.province_id,
        commune_id: item.commune_id,
      });
      if (item.entite_id) loadSousEntites(item.entite_id);
      if (item.region_id) loadProvinces(item.region_id);
      if (item.province_id) loadCommunes(item.province_id);
      updateProgress();
    } catch (err) {
      message.error("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async values => {
    setLoading(true);
    try {
      // Générer un numéro de série unique si vide
      const payload = {
        ...values,
        numero_serie: values.numero_serie || `MAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        designation: configMap.get(String(values.config_materiel_id))?.designation || values.designation || "",
        date_entree: values.date_entree ? values.date_entree.format("YYYY-MM-DD") : null,
        date_sortie: values.date_sortie ? values.date_sortie.format("YYYY-MM-DD") : null,
      };

      if (id) {
        let result = await safeCall(
          ["updateMaterielSpecifique", "editMaterielSpecifique"],
          { id, ...payload }
        ).catch(() => null);
        if (!result && api?.updateMaterielsSpecifiques) {
          result = await api.updateMaterielsSpecifiques({ id, ...payload }).catch(() => null);
        }
        if (!result && api?.updateMaterielSpecifique) {
          result = await api.updateMaterielSpecifique({ id, ...payload }).catch(() => null);
        }
        if (!result) {
          result = await fetchJson(`/api/materiels_specifiques/${id}`, payload, { method: "PUT" });
        }
        if (!result) throw new Error("Mise à jour impossible.");
        const confirmation =
          result?._confirmation ||
          `Matériel spécifique mis à jour : ${
            result?.designation || payload.designation || payload.numero_serie || `ID ${id}`
          }`;
        message.success(confirmation);
      } else {
        let result = await safeCall(
          ["createMaterielSpecifique", "addMaterielSpecifique"],
          payload
        ).catch(() => null);
        if (!result && api?.createMaterielsSpecifiques) {
          result = await api.createMaterielsSpecifiques(payload).catch(() => null);
        }
        if (!result && api?.createMaterielSpecifique) {
          result = await api.createMaterielSpecifique(payload).catch(() => null);
        }
        if (!result) {
          result = await fetchJson("/api/materiels_specifiques", payload, { method: "POST" });
        }
        if (!result) throw new Error("Enregistrement impossible.");
        const confirmation =
          result?._confirmation ||
          `Matériel spécifique enregistré : ${
            result?.designation || payload.designation || payload.numero_serie || "nouvelle fiche"
          }`;
        message.success(confirmation);
        form.resetFields();
      }
      navigate("/dashboard/materiel");
    } catch (error) {
      const detail =
        error?.response?.data?.error ||
        error?.payload?.error ||
        error?.message ||
        "Enregistrement impossible.";
        
      if (detail.includes("UNIQUE constraint failed: materiels_specifiques.numero_serie")) {
        message.error("Ce numéro de série existe déjà. Veuillez en choisir un autre.");
      } else {
        message.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className="munition-form-page">
        <div className="munition-form-overlay" />
        <div className="munition-form-shell">
          <div className="munition-form-header">
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/materiels-specifiques")}
            />
            <div>
              <Title level={3} className="munition-form-title">
                {id ? "Modifier un matériel spécifique" : "Ajouter un matériel spécifique"}
              </Title>
              <Text className="munition-form-subtitle">
                Sélectionnez une configuration, affectez la propriété et renseignez les mouvements pour garder un suivi irréprochable.
              </Text>
            </div>
          </div>

          <Card className="munition-form-progress-card" bordered={false}>
            <Progress
              percent={progressPercent}
              size="small"
              status={progressPercent < 100 ? "active" : "success"}
            />
            <Text className="munition-form-progress-text">
              {progressPercent < 100
                ? "Renseignez tous les champs marqués d’un astérisque pour finaliser."
                : "Tous les champs essentiels sont renseignés, vous pouvez enregistrer."}
            </Text>
            <Space style={{ marginTop: 12 }}>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text>En stock : {quickInfos.total}</Text>
              <Divider type="vertical" />
              <Text>En service : {quickInfos.enService}</Text>
              <Divider type="vertical" />
              <SyncOutlined spin />
              <Text>Atelier : {quickInfos.atelier}</Text>
            </Space>
          </Card>

          <Card className="munition-form-card" bordered={false}>
            <Form
              form={form}
              layout="vertical"
              onFinish={submit}
              onValuesChange={updateProgress}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Configuration *"
                    name="config_materiel_id"
                    rules={[{ required: true, message: "Sélectionnez une configuration." }, () => ({
                      validator(_, value) {
                        if (value || configs.length) return Promise.resolve();
                        return Promise.reject(new Error("Aucune configuration disponible."));
                      },
                    })]}
                  >
                    <Select
                      showSearch
                      placeholder="Rechercher une configuration"
                      loading={configLoading}
                      optionFilterProp="children"
                    >
                      {configs.map(cfg => (
                        <Option key={cfg.id} value={cfg.id}>
                          {cfg.type} — {cfg.designation} ({cfg.categorie || "N/A"})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Numéro de série"
                    name="numero_serie"
                    rules={[
                      {
                        validator: async (_, value) => {
                          if (!value) return Promise.resolve();
                          // Vérification d'unicité côté client
                          try {
                            const existing = await fetchJson(`/api/materiels_specifiques/check?numero_serie=${encodeURIComponent(value)}`);
                            if (existing && String(existing.id) !== String(id)) {
                              return Promise.reject(new Error("Ce numéro de série est déjà utilisé."));
                            }
                          } catch (e) {
                            // Ignorer les erreurs de vérification
                          }
                          return Promise.resolve();
                        }
                      }
                    ]}
                  >
                    <Input placeholder="Laissez vide pour génération automatique" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Type"
                    name="type"
                    tooltip="Pré-rempli par la configuration"
                  >
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Catégorie"
                    name="categorie"
                    tooltip="Pré-rempli par la configuration"
                  >
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="État *"
                    name="etat"
                    rules={[{ required: true, message: "Définissez l'état du matériel." }]}
                  >
                    <Select placeholder="Sélectionnez l'état">
                      <Option value="En service">En service</Option>
                      <Option value="En magasin">En magasin</Option>
                      <Option value="En réparation">En réparation</Option>
                      <Option value="Hors service">Hors service</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Propriété *"
                    name="ownership_type"
                    rules={[{ required: true, message: "Précisez le mode d'affectation." }]}
                  >
                    <Select placeholder="Entité ou région">
                      <Option value="entite">Entité</Option>
                      <Option value="region">Région</Option>
                    </Select>
                  </Form.Item>
                </Col>

                {ownershipType === "entite" && (
                  <>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="Entité *"
                        name="entite_id"
                        rules={[{ required: true, message: "Sélectionnez l'entité détentrice." }]}
                      >
                        <Select
                          showSearch
                          placeholder="Entité"
                          optionFilterProp="children"
                        >
                          {entites.map(item => (
                            <Option key={item.id} value={item.id}>
                              {item.nom}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Sous-entité" name="sous_entite_id">
                        <Select
                          allowClear
                          showSearch
                          placeholder="Sous-entité"
                          optionFilterProp="children"
                        >
                          {sousEntites.map(item => (
                            <Option key={item.id} value={item.id}>
                              {item.nom}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Coordination" name="coordination_id">
                        <Select
                          allowClear
                          showSearch
                          placeholder="Coordination"
                          optionFilterProp="children"
                        >
                          {coordinations.map(item => (
                            <Option key={item.id} value={item.id}>
                              {item.nom}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </>
                )}

                {ownershipType === "region" && (
                  <>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="Région *"
                        name="region_id"
                        rules={[{ required: true, message: "Sélectionnez une région." }]}
                      >
                        <Select
                          showSearch
                          placeholder="Région"
                          optionFilterProp="children"
                        >
                          {regions.map(item => (
                            <Option key={item.id} value={item.id}>
                              {item.nom}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Province" name="province_id">
                        <Select
                          allowClear
                          showSearch
                          placeholder="Province"
                          optionFilterProp="children"
                        >
                          {provinces.map(item => (
                            <Option key={item.id} value={item.id}>
                              {item.nom}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Commune" name="commune_id">
                        <Select
                          allowClear
                          showSearch
                          placeholder="Commune"
                          optionFilterProp="children"
                        >
                          {communes.map(item => (
                            <Option key={item.id} value={item.id}>
                              {item.nom}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </>
                )}
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Date d'entrée *"
                    name="date_entree"
                    rules={[{ required: true, message: "Indiquez la date d'entrée dans le stock." }]}
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Date de sortie" name="date_sortie">
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Observations" name="observations">
                <Input.TextArea rows={4} placeholder="Notes complémentaires (état, accessoires, interventions…)" />
              </Form.Item>

              <div className="munition-form-actions">
                <Space align="center">
                  <Button onClick={() => navigate("/materiels-specifiques")}>Annuler</Button>
                  <Button type="primary" htmlType="submit">
                    {id ? "Mettre à jour" : "Enregistrer"}
                  </Button>
                </Space>
              </div>
            </Form>
          </Card>
        </div>
      </div>
    </Spin>
  );
}
