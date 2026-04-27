// src/components/MunitionForm.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Form,
  Input,
  InputNumber,
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
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import api from "../api";
import resolveApiBase from "../utils/resolveApiBase";
import "./MunitionForm.css";

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;

const REQUIRED_FIELDS = [
  "config_munition_id",
  "reference",
  "designation",
  "type",
  "calibre",
  "stock_initial",
  "date_entree",
];

const resolveBridge = () => {
  if (typeof window === "undefined") return null;
  return window.electronAPI || window.safeElectronAPI || window.api || null;
};

const waitForBridge = (timeout = 1500) =>
  new Promise(resolve => {
    const immediate = resolveBridge();
    if (immediate) return resolve(immediate);
    const start = Date.now();
    const tick = () => {
      const candidate = resolveBridge();
      if (candidate) return resolve(candidate);
      if (Date.now() - start >= timeout) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });

const fetchJson = async (endpoint, params = {}, options = {}) => {
  const base = resolveApiBase();
  const cleanedBase = base.replace(/\/$/, "");
  let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (cleanedBase.endsWith("/api") && path.startsWith("/api")) {
    path = path.replace(/^\/api/, "");
  }
  if (!path.startsWith("/")) path = `/${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = (() => {
    try { return localStorage.getItem("auth-token") || localStorage.getItem("auth_token"); } catch { return null; }
  })();
  if (token && !headers.Authorization) headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const method = (options.method || "GET").toUpperCase();
  const query = params && method === "GET"
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString()
    : "";
  if (query) path += path.includes("?") ? `&${query}` : `?${query}`;
  const request = { ...options, method, headers };
  if (method !== "GET" && params && !options.body) request.body = JSON.stringify(params);
  const response = await fetch(`${cleanedBase}${path}`, request);
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
};

const safeCall = async (variants = [], payload) => {
  const bridge = await waitForBridge();
  const names = Array.isArray(variants) ? variants : [variants];
  let lastError = null;

  for (const name of names) {
    const candidates = [
      bridge && typeof bridge[name] === "function" ? () => bridge[name](payload ?? {}) : null,
      bridge && typeof bridge.call === "function" ? () => bridge.call(name, payload ?? {}) : null,
      typeof api[name] === "function" ? () => api[name](payload ?? {}) : null,
      typeof api.call === "function" ? () => api.call(name, payload ?? {}) : null,
    ].filter(Boolean);

    for (const fn of candidates) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error(`Aucune implémentation disponible pour ${names.join(", ")}`);
};

const normalizeArray = input => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.rows)) return input.rows;
  if (Array.isArray(input?.data)) return input.data;
  if (Array.isArray(input?.items)) return input.items;
  return [];
};

export default function MunitionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [configs, setConfigs] = useState([]);
  const [entites, setEntites] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [sousEntites, setSousEntites] = useState([]);
  const [coordinations, setCoordinations] = useState([]);

  const configId = Form.useWatch("config_munition_id", form);
  const ownershipType = Form.useWatch("ownership_type", form);
  const entiteId = Form.useWatch("entite_id", form);
  const regionId = Form.useWatch("region_id", form);
  const provinceId = Form.useWatch("province_id", form);

  const configMap = useMemo(
    () => new Map(configs.map(cfg => [String(cfg.id), cfg])),
    [configs]
  );

  const updateProgress = useCallback(() => {
    const values = form.getFieldsValue(true);
    const filled = REQUIRED_FIELDS.reduce(
      (acc, field) => (values[field] !== undefined && values[field] !== null && values[field] !== "" ? acc + 1 : acc),
      0
    );
    setProgress(Math.round((filled / REQUIRED_FIELDS.length) * 100));
  }, [form]);

  const loadConfigs = useCallback(async () => {
    const data =
      (await safeCall(["getConfigMunitionList", "getConfig_munitionList", "getConfigMunitions"]).catch(() => null)) ||
      (await fetchJson("/api/config_munitions"));
    setConfigs(normalizeArray(data));
  }, []);

  const loadEntites = useCallback(async () => {
    const data =
      (await safeCall(["getEntitesList", "getEntites"]).catch(() => null)) ||
      (await fetchJson("/api/entites"));
    setEntites(normalizeArray(data));
  }, []);

  const loadRegions = useCallback(async () => {
    const data =
      (await safeCall(["getRegionsList", "getRegions"]).catch(() => null)) ||
      (await fetchJson("/api/regions"));
    setRegions(normalizeArray(data));
  }, []);

  const loadLocalites = useCallback(async () => {
    const data =
      (await safeCall(["getLocalitesList", "getLocalites"]).catch(() => null)) ||
      (await fetchJson("/api/localites"));
    setLocalites(normalizeArray(data));
  }, []);

  const loadSousEntites = useCallback(async entite => {
    if (!entite) {
      setSousEntites([]);
      setCoordinations([]);
      return;
    }
    const sous =
      (await safeCall(["getSousEntitesByEntite", "getSousEntites"], entite).catch(() => null)) ||
      (await fetchJson(`/api/sous_entites`, { entite_id: entite }));
    const coord =
      (await safeCall(["getCoordinationsByEntite", "getCoordinations"], entite).catch(() => null)) ||
      (await fetchJson(`/api/coordinations`, { entite_id: entite }));
    setSousEntites(normalizeArray(sous));
    setCoordinations(normalizeArray(coord));
  }, []);

  const loadProvinces = useCallback(async region => {
    if (!region) {
      setProvinces([]);
      setCommunes([]);
      return;
    }
    const prov =
      (await safeCall(["getProvincesByRegion", "getProvinces"], region).catch(() => null)) ||
      (await fetchJson(`/api/provinces`, { region_id: region }));
    setProvinces(normalizeArray(prov));
  }, []);

  const loadCommunes = useCallback(async province => {
    if (!province) {
      setCommunes([]);
      return;
    }
    const data =
      (await safeCall(["getCommunesByProvince", "getCommunes"], province).catch(() => null)) ||
      (await fetchJson(`/api/communes`, { province_id: province }));
    setCommunes(normalizeArray(data));
  }, []);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const payload = { id: Number(id) || id };
      const item =
        (await safeCall(["getMunitionById", "getMunition"], payload).catch(() => null)) ||
        (await fetchJson(`/api/munitions/${id}`));
      if (!item) {
        message.error("Munition introuvable.");
        navigate("/dashboard/munitions");
        return;
      }
      form.setFieldsValue({
        config_munition_id: item.config_munition_id,
        reference: item.reference || item.code || "",
        designation: item.designation || "",
        type: item.type || item.type_munition || "",
        calibre: item.calibre || item.caliber || "",
        stock_initial: item.stock_initial ?? item.total_entrees ?? 0,
        date_entree: item.date_entree ? moment(item.date_entree) : null,
        date_sortie: item.date_sortie ? moment(item.date_sortie) : null,
        ownership_type: item.entite_id ? "entite" : item.region_id ? "region" : undefined,
        entite_id: item.entite_id || null,
        sous_entite_id: item.sous_entite_id || null,
        coordination_id: item.coordination_id || null,
        region_id: item.region_id || null,
        province_id: item.province_id || null,
        commune_id: item.commune_id || null,
        observations: item.observations || item.observation || "",
      });
      if (item.entite_id) await loadSousEntites(item.entite_id);
      if (item.region_id) await loadProvinces(item.region_id);
      if (item.province_id) await loadCommunes(item.province_id);
      updateProgress();
    } catch (error) {
      message.error(error?.message || "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, [form, id, navigate, loadSousEntites, loadProvinces, loadCommunes, updateProgress]);

  useEffect(() => {
    Promise.all([loadConfigs(), loadEntites(), loadRegions(), loadLocalites()]).then(() => fetchItem());
  }, [loadConfigs, loadEntites, loadRegions, loadLocalites, fetchItem]);

  useEffect(() => {
    if (entiteId) {
      loadSousEntites(entiteId);
    } else {
      setSousEntites([]);
      setCoordinations([]);
    }
  }, [entiteId, loadSousEntites]);

  useEffect(() => {
    if (regionId) loadProvinces(regionId);
  }, [regionId, loadProvinces]);

  useEffect(() => {
    if (provinceId) loadCommunes(provinceId);
  }, [provinceId, loadCommunes]);

  useEffect(() => {
    if (!configId) return;
    const cfg = configMap.get(String(configId));
    if (!cfg) return;
    form.setFieldsValue({
      designation: cfg.designation || "",
      type: cfg.type || "",
      calibre: cfg.calibre || cfg.caliber || "",
    });
  }, [configId, configMap, form]);

  const onSubmit = async values => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        stock_initial: values.stock_initial != null ? Number(values.stock_initial) : null,
        date_entree: values.date_entree ? values.date_entree.format("YYYY-MM-DD") : null,
        date_sortie: values.date_sortie ? values.date_sortie.format("YYYY-MM-DD") : null,
        motif: values.motif || "",
      };
      if (id) {
        await safeCall(["updateMunition", "editMunition"], { id, ...payload });
        message.success("Munition mise à jour.");
      } else {
        await safeCall(["createMunition", "addMunition"], payload);
        message.success("Munition enregistrée.");
        form.resetFields();
        setSousEntites([]);
        setCoordinations([]);
        setProvinces([]);
        setCommunes([]);
      }
      updateProgress();
      navigate("/dashboard/munition");
    } catch (error) {
      const details =
        error?.response?.data?.error ||
        error?.payload?.error ||
        error?.message ||
        "Enregistrement impossible.";
      message.error(details);
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
              onClick={() => navigate("/dashboard/munitions")}
            />
            <div>
              <Title level={3} className="munition-form-title">
                {id ? "Modifier une munition" : "Ajouter une munition"}
              </Title>
              <Text className="munition-form-subtitle">
                Sélectionnez la configuration, complétez les informations de stock et vérifiez l’affectation.
              </Text>
            </div>
          </div>

          <Card className="munition-form-progress-card" variant="borderless">
            <Progress percent={progress} size="small" status={progress < 100 ? "active" : "success"} />
            <Text className="munition-form-progress-text">
              {progress < 100
                ? "Complétez les champs requis pour valider l’enregistrement."
                : "Les champs essentiels sont remplis, vous pouvez enregistrer."}
            </Text>
          </Card>

          <Card className="munition-form-card" variant="borderless">
            <Form
              form={form}
              layout="vertical"
              onFinish={onSubmit}
              onValuesChange={updateProgress}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Configuration *"
                    name="config_munition_id"
                    rules={[{ required: true, message: "Sélectionnez une configuration." }]}
                  >
                    <Select
                      showSearch
                      placeholder="Choisir une configuration"
                      optionFilterProp="children"
                    >
                      {configs.map(cfg => (
                        <Option key={cfg.id} value={cfg.id}>
                          {cfg.designation || cfg.code || `Config #${cfg.id}`} — {cfg.type || "Type inconnu"}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Référence *"
                    name="reference"
                    rules={[{ required: true, message: "Entrez la référence." }]}
                  >
                    <Input placeholder="Référence logistique" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Désignation *"
                    name="designation"
                    rules={[{ required: true, message: "La désignation est obligatoire." }]}
                  >
                    <Input placeholder="Désignation" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Type *"
                    name="type"
                    rules={[{ required: true, message: "Le type est requis." }]}
                  >
                    <Input placeholder="Type" disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Calibre *"
                    name="calibre"
                    rules={[{ required: true, message: "Le calibre est requis." }]}
                  >
                    <Input placeholder="Calibre" disabled />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item
                    label="Stock initial *"
                    name="stock_initial"
                    rules={[{ required: true, message: "Indiquez le stock initial." }]}
                  >
                    <InputNumber style={{ width: "100%" }} min={0} placeholder="Quantité" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    label="Stock disponible"
                    name="stock_disponible"
                  >
                    <InputNumber style={{ width: "100%" }} min={0} placeholder="Stock actuel" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    label="Seuil critique"
                    name="seuil_critique"
                  >
                    <InputNumber style={{ width: "100%" }} min={0} placeholder="Seuil d'alerte" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    label="Date de péremption"
                    name="date_peremption"
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
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
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Localité *"
                    name="localite_id"
                    rules={[{ required: true, message: "Sélectionnez la localité." }]}
                  >
                    <Select
                      showSearch
                      placeholder="Localité de stockage"
                      optionFilterProp="children"
                    >
                      {localites.map(localite => (
                        <Option key={localite.id} value={localite.id}>
                          {localite.nom}
                        </Option>
                      ))}
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
                    <Select placeholder="Entité ou Région">
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
                        rules={[{ required: true, message: "Sélectionnez l’entité." }]}
                      >
                        <Select
                          showSearch
                          placeholder="Entité"
                          optionFilterProp="children"
                        >
                          {entites.map(entite => (
                            <Option key={entite.id} value={entite.id}>
                              {entite.nom}
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
                        rules={[{ required: true, message: "Sélectionnez la région." }]}
                      >
                        <Select
                          showSearch
                          placeholder="Région"
                          optionFilterProp="children"
                        >
                          {regions.map(region => (
                            <Option key={region.id} value={region.id}>
                              {region.nom}
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
                          {provinces.map(province => (
                            <Option key={province.id} value={province.id}>
                              {province.nom}
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
                          {communes.map(commune => (
                            <Option key={commune.id} value={commune.id}>
                              {commune.nom}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </>
                )}
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Motif du mouvement"
                    name="motif"
                  >
                    <Input placeholder="Motif ou justification du mouvement (dotation, transfert, inventaire...)" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Observations" name="observations">
                <TextArea rows={4} placeholder="Ajoutez un commentaire pour le suivi logistique." />
              </Form.Item>

              <div className="munition-form-actions">
                <Space>
                  <Button onClick={() => navigate("/dashboard/munitions")}>Annuler</Button>
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
