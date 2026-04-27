import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Select, Space, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

const ModeleArmeForm = () => {
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const selectedTypeId = Form.useWatch("type_id", form);
  const filteredCategories = useMemo(() => {
    if (!selectedTypeId) return categories;
    const target = Number(selectedTypeId);
    return categories.filter(
      (item) => Number(item.type_id ?? item.type_arme_id) === target
    );
  }, [categories, selectedTypeId]);

  useEffect(() => {
    Promise.all([api.getTypesArmeList(), api.getCategoriesArmeList()])
      .then(([typeData, catData]) => {
        setTypes(typeData || []);
        setCategories(catData || []);
      })
      .catch(() => message.error("Chargement des référentiels impossible"));
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .getModelesArmeList({ id })
      .then((rows) => {
        const record = Array.isArray(rows) ? rows.find((item) => String(item.id) === String(id)) : null;
        if (record) {
          form.setFieldsValue({
            nom: record.nom || record.designation || "",
            code: record.code || "",
            type_id: record.type_id || null,
            categorie_id: record.categorie_id || null
          });
        }
      })
      .catch(() => message.error("Impossible de charger le modèle"));
  }, [id, form]);

  useEffect(() => {
    if (!selectedTypeId) {
      form.setFieldsValue({ categorie_id: null });
      return;
    }
    const current = form.getFieldValue("categorie_id");
    if (
      current &&
      !filteredCategories.some((item) => Number(item.id) === Number(current))
    ) {
      form.setFieldsValue({ categorie_id: null });
    }
  }, [selectedTypeId, filteredCategories, form]);

  const handleSubmit = (values) => {
    setSaving(true);
    const action = id ? api.updateModeleArme(id, values) : api.createModeleArme(values);
    action
      .then(() => {
        message.success("Modèle enregistré");
        navigate("/dashboard/config-armes/modeles");
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
      <Card title={id ? "Modifier un modèle d'arme" : "Nouveau modèle d'arme"}>
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item name="type_id" label="Type" rules={[{ required: true, message: "Sélectionnez un type" }]}>
            <Select
              placeholder="Choisir un type"
              options={types.map((item) => ({ value: item.id, label: item.nom || item.libelle || item.code }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="categorie_id"
            label="Catégorie"
            rules={[{ required: true, message: "Sélectionnez une catégorie" }]}
          >
            <Select
              placeholder="Choisir une catégorie"
              options={filteredCategories.map((item) => ({
                value: item.id,
                label: item.nom || item.libelle || item.code
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="nom" label="Libellé" rules={[{ required: true, message: "Libellé obligatoire" }]}>
            <Input placeholder="Ex. AK-47" />
          </Form.Item>
          <Form.Item name="code" label="Code interne">
            <Input placeholder="Code (optionnel)" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Enregistrer
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate("/dashboard/config-armes/modeles")}>
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

export default ModeleArmeForm;
