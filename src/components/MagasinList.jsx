// src/components/MagasinList.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Col, Input, Row, Space, Statistic, Table, Tag, Tooltip, Typography, message, Popconfirm,
} from 'antd';
import {
  BankOutlined, DeleteOutlined, EditOutlined, EyeOutlined,
  PlusOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { usePermissions } from '../hooks/usePermissions';

const { Title, Text } = Typography;

const NIVEAU_COLOR = {
  central: 'red', division: 'volcano', bataillon: 'orange',
  centre_formation: 'gold', regional: 'blue', provincial: 'geekblue',
  communal: 'purple', localite: 'green', local: 'cyan',
};

const NIVEAU_LABEL = {
  central: 'Central BVDP', division: 'Division', bataillon: 'Bataillon',
  centre_formation: 'Centre Formation', regional: 'Coord. Régionale',
  provincial: 'Coord. Provinciale', communal: 'Coord. Communale',
  localite: 'Localité', local: 'Local',
};

const rattachement = (rec) =>
  rec.entite_nom || rec.coord_reg_nom || rec.coord_prov_nom ||
  rec.coord_com_nom || rec.localite_nom || '—';

export default function MagasinList() {
  const navigate = useNavigate();
  const { isAdmin, isGestionnaire, myMagasinId, canCreateMagasin } = usePermissions();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getMagasins();
      setData(Array.isArray(rows) ? rows : []);
    } catch (err) {
      message.error('Chargement impossible : ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Gestionnaire avec un seul magasin → aller directement au détail
  useEffect(() => {
    if (isGestionnaire && myMagasinId) {
      navigate(`/dashboard/magasin/${myMagasinId}`, { replace: true });
    }
  }, [isGestionnaire, myMagasinId, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    try {
      await api.deleteMagasin(id);
      message.success('Magasin supprimé.');
      load();
    } catch (err) {
      message.error(err?.response?.data?.error || err?.message || 'Erreur');
    }
  };

  const filtered = data.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [m.nom, m.code, m.entite_nom, m.localite_nom,
            m.coord_reg_nom, m.coord_prov_nom, m.coord_com_nom]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  const total      = data.length;
  const actifs     = data.filter((m) => m.actif).length;
  const totalStock = data.reduce((s, m) => s + Number(m.nb_items_stock || 0), 0);

  const columns = [
    {
      title: 'Code', dataIndex: 'code', width: 120,
      render: (v) => <Text code>{v || '—'}</Text>,
    },
    {
      title: 'Nom du magasin', dataIndex: 'nom',
      render: (v, rec) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          {rec.gestionnaire_nom && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Resp. : {rec.gestionnaire_nom} {rec.gestionnaire_prenom || ''}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Niveau', dataIndex: 'niveau', width: 160,
      render: (v) => <Tag color={NIVEAU_COLOR[v] || 'default'}>{NIVEAU_LABEL[v] || v || '—'}</Tag>,
    },
    {
      title: 'Rattachement', key: 'rattachement',
      render: (_, rec) => rattachement(rec),
    },
    {
      title: 'Stock', dataIndex: 'nb_items_stock', width: 100, align: 'center',
      render: (v) => <Tag color={Number(v) > 0 ? 'blue' : 'default'}>{v ?? 0} art.</Tag>,
    },
    {
      title: 'Statut', dataIndex: 'actif', width: 80,
      render: (v) => <Tag color={v ? 'success' : 'error'}>{v ? 'Actif' : 'Inactif'}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 130,
      render: (_, rec) => (
        <Space>
          <Tooltip title="Détail / Stock">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => navigate(`/dashboard/magasin/${rec.id}`)} />
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Modifier">
              <Button size="small" icon={<EditOutlined />}
                onClick={() => navigate(`/dashboard/magasin/edit/${rec.id}`)} />
            </Tooltip>
          )}
          {isAdmin && (
            <Popconfirm
              title="Supprimer ce magasin ?"
              description="Le magasin doit être vide (aucun stock)."
              onConfirm={() => handleDelete(rec.id)}
              okText="Oui" cancelText="Non"
            >
              <Tooltip title="Supprimer">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <BankOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0 }}>Magasins (Armureries)</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualiser</Button>
            {canCreateMagasin && (
              <Button type="primary" icon={<PlusOutlined />}
                onClick={() => navigate('/dashboard/magasin/add')}>
                Nouveau magasin
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Total magasins" value={total} prefix={<BankOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Actifs" value={actifs} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Articles en stock (total)" value={totalStock}
              valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>

      <Input prefix={<SearchOutlined />}
        placeholder="Rechercher par nom, code, entité, coordination…"
        value={search} onChange={(e) => setSearch(e.target.value)}
        allowClear style={{ marginBottom: 16, maxWidth: 480 }} />

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showTotal: (t) => `${t} magasin(s)` }}
        onRow={(rec) => ({
          onDoubleClick: () => navigate(`/dashboard/magasin/${rec.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
}
