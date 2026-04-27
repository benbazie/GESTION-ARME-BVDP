// src/components/ConfigMunitionForm.js
import React, { useEffect } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { Form, Input, InputNumber, Card, Spin, Button, message } from "antd";
import api from "../api";
import "./ConfigMunitionForm.css";

const isElectron = () => typeof window !== "undefined" && !!window.electronAPI;

async function tryCall(variants, ...args) {
  for (const name of variants) {
    try {
      if (isElectron() && window.electronAPI && typeof window.electronAPI[name] === "function") {
        return await window.electronAPI[name](...args);
      }
      if (api && typeof api[name] === "function") {
        return await api[name](...args);
      }
    } catch (err) {
      console.warn(`[tryCall] ${name} failed:`, err && (err.message || err));
    }
  }
  throw new Error("Aucune méthode API disponible: " + variants.join(", "));
}

const ConfigMunitionForm = () => {
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      if (!isEditMode) return;
      setLoading(true);
      try {
        const variants = [
          "getConfigMunitionById",
          "getConfigMunitionsById",
          "getConfig_munitionById",
          "getConfig_munitionsById"
        ];
        const data = await tryCall(variants, id);

        if (!mounted) return;

        if (data) {
          form.setFieldsValue(data);
        } else {
          message.error("Configuration de munition non trouvée");
          navigate("/dashboard/config-munitions");
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données :", error);
        message.error("Erreur lors du chargement des données");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [id, isEditMode, form, navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      let result;
      if (isEditMode) {
        const payload = { id, ...values };
        result = await tryCall(
          ["updateConfigMunition", "updateConfigMunitions", "update_config_munition", "update_config_munitions"],
          payload
        );
        console.log("update result:", result);
        message.success("Configuration de munition mise à jour");
        navigate("/dashboard/config-munitions");
      } else {
        result = await tryCall(
          ["createConfigMunition", "createConfigMunitions", "create_config_munition", "create_config_munitions"],
          values
        );
        console.log("create result:", result);
        // some APIs return { id } or { ok:true } or the created object; tolerant check:
        if (!result) {
          throw new Error("Création échouée: réponse vide");
        }
        message.success("Configuration de munition ajoutée");
        navigate("/dashboard/config-munitions");
      }
    } catch (error) {
      console.error("Erreur lors de l'opération :", error);
      message.error(error?.message || "Erreur lors de l'opération sur la configuration de munition");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div style={{ padding: "20px" }}>
        <Card
          title={
            <div style={{ display: "flex", alignItems: "center" }}>
              <Button
                type="link"
                icon={<ArrowLeftOutlined style={{ fontSize: "18px" }} />}
                onClick={() => navigate("/dashboard/config-munitions")}
                style={{ marginRight: "10px" }}
              />
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                {isEditMode ? "Modifier" : "Ajouter"} Configuration de Munition
              </span>
            </div>
          }
          style={{ maxWidth: 600, margin: "auto" }}
        >
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="type"
              label="Type"
              rules={[{ required: true, message: "Veuillez saisir le type" }]}
            >
              <Input placeholder="Saisir le type" />
            </Form.Item>

            <Form.Item
              name="calibre"
              label="Calibre"
              rules={[{ required: true, message: "Veuillez saisir le calibre" }]}
            >
              <Input placeholder="Saisir le calibre" />
            </Form.Item>

            <Form.Item
              name="designation"
              label="Désignation"
              rules={[{ required: true, message: "Veuillez saisir la désignation" }]}
            >
              <Input placeholder="Saisir la désignation" />
            </Form.Item>

            <Form.Item
              name="seuil_critique"
              label="Seuil Critique"
              rules={[{ required: true, message: "Veuillez saisir le seuil critique" }]}
            >
              <InputNumber placeholder="Saisir le seuil critique" style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="observation" label="Observation">
              <Input.TextArea placeholder="Saisir éventuellement une observation" rows={4} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                {isEditMode ? "Mettre à jour" : "Ajouter"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </Spin>
  );
};

export default ConfigMunitionForm;
