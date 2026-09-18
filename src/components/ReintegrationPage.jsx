// src/components/ReintegrationPage.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Divider, Form, Input,
  Row, Select, Space, Steps, Table, Tag, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, RollbackOutlined,
  SearchOutlined, UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { usePermissions } from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option } = Select;

const CONDITIONS = ['bon', 'mauvais', 'détérioré', 'perdu', 'détruit'];

const NIVEAU_LABEL = {
  central: 'Central BVDP', division: 'Division', bataillon: 'Bataillon',
  centre_formation: 'Centre Formation', regional: 'Coord. Régionale',
  provincial: 'Coord. Provinciale', communal: 'Coord. Communale',
  localite: 'Localité', local: 'Local',
};

const ensureDataUrl = (v) => {
  if (!v) return null;
  if (typeof v === 'string') {
    if (v.startsWith('data:')) return v;
    const t = v.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(t)) return `data:image/jpeg;base64,${t}`;
  }
  return null;
};

const normalizeArr = (v) =>
  Array.isArray(v) ? v : Array.isArray(v?.rows) ? v.rows : [];

export default function ReintegrationPage() {
  const navigate = useNavigate();
  const { myMagasinId } = usePermissions();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1 — VDP
  const [vdpQuery, setVdpQuery] = useState('');
  const [vdpResults, setVdpResults] = useState([]);
  const [vdpSearching, setVdpSearching] = useState(false);
  const [selectedVdp, setSelectedVdp] = useState(null);

  // Step 2 — Armes dotées
  const [dotations, setDotations] = useState([]);
  const [dotLoading, setDotLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // { dotation_item_id, arme_id, numero_serie, dotation_id, ... }

  // Step 3 — Magasin destination + confirmation
  const [form] = Form.useForm();
  const [magasins, setMagasins] = useState([]);

  // ── Chargement ────────────────────────────────────────────────────────────

  useEffect(() => {
    api.getMagasins?.()
      .then((r) => setMagasins(normalizeArr(r)))
      .catch(() => {});
  }, []);

  // Pré-sélectionner le magasin de destination si l'utilisateur est gestionnaire
  useEffect(() => {
    if (myMagasinId) {
      form.setFieldValue('magasin_id', myMagasinId);
    }
  }, [myMagasinId, form]);

  const searchVdp = useCallback(async (q) => {
    const query = (q ?? vdpQuery).trim();
    if (!query) { setVdpResults([]); return; }
    setVdpSearching(true);
    try {
      setVdpResults(normalizeArr(await api.searchVdp(query)));
    } catch { setVdpResults([]); } finally {
      setVdpSearching(false);
    }
  }, [vdpQuery]);

  const loadDotationsVdp = useCallback(async (vdpId) => {
    setDotLoading(true);
    try {
      const rows = normalizeArr(await api.getDotationsByVdp(vdpId));
      // Garder seulement les dotations actives (armes encore en dotation)
      const active = rows.filter((d) => !['returned', 'cloturee', 'annulee'].includes(d.statut));
      // Charger le détail de chacune pour avoir les items
      const details = await Promise.all(
        active.map((d) =>
          api.getDotationDetail(d.id).catch(() => null)
        )
      );
      // Aplatir en liste d'items arme
      const items = [];
      details.forEach((detail, idx) => {
        if (!detail) return;
        const dot = detail?.dotation || detail;
        const dotItems = Array.isArray(detail?.items) ? detail.items : [];
        dotItems
          .filter((it) => it.resource_type === 'arme' && it.status !== 'retourné')
          .forEach((it) => {
            items.push({
              key: `${dot.id}-${it.id}`,
              dotation_id:      dot.id,
              dotation_code:    dot.code,
              dotation_date:    dot.date_dotation,
              dotation_item_id: it.id,
              resource_type:    it.resource_type || 'arme',
              resource_id:      it.resource_id || it.arme_id,
              numero_serie:     it.arme_numero_serie || it.numero_serie || `#${it.resource_id}`,
              designation:      it.arme_designation  || it.designation  || '—',
              etat:             it.arme_etat         || it.etat         || '—',
            });
          });
      });
      setDotations(items);
    } catch (err) {
      message.error('Erreur chargement dotations : ' + err?.message);
    } finally {
      setDotLoading(false);
    }
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const nextStep = async () => {
    if (step === 0 && !selectedVdp) {
      message.warning('Sélectionnez un VDP.'); return;
    }
    if (step === 1 && !selectedItem) {
      message.warning('Sélectionnez une arme à réintégrer.'); return;
    }
    if (step === 1) {
      // Aller à l'étape 3 en pré-remplissant les infos
      setStep(2); return;
    }
    setStep((p) => p + 1);
  };

  const prevStep = () => {
    setStep((p) => Math.max(0, p - 1));
    if (step === 2) setSelectedItem(null);
    if (step === 1) { setSelectedVdp(null); setDotations([]); }
  };

  const handleSelectVdp = (vdp) => {
    setSelectedVdp(vdp);
    setSelectedItem(null);
    setDotations([]);
    loadDotationsVdp(vdp.id);
    setStep(1);
  };

  // ── Soumission ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const vals = form.getFieldsValue();
    if (!vals.magasin_id) {
      message.warning('Sélectionnez un magasin de destination.'); return;
    }
    setLoading(true);
    try {
      await api.reintegrationMagasin(vals.magasin_id, {
        resource_type:    selectedItem.resource_type,
        resource_id:      selectedItem.resource_id,
        dotation_item_id: selectedItem.dotation_item_id,
        condition_retour: vals.condition_retour || null,
        observation:      vals.observation || null,
      });
      message.success('Réintégration enregistrée avec succès.');
      // Reset
      setStep(0);
      setSelectedVdp(null);
      setSelectedItem(null);
      setDotations([]);
      form.resetFields();
    } catch (err) {
      message.error(err?.response?.data?.error || err?.message || 'Erreur lors de la réintégration.');
    } finally {
      setLoading(false);
    }
  };

  // ── Rendu étapes ───────────────────────────────────────────────────────────

  const step0 = (
    <Card title="Étape 1 — Identification du VDP">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert showIcon type="info"
          message="Tapez le nom, CNIB ou contact du VDP puis appuyez sur Entrée." />

        <Input.Search
          value={vdpQuery}
          onChange={(e) => setVdpQuery(e.target.value)}
          onSearch={(v) => { setVdpQuery(v); searchVdp(v); }}
          onClear={() => { setVdpQuery(''); setVdpResults([]); }}
          allowClear
          placeholder="Nom, CNIB, contact…"
          enterButton={<SearchOutlined />}
          loading={vdpSearching}
        />

        <Table
          size="small"
          rowKey="id"
          dataSource={vdpResults}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: 'Lancez une recherche pour afficher les VDP' }}
          columns={[
            {
              title: 'Photo', dataIndex: 'photo', width: 56,
              render: (v) => {
                const src = ensureDataUrl(v);
                return src
                  ? <img src={src} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                  : <UserOutlined style={{ fontSize: 22, color: '#999' }} />;
              },
            },
            { title: 'Nom', dataIndex: 'nom' },
            { title: 'Prénom', dataIndex: 'prenom' },
            { title: 'CNIB', dataIndex: 'numero_cnib', render: (v) => v || '—' },
            { title: 'Contact', dataIndex: 'contacts', render: (v) => v || '—' },
            { title: 'Entité', dataIndex: 'entite_nom', render: (v) => v || '—' },
            {
              title: '', key: 'action', width: 90,
              render: (_, r) => (
                <Button type="primary" size="small" onClick={() => handleSelectVdp(r)}>
                  Choisir
                </Button>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );

  const step1 = (
    <Card title={
      <Space>
        Étape 2 — Armes dotées à réintégrer
        {selectedVdp && (
          <Tag color="blue">
            {selectedVdp.nom} {selectedVdp.prenom}
          </Tag>
        )}
      </Space>
    }>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {dotations.length === 0 && !dotLoading && (
          <Alert showIcon type="warning"
            message="Aucune arme active en dotation pour ce VDP." />
        )}
        <Table
          size="small"
          rowKey="key"
          loading={dotLoading}
          dataSource={dotations}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Aucune dotation active' }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedItem ? [selectedItem.key] : [],
            onChange: (_, rows) => setSelectedItem(rows[0] || null),
          }}
          columns={[
            {
              title: 'Dotation', dataIndex: 'dotation_code',
              render: (v, r) => (
                <Space direction="vertical" size={0}>
                  <Text code>{v || `#${r.dotation_id}`}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {r.dotation_date ? new Date(r.dotation_date).toLocaleDateString('fr-FR') : '—'}
                  </Text>
                </Space>
              ),
            },
            { title: 'N° Série', dataIndex: 'numero_serie' },
            { title: 'Désignation', dataIndex: 'designation', render: (v) => v || '—' },
            {
              title: 'État', dataIndex: 'etat', width: 100,
              render: (v) => <Tag color={v === 'disponible' || v === 'bon' ? 'green' : 'default'}>{v || '—'}</Tag>,
            },
            {
              title: '', key: 'select', width: 90,
              render: (_, r) => (
                <Button
                  size="small"
                  type={selectedItem?.key === r.key ? 'primary' : 'default'}
                  onClick={() => setSelectedItem(r)}
                >
                  {selectedItem?.key === r.key ? 'Sélectionnée' : 'Choisir'}
                </Button>
              ),
            },
          ]}
        />
        {selectedItem && (
          <Alert type="success" showIcon
            message={`Arme sélectionnée : ${selectedItem.numero_serie} — ${selectedItem.designation}`}
          />
        )}
      </Space>
    </Card>
  );

  const step2 = (
    <Card title="Étape 3 — Magasin de destination et confirmation">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Récapitulatif */}
        <Descriptions bordered size="small" column={2} title="Récapitulatif">
          <Descriptions.Item label="VDP">
            {selectedVdp ? `${selectedVdp.nom} ${selectedVdp.prenom || ''}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="CNIB">
            {selectedVdp?.numero_cnib || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Arme à réintégrer">
            {selectedItem?.numero_serie || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Désignation">
            {selectedItem?.designation || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Dotation">
            <Text code>{selectedItem?.dotation_code || `#${selectedItem?.dotation_id}`}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="État actuel">
            {selectedItem?.etat || '—'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        {/* Formulaire */}
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="magasin_id" label="Magasin de destination"
                rules={[{ required: true, message: 'Sélectionnez un magasin' }]}>
                <Select showSearch allowClear placeholder="Choisir un magasin"
                  optionFilterProp="children">
                  {magasins.map((m) => (
                    <Option key={m.id} value={m.id}>
                      {m.nom}
                      {m.niveau ? ` — ${NIVEAU_LABEL[m.niveau] || m.niveau}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="condition_retour" label="Condition de retour">
                <Select allowClear placeholder="État de l'arme au retour">
                  {CONDITIONS.map((c) => (
                    <Option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="observation" label="Observation">
            <Input.TextArea rows={2} placeholder="Motif du retour, remarques…" />
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );

  const steps = [
    { title: 'VDP' },
    { title: 'Arme' },
    { title: 'Confirmation' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/dashboard/dotation-arme')} />
        <RollbackOutlined style={{ fontSize: 20, color: '#1890ff' }} />
        <Title level={3} style={{ margin: 0 }}>Réintégration arme — VDP → Magasin</Title>
      </Space>

      <Steps current={step} items={steps} style={{ marginBottom: 24 }} />

      <div style={{ minHeight: 300 }}>
        {step === 0 && step0}
        {step === 1 && step1}
        {step === 2 && step2}
      </div>

      <Row justify="space-between" style={{ marginTop: 24 }}>
        <Col>
          {step > 0 && (
            <Button onClick={prevStep} disabled={loading}>Précédent</Button>
          )}
        </Col>
        <Col>
          {step < 2 && (
            <Button type="primary" onClick={nextStep}>Suivant</Button>
          )}
          {step === 2 && (
            <Button type="primary" icon={<CheckCircleOutlined />}
              onClick={handleSubmit} loading={loading}>
              Confirmer la réintégration
            </Button>
          )}
        </Col>
      </Row>
    </div>
  );
}
