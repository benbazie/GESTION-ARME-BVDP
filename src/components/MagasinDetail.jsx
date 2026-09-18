// src/components/MagasinDetail.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Divider, Modal, Form, Input, Row,
  Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, BankOutlined, EditOutlined, FilePdfOutlined, InboxOutlined,
  MinusCircleOutlined, PlusCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { printListeMagasin } from '../utils/dotationPrint';
import TransfertMagasinModal from './TransfertMagasinModal';
import { usePermissions } from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option } = Select;

const NIVEAU_LABEL = {
  central: 'Central BVDP', division: 'Division', bataillon: 'Bataillon',
  centre_formation: 'Centre Formation', regional: 'Coord. Régionale',
  provincial: 'Coord. Provinciale', communal: 'Coord. Communale',
  localite: 'Localité', local: 'Local',
};

const MVT_COLOR = {
  entree_lot: 'green', entree_manuelle: 'cyan', sortie_dotation: 'orange',
  retour_vdp: 'blue', reversal_entite: 'purple', transfert_sortant: 'volcano',
  transfert_entrant: 'lime', perte: 'red', destruction: 'magenta',
};
const MVT_LABEL = {
  entree_lot: 'Entrée (lot)', entree_manuelle: 'Entrée manuelle',
  sortie_dotation: 'Sortie dotation', retour_vdp: 'Retour VDP',
  reversal_entite: 'Reversal entité', transfert_sortant: 'Transfert sortant',
  transfert_entrant: 'Transfert entrant', perte: 'Perte', destruction: 'Destruction',
};

const RESOURCE_TYPE_LABEL = {
  arme: 'Arme', optique: 'Optique', materiel_specifique: 'Matériel', munition: 'Munition',
};

export default function MagasinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  const [magasin,    setMagasin]    = useState(null);
  const [stock,      setStock]      = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [summary,    setSummary]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [activeTab,  setActiveTab]  = useState('stock');

  // Modal ajout stock
  const [addModal,    setAddModal]    = useState(false);
  const [addForm]     = Form.useForm();

  // Modal transfert
  const [transfertModal, setTransfertModal] = useState(false);
  const [addLoading,  setAddLoading]  = useState(false);

  // Listes pour modal
  const [armesList, setArmesList] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const inv = await api.getInventaireMagasin(id);
      setMagasin(inv.magasin || null);
      setStock(inv.stock || []);
      setSummary(inv.summary || []);
    } catch (err) {
      message.error('Erreur : ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMouvements = useCallback(async () => {
    try {
      const rows = await api.getMouvementsMagasin(id, { limit: 100 });
      setMouvements(Array.isArray(rows) ? rows : []);
    } catch { /* silencieux */ }
  }, [id]);

  useEffect(() => {
    loadData();
    loadMouvements();
  }, [loadData, loadMouvements]);

  useEffect(() => {
    if (addModal) {
      api.getArmesList?.({ statut: 'disponible' })
        .then((r) => setArmesList(Array.isArray(r) ? r : []))
        .catch(() => {});
    }
  }, [addModal]);

  const handleAddStock = async (values) => {
    setAddLoading(true);
    try {
      await api.addToStockMagasin(id, {
        resource_type: values.resource_type,
        resource_id:   values.resource_id,
        quantite:      values.quantite || 1,
        observation:   values.observation,
      });
      message.success('Ajouté au stock.');
      addForm.resetFields();
      setAddModal(false);
      loadData();
      loadMouvements();
    } catch (err) {
      message.error(err?.response?.data?.error || err?.message || 'Erreur');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveFromStock = async (item) => {
    try {
      await api.removeFromStockMagasin(id, {
        resource_type: item.resource_type,
        resource_id:   item.resource_id,
        quantite:      1,
        type:          'perte',
      });
      message.success('Retiré du stock.');
      loadData();
      loadMouvements();
    } catch (err) {
      message.error(err?.response?.data?.error || err?.message || 'Erreur');
    }
  };

  // ─── Colonnes stock ──────────────────────────────────────────────────────────
  const stockColumns = [
    {
      title: 'Type', dataIndex: 'resource_type', width: 120,
      render: (v) => <Tag>{RESOURCE_TYPE_LABEL[v] || v}</Tag>,
    },
    { title: 'N° Série', dataIndex: 'numero_serie', render: (v) => v || '—' },
    { title: 'Désignation', dataIndex: 'designation', render: (v) => v || '—' },
    { title: 'État', dataIndex: 'etat', width: 100, render: (v) => v || '—' },
    {
      title: 'Qté', dataIndex: 'quantite', width: 70, align: 'center',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 80, align: 'center',
      render: (_, rec) => (
        <Tooltip title="Retirer du stock (perte)">
          <Button size="small" danger icon={<MinusCircleOutlined />}
            onClick={() => handleRemoveFromStock(rec)} />
        </Tooltip>
      ),
    },
  ];

  // ─── Colonnes mouvements ─────────────────────────────────────────────────────
  const mvtColumns = [
    {
      title: 'Date', dataIndex: 'date_mouvement', width: 150,
      render: (v) => v ? new Date(v).toLocaleString('fr-FR') : '—',
    },
    {
      title: 'Type', dataIndex: 'type', width: 160,
      render: (v) => <Tag color={MVT_COLOR[v] || 'default'}>{MVT_LABEL[v] || v}</Tag>,
    },
    {
      title: 'Ressource', key: 'ressource', width: 120,
      render: (_, rec) => `${RESOURCE_TYPE_LABEL[rec.resource_type] || rec.resource_type} #${rec.resource_id}`,
    },
    {
      title: 'Qté', dataIndex: 'quantite', width: 60, align: 'center',
    },
    { title: 'Acteur', dataIndex: 'acteur_nom', render: (v) => v || '—' },
    {
      title: 'Dotation', dataIndex: 'dotation_code',
      render: (v) => v ? <Text code>{v}</Text> : '—',
    },
    { title: 'Observation', dataIndex: 'observation', render: (v) => v || '—' },
  ];

  if (!magasin && !loading) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="Magasin introuvable." showIcon />
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard/magasin')}
          style={{ marginTop: 12 }}>
          Retour
        </Button>
      </div>
    );
  }

  const rattachement =
    magasin?.entite_nom || magasin?.coord_reg_nom || magasin?.coord_prov_nom ||
    magasin?.coord_com_nom || magasin?.localite_nom || '—';

  const tabItems = [
    {
      key: 'stock',
      label: `Stock (${stock.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<PlusCircleOutlined />}
              onClick={() => setAddModal(true)}>
              Ajouter au stock
            </Button>
            <Button icon={<ReloadOutlined />}
              onClick={() => setTransfertModal(true)}
              disabled={stock.length === 0}>
              Transférer vers un autre magasin
            </Button>
          </Space>
          <Table rowKey={(r) => `${r.resource_type}-${r.resource_id}`}
            columns={stockColumns} dataSource={stock} size="small"
            pagination={{ pageSize: 20 }} loading={loading} />
        </>
      ),
    },
    {
      key: 'mouvements',
      label: `Mouvements (${mouvements.length})`,
      children: (
        <Table rowKey="id" columns={mvtColumns} dataSource={mouvements}
          size="small" pagination={{ pageSize: 20 }} />
      ),
    },
    {
      key: 'inventaire',
      label: 'Inventaire',
      children: (
        <Row gutter={16}>
          {summary.map((s) => (
            <Col key={s.resource_type} xs={24} sm={12} md={6} style={{ marginBottom: 16 }}>
              <Card size="small">
                <Statistic
                  title={RESOURCE_TYPE_LABEL[s.resource_type] || s.resource_type}
                  value={Number(s.quantite_totale)}
                  suffix={`(${s.nb_lignes} ligne(s))`}
                />
              </Card>
            </Col>
          ))}
          {summary.length === 0 && <Col><Text type="secondary">Stock vide.</Text></Col>}
        </Row>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* En-tête */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/dashboard/magasin')} />
            <BankOutlined style={{ fontSize: 22, color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0 }}>{magasin?.nom || '…'}</Title>
            {magasin?.actif === false && <Tag color="error">Inactif</Tag>}
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { loadData(); loadMouvements(); }}>
              Actualiser
            </Button>
            <Button icon={<FilePdfOutlined />}
              style={{ color: '#722ed1', borderColor: '#722ed1' }}
              onClick={() => printListeMagasin(magasin, stock)}>
              Imprimer inventaire
            </Button>
            {isAdmin && (
              <Button icon={<EditOutlined />}
                onClick={() => navigate(`/dashboard/magasin/edit/${id}`)}>
                Modifier
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Infos magasin */}
      <Card size="small" style={{ marginBottom: 16 }} loading={loading}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Code">
            <Text code>{magasin?.code || '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Niveau">
            {NIVEAU_LABEL[magasin?.niveau] || magasin?.niveau || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Rattachement">{rattachement}</Descriptions.Item>
          <Descriptions.Item label="Responsable">
            {magasin?.gestionnaire_nom
              ? `${magasin.gestionnaire_nom} ${magasin.gestionnaire_prenom || ''}`
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Observation" span={2}>
            {magasin?.observation || '—'}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />

        <Row gutter={16}>
          {summary.map((s) => (
            <Col key={s.resource_type} xs={12} sm={6}>
              <Statistic
                title={RESOURCE_TYPE_LABEL[s.resource_type] || s.resource_type}
                value={Number(s.quantite_totale)}
                valueStyle={{ fontSize: 20, color: '#1890ff' }}
              />
            </Col>
          ))}
        </Row>
      </Card>

      {/* Onglets */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* Modal ajout stock */}
      <Modal
        open={addModal}
        title="Ajouter un article au stock"
        onCancel={() => { setAddModal(false); addForm.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddStock}>
          <Form.Item name="resource_type" label="Type de ressource"
            rules={[{ required: true }]}>
            <Select placeholder="Sélectionner">
              <Option value="arme">Arme</Option>
              <Option value="optique">Optique</Option>
              <Option value="materiel_specifique">Matériel spécifique</Option>
              <Option value="munition">Munition (config)</Option>
            </Select>
          </Form.Item>
          <Form.Item name="resource_id" label="ID de la ressource"
            rules={[{ required: true, message: 'ID requis' }]}
            extra="Entrez l'identifiant numérique de la ressource">
            <Input type="number" placeholder="Ex : 42" />
          </Form.Item>
          <Form.Item name="quantite" label="Quantité" initialValue={1}>
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item name="observation" label="Observation">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={addLoading}
                icon={<InboxOutlined />}>
                Ajouter au stock
              </Button>
              <Button onClick={() => { setAddModal(false); addForm.resetFields(); }}>
                Annuler
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal transfert entre magasins */}
      <TransfertMagasinModal
        open={transfertModal}
        magasinSource={magasin}
        stock={stock}
        onClose={() => setTransfertModal(false)}
        onSuccess={() => { setTransfertModal(false); loadData(); loadMouvements(); }}
      />
    </div>
  );
}
