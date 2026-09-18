// src/components/AfficheArme.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Row, Space,
  Spin, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, BankOutlined, HistoryOutlined, UserOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';

const { Title, Text } = Typography;

const STATUT_COLOR = {
  disponible:       'default',
  en_stock:         'blue',
  dotee:            'orange',
  dotee_collectif:  'gold',
  perdue:           'red',
  detruite:         'magenta',
  maintenance:      'purple',
};

const ITEM_STATUS_COLOR = {
  assigné:  'orange',
  retourné: 'green',
  perdu:    'red',
  détruit:  'magenta',
};

const MVT_COLOR = {
  entree_manuelle:   'cyan',  entree_lot:       'green',
  sortie_dotation:   'orange', retour_vdp:       'blue',
  transfert_sortant: 'volcano', transfert_entrant: 'lime',
  perte:             'red',   destruction:       'magenta',
};
const MVT_LABEL = {
  entree_manuelle:   'Entrée manuelle', entree_lot:       'Entrée lot',
  sortie_dotation:   'Sortie dotation', retour_vdp:       'Retour VDP',
  transfert_sortant: 'Transfert sortant', transfert_entrant: 'Transfert entrant',
  perte:             'Perte',           destruction:       'Destruction',
};

export default function AfficheArme() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [fiche,   setFiche]   = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getArmeFiche(id);
      setFiche(data);
    } catch (err) {
      message.error('Erreur de chargement : ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <Spin style={{ display: 'block', textAlign: 'center', padding: 64 }} />;
  }

  if (!fiche?.arme) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="Arme introuvable." showIcon />
        <Button icon={<ArrowLeftOutlined />} style={{ marginTop: 12 }}
          onClick={() => navigate('/dashboard/armes')}>Retour</Button>
      </div>
    );
  }

  const { arme, dotations, mouvements } = fiche;

  // ── Colonnes historique dotations ──────────────────────────────────────────
  const dotColumns = [
    {
      title: 'Dotation', key: 'dotation', width: 160,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: 12 }}>{r.dotation_code || `#${r.dotation_id}`}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.date_dotation ? new Date(r.date_dotation).toLocaleDateString('fr-FR') : '—'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Bénéficiaire', key: 'benef',
      render: (_, r) => r.vdp_nom
        ? <Space><UserOutlined />{r.vdp_nom} {r.vdp_prenom || ''}{r.vdp_cnib ? ` (${r.vdp_cnib})` : ''}</Space>
        : r.entite_nom || '—',
    },
    {
      title: 'Type', dataIndex: 'dotation_type', width: 110,
      render: (v) => <Tag>{v || '—'}</Tag>,
    },
    {
      title: 'Statut item', dataIndex: 'item_status', width: 110,
      render: (v) => <Tag color={ITEM_STATUS_COLOR[v] || 'default'}>{v || '—'}</Tag>,
    },
    {
      title: 'Condition retour', dataIndex: 'condition_retour', width: 130,
      render: (v, r) => v
        ? <Tag color={v === 'bon' ? 'green' : v === 'perdu' || v === 'détruit' ? 'red' : 'orange'}>{v}</Tag>
        : (r.item_status === 'retourné' ? <Tag color="green">—</Tag> : <Text type="secondary">En cours</Text>),
    },
    {
      title: 'Retour le', dataIndex: 'returned_at', width: 120,
      render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '—',
    },
  ];

  // ── Colonnes mouvements magasin ────────────────────────────────────────────
  const mvtColumns = [
    {
      title: 'Date', dataIndex: 'date_mouvement', width: 140,
      render: (v) => v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—',
    },
    {
      title: 'Type', dataIndex: 'type', width: 160,
      render: (v) => <Tag color={MVT_COLOR[v] || 'default'} style={{ fontSize: 11 }}>{MVT_LABEL[v] || v}</Tag>,
    },
    {
      title: 'Magasin', dataIndex: 'magasin_nom',
      render: (v) => v ? <Space><BankOutlined />{v}</Space> : '—',
    },
    { title: 'Observation', dataIndex: 'observation', render: (v) => v || '—' },
  ];

  // Localisation actuelle
  const locTag = arme.statut === 'en_stock' && arme.magasin_nom
    ? <Space><BankOutlined /><Text strong>{arme.magasin_nom}</Text><Tag color="blue">En stock</Tag></Space>
    : arme.statut === 'dotee' || arme.statut === 'dotee_collectif'
      ? <Tag color="orange">En dotation (VDP / entité)</Tag>
      : <Tag color={STATUT_COLOR[arme.statut] || 'default'}>{arme.statut || '—'}</Tag>;

  return (
    <div style={{ padding: 24 }}>
      {/* En-tête */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
            <Title level={3} style={{ margin: 0 }}>
              Fiche arme — {arme.numero_serie || `#${arme.id}`}
            </Title>
            <Tag color={STATUT_COLOR[arme.statut] || 'default'}>
              {arme.statut || 'inconnu'}
            </Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Modifier l'arme">
              <Button onClick={() => navigate(`/dashboard/armes/edit/${id}`)}>Modifier</Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* Identité de l'arme */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="N° Série">
                <Text strong>{arme.numero_serie || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Désignation">
                {arme.config_designation || arme.designation || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                {arme.config_type || arme.type || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Catégorie">
                {arme.config_categorie || arme.categorie || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Calibre">
                {arme.config_calibre || arme.calibre || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Marque">
                {arme.config_marque || '—'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} md={12}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="État">
                {arme.etat ? <Tag>{arme.etat}</Tag> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Statut">
                <Tag color={STATUT_COLOR[arme.statut] || 'default'}>{arme.statut || '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Localisation actuelle">
                {locTag}
              </Descriptions.Item>
              <Descriptions.Item label="Lot">
                {arme.lot_designation
                  ? <Text code>{arme.lot_designation}{arme.lot_code ? ` (${arme.lot_code})` : ''}</Text>
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Date entrée">
                {arme.date_entree ? new Date(arme.date_entree).toLocaleDateString('fr-FR') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Observation">
                {arme.observation || '—'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Historique des dotations */}
      <Card
        title={<Space><HistoryOutlined />Historique des dotations ({dotations.length})</Space>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        {dotations.length === 0
          ? <Text type="secondary">Aucune dotation enregistrée pour cette arme.</Text>
          : (
            <Table
              rowKey="dotation_item_id"
              size="small"
              columns={dotColumns}
              dataSource={dotations}
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          )}
      </Card>

      {/* Mouvements en magasin */}
      <Card
        title={<Space><BankOutlined />Mouvements en magasin ({mouvements.length})</Space>}
        size="small"
      >
        {mouvements.length === 0
          ? <Text type="secondary">Aucun mouvement de magasin enregistré.</Text>
          : (
            <Table
              rowKey="id"
              size="small"
              columns={mvtColumns}
              dataSource={mouvements}
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          )}
      </Card>
    </div>
  );
}
