import React, { useEffect, useState, useCallback } from "react";
import { Form, Input, Select, Button, message, Modal } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import "./CoordinationProvincialeForm.css";

const { Option } = Select;

function getPreposition(nomProvince) {
  if (!nomProvince) return "de";
  // Pluriel
  if (/^(les|des|aux)\b/i.test(nomProvince)) return "des";
  // Masculin commençant par une consonne
  if (/^(le|du)\b/i.test(nomProvince)) return "du";
  // Féminin ou voyelle
  if (/^(la|de la|l')/i.test(nomProvince) || /^[aeiouyâêîôûéèëïüœ]/i.test(nomProvince)) return "de la";
  // Par défaut
  return "de";
}

const CREATE_METHODS = ["addCoordinationProvinciale","createCoordinationProvinciale","postCoordinationProvinciale"];
const UPDATE_METHODS = ["updateCoordinationProvinciale","editCoordinationProvinciale","putCoordinationProvinciale"];

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
  const win = window.API_BASE_URL || window.__API_BASE__;
  const stored = localStorage?.getItem("apiBaseUrl");
  const candidate = win || stored;
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
const httpJson = async (method, path, body) => {
  const endpoint = `${resolveApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const resp = await fetch(endpoint, { method, headers: buildJsonHeaders(), body: body ? JSON.stringify(body) : undefined });
  const raw = await resp.text().catch(() => "");
  if (!resp.ok) {
    const error = new Error(raw || resp.statusText || `HTTP ${resp.status}`);
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

export default function CoordinationProvincialeForm({ initialValues = {}, onSuccess }) {
  const [form] = Form.useForm();
  const [coordRegionales, setCoordRegionales] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [filteredProvinces, setFilteredProvinces] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  // Helper pour attendre electronAPI si besoin
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

  // Charger les coordinations régionales
  const loadCoordRegionales = useCallback(async () => {
    const api = await waitForElectronAPI();
    let data = [];
    if (api && typeof api.getCoordinationRegionales === "function") {
      data = await api.getCoordinationRegionales();
    } else if (api && typeof api.getCoordinationRegionaleList === "function") {
      data = await api.getCoordinationRegionaleList();
    }
    setCoordRegionales(Array.isArray(data) ? data : []);
  }, []);

  // Charger toutes les provinces
  const loadProvinces = useCallback(async () => {
    const api = await waitForElectronAPI();
    let data = [];
    if (api && typeof api.getProvinces === "function") {
      data = await api.getProvinces();
    }
    setProvinces(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadCoordRegionales();
    loadProvinces();
  }, [loadCoordRegionales, loadProvinces]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      window.electronAPI.getCoordinationProvincialeById(id)
        .then(data => { if (data) form.setFieldsValue(data); })
        .finally(() => setLoading(false));
    }
  }, [id, form]);

  // Filtrer les provinces selon la région de la coordination régionale sélectionnée
  const handleCoordRegionaleChange = (coordRegionaleId) => {
    const coord = coordRegionales.find(c => c.id === coordRegionaleId);
    if (!coord) {
      setFilteredProvinces([]);
      form.setFieldsValue({ province_id: undefined, nom: "", code: "" });
      return;
    }
    const filtered = provinces.filter(p => String(p.region_id) === String(coord.region_id));
    setFilteredProvinces(filtered);
    form.setFieldsValue({ province_id: undefined, nom: "", code: "" });
  };

  // Lorsqu'on sélectionne une province, génère le nom et le code automatiquement
  const handleProvinceChange = (provinceId) => {
    const province = provinces.find(p => p.id === provinceId);
    if (!province) {
      form.setFieldsValue({ nom: "", code: "" });
      return;
    }
    const prepo = getPreposition(province.nom);
    // Nom en MAJUSCULES
    const nom = `COORDINATION PROVINCIALE ${prepo.toUpperCase()} ${province.nom.toUpperCase()}`;
    // Récupère la coordination régionale sélectionnée pour le code
    const coordRegionaleId = form.getFieldValue("parent_id");
    const coordRegionale = coordRegionales.find(c => c.id === coordRegionaleId);
    const code = [
      (coordRegionale?.code || coordRegionale?.nom || "").toUpperCase(),
      (province.code || province.nom || "").toUpperCase()
    ].filter(Boolean).join('-');
    form.setFieldsValue({ nom, code });
  };

  // Génère le code automatiquement si non fourni
  const generateCode = (nom, province, coordRegionale) => {
    if (!province || !coordRegionale) return "";
    return [
      coordRegionale.code || coordRegionale.nom || "",
      province.code || province.nom || "",
      nom || ""
    ].filter(Boolean).join("-").toUpperCase();
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const coordRegionale = coordRegionales.find(c => c.id === values.parent_id);
      const province = provinces.find(p => p.id === values.province_id);
      const region_id = coordRegionale?.region_id;
      let code = values.code?.trim();
      if (!code) {
        code = generateCode(values.nom, province, coordRegionale);
      }
      const payload = {
        nom: values.nom?.trim() || "",
        code,
        province_id: values.province_id,
        region_id,
        parent_id: values.parent_id,
        description: values.description?.trim() || ""
      };
      if (!payload.nom || !payload.code || !payload.province_id || !payload.region_id || !payload.parent_id) {
        Modal.error({ title: "Champs obligatoires manquants", content: "nom, code, province, région, coordination régionale" });
        setLoading(false);
        return;
      }
      const api = window.electronAPI || window.api || {};
      const createMethod = resolveApiMethod(api, CREATE_METHODS);
      const updateMethod = resolveApiMethod(api, UPDATE_METHODS);
      const updateId = Number(id);
      if (id) {
        let succeeded = false;
        if (updateMethod) {
          try {
            await updateMethod(updateId, payload);
            succeeded = true;
          } catch (errPrimary) {
            try {
              await updateMethod({ id: updateId, ...payload });
              succeeded = true;
            } catch (errSecondary) {
              console.warn("[CoordinationProvincialeForm] bridge update fallback", errSecondary);
            }
          }
        }
        if (!succeeded) await httpJson("PUT", `/api/coordination_provinciale/${updateId}`, payload);
        message.success("Coordination provinciale modifiée !");
      } else {
        let created = false;
        if (createMethod) {
          try {
            await createMethod(payload);
            created = true;
          } catch (errCall) {
            try {
              await createMethod({ ...payload });
              created = true;
            } catch (errSecondary) {
              console.warn("[CoordinationProvincialeForm] bridge create fallback", errSecondary);
            }
          }
        }
        if (!created) await httpJson("POST", "/api/coordination_provinciale", payload);
        message.success("Coordination provinciale ajoutée !");
        await loadCoordRegionales();
        onSuccess?.();
      }
      navigate("/dashboard/coordinations/provinciale");
    } catch (e) {
      let detail = e?.message || e?.toString() || "Erreur inconnue";
      if (e?.response?.data?.error) detail += "\n" + e.response.data.error;
      if (e?.response?.data?.detail) detail += "\n" + e.response.data.detail;
      Modal.error({
        title: "Erreur lors de l'enregistrement",
        content: (
          <div style={{ whiteSpace: "pre-wrap" }}>
            {detail}
          </div>
        ),
        width: 600,
      });
      console.error("[CoordinationProvincialeForm] Erreur lors de l'enregistrement :", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      <Form.Item
        label="Coordination régionale"
        name="parent_id"
        rules={[{ required: true, message: "Sélectionnez une coordination régionale" }]}
      >
        <Select
          placeholder="Sélectionnez une coordination régionale"
          onChange={handleCoordRegionaleChange}
          allowClear
          showSearch
          optionFilterProp="children"
          loading={coordRegionales.length === 0}
        >
          {coordRegionales.map(cr => (
            <Option key={cr.id} value={cr.id}>{cr.nom}</Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        label="Province"
        name="province_id"
        rules={[{ required: true, message: "Sélectionnez une province" }]}
      >
        <Select
          placeholder="Sélectionnez une province"
          allowClear
          onChange={handleProvinceChange}
        >
          {filteredProvinces.map(p => (
            <Option key={p.id} value={p.id}>{p.nom} ({p.code})</Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        label="Nom"
        name="nom"
        rules={[{ required: true, message: "Nom requis" }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Code (laissé vide pour auto-générer)"
        name="code"
      >
        <Input />
      </Form.Item>
      <Form.Item
        label="Description"
        name="description"
      >
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          Enregistrer
        </Button>
      </Form.Item>
    </Form>
  );
}
