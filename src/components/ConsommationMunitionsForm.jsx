// src/components/ConsommationMunitionsForm.js
import React, { useEffect, useState } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import "./ConsommationMunitionsForm.css";

function ConsommationMunitionsForm() {
  const [form] = Form.useForm();
  const { id } = useParams(); // Si présent, mode édition
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Chargement des données si en mode édition
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    (async () => {
      try {
        const data = await window.api.call("getConsommationMunitionById", { id });
        form.setFieldsValue({
          munition_id: data.munition_id,
          quantite_consommee: data.quantite_consommee,
          date_consommation: moment(data.date_consommation),
          remarque: data.remarque,
        });
      } catch (err) {
        console.error("Erreur chargement consommation :", err);
        message.error(
          err.message || "Erreur lors du chargement de la consommation"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        date_consommation: values.date_consommation.format("YYYY-MM-DD"),
      };

      if (id) {
        await window.api.call("updateConsommationMunition", { id, ...payload });
      } else {
        await window.api.call("createConsommationMunition", payload);
      }

      message.success("Enregistrement sauvegardé avec succès !");
      navigate("/consommation_munitions");
    } catch (err) {
      message.error(err.message || "Erreur lors de la sauvegarde de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="consommation-form-container">
      <h1>{id ? "Modifier l'enregistrement" : "Ajouter un enregistrement"}</h1>
      <Button
        type="default"
        onClick={() => navigate("/consommation_munitions")}
        icon={<ArrowLeftOutlined />}
        className="back-button"
      >
        Retour à la liste
      </Button>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        className="consommation-form"
      >
        <Form.Item
          label="ID Munition"
          name="munition_id"
          rules={[
            { required: true, message: "Veuillez saisir l'ID de la munition" },
          ]}
        >
          <Input placeholder="ID de la munition" />
        </Form.Item>
        <Form.Item
          label="Quantité Consommée"
          name="quantite_consommee"
          rules={[
            { required: true, message: "Veuillez saisir la quantité consommée" },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            placeholder="Quantité consommée"
          />
        </Form.Item>
        <Form.Item
          label="Date de Consommation"
          name="date_consommation"
          rules={[
            { required: true, message: "Veuillez sélectionner la date" },
          ]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Remarque" name="remarque">
          <Input.TextArea rows={4} placeholder="Remarque (optionnel)" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Sauvegarder
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

export default ConsommationMunitionsForm;
