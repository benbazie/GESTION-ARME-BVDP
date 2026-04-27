import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Select, message, Space } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

const CategorieArmeForm = () => {
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState([]);

  useEffect(() => {
    api
      .getTypesArmeList()
      .then((rows) => setTypes(rows || []))
      .catch(() => message.error("Impossible de charger les types d'armes"));
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .getCategoriesArmeList({ id })
      .then((rows) => {
        const record = Array.isArray(rows) ? rows.find((item) => String(item.id) === String(id)) : null;
        if (record)
          form.setFieldsValue({
            nom: record.nom,
            code: record.code || "",
            type_id: record.type_id ?? record.type_arme_id ?? null
          });
      })
      .catch(() => message.error("Impossible de charger la catégorie"));
  }, [id, form]);

  const handleSubmit = (values) => {
    if (!values.type_id) {
      message.error("Sélectionnez un type d'arme");
      return;
    }
    setSaving(true);
    const payload = { ...values, type_id: values.type_id };
    const action = id ? api.updateCategorieArme(id, payload) : api.createCategorieArme(payload);
    action
      .then(() => {
        message.success("Catégorie enregistrée");
        navigate("/dashboard/config-armes/categories");
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
      <Card title={id ? "Modifier une catégorie d'arme" : "Nouvelle catégorie d'arme"}>
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item name="nom" label="Libellé" rules={[{ required: true, message: "Libellé obligatoire" }]}>
            <Input placeholder="Ex. Arme légère" />
          </Form.Item>
          <Form.Item
            name="type_id"
            label="Type d'arme"
            rules={[{ required: true, message: "Type obligatoire" }]}
          >
            <Select
              placeholder="Associer un type"
              options={types.map((item) => ({
                value: item.id,
                label: item.nom || item.libelle || item.code
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="code" label="Code interne">
            <Input placeholder="Code (optionnel)" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Enregistrer
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate("/dashboard/config-armes/categories")}>
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

export default CategorieArmeForm;
