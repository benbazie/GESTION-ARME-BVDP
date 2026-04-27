import { Typography, Form, Input, Card, Button, message } from 'antd';
import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "./ConfigOptiqueForm.css";

const { Title, Text } = Typography;

const ConfigOptiqueForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams(); // Si un id est présent, c'est en mode modification

  const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI

  // Charger la configuration existante en cas de modification
  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        let data;
        try {
          if (isElectron() && window.electronAPI.getConfigOptiqueById) {
            data = await window.electronAPI.getConfigOptiqueById(id);
          } else {
            data = await api.getConfigOptiqueById(id);
          }

          if (data) {
            form.setFieldsValue(data);
          } else {
            message.error("Configuration d'optique non trouvée");
          }
        } catch (error) {
          console.error("Erreur lors de la récupération de la configuration d'optique :", error);
          message.error("Erreur lors de la récupération des données");
        }
      }
    };

    fetchData();
  }, [id, form]);

  const onFinish = async (values) => {
    try {
      const payload = { ...values, id }
      if (id) {
        if (isElectron() && window.electronAPI.updateConfigOptique) {
          await window.electronAPI.updateConfigOptique(payload)
        } else {
          await api.updateConfigOptique(payload)
        }
        message.success("Configuration d'optique mise à jour avec succès");
      } else {
        if (isElectron() && window.electronAPI.createConfigOptique) {
          await window.electronAPI.createConfigOptique(payload)
        } else {
          await api.createConfigOptique(payload)
        }
        message.success("Configuration d'optique ajoutée avec succès");
        form.resetFields();
      }
      navigate("/dashboard/config-optique");
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la configuration d'optique :", error);
      message.error("Erreur lors de l'enregistrement");
    }
  };

  return (
    <div className="config-optique-form-container">
      <Card className="config-optique-form-card" bordered>
        <Title level={2} className="config-optique-form-title">
          {id ? "Modifier la Configuration d'Optique" : "Ajouter une Configuration d'Optique"}
        </Title>
        <Text className="config-optique-form-info">
          Remplissez le formulaire. Les champs marqués d'une étoile (*) sont obligatoires.
        </Text>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          className="config-optique-form"
        >
          <Form.Item
            label="Type *"
            name="type"
            rules={[{ required: true, message: "Veuillez saisir le type." }]}
          >
            <Input placeholder="Ex : Lunette" />
          </Form.Item>
          <Form.Item
            label="Catégorie"
            name="categorie"
          >
            <Input placeholder="Ex : Vision nocturne (optionnel)" />
          </Form.Item>
          <Form.Item
            label="Désignation *"
            name="designation"
            rules={[{ required: true, message: "Veuillez saisir la désignation." }]}
          >
            <Input placeholder="Ex : Lunette FFP20" />
          </Form.Item>
          <Form.Item label="Observation" name="observation">
            <Input.TextArea rows={4} placeholder="Commentaires ou remarques (optionnel)" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {id ? "Mettre à jour" : "Ajouter"}
            </Button>
          </Form.Item>
        </Form>
        <div className="config-optique-form-back">
          <Button type="default" onClick={() => navigate("/dashboard/config-optique")} block>
            Retour à la liste
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ConfigOptiqueForm;
