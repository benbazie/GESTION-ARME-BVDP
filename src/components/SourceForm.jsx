import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Form, Input, Space, message } from "antd";
import dayjs from "dayjs";
import { useNavigate, useParams } from "react-router-dom";
import api, {
  getSourceArmement,
  createSourceArmement,
  updateSourceArmement
} from "../api";

const SourceForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = useMemo(() => Boolean(id), [id]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    setLoading(true);
    getSourceArmement(id)
      .then((data) => {
        if (!mounted) return;
        const initial = {
          ...data,
          date_reception: data?.date_reception ? dayjs(data.date_reception) : null,
          date_cloture: data?.date_cloture ? dayjs(data.date_cloture) : null
        };
        form.setFieldsValue(initial);
      })
      .catch((error) => {
        console.error("[SourceForm] load:", error);
        message.error("Impossible de charger la source.");
        navigate("/dashboard/sources");
      })
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, [isEdit, id, form, navigate]);

  const handleSubmit = async (values) => {
    const payload = {
      ...values,
      date_reception: values.date_reception
        ? values.date_reception.format("YYYY-MM-DD")
        : null,
      date_cloture: values.date_cloture
        ? values.date_cloture.format("YYYY-MM-DD")
        : null
    };
    setLoading(true);
    try {
      if (isEdit) {
        await updateSourceArmement(id, payload);
        message.success("Source mise à jour.");
      } else {
        await createSourceArmement(payload);
        message.success("Source créée.");
      }
      navigate("/dashboard/sources");
    } catch (error) {
      console.error("[SourceForm] submit:", error);
      message.error("Enregistrement impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={isEdit ? "Modifier une source" : "Nouvelle source"}
      extra={
        <Button onClick={() => navigate("/dashboard/sources")}>
          Retour
        </Button>
      }
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={handleSubmit}
        disabled={loading}
      >
        <Form.Item
          name="code"
          label="Code"
          rules={[{ required: true, message: "Code requis" }]}
        >
          <Input placeholder="Ex. SRC-001" />
        </Form.Item>

        <Form.Item
          name="nom"
          label="Nom"
          rules={[{ required: true, message: "Nom requis" }]}
        >
          <Input placeholder="Nom de la source" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} placeholder="Détails complémentaires" />
        </Form.Item>

        <Form.Item name="provenance" label="Provenance">
          <Input placeholder="Origine (pays, organisation…)" />
        </Form.Item>

        <Form.Item name="source_dotation_id" label="Source de dotation">
          <Input placeholder="Identifiant externe éventuel" />
        </Form.Item>

        <Form.Item name="date_reception" label="Date de réception">
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="date_cloture" label="Date de clôture">
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Space>
          <Button onClick={() => navigate("/dashboard/sources")}>
            Annuler
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </Space>
      </Form>
    </Card>
  );
};

export default SourceForm;
