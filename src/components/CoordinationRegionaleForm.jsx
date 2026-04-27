import React, { useEffect, useState } from "react";
import { Form, Input, Button, Select, Card, message, Modal, Row, Col, Space } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import "./CoordinationRegionaleForm.css";

const { Option } = Select;

const CREATE_METHODS = ['addCoordinationRegionale', 'createCoordinationRegionale', 'postCoordinationRegionale'];
const UPDATE_METHODS = ['updateCoordinationRegionale', 'editCoordinationRegionale', 'putCoordinationRegionale'];

const resolveApiMethod = (api, candidates) => {
  if (!api) return null;
  for (const name of candidates) {
    if (typeof api[name] === "function") return (...args) => api[name](...args);
  }
  if (typeof api.call === "function" && candidates.length) {
    const [fallback] = candidates;
    return (...args) => api.call(fallback, ...args);
  }
  return null;
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

const buildJsonHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage?.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const httpJson = async (method, path, body) => {
  const endpoint = `${resolveApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const resp = await fetch(endpoint, {
    method,
    headers: buildJsonHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await resp.text().catch(() => "");
  if (!resp.ok) {
    const detail = raw || resp.statusText || `HTTP ${resp.status}`;
    const error = new Error(detail);
    error.status = resp.status;
    throw error;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export default function CoordinationRegionaleForm() {
  const [form] = Form.useForm();
  const nomValue = Form.useWatch("nom", form);
  const [regions, setRegions] = useState([]);
  const [entites, setEntites] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    const bridge = window.electronAPI || window.api || {};
    (async () => {
      try {
        const regionList = await (bridge.getRegions?.() ?? Promise.resolve([]));
        setRegions(Array.isArray(regionList) ? regionList : []);
      } catch {
        setRegions([]);
      }
      try {
        const entiteList =
          (await bridge.getEntitesList?.()) ??
          (await bridge.getEntites?.()) ??
          [];
        setEntites(Array.isArray(entiteList) ? entiteList : []);
      } catch {
        setEntites([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (window.electronAPI?.getCoordinationRegionaleById(id) ?? Promise.resolve(null))
      .then((data) => {
        if (data) form.setFieldsValue(data);
      })
      .finally(() => setLoading(false));
  }, [id, form]);

  // Génération automatique du code dès que le nom ou la région change
  useEffect(() => {
    const nom = (nomValue || "").trim();
    if (!nom) return;
    const currentCode = form.getFieldValue("code");
    if (currentCode && !currentCode.startsWith("CR-")) return;
    const initials = nom
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase())
      .filter(Boolean)
      .join("");
    form.setFieldsValue({ code: initials ? `CR-${initials}` : "" });
  }, [nomValue, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        nom: values.nom?.trim() || "",
        code: values.code?.trim() || "",
        region_id: values.region_id,
        entite_id: values.entite_id,
        description: values.description?.trim() || ""
      };
      if (!payload.nom || !payload.code || !payload.region_id || !payload.entite_id) {
        throw new Error("Champs obligatoires manquants : nom, code, région, entité.");
      }

      const api = window.electronAPI || window.api || {};
      const createMethod = resolveApiMethod(api, CREATE_METHODS);
      const updateMethod = resolveApiMethod(api, UPDATE_METHODS);
      const updateId = Number(id);
      if (isEdit) {
        let succeeded = false;
        if (updateMethod) {
          try {
            await updateMethod({ id: updateId, ...payload });
            succeeded = true;
          } catch (err) {
            console.warn("[CoordinationRegionaleForm] update via bridge échouée, fallback HTTP", err);
          }
        }
        if (!succeeded) {
          await httpJson("PUT", `/api/coordination_regionale/${updateId}`, payload);
        }
      } else {
        if (createMethod) {
          await createMethod(payload);
        } else {
          await httpJson("POST", "/api/coordination_regionale", payload);
        }
      }

      message.success(isEdit ? "Coordination mise à jour." : "Coordination régionale ajoutée !");
      navigate("/dashboard/coordinations/regionale");
    } catch (e) {
      let detail = e?.response?.data?.detail || e?.message || e?.toString() || "Erreur inconnue";
      Modal.error({
        title: "Erreur lors de l'enregistrement",
        content: (
          <div style={{ whiteSpace: "pre-wrap" }}>
            {detail}
          </div>
        ),
        width: 600,
      });
      console.error("[CoordinationRegionaleForm] Erreur lors de l'enregistrement :", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={id ? "Modifier une Coordination Régionale" : "Ajouter une Coordination Régionale"} style={{ margin: 24 }}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="nom" label="Nom" rules={[{ required: true }]}>
              <Input placeholder="Nom complet" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="code" label="Code" rules={[{ required: true }]}>
              <Input placeholder="CR-XXX" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="region_id" label="Région" rules={[{ required: true }]}>
              <Select placeholder="Sélectionner une région">
                {regions.map(r => <Option key={r.id} value={r.id}>{r.nom}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="entite_id"
              label="Entité de rattachement"
              rules={[{ required: true, message: "Sélectionnez l'entité porteuse" }]}
            >
              <Select placeholder="Choisir une entité">
                {entites.map(entite => (
                  <Option key={entite.id} value={entite.id}>
                    {entite.nom || entite.code || `Entité #${entite.id}`}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={4} placeholder="Notes ou précisions" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {id ? "Enregistrer les modifications" : "Ajouter"}
            </Button>
            <Button onClick={() => navigate("/dashboard/coordinations/regionale")}>
              Annuler
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
