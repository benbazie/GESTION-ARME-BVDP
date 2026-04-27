// src/components/AppConfigForm.js
import React, { useEffect, useState, useCallback } from "react";
import { Form, Input, Button, Spin, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import "./AppConfigForm.css";

const resolveApiBase = () => {
  const candidate =
    window.api?.client?.defaults?.baseURL ||
    window.api?.baseURL ||
    window.api?.API_BASE_URL ||
    import.meta.env?.VITE_API_URL;

  if (candidate) return String(candidate).replace(/\/$/, "");

  const origin =
    typeof window !== "undefined" && typeof window.location?.origin === "string"
      ? window.location.origin
      : "";

  if (origin && origin.startsWith("http")) return `${origin.replace(/\/$/, "")}/api`;

  return "http://127.0.0.1:3001/api";
};

const requestJson = async (method, path, body = null) => {
  const base = resolveApiBase();
  const target = path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
  const headers = { "Content-Type": "application/json" };

  try {
    const stored =
      localStorage.getItem("auth-token") || localStorage.getItem("auth_token");
    if (stored) {
      headers.Authorization = stored.startsWith("Bearer ")
        ? stored
        : `Bearer ${stored}`;
    }
  } catch (err) {
    console.warn("[AppConfigForm] lecture token impossible :", err);
  }

  const upper = String(method || "GET").toUpperCase();
  const init = { method: upper, headers, credentials: "include" };

  if (upper === "GET" && body && typeof body === "object") {
    const qs = new URLSearchParams(
      Object.entries(body).filter(([, v]) => v != null && v !== "")
    ).toString();
    const res = await fetch(qs ? `${target}?${qs}` : target, init);
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return res.status === 204 ? null : res.json();
  }

  if (body != null && upper !== "GET") init.body = JSON.stringify(body);
  const res = await fetch(target, init);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.status === 204 ? null : res.json();
};

function AppConfigForm() {
  const [form] = Form.useForm();
  const { id } = useParams(); // En édition, l'id est présent
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialConfig, setInitialConfig] = useState(null);

  const loadConfig = useCallback(async () => {
    if (!id) {
      form.resetFields();
      setInitialConfig(null);
      return;
    }

    setLoading(true);
    try {
      const raw = await requestJson("GET", `/app_config/${id}`);
      const record = Array.isArray(raw) ? raw[0] : raw;
      if (!record) {
        message.error("Configuration introuvable");
        navigate("/app_config", { replace: true });
        return;
      }
      form.setFieldsValue(record);
      setInitialConfig(record);
    } catch (err) {
      console.error("[AppConfigForm] load error :", err);
      message.error("Impossible de charger cette configuration");
    } finally {
      setLoading(false);
    }
  }, [form, id, navigate]);

  const handleSubmit = useCallback(async (values) => {
    setSaving(true);
    try {
      const payload = { ...values };
      if (initialConfig?.id) {
        payload.id = initialConfig.id;
        await requestJson("PUT", `/app_config/${initialConfig.id}`, payload);
        message.success("Configuration mise à jour");
      } else {
        const created = await requestJson("POST", "/app_config", payload);
        if (created?.id) setInitialConfig(created);
        message.success("Configuration créée");
      }
      navigate("/app_config");
    } catch (err) {
      console.error("[AppConfigForm] save error :", err);
      message.error(`Enregistrement impossible : ${err?.message || "erreur inconnue"}`);
    } finally {
      setSaving(false);
    }
  }, [initialConfig, navigate]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <Spin spinning={loading || saving}>
      <div className="app-config-form-container">
        <h1>{id ? "Modifier la Configuration" : "Ajouter une Configuration"}</h1>
        <Button
          type="default"
          onClick={() => navigate("/app_config")}
          icon={<ArrowLeftOutlined />}
          className="back-button"
        >
          Retour à la liste
        </Button>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="app-config-form"
        >
          <Form.Item
            label="Nom du Paramètre"
            name="nom_param"
            rules={[{ required: true, message: "Veuillez saisir le nom du paramètre" }]}
          >
            <Input placeholder="Nom du paramètre" />
          </Form.Item>

          <Form.Item
            label="Valeur"
            name="valeur"
            rules={[{ required: true, message: "Veuillez saisir la valeur" }]}
          >
            <Input placeholder="Valeur" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
          >
            <Input.TextArea rows={4} placeholder="Description (facultatif)" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Sauvegarder
            </Button>
          </Form.Item>
        </Form>
      </div>
    </Spin>
  );
}

export default AppConfigForm;
