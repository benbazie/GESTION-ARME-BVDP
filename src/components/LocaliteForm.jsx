// src/components/LocaliteForm.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  Form,
  Input,
  Button,
  Select,
  message,
  Card,
  Spin,
  Space
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import './LocaliteForm.css';

const { Option } = Select;

export default function LocaliteForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [filteredProvinces, setFilteredProvinces] = useState([]);
  const [filteredCommunes, setFilteredCommunes] = useState([]);

  const loadLookups = useCallback(async () => {
    setLoading(true);
    try {
      const [regionsData, provincesData, communesData] = await Promise.all([
        api.getRegionsList(),
        api.getProvincesList(),
        api.getCommunesList(),
      ]);
      setRegions(Array.isArray(regionsData) ? regionsData : []);
      setProvinces(Array.isArray(provincesData) ? provincesData : []);
      setCommunes(Array.isArray(communesData) ? communesData : []);
    } catch (error) {
      const msg = error?.message === "401" ? "Session expirée." : "Erreur lors du chargement des références.";
      message.error(msg);
      if (error?.message === "401") navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // Si on édite, charger la localité existante
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      try {
        const data = await api.getLocaliteById(id);
        form.setFieldsValue({
          nom: data.nom,
          code: data.code,
          region_id: data.region_id,
          province_id: data.province_id,
          commune_id: data.commune_id,
        });
        if (data?.region_id) {
          handleRegionChange(data.region_id, data.province_id, data.commune_id);
        }
      } catch (error) {
        const msg = error?.message === "401" ? "Session expirée." : "Erreur lors du chargement de la localité.";
        message.error(msg);
        if (error?.message === "401") navigate('/login');
        else navigate('/dashboard/localites');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form, navigate]);

  useEffect(() => {
    const regionId = form.getFieldValue('region_id');
    if (regionId && provinces.length) {
      handleRegionChange(regionId, form.getFieldValue('province_id'), form.getFieldValue('commune_id'));
    }
  }, [provinces, communes, form]);

  // Filtrage en cascade
  const handleRegionChange = (regionId, provId = null, commId = null) => {
    if (!regionId) {
      setFilteredProvinces([]);
      setFilteredCommunes([]);
      form.setFieldsValue({ province_id: undefined, commune_id: undefined });
      return;
    }
    const provs = provinces.filter(p => String(p.region_id) === String(regionId));
    setFilteredProvinces(provs);
    const matchedProvince = provs.find(p => String(p.id) === String(provId));
    form.setFieldsValue({ province_id: matchedProvince?.id ?? undefined });
    handleProvinceChange(matchedProvince?.id, commId);
  };

  const handleProvinceChange = (provinceId, commId = null) => {
    if (!provinceId) {
      setFilteredCommunes([]);
      form.setFieldsValue({ commune_id: undefined });
      return;
    }
    const comms = communes.filter(c => String(c.province_id) === String(provinceId));
    setFilteredCommunes(comms);
    const matchedCommune = comms.find(c => String(c.id) === String(commId));
    form.setFieldsValue({ commune_id: matchedCommune?.id ?? undefined });
  };

  // Soumettre création ou mise à jour
  const onFinish = async values => {
    console.log('[LocaliteForm] onFinish appelé avec values:', values);
    setLoading(true);
    try {
      const payload = {
        nom: values.nom?.trim(),
        code: values.code?.trim(),
        region_id: values.region_id,
        province_id: values.province_id,
        commune_id: values.commune_id,
      };
      console.log('[LocaliteForm] payload construit:', payload);
      if (id) {
        console.log('[LocaliteForm] Mise à jour localité ID:', id);
        await api.updateLocalite({ id, ...payload });
        message.success("Localité mise à jour");
      } else {
        console.log('[LocaliteForm] Création nouvelle localité');
        await api.createLocalite(payload);
        message.success("Localité ajoutée");
      }
      navigate('/dashboard/localites');
    } catch (error) {
      console.error('[LocaliteForm] Erreur enregistrement:', error);
      const msg = error?.message === "401" ? "Session expirée." : (error?.message || "Erreur lors de l'enregistrement");
      message.error(msg);
      if (error?.message === "401") navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="localite-form-container">
      <Spin spinning={loading}>
        <Card title={id ? "Modifier la Localité" : "Ajouter une Localité"} className="localite-form-card">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ code: '' }}
          >
            <Form.Item name="id" hidden>
              <Input />
            </Form.Item>

            <Form.Item
              name="nom"
              label="Nom de la localité"
              rules={[{ required: true, message: "Le nom est obligatoire" }]}
            >
              <Input placeholder="Saisissez le nom de la localité" />
            </Form.Item>

            <Form.Item name="code" label="Code">
              <Input placeholder="Code (facultatif)" />
            </Form.Item>

            <Form.Item
              name="region_id"
              label="Région"
              rules={[{ required: true, message: "Veuillez sélectionner une région" }]}
            >
              <Select
                placeholder="Choisissez une région"
                onChange={val => handleRegionChange(val)}
                allowClear
              >
                {regions.map(r => (
                  <Option key={r.id} value={r.id}>{r.nom}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="province_id"
              label="Province"
              rules={[{ required: true, message: "Veuillez sélectionner une province" }]}
            >
              <Select
                placeholder="Choisissez une province"
                onChange={handleProvinceChange}
                allowClear
              >
                {filteredProvinces.map(p => (
                  <Option key={p.id} value={p.id}>
                    {p.province_nom || p.nom}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="commune_id"
              label="Commune"
              rules={[{ required: true, message: "Veuillez sélectionner une commune" }]}
            >
              <Select placeholder="Choisissez une commune" allowClear>
                {filteredCommunes.map(c => (
                  <Option key={c.id} value={c.id}>{c.nom}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button onClick={() => navigate('/dashboard/localites')}>
                  Annuler
                </Button>
                <Button type="primary" htmlType="submit">
                  Enregistrer
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Spin>
    </div>
  );
}
