import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Form, Input, Card, Spin, Button, message } from 'antd';

const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI;

const ConfigMaterielForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadMateriel();
    }
  }, [id]);

  const loadMateriel = async () => {
    try {
      setLoading(true);
      let data;
      if (isElectron() && window.electronAPI.getConfigMaterielById) {
        data = await window.electronAPI.getConfigMaterielById(id);
      } else {
        data = await api.getConfigMaterielById(id);
      }
      if (data) {
        form.setFieldsValue(data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement du matériel:", error);
      message.error("Erreur lors du chargement du matériel");
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const payload = id ? { ...values, id } : values;
      if (id) {
        if (isElectron() && window.electronAPI.updateConfigMateriel) {
          await window.electronAPI.updateConfigMateriel(payload);
        } else {
          await api.updateConfigMateriel(payload);
        }
        message.success("Configuration de matériel mise à jour avec succès");
      } else {
        if (isElectron() && window.electronAPI.createConfigMateriel) {
          await window.electronAPI.createConfigMateriel(payload);
        } else {
          await api.createConfigMateriel(payload);
        }
        message.success("Configuration de matériel ajoutée avec succès");
      }
      navigate('/config-materiel');
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      message.error("Erreur lors de la sauvegarde de la configuration de matériel");
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
                onClick={() => navigate("/config-materiel")}
                style={{ marginRight: "10px" }}
              />
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                {id ? "Modifier" : "Ajouter"} Configuration de Matériel
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
              name="categorie"
              label="Catégorie"
              rules={[{ required: true, message: "Veuillez saisir la catégorie" }]}
            >
              <Input placeholder="Saisir la catégorie" />
            </Form.Item>

            <Form.Item
              name="designation"
              label="Désignation"
              rules={[{ required: true, message: "Veuillez saisir la désignation" }]}
            >
              <Input placeholder="Saisir la désignation" />
            </Form.Item>

            <Form.Item name="observation" label="Observation">
              <Input.TextArea placeholder="Saisir éventuellement une observation" rows={4} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                {id ? "Mettre à jour" : "Ajouter"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </Spin>
  );
};

export default ConfigMaterielForm;
