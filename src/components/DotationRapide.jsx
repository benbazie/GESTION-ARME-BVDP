// src/components/DotationRapide.js
import React, { useState } from "react";
import {
  Form,
  Input,
  InputNumber,
  Button,
  DatePicker,
  Select,
  message
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "./DotationRapide.css";

const { Option } = Select;

export default function DotationRapide() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async values => {
    setLoading(true);

    // Préparer le payload
    const payload = {
      vdp_id: values.vdp_id,
      ressource_type: values.equipement_type,
      ressource_id: values.equipement_id,
      quantite: values.quantite,
      date_dotation: values.date_dotation.format("YYYY-MM-DD"),
      type_dotation: "Rapide"
    };

    try {
      // Appel IPC au lieu de fetch
      await window.api.call("createDotationRapide", payload);
      message.success("Dotation rapide enregistrée");
      navigate("/dotations");
    } catch (err) {
      console.error("Erreur dotation rapide :", err);
      message.error(err.message || "Erreur lors de la dotation rapide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dotation-rapide-container">
      <h1>Dotation Rapide</h1>

      <Button
        type="default"
        onClick={() => navigate("/")}
        icon={<ArrowLeftOutlined />}
        className="back-button"
      >
        Retour au Dashboard
      </Button>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        className="dotation-rapide-form"
      >
        <Form.Item
          name="vdp_id"
          label="VDP ID"
          rules={[{ required: true, message: "Veuillez saisir l'ID du VDP" }]}
        >
          <Input placeholder="ID du VDP" />
        </Form.Item>

        <Form.Item
          name="equipement_type"
          label="Type d'Équipement"
          rules={[{ required: true, message: "Veuillez sélectionner un type" }]}
        >
          <Select placeholder="Sélectionner un type">
            <Option value="arme">Arme</Option>
            <Option value="munition">Munition</Option>
            <Option value="optique">Optique</Option>
            <Option value="materiel_specifique">
              Matériel Spécifique
            </Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="equipement_id"
          label="ID de l'Équipement"
          rules={[{ required: true, message: "Veuillez saisir l'ID de l'équipement" }]}
        >
          <Input placeholder="ID de l'équipement" />
        </Form.Item>

        <Form.Item name="quantite" label="Quantité">
          <InputNumber
            style={{ width: "100%" }}
            placeholder="Quantité"
          />
        </Form.Item>

        <Form.Item
          name="date_dotation"
          label="Date de Dotation"
          rules={[{ required: true, message: "Veuillez sélectionner la date" }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Effectuer la Dotation
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
