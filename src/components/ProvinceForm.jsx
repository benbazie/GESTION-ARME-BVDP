// src/components/ProvinceForm.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Form,
  Input,
  Button,
  Select,
  Card,
  Typography,
  Spin,
  Row,
  Col,
  message,
  Modal,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import "./ProvinceForm.css";
import api from "../api";

const { Title, Text } = Typography;
const { Option } = Select;

const waitForElectronAPI = (timeout = 2000) =>
  new Promise((resolve) => {
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

const safeCall = async (variants = [], ...args) => {
  const api = await waitForElectronAPI();
  const names = Array.isArray(variants) ? variants : [variants];
  for (const name of names) {
    try {
      if (api && typeof api[name] === "function") return await api[name](...args);
      if (api && typeof api.call === "function") return await api.call(name, ...(args.length ? args : [{}]));
    } catch (err) {
      if (err?.status === 401) throw err;
      console.warn(`[safeCall] ${name} failed`, err);
    }
  }
  return null;
};

const normalizeList = (value) =>
  Array.isArray(value)
    ? value
    : Array.isArray(value?.rows)
    ? value.rows
    : Array.isArray(value?.data)
    ? value.data
    : [];

const waitForBridge = (timeout = 1500) =>
  new Promise(resolve => {
    if (typeof window === "undefined") return resolve(null);
    if (window.electronAPI || window.api) return resolve(window.electronAPI || window.api);
    const start = Date.now();
    (function poll() {
      if (window.electronAPI || window.api) return resolve(window.electronAPI || window.api);
      if (Date.now() - start >= timeout) return resolve(null);
      setTimeout(poll, 40);
    })();
  });

const bridgeCall = async (names, payload) => {
  const bridge = await waitForBridge();
  const variants = Array.isArray(names) ? names : [names];
  for (const name of variants) {
    try {
      if (bridge?.[name]) return await bridge[name](payload);
      if (bridge?.call) return await bridge.call(name, payload);
    } catch {
      /* essai suivant */
    }
  }
  return null;
};

const resolveApiBaseUrl = () => {
  const fromWindow = window.API_BASE_URL || window.__API_BASE__;
  const fromStorage = localStorage?.getItem("apiBaseUrl");
  const candidate = fromWindow || fromStorage;
  if (candidate) return candidate.replace(/\/$/, "");
  const origin = window.location.origin;
  return origin && !origin.startsWith("file://") ? origin.replace(/\/$/, "") : "http://localhost:3001";
};

const buildJsonHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage?.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const httpJson = async (method, path) => {
  const endpoint = `${resolveApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const resp = await fetch(endpoint, { method, headers: buildJsonHeaders() });
  const text = await resp.text().catch(() => "");
  if (!resp.ok) {
    const error = new Error(text || resp.statusText || `HTTP ${resp.status}`);
    error.status = resp.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
};

const fetchProvinceById = async (provinceId) => {
  if (!provinceId) return null;
  const direct = await safeCall(["getProvinceById","getProvince"], provinceId);
  if (direct) return direct;
  const viaPayload = await safeCall(["getProvinceById","getProvince"], { id: provinceId });
  if (viaPayload) return viaPayload;
  return httpJson("GET", `/api/provinces/${provinceId}`);
};

export default function ProvinceForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const numericId = Number.isFinite(Number(id)) ? Number(id) : null;
  const isEdit = numericId !== null;
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadRegions = useCallback(async () => {
    try {
      const result =
        await safeCall(["getRegions", "getRegionsList"]) ??
        (typeof api?.fetchRegions === "function" ? await api.fetchRegions() : []);
      setRegions(Array.isArray(result) ? result : []);
    } catch (err) {
      Modal.error({ title: "Erreur", content: "Impossible de charger les régions." });
    }
  }, []);

  const loadProvince = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      if (!regions.length) {
        await loadRegions();
      }
      const data = await fetchProvinceById(id);
      if (!data) throw new Error("Province introuvable.");
      form.setFieldsValue({
        nom: data.nom,
        code: data.code,
        region_id: data.region_id,
        description: data.description || ""
      });
    } catch (error) {
      console.error("[ProvinceForm] loadProvince:", error);
      message.error(error.message || "Impossible de charger la province.");
    } finally {
      setLoading(false);
    }
  }, [form, id, isEdit, regions.length, loadRegions]);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  useEffect(() => {
    loadProvince();
  }, [loadProvince]);

  const onFinish = async (values) => {
    const payload = {
      nom: values.nom?.trim(),
      code: values.code?.trim(),
      region_id: values.region_id,
    };

    setLoading(true);
    try {
      if (isEdit) {
        let result = await safeCall(["updateProvince", "editProvince"], { id: numericId, ...payload });
        if (!result && typeof api?.updateProvince === "function") {
          result = await api.updateProvince(numericId, payload);
        }
        if (!result && typeof api?.client?.put === "function") {
          await api.client.put(`/provinces/${numericId}`, payload);
        }
      } else {
        let created = await safeCall(["addProvince", "createProvince"], payload);
        if (!created && typeof api?.createProvince === "function") {
          created = await api.createProvince(payload);
        }
        if (!created && typeof api?.client?.post === "function") {
          await api.client.post(`/provinces`, payload);
        }
      }
      navigate("/dashboard/provinces");
    } catch {
      Modal.error({ title: "Erreur", content: "Enregistrement impossible." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row justify="center" style={{ padding: 24 }}>
        <Col xs={24} sm={20} md={16} lg={12}>
          <Card
            className="province-form-card"
            title={
              <div style={{ display: "flex", alignItems: "center" }}>
                <Button
                  type="link"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/dashboard/provinces")}
                />
                <Title level={3} style={{ margin: 0 }}>
                  {id ? "Modifier la Province" : "Ajouter une Province"}
                </Title>
              </div>
            }
          >
            <Text type="secondary">
              Les champs marqués d’une étoile (*) sont obligatoires.
            </Text>

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              style={{ marginTop: 16 }}
              disabled={loading}
            >
              <Form.Item
                label="Nom de la Province *"
                name="nom"
                rules={[
                  {
                    required: true,
                    message: "Veuillez saisir le nom de la province",
                  },
                  {
                    whitespace: true,
                    message: "Le nom ne peut être vide",
                  },
                ]}
              >
                <Input placeholder="Ex : Kadiogo" />
              </Form.Item>

              <Form.Item
                label="Code de la Province *"
                name="code"
                rules={[
                  { required: true, message: "Veuillez saisir le code de la province" },
                  { pattern: /^[A-Za-z0-9\-]+$/, message: "Caractères invalides" },
                ]}
              >
                <Input placeholder="Ex : P-01" />
              </Form.Item>

              <Form.Item
                label="Région Associée *"
                name="region_id"
                rules={[{ required: true, message: "Veuillez sélectionner une région" }]}
              >
                <Select placeholder="Sélectionnez une région">
                  {regions.map((reg) => (
                    <Option key={reg.id} value={reg.id}>
                      {reg.nom}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                >
                  {id ? "Mettre à jour" : "Enregistrer"}
                </Button>
              </Form.Item>
            </Form>

            <div className="province-form-footer">
              {!id && isEdit && (
                <Button
                  type="default"
                  onClick={() =>
                    navigate(`/dashboard/communes/add?province_id=${numericId}`)
                  }
                >
                  Ajouter des Communes à cette Province
                </Button>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}


