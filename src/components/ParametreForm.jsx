// src/components/ParametreForm.jsx
import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Button,
  Spin,
  message,
  Card
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

export default function ParametreForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = await window.api.call("getParametres", {});
        form.setFieldsValue(params);
      } catch (err) {
        console.error("getParametres", err);
        message.error("Erreur lors du chargement des paramètres.");
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  const onFinish = async values => {
    setLoading(true);
    try {
      await window.api.call("updateParametres", values);
      message.success("Paramètres sauvegardés avec succès");
      navigate("/");
    } catch (err) {
      console.error("updateParametres", err);
      message.error("Erreur lors de la sauvegarde des paramètres");
    } finally {
      setLoading(false);
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
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="parametre1"
            label="Paramètre 1"
            rules={[
              {
                required: true,
                message: "Veuillez saisir une valeur pour le paramètre 1"
              }
            ]}
          >
            <Input placeholder="Valeur du paramètre 1" />
          </Form.Item>

          <Form.Item
            name="parametre2"
            label="Paramètre 2"
            rules={[
              {
                required: true,
                message: "Veuillez saisir une valeur pour le paramètre 2"
              }
            ]}
          >
            <Input placeholder="Valeur du paramètre 2" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Enregistrer
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  );
}
