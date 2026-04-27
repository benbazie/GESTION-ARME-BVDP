// src/components/RegionForm.jsx
import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Spin,
  Row,
  Col,
  message,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import "./RegionForm.css";
import api from "../api";

const { Title, Text } = Typography;

const getBridge = () => window.electronAPI || window.safeElectronAPI || window.api || {};

const fetchRegionsList = async () => {
  if (typeof api?.getRegionsList === "function") {
    try {
      const list = await api.getRegionsList();
      if (Array.isArray(list)) return list;
    } catch (error) {
      console.warn("[RegionForm] api.getRegionsList:", error);
    }
  }
  const bridge = getBridge();
  const bridgeFns = [bridge?.getRegionsList, bridge?.getRegions];
  for (const fn of bridgeFns) {
    if (typeof fn !== "function") continue;
    try {
      const list = await fn();
      if (Array.isArray(list)) return list;
    } catch (error) {
      console.warn("[RegionForm] bridge regions:", error);
    }
  }
  if (typeof api?.fetchRegions === "function") {
    try {
      const list = await api.fetchRegions();
      if (Array.isArray(list)) return list;
    } catch (error) {
      console.warn("[RegionForm] api.fetchRegions:", error);
    }
  }
  return [];
};

const callRegionVariant = async (fn, regionId) => {
  if (typeof fn !== "function") return null;
  try {
    const direct = await fn(regionId);
    if (direct) return direct;
  } catch {}
  try {
    const viaObject = await fn({ id: regionId });
    if (viaObject) return viaObject;
  } catch {}
  return null;
};

const fetchRegionById = async (regionId) => {
  if (!regionId) return null;
  const bridge = getBridge();
  const variants = [
    api?.getRegionById,
    api?.getRegion,
    api?.fetchRegion,
    bridge?.getRegionById,
    bridge?.getRegion,
  ];
  for (const fn of variants) {
    const result = await callRegionVariant(fn, regionId);
    if (result) return result;
  }
  return null;
};

export default function RegionForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();

  const [existingRegions, setExistingRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedRegionId, setSavedRegionId] = useState(null);

  // Chargement des régions existantes et données de la région si édition
  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      setLoading(true);
      try {
        const regs = await fetchRegionsList();
        if (!isMounted) return;
        setExistingRegions(regs || []);
        if (id) {
          const region = await fetchRegionById(id);
          if (!isMounted) return;
          if (region) {
            form.setFieldsValue({ nom: region.nom, code: region.code });
          } else {
            message.error("Aucune région trouvée pour cet ID");
            navigate("/regions", { replace: true });
          }
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("[RegionForm] init:", error);
        message.error("Erreur lors du chargement des données");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    bootstrap();
    return () => {
      isMounted = false;
    };
  }, [id, form, navigate]);

  // Validation et enregistrement
  const onFinish = async (values) => {
    setSaving(true);
    try {
      const nameLower = values.nom.trim().toLowerCase();

      // Vérifier doublon sur le nom (hors édition)
      if (!id) {
        const exists = existingRegions.some(
          (reg) => reg.nom.trim().toLowerCase() === nameLower
        );
        if (exists) {
          message.error("Cette région existe déjà.");
          return;
        }
      }

      if (id) {
        // Mise à jour
        await window.electronAPI.updateRegion({ id, ...values });
        message.success("Région mise à jour avec succès");
        navigate("/regions");
      } else {
        // Création
        const { id: newId } = await window.electronAPI.createRegion(values);
        message.success("Région ajoutée avec succès");
        setSavedRegionId(newId);
        form.resetFields();
      }
    } catch (err) {
      console.error("RegionForm save:", err);
      message.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row justify="center" style={{ padding: 24 }}>
        <Col xs={24} sm={20} md={16} lg={12}>
          <Card
            className="region-form-card"
            title={
              <div style={{ display: "flex", alignItems: "center" }}>
                <Button
                  type="link"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/regions")}
                />
                <Title level={3} style={{ margin: 0 }}>
                  {id ? "Modifier la Région" : "Ajouter une Région"}
                </Title>
              </div>
            }
          >
            <Text type="secondary">
              Les champs marqués d'une étoile (*) sont obligatoires.
            </Text>

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              style={{ marginTop: 16 }}
              disabled={saving}
            >
              <Form.Item
                label="Nom de la Région *"
                name="nom"
                rules={[
                  { required: true, message: "Veuillez saisir le nom de la région" },
                  { whitespace: true, message: "Le nom ne peut être vide" },
                ]}
              >
                <Input placeholder="Ex : Centre" />
              </Form.Item>

              <Form.Item
                label="Code de la Région *"
                name="code"
                rules={[
                  { required: true, message: "Veuillez saisir le code de la région" },
                  {
                    pattern: /^[A-Za-z0-9\-]+$/,
                    message: "Caractères invalides (lettres, chiffres et tirets autorisés)",
                  },
                ]}
              >
                <Input placeholder="Ex : R-01" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={saving}
                >
                  {id ? "Mettre à jour" : "Enregistrer"}
                </Button>
              </Form.Item>
            </Form>

            {!id && savedRegionId && (
              <div style={{ marginTop: 16 }}>
                <Button
                  type="default"
                  block
                  onClick={() =>
                    navigate(`/provinces/add?region_id=${savedRegionId}`)
                  }
                >
                  Ajouter des Provinces à cette Région
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}

