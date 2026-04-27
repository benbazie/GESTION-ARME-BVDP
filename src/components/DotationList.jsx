// src/components/DotationList.js
import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  DatePicker,
  Space,
  message,
  Card,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';

export default function DotationList() {
  const [dotations, setDotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterForm] = Form.useForm();
  const navigate = useNavigate();

  // 1. Chargement des dotations via IPC
  const loadDotations = async () => {
    setLoading(true);
    try {
      const data = await window.api.call('getDotations', {});
      setDotations(Array.isArray(data) ? data : []);
    } catch {
      message.error('Erreur lors du chargement des dotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDotations();
  }, []);

  // 2. Filtrage local
  const onSearch = values => {
    let filtered = dotations;
    const { code_dotation, ressource_type, type_dotation, date_dotation } = values;

    if (code_dotation) {
      filtered = filtered.filter(d =>
        d.code_dotation
          ?.toLowerCase()
          .includes(code_dotation.toLowerCase())
      );
    }
    if (ressource_type) {
      filtered = filtered.filter(d => d.ressource_type === ressource_type);
    }
    if (type_dotation) {
      filtered = filtered.filter(d => d.type_dotation === type_dotation);
    }
    if (date_dotation) {
      const sd = moment(date_dotation).format('YYYY-MM-DD');
      filtered = filtered.filter(
        d => moment(d.date_dotation).format('YYYY-MM-DD') === sd
      );
    }

    setDotations(filtered);
  };

  const onReset = () => {
    filterForm.resetFields();
    loadDotations();
  };

  // 3. Suppression via IPC
  const deleteDotation = async id => {
    try {
      await window.api.call('deleteDotation', { id });
      message.success('Dotation supprimée');
      loadDotations();
    } catch {
      message.error('Erreur lors de la suppression de la dotation');
    }
  };

  // 4. Définition des colonnes
  const columns = [
    {
      title: 'Code Dotation',
      dataIndex: 'code_dotation',
      key: 'code_dotation',
      sorter: (a, b) => a.code_dotation.localeCompare(b.code_dotation),
    },
    {
      title: 'Ressource Type',
      dataIndex: 'ressource_type',
      key: 'ressource_type',
      sorter: (a, b) => a.ressource_type.localeCompare(b.ressource_type),
    },
    {
      title: 'Ressource ID',
      dataIndex: 'ressource_id',
      key: 'ressource_id',
      sorter: (a, b) => a.ressource_id - b.ressource_id,
    },
    {
      title: 'Dotation Type',
      dataIndex: 'type_dotation',
      key: 'type_dotation',
      sorter: (a, b) => a.type_dotation.localeCompare(b.type_dotation),
    },
    {
      title: 'Date Dotation',
      dataIndex: 'date_dotation',
      key: 'date_dotation',
      render: date => moment(date).format('LL'),
      sorter: (a, b) =>
        new Date(a.date_dotation) - new Date(b.date_dotation),
    },
    {
      title: 'Date Integration',
      dataIndex: 'date_integration',
      key: 'date_integration',
      render: date => (date ? moment(date).format('LL') : ''),
      sorter: (a, b) =>
        new Date(a.date_integration || 0) -
        new Date(b.date_integration || 0),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      key: 'statut',
      sorter: (a, b) => a.statut.localeCompare(b.statut),
    },
    {
      title: 'Observation',
      dataIndex: 'observation',
      key: 'observation',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/dotation/form/${record.id}`)}
          />
          <Popconfirm
            title="Confirmer la suppression ?"
            onConfirm={() => deleteDotation(record.id)}
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Card
        title="Filtrer Dotations"
        style={{ marginBottom: '20px' }}
      >
        <Form
          form={filterForm}
          layout="inline"
          onFinish={onSearch}
        >
          <Form.Item name="code_dotation">
            <Input placeholder="Code Dotation" />
          </Form.Item>
          <Form.Item name="ressource_type">
            <Input placeholder="Ressource Type" />
          </Form.Item>
          <Form.Item name="type_dotation">
            <Input placeholder="Type Dotation" />
          </Form.Item>
          <Form.Item name="date_dotation">
            <DatePicker placeholder="Date Dotation" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
              >
                Rechercher
              </Button>
              <Button onClick={onReset}>Réinitialiser</Button>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => navigate('/dotation/form')}
              >
                Ajouter Dotation
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadDotations}
              >
                Rafraîchir
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Liste des Dotations">
        <Table
          columns={columns}
          dataSource={dotations}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 5 }}
        />
      </Card>
    </div>
  );
}
