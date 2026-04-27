import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Select, DatePicker, Space, Typography, Descriptions, Modal, Button, Input } from 'antd';
import { EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    table: null,
    action: null,
    dateRange: null
  });
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const tables = [
    { value: 'armes', label: 'Armes' },
    { value: 'munitions', label: 'Munitions' },
    { value: 'optiques', label: 'Optiques' },
    { value: 'materiels_specifiques', label: 'Matériels Spécifiques' },
    { value: 'vdps', label: 'VDP' },
    { value: 'dotations', label: 'Dotations' }
  ];

  const actions = [
    { value: 'CREATE', label: 'Création', color: 'green' },
    { value: 'UPDATE', label: 'Modification', color: 'blue' },
    { value: 'DELETE', label: 'Suppression', color: 'red' },
    { value: 'RESTORE', label: 'Restauration', color: 'orange' }
  ];

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    if (!filters.table) return;

    setLoading(true);
    try {
      const params = {
        action: filters.action,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        limit: 100
      };

      const response = await api.get(`/audit/table/${filters.table}`, { params });
      setLogs(response.data);
    } catch (error) {
      console.error('Erreur chargement logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const showDetails = (record) => {
    setSelectedLog(record);
    setDetailsVisible(true);
  };

  const columns = [
    {
      title: 'Date/Heure',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm:ss'),
      width: 160
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action) => {
        const actionConfig = actions.find(a => a.value === action);
        return <Tag color={actionConfig?.color}>{actionConfig?.label}</Tag>;
      },
      width: 120
    },
    {
      title: 'Utilisateur',
      key: 'utilisateur',
      render: (_, record) => 
        `${record.utilisateur_nom_complet || record.utilisateur_nom || 'N/A'} ${record.utilisateur_prenom || ''}`,
      width: 200
    },
    {
      title: 'Enregistrement #',
      dataIndex: 'record_id',
      key: 'record_id',
      width: 120
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          icon={<EyeOutlined />} 
          size="small" 
          onClick={() => showDetails(record)}
        >
          Détails
        </Button>
      ),
      width: 100
    }
  ];

  const renderValueComparison = () => {
    if (!selectedLog) return null;

    const { old_values, new_values, action } = selectedLog;

    if (action === 'CREATE') {
      return (
        <Descriptions title="Valeurs créées" column={1} bordered>
          {Object.entries(new_values || {}).map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {JSON.stringify(value)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      );
    }

    if (action === 'DELETE') {
      return (
        <Descriptions title="Valeurs supprimées" column={1} bordered>
          {Object.entries(old_values || {}).map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {JSON.stringify(value)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      );
    }

    if (action === 'UPDATE') {
      const changedFields = Object.keys(new_values || {}).filter(
        key => JSON.stringify(old_values?.[key]) !== JSON.stringify(new_values?.[key])
      );

      return (
        <Descriptions title="Modifications" column={2} bordered>
          {changedFields.map(key => (
            <React.Fragment key={key}>
              <Descriptions.Item label={`${key} (avant)`} span={1}>
                <Tag color="red">{JSON.stringify(old_values?.[key])}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={`${key} (après)`} span={1}>
                <Tag color="green">{JSON.stringify(new_values?.[key])}</Tag>
              </Descriptions.Item>
            </React.Fragment>
          ))}
        </Descriptions>
      );
    }

    return null;
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2}>
          <HistoryOutlined /> Journal d'Audit
        </Title>

        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="Sélectionner une table"
            style={{ width: 200 }}
            options={tables}
            value={filters.table}
            onChange={(value) => setFilters({ ...filters, table: value })}
          />

          <Select
            placeholder="Type d'action"
            style={{ width: 150 }}
            allowClear
            options={actions}
            value={filters.action}
            onChange={(value) => setFilters({ ...filters, action: value })}
          />

          <RangePicker
            format="DD/MM/YYYY"
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={logs}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="Détails de l'Audit"
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        footer={null}
        width={800}
      >
        {selectedLog && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Date/Heure" span={2}>
                {dayjs(selectedLog.created_at).format('DD/MM/YYYY HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Utilisateur" span={2}>
                {selectedLog.utilisateur_nom}
              </Descriptions.Item>
              <Descriptions.Item label="IP">{selectedLog.ip_address}</Descriptions.Item>
              <Descriptions.Item label="User Agent">{selectedLog.user_agent}</Descriptions.Item>
            </Descriptions>

            {renderValueComparison()}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogs;
