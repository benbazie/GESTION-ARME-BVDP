import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Col, Form, Input, Row, Select, Space, Spin, Typography, message } from "antd";
import api from "../api";
import "./CommuneForm.css";

const { Title, Paragraph } = Typography;
const { Option } = Select;

const callFirstAvailable = async (candidates = []) => {
  let lastError = null;
  for (const candidate of candidates) {
    if (typeof candidate !== "function") continue;
    try {
      return await candidate();
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  throw new Error("Aucune implémentation disponible.");
};

export default function CommuneForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);

  const selectedRegion = Form.useWatch("region_id", form);
  const communeName = Form.useWatch("nom", form);
  const selectedProvinceId = Form.useWatch("province_id", form);
  const filteredProvinces = useMemo(() => {
    if (!selectedRegion) return [];
    return provinces.filter(
      (province) => String(province.region_id) === String(selectedRegion)
    );
  }, [provinces, selectedRegion]);

  const selectedProvince = useMemo(
    () =>
      provinces.find(
        (province) => String(province.id) === String(selectedProvinceId)
      ) || null,
    [provinces, selectedProvinceId]
  );

  const sanitizeSegment = useCallback((value = "") => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
  }, []);

  useEffect(() => {
    const provinceSegment = sanitizeSegment(
      selectedProvince?.code || selectedProvince?.nom || ""
    );
    const communeSegment = sanitizeSegment(communeName || "").slice(0, 2);
    const generated =
      provinceSegment && communeSegment
        ? `${provinceSegment}-${communeSegment}`
        : "";
    if ((form.getFieldValue("code") || "") !== generated) {
      form.setFieldsValue({ code: generated });
    }
  }, [communeName, selectedProvince, form, sanitizeSegment]);

  const fetchLookups = useCallback(async () => {
    try {
      const [regionsList, provincesList] = await Promise.all([
        api.getRegionsList?.().catch(() => []),
        api.getProvincesList?.().catch(() => []),
      ]);
      setRegions(Array.isArray(regionsList) ? regionsList : []);
      setProvinces(Array.isArray(provincesList) ? provincesList : []);
    } catch (error) {
      console.error("[CommuneForm] lookups:", error);
      message.error("Impossible de charger les référentiels.");
    }
  }, []);

  const fetchCommune = useCallback(async () => {
    if (!isEdit) {
      form.resetFields();
      return;
    }
    try {
      const detail =
        (await api.getCommuneById?.(id)) ||
        (await window.electronAPI?.getCommune?.(Number(id))) ||
        (await window.electronAPI?.call?.("getCommune", Number(id)));
      if (!detail) {
        message.error("Commune introuvable.");
        navigate("/dashboard/communes");
        return;
      }
      form.setFieldsValue({
        nom: detail.nom || "",
        code: detail.code || "",
        region_id: detail.region_id ?? null,
        province_id: detail.province_id ?? null,
        description: detail.description || "",
      });
    } catch (error) {
      console.error("[CommuneForm] fetch:", error);
      message.error("Erreur lors du chargement de la commune.");
      navigate("/dashboard/communes");
    }
  }, [form, id, isEdit, navigate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchLookups();
      await fetchCommune();
      setLoading(false);
    })();
  }, [fetchLookups, fetchCommune]);

  const submitCreate = (payload) =>
    callFirstAvailable([
      () => api.createCommune?.(payload),
      () => api.addCommune?.(payload),
      () => window.electronAPI?.createCommune?.(payload),
      () => window.electronAPI?.addCommune?.(payload),
      () => window.electronAPI?.call?.("createCommune", payload),
    ]);

  const submitUpdate = (payload) =>
    callFirstAvailable([
      () => api.updateCommune?.(id, payload),
      () => api.editCommune?.(id, payload),
      () => window.electronAPI?.updateCommune?.(Number(id), payload),
      () => window.electronAPI?.call?.("updateCommune", Number(id), payload),
    ]);

  const handleFinish = async (values) => {
    setSubmitting(true);
    const payload = {
      nom: values.nom?.trim(),
      code: values.code?.trim(),
      region_id: values.region_id ? Number(values.region_id) : null,
      province_id: values.province_id ? Number(values.province_id) : null,
      description: values.description?.trim() || null,
    };
    try {
      if (isEdit) {
        await submitUpdate(payload);
        message.success("Commune mise à jour.");
      } else {
        await submitCreate(payload);
        message.success("Commune créée.");
      }
      navigate("/dashboard/communes");
    } catch (error) {
      console.error("[CommuneForm] submit:", error);
      message.error("Échec de l’enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegionChange = (value) => {
    form.setFieldsValue({ region_id: value, province_id: undefined });
  };

  return (
    <Spin spinning={loading || submitting}>
      <Card
        bordered={false}
        className="commune-form-card"
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title level={3} style={{ marginBottom: 0 }}>
              {isEdit ? "Modifier la commune" : "Nouvelle commune"}
            </Title>
            <Paragraph type="secondary">
              Renseignez le nom, le code ainsi que la région et la province associées.
            </Paragraph>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            initialValues={{ nom: "", code: "", description: "" }}
            className="commune-form"
          >
            <div className="commune-form-section">
              <Typography.Title level={5}>Informations générales</Typography.Title>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Nom"
                    name="nom"
                    rules={[{ required: true, message: "Le nom est obligatoire." }]}
                  >
                    <Input placeholder="Ex : Ouagadougou I" allowClear />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Code"
                    name="code"
                    rules={[{ required: true, message: "Le code est obligatoire." }]}
                    extra="Le code est généré automatiquement à partir de la province et du nom."
                  >
                    <Input
                      placeholder="Ex : POU-BO"
                      readOnly
                      allowClear={false}
                      style={{ background: "#f6f8fb", cursor: "not-allowed" }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="Description" name="description">
                <Input.TextArea rows={3} placeholder="Notes optionnelles" />
              </Form.Item>
            </div>

            <div className="commune-form-section">
              <Typography.Title level={5}>Rattachement géographique</Typography.Title>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Région"
                    name="region_id"
                    rules={[{ required: true, message: "Sélectionnez une région." }]}
                  >
                    <Select
                      placeholder="Choisir une région"
                      allowClear
                      onChange={handleRegionChange}
                      options={regions.map((region) => ({
                        label: region.nom,
                        value: region.id,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Province"
                    name="province_id"
                    rules={[{ required: true, message: "Sélectionnez une province." }]}
                  >
                    <Select
                      placeholder={
                        selectedRegion ? "Choisir une province" : "Sélectionnez une région d’abord"
                      }
                      allowClear
                      disabled={!selectedRegion}
                      options={filteredProvinces.map((province) => ({
                        label: province.nom,
                        value: province.id,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Space>
              <Button onClick={() => navigate(-1)}>Annuler</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {isEdit ? "Mettre à jour" : "Enregistrer"}
              </Button>
            </Space>
          </Form>
        </Space>
      </Card>
    </Spin>
  );
}
