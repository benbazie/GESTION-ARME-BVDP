// src/components/MagasinForm.js
import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Button,
  message,
  Spin,
  Card
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import "./MagasinForm.css";

export default function MagasinForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);

  // Charger le magasin si on édite
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      try {
        const data = await window.api.call("getMagasinById", { id });
        form.setFieldsValue({
          nom_magasin:      data.nom_magasin,
          responsable_nom:  data.responsable_nom,
          responsable_prenom: data.responsable_prenom,
          grade_responsable:  data.grade_responsable,
          contact:            data.contact,
          adresse:            data.adresse
        });
      } catch (err) {
        console.error("getMagasinById", err);
        message.error("Erreur lors du chargement du magasin");
        navigate("/magasin");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form]);

  // Soumettre add/update via IPC
  const onFinish = async values => {
    setLoading(true);
    try {
      if (id) {
        await window.api.call("updateMagasin", { id, ...values });
        message.success("Magasin mis à jour");
      } else {
        await window.api.call("addMagasin", values);
        message.success("Magasin ajouté");
      }
      navigate("/magasin");
    } catch (err) {
      console.error("saveMagasin", err);
      message.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className="magasin-form-container">
        <Card title={id ? "Modifier le Magasin" : "Ajouter un Magasin"}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/magasin")}
          >
            Retour à la liste
          </Button>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            className="magasin-form"
          >
            <Form.Item
              name="nom_magasin"
              label="Nom du Magasin"
              rules={[
                { required: true, message: "Le nom est obligatoire" }
              ]}
            >
              <Input placeholder="Nom du magasin" />
            </Form.Item>

            <Form.Item
              name="responsable_nom"
              label="Nom du Responsable"
              rules={[
                { required: true, message: "Le nom du responsable est requis" }
              ]}
            >
              <Input placeholder="Nom du responsable" />
            </Form.Item>

            <Form.Item
              name="responsable_prenom"
              label="Prénom du Responsable"
              rules={[
                { required: true, message: "Le prénom est requis" }
              ]}
            >
              <Input placeholder="Prénom du responsable" />
            </Form.Item>

            <Form.Item
              name="grade_responsable"
              label="Grade du Responsable"
            >
              <Input placeholder="Grade du responsable" />
            </Form.Item>

            <Form.Item
              name="contact"
              label="Contact"
              rules={[
                { required: true, message: "Le contact est requis" }
              ]}
            >
              <Input placeholder="Contact" />
            </Form.Item>

            <Form.Item
              name="adresse"
              label="Adresse"
              rules={[
                { required: true, message: "L'adresse est requise" }
              ]}
            >
              <Input placeholder="Adresse du magasin" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
              >
                Sauvegarder
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </Spin>
  );
}
