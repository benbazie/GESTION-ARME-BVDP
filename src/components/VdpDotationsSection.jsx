import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const { Text } = Typography;

const ITEM_STATUS_COLOR = {
  assigné:  'orange',
  retourné: 'green',
  perdu:    'red',
  détruit:  'magenta',
};

const columns = (navigate) => [
  {
    title: 'Arme / Ressource',
    key: 'resource',
    render: (_, r) => (
      <Space direction="vertical" size={0}>
        <Text strong>{r.numero_serie || `#${r.resource_id}`}</Text>
        {r.arme_designation && (
          <Text type="secondary" style={{ fontSize: 11 }}>{r.arme_designation}</Text>
        )}
      </Space>
    ),
  },
  {
    title: 'Dotation',
    key: 'dotation',
    width: 160,
    render: (_, r) => (
      <Space direction="vertical" size={0}>
        <Text code style={{ fontSize: 11 }}>{r.dotation_code || `#${r.dotation_id}`}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {r.date_dotation ? new Date(r.date_dotation).toLocaleDateString('fr-FR') : '—'}
        </Text>
      </Space>
    ),
  },
  {
    title: 'Statut',
    dataIndex: 'item_status',
    width: 100,
    render: (v) => <Tag color={ITEM_STATUS_COLOR[v] || 'default'}>{v || '—'}</Tag>,
  },
  {
    title: 'Condition retour',
    dataIndex: 'condition_retour',
    width: 130,
    render: (v) => v
      ? <Tag color={v === 'bon' ? 'green' : v === 'perdu' || v === 'détruit' ? 'red' : 'orange'}>{v}</Tag>
      : <Text type="secondary">—</Text>,
  },
  {
    title: 'Retour le',
    dataIndex: 'returned_at',
    width: 110,
    render: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '—',
  },
  {
    title: 'Localisation actuelle',
    key: 'loc',
    width: 140,
    render: (_, r) => r.arme_magasin_nom
      ? <Text style={{ fontSize: 11 }}>{r.arme_magasin_nom}</Text>
      : <Text type="secondary">—</Text>,
  },
  {
    title: '',
    key: 'fiche',
    width: 80,
    render: (_, r) => r.resource_type === 'arme' ? (
      <Button
        size="small"
        icon={<EyeOutlined />}
        onClick={() => navigate(`/dashboard/arme/fiche/${r.resource_id}`)}
      >
        Fiche
      </Button>
    ) : null,
  },
];

export default function VdpDotationsSection({ vdpId }) {
  const navigate = useNavigate();
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  const load = useCallback(async () => {
    if (!vdpId) return;
    setLoading(true);
    try {
      const data = await api.getVdpDotationsHistory(vdpId);
      setItems(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch (err) {
      message.error('Erreur chargement dotations : ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [vdpId]);

  useEffect(() => { load(); }, [load]);

  const activeItems  = useMemo(() => items.filter((i) => i.item_status === 'assigné'),  [items]);
  const closedItems  = useMemo(() => items.filter((i) => i.item_status !== 'assigné'),  [items]);

  const cols = useMemo(() => columns(navigate), [navigate]);

  if (!loaded && loading) {
    return <Spin style={{ display: 'block', textAlign: 'center', padding: 32 }} />;
  }

  return (
    <Card
      title={
        <Space>
          <HistoryOutlined />
          Dotations ({items.length} item{items.length !== 1 ? 's' : ''})
        </Space>
      }
      size="small"
      extra={
        <Button size="small" onClick={load} loading={loading}>
          Actualiser
        </Button>
      }
    >
      {items.length === 0 ? (
        <Text type="secondary">Aucune dotation enregistrée pour ce VDP.</Text>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {activeItems.length > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <Tag color="orange">En cours</Tag>
                <Text strong>
                  {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} actuellement dotés
                </Text>
              </div>
              <Table
                rowKey="item_id"
                size="small"
                columns={cols}
                dataSource={activeItems}
                pagination={false}
              />
            </div>
          )}
          {closedItems.length > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <Tag color="default">Historique</Tag>
                <Text strong>
                  {closedItems.length} item{closedItems.length !== 1 ? 's' : ''} retournés / perdus / détruits
                </Text>
              </div>
              <Table
                rowKey="item_id"
                size="small"
                columns={cols}
                dataSource={closedItems}
                pagination={{ pageSize: 10, showSizeChanger: false }}
              />
            </div>
          )}
        </Space>
      )}
    </Card>
  );
}
