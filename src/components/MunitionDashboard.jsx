import React, { useState, useEffect } from "react";
import { Card, Row, Col, Table, Alert, Badge, Button, Select, Statistic } from "antd";
import { WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import moment from "moment";

const { Option } = Select;

export default function MunitionDashboard() {
  const [alertes, setAlertes] = useState([]);
  const [munitionsParLocalite, setMunitionsParLocalite] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [selectedLocalite, setSelectedLocalite] = useState(null);
  const [statistiques, setStatistiques] = useState({});

  useEffect(() => {
    loadData();
  }, [selectedLocalite]);

  const loadData = async () => {
    try {
      // Charger les alertes actives
      const alertesData = await api.call('getAlertesMunitions', { statut: 'ACTIVE' });
      setAlertes(alertesData || []);

      // Charger les statistiques par localité
      const statsData = await api.call('getStatistiquesMunitionsParLocalite', { 
        localite_id: selectedLocalite 
      });
      setMunitionsParLocalite(statsData || []);

      // Charger les localités
      const localitesData = await api.call('getLocalitesList');
      setLocalites(localitesData || []);

      // Statistiques globales
      const globalStats = await api.call('getStatistiquesGlobalesMunitions');
      setStatistiques(globalStats || {});
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    }
  };

  const alerteColumns = [
    {
      title: 'Niveau',
      dataIndex: 'niveau',
      render: niveau => {
        const colors = {
          'INFO': 'blue',
          'WARNING': 'orange', 
          'CRITICAL': 'red'
        };
        return <Badge color={colors[niveau]} text={niveau} />;
      }
    },
    {
      title: 'Type',
      dataIndex: 'type_alerte'
    },
    {
      title: 'Message',
      dataIndex: 'message'
    },
    {
      title: 'Date',
      dataIndex: 'date_alerte',
      render: date => moment(date).format('DD/MM/YYYY HH:mm')
    }
  ];

  const munitionColumns = [
    {
      title: 'Munition',
      dataIndex: 'designation'
    },
    {
      title: 'Type',
      dataIndex: 'type'
    },
    {
      title: 'Stock',
      dataIndex: 'stock_disponible',
      align: 'right'
    },
    {
      title: 'Seuil',
      dataIndex: 'seuil_critique',
      align: 'right'
    },
    {
      title: 'État',
      render: (_, record) => {
        if (record.stock_disponible <= 0) {
          return <Badge status="error" text="Rupture" />;
        }
        if (record.stock_disponible <= record.seuil_critique) {
          return <Badge status="warning" text="Critique" />;
        }
        return <Badge status="success" text="Normal" />;
      }
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Munitions"
              value={statistiques.totalMunitions || 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Alertes Actives"
              value={alertes.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: alertes.length > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Stocks Critiques"
              value={statistiques.stocksCritiques || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Ruptures"
              value={statistiques.ruptures || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {alertes.length > 0 && (
        <Alert
          message="Alertes Actives"
          description={`${alertes.length} alerte(s) nécessite(nt) votre attention`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title="Alertes Munitions" 
            extra={
              <Button onClick={() => api.call('resolveAllAlertes')}>
                Marquer comme résolues
              </Button>
            }
          >
            <Table
              dataSource={alertes}
              columns={alerteColumns}
              size="small"
              pagination={{ pageSize: 5 }}
              rowKey="id"
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card 
            title="Stocks par Localité"
            extra={
              <Select
                placeholder="Filtrer par localité"
                style={{ width: 200 }}
                allowClear
                value={selectedLocalite}
                onChange={setSelectedLocalite}
              >
                {localites.map(loc => (
                  <Option key={loc.id} value={loc.id}>
                    {loc.nom}
                  </Option>
                ))}
              </Select>
            }
          >
            <Table
              dataSource={munitionsParLocalite}
              columns={munitionColumns}
              size="small"
              pagination={{ pageSize: 8 }}
              rowKey="id"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
