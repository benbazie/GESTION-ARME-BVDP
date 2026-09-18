// src/components/MagasinForm.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Form, Input, Row, Select, Space, Switch, Typography, message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';

const { Title } = Typography;
const { Option } = Select;

const NIVEAUX = [
  { value: 'central',          label: 'Central BVDP' },
  { value: 'division',         label: 'Division' },
  { value: 'bataillon',        label: 'Bataillon' },
  { value: 'centre_formation', label: 'Centre de Formation' },
  { value: 'regional',         label: 'Coordination Régionale' },
  { value: 'provincial',       label: 'Coordination Provinciale' },
  { value: 'communal',         label: 'Coordination Communale' },
  { value: 'localite',         label: 'Localité' },
];

export default function MagasinForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);
  const [niveau,    setNiveau]    = useState('local');

  const [entites,   setEntites]   = useState([]);
  const [regions,   setRegions]   = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes,  setCommunes]  = useState([]);
  const [localites, setLocalites] = useState([]);
  const [coordRegs,  setCoordRegs]  = useState([]);
  const [coordProvs, setCoordProvs] = useState([]);
  const [coordComs,  setCoordComs]  = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);

  // Charge les référentiels
  useEffect(() => {
    Promise.all([
      api.getEntitesList?.() || Promise.resolve([]),
      api.getCoordinationRegionaleList?.() || Promise.resolve([]),
      api.getCoordinationProvincialeList?.() || Promise.resolve([]),
      api.getCoordinationCommunaleList?.() || Promise.resolve([]),
      api.getLocalitesList?.() || Promise.resolve([]),
      api.getUtilisateursList?.() || Promise.resolve([]),
    ]).then(([ents, regs, provs, coms, locs, users]) => {
      setEntites(Array.isArray(ents) ? ents : (ents?.rows || []));
      setCoordRegs(Array.isArray(regs) ? regs : (regs?.rows || []));
      setCoordProvs(Array.isArray(provs) ? provs : (provs?.rows || []));
      setCoordComs(Array.isArray(coms) ? coms : (coms?.rows || []));
      setLocalites(Array.isArray(locs) ? locs : (locs?.rows || []));
      setUtilisateurs(Array.isArray(users) ? users : (users?.rows || []));
    }).catch(console.error);
  }, []);

  // Charge la dotation existante en mode édition
  const loadExisting = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const mag = await api.getMagasinById(id);
      if (!mag) { setError('Magasin introuvable.'); return; }
      setNiveau(mag.niveau || 'local');
      form.setFieldsValue({
        nom:          mag.nom,
        niveau:       mag.niveau,
        actif:        mag.actif !== false,
        observation:  mag.observation || '',
        gestionnaire_id:              mag.gestionnaire_id   || undefined,
        entite_id:                    mag.entite_id          || undefined,
        coordination_regionale_id:    mag.coordination_regionale_id    || undefined,
        coordination_provinciale_id:  mag.coordination_provinciale_id  || undefined,
        coordination_communale_id:    mag.coordination_communale_id    || undefined,
        localite_id:                  mag.localite_id        || undefined,
      });
    } catch (err) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, form]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateMagasin(id, values);
        message.success('Magasin mis à jour.');
      } else {
        await api.createMagasin(values);
        message.success('Magasin créé.');
      }
      navigate('/dashboard/magasin');
    } catch (err) {
      message.error(err?.response?.data?.error || err?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const showEntite    = ['central','division','bataillon','centre_formation'].includes(niveau);
  const showCoordReg  = niveau === 'regional';
  const showCoordProv = niveau === 'provincial';
  const showCoordCom  = niveau === 'communal';
  const showLocalite  = niveau === 'localite';

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard/magasin')}>
          Retour
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {isEdit ? 'Modifier le magasin' : 'Nouveau magasin'}
        </Title>
      </Space>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Card loading={loading}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ actif: true, niveau: 'local' }}
          onFinish={handleSave}
        >
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item name="nom" label="Nom du magasin"
                rules={[{ required: true, message: 'Nom obligatoire' }]}>
                <Input placeholder="Ex : Magasin Central BVDP" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="actif" label="Actif" valuePropName="checked">
                <Switch checkedChildren="Oui" unCheckedChildren="Non" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="niveau" label="Niveau hiérarchique"
            rules={[{ required: true, message: 'Niveau obligatoire' }]}>
            <Select
              placeholder="Sélectionner le niveau"
              onChange={(v) => {
                setNiveau(v);
                form.setFieldsValue({
                  entite_id: undefined,
                  coordination_regionale_id: undefined,
                  coordination_provinciale_id: undefined,
                  coordination_communale_id: undefined,
                  localite_id: undefined,
                });
              }}
            >
              {NIVEAUX.map((n) => (
                <Option key={n.value} value={n.value}>{n.label}</Option>
              ))}
            </Select>
          </Form.Item>

          {/* Rattachement selon niveau */}
          {showEntite && (
            <Form.Item name="entite_id" label="Entité (Division / Bataillon / Centre / BVDP)">
              <Select showSearch placeholder="Sélectionner une entité" allowClear
                optionFilterProp="children" filterOption={(i, o) =>
                  (o?.children || '').toLowerCase().includes(i.toLowerCase())}>
                {entites.map((e) => (
                  <Option key={e.id} value={e.id}>{e.nom} {e.code ? `(${e.code})` : ''}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          {showCoordReg && (
            <Form.Item name="coordination_regionale_id" label="Coordination Régionale">
              <Select showSearch placeholder="Sélectionner" allowClear optionFilterProp="children">
                {coordRegs.map((c) => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
              </Select>
            </Form.Item>
          )}
          {showCoordProv && (
            <Form.Item name="coordination_provinciale_id" label="Coordination Provinciale">
              <Select showSearch placeholder="Sélectionner" allowClear optionFilterProp="children">
                {coordProvs.map((c) => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
              </Select>
            </Form.Item>
          )}
          {showCoordCom && (
            <Form.Item name="coordination_communale_id" label="Coordination Communale">
              <Select showSearch placeholder="Sélectionner" allowClear optionFilterProp="children">
                {coordComs.map((c) => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
              </Select>
            </Form.Item>
          )}
          {showLocalite && (
            <Form.Item name="localite_id" label="Localité">
              <Select showSearch placeholder="Sélectionner une localité" allowClear
                optionFilterProp="children">
                {localites.map((l) => <Option key={l.id} value={l.id}>{l.nom}</Option>)}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="gestionnaire_id" label="Responsable / Gestionnaire">
            <Select showSearch placeholder="Sélectionner un utilisateur" allowClear
              optionFilterProp="children">
              {utilisateurs.map((u) => (
                <Option key={u.id} value={u.id}>
                  {u.nom} {u.prenom || ''} {u.role_nom ? `— ${u.role_nom}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="observation" label="Observation">
            <Input.TextArea rows={3} placeholder="Remarques, emplacement physique…" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                {isEdit ? 'Enregistrer les modifications' : 'Créer le magasin'}
              </Button>
              <Button onClick={() => navigate('/dashboard/magasin')}>Annuler</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
