// src/components/Parametres.jsx
import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Button,
  Spin,
  Card,
  message
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./Parametres.css";

export default function Parametres() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Charger les paramètres depuis le main process
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = await window.api.call("getParametres", {});
        // Remplit le formulaire avec l'objet retourné
        form.setFieldsValue(params);
      } catch (err) {
        console.error("getParametres", err);
        message.error("Erreur lors du chargement des paramètres.");
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  // 2. Enregistrer les paramètres
  const onFinish = async (values) => {
    setSaving(true);
    try {
      // updateParametres attend un objet { parametre1, parametre2, ... }
      await window.api.call("updateParametres", values);
      message.success("Paramètres sauvegardés avec succès");
      navigate(-1);
    } catch (err) {
      console.error("updateParametres", err);
      message.error("Erreur lors de la sauvegarde des paramètres.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          >
            Retour
          </Button>
        }
        style={{ maxWidth: 600, margin: "24px auto" }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          disabled={saving}
        >
          <Form.Item
            name="parametre1"
            label="Paramètre 1"
            rules={[
              { required: true, message: "Veuillez saisir la valeur du paramètre 1" }
            ]}
          >
            <Input placeholder="Valeur du paramètre 1" />
          </Form.Item>

          <Form.Item
            name="parametre2"
            label="Paramètre 2"
            rules={[
              { required: true, message: "Veuillez saisir la valeur du paramètre 2" }
            ]}
          >
            <Input placeholder="Valeur du paramètre 2" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={saving}
            >
              Enregistrer
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  );
}
