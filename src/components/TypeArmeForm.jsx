import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, message, Space } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

const TypeArmeForm = () => {
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getTypesArmeList({ id })
      .then((rows) => {
        const record = Array.isArray(rows) ? rows.find((item) => String(item.id) === String(id)) : null;
        if (record) form.setFieldsValue({ nom: record.nom, code: record.code || "" });
      })
      .catch(() => message.error("Impossible de charger le type"));
  }, [id, form]);

  const handleSubmit = (values) => {
    setSaving(true);
    const action = id ? api.updateTypeArme(id, values) : api.createTypeArme(values);
    action
      .then(() => {
        message.success("Type enregistré");
        navigate("/dashboard/config-armes/types");
      })
      .catch(() => message.error("Enregistrement impossible"))
      .finally(() => setSaving(false));
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/config-armes")}>
          Retour aux configurations
        </Button>
      </Space>
      <Card title={id ? "Modifier un type d'arme" : "Nouveau type d'arme"}>
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item name="nom" label="Libellé" rules={[{ required: true, message: "Libellé obligatoire" }]}>
            <Input placeholder="Ex. Fusil d'assaut" />
          </Form.Item>
          <Form.Item name="code" label="Code interne">
            <Input placeholder="Code (optionnel)" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Enregistrer
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate("/dashboard/config-armes/types")}>
              Annuler
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate("/dashboard/config-armes")}>
              Retour configurations
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
};

export default TypeArmeForm;
