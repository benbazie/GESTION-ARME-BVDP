// src/components/DdrForm.js
import React, { useEffect, useState } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import "./DdrForm.css";

function DdrForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams(); // Si présent, mode édition
  const [loading, setLoading] = useState(false);

  // Chargement des données en mode édition
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    (async () => {
      try {
        const data = await window.api.call("getDdrDesarmementById", { id });
        form.setFieldsValue({
          arme_id: data.arme_id,
          vdp_id: data.vdp_id,
          methode_desarmement: data.methode_desarmement,
          statut_desarmement: data.statut_desarmement,
          date_desarmement: moment(data.date_desarmement),
        });
      } catch (err) {
        message.error(
          err.message || "Erreur lors de la récupération de l'opération de DDR"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form]);

  // Soumission du formulaire
  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        date_desarmement: values.date_desarmement.format("YYYY-MM-DD"),
      };

      if (id) {
        await window.api.call("updateDdrDesarmement", { id, ...payload });
      } else {
        await window.api.call("createDdrDesarmement", payload);
      }

      message.success("Opération de DDR sauvegardée !");
      navigate("/ddr_desarmement");
    } catch (err) {
      message.error(
        err.message || "Erreur lors de l'enregistrement de l'opération de DDR"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ddr-form-container">
      <h1>
        {id
          ? "Modifier l'Opération de DDR"
          : "Ajouter une Opération de DDR"}
      </h1>
      <Button
        type="default"
        onClick={() => navigate("/ddr_desarmement")}
        icon={<ArrowLeftOutlined />}
        className="back-button"
      >
        Retour à la liste
      </Button>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        className="ddr-form"
      >
        <Form.Item
          label="ID de l'Arme"
          name="arme_id"
          rules={[{ required: true, message: "Veuillez saisir l'ID de l'arme" }]}
        >
          <Input placeholder="ID de l'arme" />
        </Form.Item>

        <Form.Item
          label="ID du VDP"
          name="vdp_id"
          rules={[{ required: true, message: "Veuillez saisir l'ID du VDP" }]}
        >
          <Input placeholder="ID du VDP" />
        </Form.Item>

        <Form.Item
          label="Méthode de Désarmement"
          name="methode_desarmement"
          rules={[{ required: true, message: "Veuillez saisir la méthode de désarmement" }]}
        >
          <Input placeholder="Méthode de désarmement" />
        </Form.Item>

        <Form.Item
          label="Statut"
          name="statut_desarmement"
          rules={[{ required: true, message: "Veuillez saisir le statut de l'opération" }]}
        >
          <Input placeholder="Statut (ex: Collectée, En cours, Terminée)" />
        </Form.Item>

        <Form.Item
          label="Date de l'Opération"
          name="date_desarmement"
          rules={[{ required: true, message: "Veuillez choisir la date de l'opération" }]}
        >
          <DatePicker style={{ width: "100%" }} />
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

export default DdrForm;
