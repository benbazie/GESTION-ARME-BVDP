import React, { useEffect, useState } from "react";
import { Form, Input, Button, Select, Card, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import "./CoordinationForm.css";

const { Option } = Select;

export default function CoordinationForm() {
  const [form] = Form.useForm();
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    window.electronAPI.getRegions().then(setRegions);
    window.electronAPI.getProvinces().then(setProvinces);
    window.electronAPI.getCommunes().then(setCommunes);
    if (id) {
      setLoading(true);
      window.electronAPI.getCoordinationById(id)
        .then(data => { if (data) form.setFieldsValue(data); })
        .finally(() => setLoading(false));
    }
  }, [id, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      if (id) {
        await window.electronAPI.updateCoordination(id, values);
        message.success("Coordination modifiée !");
      } else {
        await window.electronAPI.addCoordination(values);
        message.success("Coordination ajoutée !");
      }
      navigate("/dashboard/coordinations");
    } catch (e) {
      message.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={id ? "Modifier une Coordination" : "Ajouter une Coordination"} style={{ margin: 24 }}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="nom" label="Nom" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="code" label="Code" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Select>
            <Option value="regionale">Régionale</Option>
            <Option value="provinciale">Provinciale</Option>
            <Option value="communale">Communale</Option>
          </Select>
        </Form.Item>
        <Form.Item name="region_id" label="Région">
          <Select allowClear>
            {regions.map(r => <Option key={r.id} value={r.id}>{r.nom}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="province_id" label="Province">
          <Select allowClear>
            {provinces.map(p => <Option key={p.id} value={p.id}>{p.nom}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="commune_id" label="Commune">
          <Select allowClear>
            {communes.map(c => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            {id ? "Enregistrer les modifications" : "Ajouter"}
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => navigate("/dashboard/coordinations")}>
            Annuler
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
