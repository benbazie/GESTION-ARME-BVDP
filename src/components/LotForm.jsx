import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  DatePicker,
  Button,
  Card,
  Progress,
  Spin,
  message,
  Typography,
  Row,
  Col,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import "./LotForm.css";

const { TextArea } = Input;
const { Title, Text } = Typography;

/*
 Robust safeCall:
 - essaye window.electronAPI[name]
 - puis window.electronAPI.call(name, ...)
 - puis legacy window.api.call / window.api[name]
 - enfin fallback HTTP direct sur /api/<resource>
 - réessaye variantes de noms fournies
 - renvoie null en cas d'échec (ou relance l'erreur 401 pour gestion auth)
*/
async function safeCall(variants = [], ...args) {
  const names = Array.isArray(variants) ? variants : [variants];
  const hasWindow = typeof window !== "undefined";
  const tokenFromStorage = () => {
    try {
      return (hasWindow && (localStorage.getItem("auth-token") || localStorage.getItem("auth_token"))) || null;
    } catch { return null; }
  };

  const fetchFallback = async (name, ...a) => {
    try {
      const raw = String(name || "")
        .replace(/^(get|create|update|delete)/i, "")
        .replace(/List$|ById$|ByID$/i, "")
        .replace(/s$/i, "")
        .replace(/[A-Z]/g, m => '_' + m.toLowerCase())
        .replace(/^_/, '')
        .toLowerCase()
        .trim();
      if (!raw) return null;
      // determine verb
      const verb = /^get/i.test(name) ? "GET" :
                   /^create/i.test(name) ? "POST" :
                   /^update/i.test(name) ? "PUT" :
                   /^delete/i.test(name) ? "DELETE" : "GET";
      const base = (typeof location !== "undefined" && location.origin) ? `${location.origin}` : "http://localhost:3001";
      const url = `${base}/api/${raw}${verb === 'GET' && a[0] && (typeof a[0] === 'string' || typeof a[0] === 'number') ? `/${a[0]}` : ''}`;
      const headers = { "Content-Type": "application/json" };
      const tk = tokenFromStorage();
      if (tk) headers.Authorization = tk.startsWith("Bearer ") ? tk : `Bearer ${tk}`;

      if (verb === "GET") {
        const params = a[0] && typeof a[0] === "object" ? new URLSearchParams(Object.entries(a[0]).filter(([,v]) => v!=null && v!=='')).toString() : "";
        const final = params ? `${url}?${params}` : url;
        const res = await fetch(final, { method: "GET", headers });
        if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
        if (!res.ok) return null;
        try { return await res.json() } catch { return null }
      }

      if (verb === "POST") {
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(a[0] || {}) });
        if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
        if (!res.ok) return null;
        try { return await res.json() } catch { return null }
      }

      if (verb === "PUT") {
        const id = a[0] && (a[0].id || a[0]._id) ? `/${a[0].id||a[0]._id}` : '';
        const res = await fetch(`${url}${id}`, { method: "PUT", headers, body: JSON.stringify(a[0] || {}) });
        if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
        if (!res.ok) return null;
        try { return await res.json() } catch { return null }
      }

      if (verb === "DELETE") {
        const id = a[0] || "";
        const res = await fetch(`${url}/${id}`, { method: "DELETE", headers });
        if (res.status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
        if (!res.ok) return null;
        try { return await res.json() } catch { return null }
      }
    } catch (e) {
      if (e && e.status === 401) throw e;
      return null;
    }
    return null;
  };

  for (const name of names) {
    try {
      // 1) direct electronAPI[name]
      if (hasWindow && window.electronAPI && typeof window.electronAPI[name] === "function") {
        const r = await window.electronAPI[name](...args);
        return r;
      }
      // 2) electronAPI.call
      if (hasWindow && window.electronAPI && typeof window.electronAPI.call === "function") {
        try {
          const r = await window.electronAPI.call(name, ...(args.length ? args : [{}]));
          return r;
        } catch (e) {
          if (e && e.status === 401) throw e;
        }
      }
      // 3) legacy window.api.call
      if (hasWindow && window.api && typeof window.api.call === "function") {
        try {
          const r = await window.api.call(name, ...(args.length ? args : [{}]));
          return r;
        } catch (e) { /* ignore */ }
      }
      // 4) legacy window.api[name]
      if (hasWindow && window.api && typeof window.api[name] === "function") {
        try {
          const r = await window.api[name](...args);
          return r;
        } catch (e) { /* ignore */ }
      }
      // 5) fetch fallback
      const fetched = await fetchFallback(name, ...args);
      if (fetched !== null) return fetched;
    } catch (err) {
      if (err && err.status === 401) throw err;
      console.warn(`[safeCall] ${name} failed:`, err && (err.message || err));
    }
  }
  return null;
}

export default function LotForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);

  const updateProgress = () => {
    const vals = form.getFieldsValue();
    const required = ["designation", "periode_debut", "periode_fin", "description"];
    const filled = required.reduce((acc, key) => !!vals[key] ? acc + 1 : acc, 0);
    setProgressPercent(Math.round((filled / required.length) * 100));
  };

  const onValuesChange = () => updateProgress();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      try {
        const data = await safeCall(
          ['getLotById', 'getLot', `getLotsById`, `getLots`, 'getLotByID', 'getLotsList'],
          id
        );
        if (!data) throw new Error("Lot introuvable");
        // tolerate different field names
        const designation = data.designation || data.name || data.libelle || "";
        const periode_debut = data.periode_debut || data.date_debut || data.dateStart || null;
        const periode_fin = data.periode_fin || data.date_fin || data.dateEnd || null;
        const description = data.description || data.justificatif || data.note || "";

        form.setFieldsValue({
          designation,
          periode_debut: periode_debut ? moment(periode_debut) : null,
          periode_fin: periode_fin ? moment(periode_fin) : null,
          description
        });
        updateProgress();
      } catch (err) {
        console.error("getLotById", err);
        message.error("Impossible de charger le lot");
        navigate("/lots");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onFinish = async (values) => {
    const payload = {
      // backend expects periode_debut/periode_fin per current DB
      designation: values.designation,
      periode_debut: values.periode_debut?.format("YYYY-MM-DD") || null,
      periode_fin: values.periode_fin?.format("YYYY-MM-DD") || null,
      description: values.description || null
    };

    setLoading(true);
    try {
      if (id) {
        const res = await safeCall(
          ['updateLot', 'updateLots', 'updateLotById', 'updateLotsById', 'updateLotList'],
          { id, ...payload }
        );
        if (res === null) throw new Error("Update failed");
        message.success("Lot mis à jour");
      } else {
        const res = await safeCall(
          ['createLot', 'createLots', 'addLot', 'createLotRecord', 'createLotsList'],
          payload
        );
        if (res === null) throw new Error("Create failed");
        message.success("Lot ajouté");
      }
      navigate("/dashboard/lots");
    } catch (err) {
      console.error("saveLot", err);
      if (err && err.status === 401) {
        message.error("Non autorisé. Veuillez vous connecter.");
      } else {
        message.error("Erreur lors de l'enregistrement");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className="lot-form-page">
        <div className="lot-form-overlay" />
        <div className="lot-form-shell">
          <div className="lot-form-header">
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/dashboard/lots")}
            />
            <div>
              <Title level={3} className="lot-form-title">
                {id ? "Modifier le lot" : "Nouveau lot"}
              </Title>
              <Text className="lot-form-subtitle">
                Renseignez les informations essentielles pour suivre vos lots d’armement.
              </Text>
            </div>
          </div>

          <Card className="lot-form-progress-card" bordered={false}>
            <Progress
              percent={progressPercent}
              size="small"
              status={progressPercent < 100 ? "active" : "success"}
            />
            <Text className="lot-form-progress-text">
              {progressPercent < 100
                ? "Complétez les champs requis pour finaliser l’enregistrement."
                : "Parfait, toutes les informations clés sont présentes."}
            </Text>
          </Card>

          <Card className="lot-form-card" bordered={false}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onValuesChange={onValuesChange}
              className="lot-form"
            >
              <Form.Item
                name="designation"
                label="Désignation *"
                rules={[{ required: true, message: "La désignation est obligatoire." }]}
              >
                <Input placeholder="Saisir la désignation du lot" />
              </Form.Item>

              <Row gutter={16} className="lot-form-dates">
                <Col xs={24} md={12}>
                  <Form.Item name="periode_debut" label="Date de début">
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="periode_fin" label="Date de fin">
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="description" label="Description">
                <TextArea rows={4} placeholder="Décrivez le lot ou précisez les conditions (facultatif)" />
              </Form.Item>

              <div className="lot-form-actions">
                <Button type="primary" htmlType="submit" disabled={loading}>
                  {id ? "Enregistrer les modifications" : "Ajouter le lot"}
                </Button>
              </div>
            </Form>
          </Card>
        </div>
      </div>
    </Spin>
  );
}
