// src/components/DotationArmeForm.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Drawer,
  Form, Input, Row, Select, Space, Steps, Table, Tag, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, BankOutlined, CheckCircleOutlined,
  FileAddOutlined, SearchOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import VdpForm from './VdpForm';
import { usePermissions } from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option } = Select;

const NIVEAU_LABEL = {
  central: 'Central BVDP', division: 'Division', bataillon: 'Bataillon',
  centre_formation: 'Centre Formation', regional: 'Coord. Régionale',
  provincial: 'Coord. Provinciale', communal: 'Coord. Communale',
  localite: 'Localité', local: 'Local',
};

const ensureDataUrl = (input) => {
  if (!input) return null;
  if (typeof input === 'string') {
    if (input.startsWith('data:')) return input;
    const t = input.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(t)) return `data:image/jpeg;base64,${t}`;
    return null;
  }
  return null;
};

const normalizeArr = (v) =>
  Array.isArray(v) ? v : Array.isArray(v?.rows) ? v.rows : [];

export default function DotationArmeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { myMagasinId } = usePermissions();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [form1] = Form.useForm();
  const [magasins, setMagasins] = useState([]);
  const [magasinStock, setMagasinStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  // ── Step 2 state (bénéficiaire) ───────────────────────────────────────────
  const [benefType, setBenefType] = useState('vdp');    // 'vdp' | 'entite'
  const [benefQuery, setBenefQuery] = useState('');
  const [benefResults, setBenefResults] = useState([]);
  const [benefSearching, setBenefSearching] = useState(false);
  const [selectedBenef, setSelectedBenef] = useState(null);
  const [showVdpDrawer, setShowVdpDrawer] = useState(false);

  // ── Step 3 state (armes) ──────────────────────────────────────────────────
  const [armeQuery, setArmeQuery] = useState('');
  const [allArmes, setAllArmes] = useState([]);
  const [armeResults, setArmeResults] = useState([]);
  const [armeLoading, setArmeLoading] = useState(false);
  const [selectedArmes, setSelectedArmes] = useState([]);
  // ID du magasin sélectionné en tant qu'état explicite (évite form1.getFieldValue non-réactif)
  const [selectedMagasinId, setSelectedMagasinId] = useState(null);

  // ── Load helpers ──────────────────────────────────────────────────────────

  const loadMagasins = useCallback(async () => {
    try {
      const rows = normalizeArr(await api.getMagasins());
      setMagasins(rows);
    } catch { /* silencieux */ }
  }, []);

  const loadMagasinStock = useCallback(async (magasinId, armesBase) => {
    if (!magasinId) { setMagasinStock([]); return; }
    setStockLoading(true);
    try {
      const rows = normalizeArr(await api.getStockMagasin(magasinId, { resource_type: 'arme' }));
      setMagasinStock(rows);
    } catch (err) {
      message.error('Erreur chargement stock magasin : ' + err?.message);
      setMagasinStock([]);
    } finally {
      setStockLoading(false);
    }
  }, []);

  const loadArmes = useCallback(async () => {
    setArmeLoading(true);
    try {
      const rows = normalizeArr(await api.getArmesList());
      const clean = rows.filter((r) => !r.deleted_at && r.statut !== 'dotée');
      setAllArmes(clean);
    } catch (err) {
      message.error('Impossible de charger les armes : ' + (err?.message || 'erreur serveur'));
    } finally {
      setArmeLoading(false);
    }
  }, []);

  const searchBenef = useCallback(async (q) => {
    const query = (q ?? benefQuery).trim();
    if (!query) { setBenefResults([]); return; }
    setBenefSearching(true);
    try {
      const rows = normalizeArr(
        benefType === 'vdp'
          ? await api.searchVdp(query)
          : await api.searchEntites(query)
      );
      setBenefResults(rows.map((r) => ({ ...r, _scope: benefType })));
    } catch { setBenefResults([]); } finally {
      setBenefSearching(false);
    }
  }, [benefType, benefQuery]);

  // ── Init & edit load ──────────────────────────────────────────────────────

  useEffect(() => {
    loadMagasins();
    loadArmes();
  }, [loadMagasins, loadArmes]);

  // Pré-sélectionner le magasin du gestionnaire — APRÈS que allArmes est chargé
  useEffect(() => {
    if (!isEdit && myMagasinId && allArmes.length > 0) {
      form1.setFieldValue('magasin_source_id', myMagasinId);
      setSelectedMagasinId(myMagasinId);
      loadMagasinStock(myMagasinId);
    }
  }, [isEdit, myMagasinId, allArmes.length, form1, loadMagasinStock]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const detail = await api.getDotationDetail(id);
        const dot = detail?.dotation || detail;
        const items = detail?.items || [];
        form1.setFieldsValue({
          dotation_type: dot.dotation_type || 'individuelle',
          date_dotation: dot.date_dotation ? dayjs(dot.date_dotation) : dayjs(),
          magasin_source_id: dot.magasin_source_id || undefined,
          observation: dot.observation || '',
        });
        setBenefType(dot.beneficiary_type || 'vdp');
        if (dot.beneficiary_type === 'vdp') {
          setSelectedBenef({
            id: dot.vdp_id, nom: dot.vdp_nom, prenom: dot.vdp_prenom,
            numero_cnib: dot.vdp_cnib, _scope: 'vdp',
          });
        } else {
          setSelectedBenef({
            id: dot.entite_id || dot.coordination_id || dot.sous_entite_id,
            nom: dot.entite_nom || dot.coordination_nom || dot.sous_entite_nom,
            code: dot.entite_code, _scope: 'entite',
          });
        }
        setSelectedArmes(items.map((it) => ({
          key: `arme-${it.arme_id || it.resource_id}`,
          id: it.arme_id || it.resource_id,
          numero_serie: it.arme_numero_serie || it.numero_serie || null,
          designation: it.arme_designation || it.designation || null,
          etat: it.arme_etat || null,
          quantite: it.quantite || 1,
          dotation_item_id: it.id,
        })));
      } catch (err) {
        message.error('Erreur chargement dotation : ' + err?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, form1]);

  // ── Arme search filter ────────────────────────────────────────────────────

  const dotType = Form.useWatch('dotation_type', form1) || 'individuelle';

  useEffect(() => {
    const needle = armeQuery.trim().toLowerCase();
    // Base : filtre par stock magasin si un magasin est sélectionné
    let base = selectedMagasinId
      ? allArmes.filter((a) => magasinStock.some((s) => String(s.resource_id) === String(a.id)))
      : allArmes;
    // Filtre usage_type / dotation_type
    base = base.filter((a) => {
      const ut = a.usage_type;
      if (!ut || ut === 'les_deux') return true;
      if (dotType === 'individuelle') return ut !== 'collectif';
      if (dotType === 'collective')   return ut !== 'individuel';
      return true;
    });
    if (!needle) { setArmeResults(base); return; }
    setArmeResults(base.filter((a) =>
      [a.numero_serie, a.designation, a.type, a.categorie, a.etat, a.modele, a.marque]
        .some((v) => (v || '').toLowerCase().includes(needle))
    ));
  }, [armeQuery, allArmes, magasinStock, selectedMagasinId, dotType]);

  // ── Step navigation ───────────────────────────────────────────────────────

  const nextStep = async () => {
    if (step === 0) {
      try { await form1.validateFields(['dotation_type', 'date_dotation']); }
      catch { message.warning('Renseignez le type et la date.'); return; }
    }
    if (step === 1 && !selectedBenef) {
      message.warning('Sélectionnez un bénéficiaire.'); return;
    }
    if (step === 2 && !selectedArmes.length) {
      message.warning('Sélectionnez au moins une arme.'); return;
    }
    setStep((p) => p + 1);
  };

  const prevStep = () => setStep((p) => Math.max(0, p - 1));

  const addArme = (record) => {
    const key = `arme-${record.id}`;
    const dotType = form1.getFieldValue('dotation_type') || 'individuelle';
    const ut = record.usage_type;
    if (dotType === 'individuelle' && ut === 'collectif') {
      message.error(`Cette arme (${record.numero_serie || record.designation}) est configurée pour usage collectif uniquement — elle ne peut pas être dotée à un individu.`);
      return;
    }
    if (dotType === 'collective' && ut === 'individuel') {
      message.error(`Cette arme (${record.numero_serie || record.designation}) est configurée pour usage individuel uniquement — elle ne peut pas être dotée à une entité.`);
      return;
    }
    if (dotType === 'individuelle' && selectedArmes.length >= 1) {
      message.warning('Dotation individuelle : une seule arme autorisée.'); return;
    }
    if (selectedArmes.some((a) => a.key === key)) {
      message.info('Arme déjà sélectionnée.'); return;
    }
    setSelectedArmes((prev) => [...prev, { ...record, key, quantite: 1 }]);
  };

  const removeArme = (key) => setSelectedArmes((prev) => prev.filter((a) => a.key !== key));

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const vals = form1.getFieldsValue();
    const dotType = vals.dotation_type || 'individuelle';

    if (!selectedBenef) { message.warning('Aucun bénéficiaire sélectionné.'); return; }
    if (!selectedArmes.length) { message.warning('Aucune arme sélectionnée.'); return; }

    const scope = selectedBenef._scope || 'vdp';
    const benId = Number(selectedBenef.id);

    const payload = {
      dotation_type:     dotType,
      beneficiary_type:  scope === 'vdp' ? 'vdp' : 'entite',
      vdp_id:            scope === 'vdp' ? benId : null,
      entite_id:         scope === 'entite' ? benId : null,
      coordination_id:   scope === 'coordination' ? benId : null,
      sous_entite_id:    scope === 'sous_entite' ? benId : null,
      date_dotation:     (vals.date_dotation || dayjs()).format('YYYY-MM-DD'),
      magasin_source_id: vals.magasin_source_id || null,
      observation:       vals.observation || null,
      items: selectedArmes.map((a) => ({
        id:            a.dotation_item_id,
        resource_type: 'arme',
        resource_id:   a.id,
        arme_id:       a.id,
        quantite:      a.quantite || 1,
      })),
    };

    setLoading(true);
    try {
      if (isEdit) {
        await api.updateDotation(id, payload);
        message.success('Dotation mise à jour.');
      } else {
        await api.createDotation(payload);
        message.success('Dotation enregistrée.');
      }
      navigate('/dashboard/dotation-arme');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message;
      if (err?.response?.status === 409) {
        message.error('Conflit : ' + (msg || 'ressource déjà dotée.'));
      } else {
        message.error('Erreur : ' + (msg || 'Vérifiez le serveur.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Render steps ───────────────────────────────────────────────────────────

  const step1 = (
    <Card title="Étape 1 – Paramétrage">
      <Form form={form1} layout="vertical"
        initialValues={{ dotation_type: 'individuelle', date_dotation: dayjs() }}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="dotation_type" label="Type de dotation"
              rules={[{ required: true }]}>
              <Select onChange={(v) => {
                setBenefType(v === 'individuelle' ? 'vdp' : 'entite');
                setSelectedBenef(null);
                if (v === 'individuelle' && selectedArmes.length > 1) {
                  setSelectedArmes((prev) => prev.slice(0, 1));
                  message.info('Réduit à 1 arme pour dotation individuelle.');
                }
              }}>
                <Option value="individuelle">Individuelle (VDP)</Option>
                <Option value="collective">Collective (Entité)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="date_dotation" label="Date de dotation"
              rules={[{ required: true, message: 'Date obligatoire' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="magasin_source_id" label={
          <Space><BankOutlined /> Magasin source (armurerie)</Space>
        } extra="Le stock du magasin sera mis à jour automatiquement.">
          <Select
            showSearch allowClear
            placeholder="Sélectionner un magasin (optionnel)"
            optionFilterProp="children"
            loading={!magasins.length}
            onChange={(v) => {
              const mid = v ?? null;
              setSelectedMagasinId(mid);
              loadMagasinStock(mid);
            }}
          >
            {magasins.map((m) => (
              <Option key={m.id} value={m.id}>
                {m.nom}
                {m.niveau ? ` — ${NIVEAU_LABEL[m.niveau] || m.niveau}` : ''}
                {m.nb_items_stock != null ? ` (${m.nb_items_stock} art.)` : ''}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="observation" label="Observation">
          <Input.TextArea rows={2} placeholder="Remarques…" />
        </Form.Item>
      </Form>
    </Card>
  );

  const step2 = (
    <Card title="Étape 2 – Bénéficiaire">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert showIcon type="info"
          message={benefType === 'vdp'
            ? 'Tapez un nom, CNIB ou contact, puis appuyez sur Entrée.'
            : "Tapez le nom de l'entité ou coordination, puis appuyez sur Entrée."}
        />

        <Input.Search
          value={benefQuery}
          onChange={(e) => setBenefQuery(e.target.value)}
          onSearch={(v) => { setBenefQuery(v); searchBenef(v); }}
          onClear={() => { setBenefQuery(''); setBenefResults([]); }}
          allowClear
          placeholder={benefType === 'vdp' ? 'Nom / CNIB / contact…' : 'Nom entité ou coordination…'}
          enterButton={<SearchOutlined />}
          loading={benefSearching}
        />

        {selectedBenef && (
          <Alert type="success" showIcon
            message={
              benefType === 'vdp'
                ? `${selectedBenef.nom || ''} ${selectedBenef.prenom || ''}`.trim()
                : selectedBenef.nom || 'Bénéficiaire sélectionné'
            }
            description={
              benefType === 'vdp'
                ? `CNIB : ${selectedBenef.numero_cnib || '—'} | Contact : ${selectedBenef.contacts || '—'}`
                : `Code : ${selectedBenef.code || '—'}`
            }
          />
        )}

        <Table
          size="small" rowKey={(r) => r.id || r.key}
          dataSource={benefResults}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          columns={benefType === 'vdp' ? [
            {
              title: 'Photo', dataIndex: 'photo', width: 56,
              render: (v) => {
                const src = ensureDataUrl(v);
                return src
                  ? <img src={src} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                  : <UserOutlined style={{ fontSize: 24 }} />;
              },
            },
            { title: 'Nom', dataIndex: 'nom' },
            { title: 'Prénom', dataIndex: 'prenom' },
            { title: 'CNIB', dataIndex: 'numero_cnib', render: (v) => v || '—' },
            { title: 'Contact', dataIndex: 'contacts', render: (v) => v || '—' },
            { title: 'Entité', dataIndex: 'entite_nom', render: (v) => v || '—' },
            {
              title: '', key: 'action', width: 80,
              render: (_, r) => (
                <Button size="small" type="primary" onClick={() => setSelectedBenef({ ...r, _scope: 'vdp' })}>
                  Choisir
                </Button>
              ),
            },
          ] : [
            { title: 'Nom', dataIndex: 'nom' },
            { title: 'Code', dataIndex: 'code', render: (v) => v || '—' },
            { title: 'Type', dataIndex: 'type', render: (v) => v || '—' },
            {
              title: '', key: 'action', width: 80,
              render: (_, r) => (
                <Button size="small" type="primary"
                  onClick={() => setSelectedBenef({ ...r, _scope: r.scope || 'entite' })}>
                  Choisir
                </Button>
              ),
            },
          ]}
        />

        {benefType === 'vdp' && (
          <Button icon={<FileAddOutlined />} onClick={() => setShowVdpDrawer(true)}>
            Créer un nouveau VDP
          </Button>
        )}
      </Space>
    </Card>
  );

  const step3 = (
    <Card title="Étape 3 – Sélection des armes">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {selectedMagasinId && (
          <Alert showIcon type="info"
            message={`Affichage du stock du magasin sélectionné (${magasinStock.length} arme(s) disponible(s))`}
          />
        )}

        <Input.Search
          value={armeQuery}
          onChange={(e) => setArmeQuery(e.target.value)}
          onSearch={(v) => setArmeQuery(v)}
          allowClear
          placeholder="N° série, désignation, type…"
          enterButton={<SearchOutlined />}
        />

        <Table
          size="small"
          rowKey={(r) => r.id || r.resource_id}
          loading={armeLoading || stockLoading}
          dataSource={armeResults}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'N° Série', dataIndex: 'numero_serie', render: (v) => v || '—' },
            { title: 'Désignation', dataIndex: 'designation', render: (v) => v || '—' },
            { title: 'Type', dataIndex: 'type', render: (v) => v || '—' },
            {
              title: 'Usage', dataIndex: 'usage_type', width: 110,
              render: (v) => {
                if (!v || v === 'les_deux') return <Tag color="blue">Libre</Tag>;
                if (v === 'collectif') return <Tag color="purple">Collectif</Tag>;
                return <Tag color="green">Individuel</Tag>;
              },
            },
            {
              title: 'État', dataIndex: 'etat', width: 100,
              render: (v) => <Tag color={v === 'disponible' ? 'green' : 'default'}>{v || '—'}</Tag>,
            },
            {
              title: '', key: 'add', width: 90,
              render: (_, r) => (
                <Button size="small" type="primary" onClick={() => addArme(r)}>
                  Ajouter
                </Button>
              ),
            },
          ]}
        />

        {selectedArmes.length > 0 && (
          <>
            <Divider orientation="left">Armes sélectionnées ({selectedArmes.length})</Divider>
            <Table
              size="small" rowKey="key" pagination={false}
              dataSource={selectedArmes}
              columns={[
                { title: 'N° Série', dataIndex: 'numero_serie', render: (v) => v || '—' },
                { title: 'Désignation', dataIndex: 'designation', render: (v) => v || '—' },
                { title: 'État', dataIndex: 'etat', render: (v) => v || '—' },
                {
                  title: '', key: 'remove', width: 80,
                  render: (_, r) => (
                    <Button size="small" danger onClick={() => removeArme(r.key)}>Retirer</Button>
                  ),
                },
              ]}
            />
          </>
        )}
      </Space>
    </Card>
  );

  const step4 = () => {
    const vals = form1.getFieldsValue();
    const mag = magasins.find((m) => m.id === vals.magasin_source_id);
    return (
      <Card title="Étape 4 – Validation">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert showIcon type="success" message="Vérifiez les informations avant de valider." />

          <Descriptions bordered size="small" column={2} title="Dotation">
            <Descriptions.Item label="Type">
              <Tag color={vals.dotation_type === 'individuelle' ? 'green' : 'purple'}>
                {vals.dotation_type === 'individuelle' ? 'Individuelle' : 'Collective'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Date">
              {vals.date_dotation ? vals.date_dotation.format('DD/MM/YYYY') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Magasin source" span={2}>
              {mag ? `${mag.nom} — ${NIVEAU_LABEL[mag.niveau] || mag.niveau || ''}` : 'Non renseigné'}
            </Descriptions.Item>
            <Descriptions.Item label="Observation" span={2}>
              {vals.observation || '—'}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions bordered size="small" column={2} title="Bénéficiaire">
            {benefType === 'vdp' ? (
              <>
                <Descriptions.Item label="Nom">{selectedBenef?.nom || '—'}</Descriptions.Item>
                <Descriptions.Item label="Prénom">{selectedBenef?.prenom || '—'}</Descriptions.Item>
                <Descriptions.Item label="CNIB">{selectedBenef?.numero_cnib || '—'}</Descriptions.Item>
                <Descriptions.Item label="Contact">{selectedBenef?.contacts || '—'}</Descriptions.Item>
              </>
            ) : (
              <>
                <Descriptions.Item label="Structure">{selectedBenef?.nom || '—'}</Descriptions.Item>
                <Descriptions.Item label="Code">{selectedBenef?.code || '—'}</Descriptions.Item>
              </>
            )}
          </Descriptions>

          <Card size="small" title={`Armes sélectionnées (${selectedArmes.length})`}>
            <Table
              size="small" rowKey="key" pagination={false}
              dataSource={selectedArmes}
              columns={[
                { title: 'N° Série', dataIndex: 'numero_serie', render: (v) => v || '—' },
                { title: 'Désignation', dataIndex: 'designation', render: (v) => v || '—' },
                { title: 'État', dataIndex: 'etat', render: (v) => v || '—' },
              ]}
            />
          </Card>
        </Space>
      </Card>
    );
  };

  const steps = [
    { title: 'Paramétrage' },
    { title: 'Bénéficiaire' },
    { title: 'Ressources' },
    { title: 'Validation' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/dashboard/dotation-arme')} />
        <Title level={3} style={{ margin: 0 }}>
          {isEdit ? 'Modifier la dotation' : 'Nouvelle dotation d\'arme'}
        </Title>
      </Space>

      <Steps current={step} items={steps} style={{ marginBottom: 24 }} />

      <div style={{ minHeight: 320 }}>
        {step === 0 && step1}
        {step === 1 && step2}
        {step === 2 && step3}
        {step === 3 && step4()}
      </div>

      <Row justify="space-between" style={{ marginTop: 24 }}>
        <Col>
          {step > 0 && (
            <Button onClick={prevStep}>Précédent</Button>
          )}
        </Col>
        <Col>
          {step < 3 && (
            <Button type="primary" onClick={nextStep} loading={loading}>
              Suivant
            </Button>
          )}
          {step === 3 && (
            <Button type="primary" icon={<CheckCircleOutlined />}
              onClick={handleSubmit} loading={loading}>
              {isEdit ? 'Enregistrer les modifications' : 'Valider la dotation'}
            </Button>
          )}
        </Col>
      </Row>

      {/* Drawer ajout VDP */}
      <Drawer
        title="Nouveau VDP"
        placement="right"
        width={800}
        open={showVdpDrawer}
        onClose={() => setShowVdpDrawer(false)}
        destroyOnClose
      >
        <VdpForm
          onSuccess={(newVdp) => {
            const vdp = { ...newVdp, _scope: 'vdp' };
            setBenefResults((prev) => [vdp, ...prev]);
            setSelectedBenef(vdp);
            setShowVdpDrawer(false);
            message.success('VDP créé et sélectionné.');
          }}
        />
      </Drawer>
    </div>
  );
}
