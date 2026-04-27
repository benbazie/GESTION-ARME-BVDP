// src/components/OptiqueForm.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  Space,
  message,
} from "antd";
import { ArrowLeftOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import moment from "moment";
import api from "../api";
import resolveApiBase from "../utils/resolveApiBase";
import "./OptiqueForm.css";


const { Option } = Select;
const { Title, Text } = Typography;

const REQUIRED_FIELDS = ["config_optique_id", "numero_serie", "etat", "ownership_type", "date_entree"];

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

export default function OptiqueForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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

  const ownershipType = Form.useWatch("ownership_type", form);
  const entiteId = Form.useWatch("entite_id", form);
  const regionId = Form.useWatch("region_id", form);
  const provinceId = Form.useWatch("province_id", form);
  const configId = Form.useWatch("config_optique_id", form);

  const configMap = useMemo(
    () => new Map(configs.map(cfg => [String(cfg.id), cfg])),
    [configs]
  );

  const listPath = useMemo(() => {
    const cleaned = location.pathname.replace(/\/(add|edit\/[^/]+)$/i, "");
    return cleaned || "/dashboard/optiques";
  }, [location.pathname]);

  const goToList = useCallback(
    (options = {}) => navigate(listPath, { replace: false, ...options }),
    [navigate, listPath]
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
      ["getConfigOptiqueList", "getConfigOptiques", "getConfigOptique"],
      "/api/config_optique"
    );
    setConfigs(list);
    if (!list.length) {
      message.warning("Aucune configuration optique disponible, veuillez en créer avant la saisie.");
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

  const fetchItem = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data =
        (await safeCall(["getOptique", "getOptiqueById"], { id }).catch(() =>
          safeCall(["getOptiqueById"], id).catch(() => null)
        )) || null;
      if (!data) {
        message.error("Optique introuvable.");
        goToList({ replace: true });
        return;
      }
      form.setFieldsValue({
        config_optique_id: data.config_optique_id,
        numero_serie: data.numero_serie,
        etat: data.etat,
        date_entree: data.date_entree ? moment(data.date_entree) : null,
        date_sortie: data.date_sortie ? moment(data.date_sortie) : null,
        ownership_type: data.entite_id ? "entite" : "region",
        entite_id: data.entite_id,
        sous_entite_id: data.sous_entite_id,
        coordination_id: data.coordination_id,
        region_id: data.region_id,
        province_id: data.province_id,
        commune_id: data.commune_id,
        observations: data.observation || "",
      });
      if (data.entite_id) loadSousEntites(data.entite_id);
      if (data.region_id) loadProvinces(data.region_id);
      if (data.province_id) loadCommunes(data.province_id);
      updateProgress();
    } catch (err) {
      message.error("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadEntites();
    loadRegions();
    fetchItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    updateProgress();
  }, [ownershipType, configId]);

  useEffect(() => {
    if (entiteId) {
      loadSousEntites(entiteId);
      const entite = entites.find(item => String(item.id) === String(entiteId));
      if (entite?.region_id) form.setFieldsValue({ region_id: entite.region_id });
    } else {
      setSousEntites([]);
      setCoordinations([]);
    }
  }, [entiteId, entites, form]);

  useEffect(() => {
    if (regionId) loadProvinces(regionId);
  }, [regionId]);

  useEffect(() => {
    if (provinceId) loadCommunes(provinceId);
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

  const submit = async values => {
    setLoading(true);
    try {
      // Générer un numéro de série unique si vide
      const payload = {
        ...values,
        numero_serie: values.numero_serie || `OPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        designation: configMap.get(String(values.config_optique_id))?.designation || values.designation || "",
        date_entree: values.date_entree ? values.date_entree.format("YYYY-MM-DD") : null,
        date_sortie: values.date_sortie ? values.date_sortie.format("YYYY-MM-DD") : null,
      };

      if (id) {
        let result = await safeCall(
          ["updateOptique", "editOptique"],
          { id, ...payload }
        ).catch(() => null);
        if (!result && api?.updateOptiques) {
          result = await api.updateOptiques({ id, ...payload }).catch(() => null);
        }
        if (!result && api?.updateOptique) {
          result = await api.updateOptique({ id, ...payload }).catch(() => null);
        }
        if (!result) {
          result = await fetchJson(`/api/optiques/${id}`, payload, { method: "PUT" });
        }
        if (!result) throw new Error("Mise à jour impossible.");
        const confirmation =
          result?._confirmation ||
          `Optique mise à jour : ${
            result?.designation || payload.designation || payload.numero_serie || `ID ${id}`
          }`;
        message.success(confirmation);
      } else {
        let result = await safeCall(
          ["createOptique", "addOptique"],
          payload
        ).catch(() => null);
        if (!result && api?.createOptiques) {
          result = await api.createOptiques(payload).catch(() => null);
        }
        if (!result && api?.createOptique) {
          result = await api.createOptique(payload).catch(() => null);
        }
        if (!result) {
          result = await fetchJson("/api/optiques", payload, { method: "POST" });
        }
        if (!result) throw new Error("Enregistrement impossible.");
        const confirmation =
          result?._confirmation ||
          `Optique enregistrée : ${
            result?.designation || payload.designation || payload.numero_serie || "nouvelle fiche"
          }`;
        message.success(confirmation);
        form.resetFields();
      }
      navigate("/dashboard/optique");
    } catch (error) {
      const detail =
        error?.response?.data?.error ||
        error?.payload?.error ||
        error?.message ||
        "Enregistrement impossible.";
      
      if (detail.includes("UNIQUE constraint failed: optiques.numero_serie")) {
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
              onClick={() => goToList()}
            />
            <div>
              <Title level={3} className="munition-form-title">
                {id ? "Modifier une optique" : "Ajouter une optique"}
              </Title>
              <Text className="munition-form-subtitle">
                Sélectionnez la configuration optique, renseignez la propriété et tenez vos inventaires à jour avec précision.
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
                ? "Complétez tous les champs requis pour pouvoir enregistrer."
                : "Vous pouvez enregistrer l’optique."}
            </Text>
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
                    name="config_optique_id"
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
                            const existing = await fetchJson(`/api/optiques/check?numero_serie=${encodeURIComponent(value)}`);
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
                  <Form.Item label="Type" name="type">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Catégorie" name="categorie">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="État *"
                    name="etat"
                    rules={[{ required: true, message: "Sélectionnez l'état de l'optique." }]}
                  >
                    <Select placeholder="État">
                      <Option value="Doté">Doté</Option>
                      <Option value="Non doté">Non doté</Option>
                      <Option value="En magasin">En magasin</Option>
                      <Option value="Maintenance">Maintenance</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Propriété *"
                    name="ownership_type"
                    rules={[{ required: true, message: "Précisez la propriété." }]}
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
                        rules={[{ required: true, message: "Sélectionnez l'entité." }]}
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
                    rules={[{ required: true, message: "Indiquez la date d'entrée." }]}
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
                <Input.TextArea rows={4} placeholder="Commentaires sur l'état, l'utilisation ou la maintenance." />
              </Form.Item>

              <div className="munition-form-actions">
                <Space>
                  <Button onClick={() => goToList()}>Annuler</Button>
                  <Button type="primary" htmlType="submit" icon={<SafetyCertificateOutlined />}>
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
