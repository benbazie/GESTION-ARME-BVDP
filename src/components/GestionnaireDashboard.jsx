// src/components/GestionnaireDashboard.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Col, Row, Space, Spin, Statistic, Table, Tag, Typography, message,
} from 'antd';
import {
  BankOutlined, FileAddOutlined, RollbackOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const RESOURCE_LABEL = {
  arme: 'Armes', optique: 'Optiques',
  materiel_specifique: 'Matériel', munition: 'Munitions',
};

const RESOURCE_COLOR = {
  arme: '#1890ff', optique: '#52c41a',
  materiel_specifique: '#fa8c16', munition: '#722ed1',
};

const MVT_COLOR = {
  entree_manuelle: 'cyan', entree_lot: 'green',
  sortie_dotation: 'orange', retour_vdp: 'blue',
  transfert_sortant: 'volcano', transfert_entrant: 'lime',
  perte: 'red', destruction: 'magenta',
};
const MVT_LABEL = {
  entree_manuelle: 'Entrée manuelle', entree_lot: 'Entrée (lot)',
  sortie_dotation: 'Sortie dotation', retour_vdp: 'Retour VDP',
  transfert_sortant: 'Transfert sortant', transfert_entrant: 'Transfert entrant',
  perte: 'Perte', destruction: 'Destruction',
};

export default function GestionnaireDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { myMagasinId } = usePermissions();

  const [magasin,    setMagasin]    = useState(null);
  const [summary,    setSummary]    = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [loading,    setLoading]    = useState(false);

  const loadData = useCallback(async () => {
    if (!myMagasinId) return;
    setLoading(true);
    try {
      const [inv, mvts] = await Promise.all([
        api.getInventaireMagasin(myMagasinId),
        api.getMouvementsMagasin(myMagasinId, { limit: 10 }),
      ]);
      setMagasin(inv.magasin || null);
      setSummary(inv.summary  || []);
      setMouvements(Array.isArray(mvts) ? mvts : []);
    } catch (err) {
      message.error('Erreur de chargement : ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [myMagasinId]);

  useEffect(() => { loadData(); }, [loadData]);

  const mvtColumns = [
    {
      title: 'Date', dataIndex: 'date_mouvement', width: 130,
      render: (v) => v
        ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
        : '—',
    },
    {
      title: 'Type', dataIndex: 'type', width: 170,
      render: (v) => (
        <Tag color={MVT_COLOR[v] || 'default'} style={{ fontSize: 11 }}>
          {MVT_LABEL[v] || v}
        </Tag>
      ),
    },
    {
      title: 'Ressource', key: 'ressource',
      render: (_, r) =>
        `${RESOURCE_LABEL[r.resource_type] || r.resource_type} #${r.resource_id}`,
    },
    { title: 'Qté', dataIndex: 'quantite', width: 55, align: 'center' },
    {
      title: 'Observation', dataIndex: 'observation',
      render: (v) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—',
    },
  ];

  if (loading && !magasin) {
    return <Spin style={{ display: 'block', textAlign: 'center', padding: 64 }} />;
  }

  if (!myMagasinId) {
    return (
      <div style={{ padding: 32 }}>
        <Text type="secondary">Aucun magasin associé à votre compte.</Text>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={{ padding: 24 }}>
      {/* En-tête */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space align="start">
            <BankOutlined style={{ fontSize: 28, color: '#1890ff', marginTop: 4 }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {magasin?.nom || 'Mon magasin'}
              </Title>
              <Text type="secondary">
                {user?.username && `${user.username} — `}{today}
              </Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Actualiser
            </Button>
            <Button type="primary" icon={<FileAddOutlined />}
              onClick={() => navigate('/dashboard/dotation-arme/add')}>
              Nouvelle dotation
            </Button>
            <Button icon={<RollbackOutlined />}
              onClick={() => navigate('/dashboard/reintegration')}>
              Réintégration
            </Button>
            <Button icon={<BankOutlined />}
              onClick={() => navigate(`/dashboard/magasin/${myMagasinId}`)}>
              Détail & stock
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Statistiques stock */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {summary.length === 0 ? (
          <Col xs={24}>
            <Card size="small">
              <Text type="secondary">Aucun article en stock pour le moment.</Text>
            </Card>
          </Col>
        ) : (
          summary.map((s) => (
            <Col key={s.resource_type} xs={12} sm={6}>
              <Card
                size="small"
                style={{
                  borderRadius: 10,
                  borderLeft: `4px solid ${RESOURCE_COLOR[s.resource_type] || '#1890ff'}`,
                }}
              >
                <Statistic
                  title={RESOURCE_LABEL[s.resource_type] || s.resource_type}
                  value={Number(s.quantite_totale)}
                  valueStyle={{
                    color: RESOURCE_COLOR[s.resource_type] || '#1890ff',
                    fontSize: 28,
                  }}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {s.nb_lignes} ligne(s)
                    </Text>
                  }
                />
              </Card>
            </Col>
          ))
        )}
      </Row>

      {/* Derniers mouvements */}
      <Card
        title="Derniers mouvements"
        size="small"
        loading={loading}
        extra={
          <Button
            size="small"
            type="link"
            onClick={() => navigate(`/dashboard/magasin/${myMagasinId}`)}
          >
            Voir tout →
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={mouvements}
          columns={mvtColumns}
          pagination={false}
          locale={{ emptyText: 'Aucun mouvement récent.' }}
        />
      </Card>
    </div>
  );
}
