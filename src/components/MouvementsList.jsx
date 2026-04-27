// src/components/MouvementsList.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  message,
  Spin,
  Space,
  Form,
  Input,
  DatePicker
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { Link, useNavigate } from 'react-router-dom';
import './MouvementsList.css';

const { RangePicker } = DatePicker;

export default function MouvementsList() {
  const [mouvements, setMouvements] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Charger les mouvements via IPC
  const loadMouvements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.call('getMouvements', {});
      setMouvements(Array.isArray(data) ? data : []);
      setFiltered(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('getMouvements', err);
      message.error('Erreur lors du chargement des mouvements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMouvements();
  }, [loadMouvements]);

  // Filtrage
  const onSearch = values => {
    let list = [...mouvements];
    const { date_range, type, motif } = values;

    if (date_range && date_range.length === 2) {
      const [start, end] = date_range;
      list = list.filter(m => {
        const d = moment(m.date_mouvement);
        return d.isSameOrAfter(start, 'day') && d.isSameOrBefore(end, 'day');
      });
    }
    if (type) {
      list = list.filter(m =>
        m.type?.toLowerCase().includes(type.toLowerCase())
      );
    }
    if (motif) {
      list = list.filter(m =>
        m.motif?.toLowerCase().includes(motif.toLowerCase())
      );
    }
    setFiltered(list);
  };

  const onReset = () => {
    form.resetFields();
    setFiltered(mouvements);
  };

  // Suppression
  const handleDelete = id => {
    Modal.confirm({
      title: 'Confirmer la suppression',
      content: 'Êtes-vous sûr de vouloir supprimer ce mouvement ?',
      okText: 'Oui',
      cancelText: 'Non',
      onOk: async () => {
        try {
          await window.api.call('deleteMouvement', { id });
          message.success('Mouvement supprimé');
          loadMouvements();
        } catch (err) {
          console.error('deleteMouvement', err);
          message.error('Échec de la suppression.');
        }
      }
    });
  };

  // Colonnes
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id'
    },
    {
      title: 'Date de Mouvement',
      dataIndex: 'date_mouvement',
      key: 'date_mouvement',
      render: d => d ? moment(d).format('L') : 'N/C',
      sorter: (a, b) =>
        moment(a.date_mouvement) - moment(b.date_mouvement)
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      sorter: (a, b) =>
        (a.type || '').localeCompare(b.type || '')
    },
    {
      title: 'Motif',
      dataIndex: 'motif',
      key: 'motif'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/mouvements/edit/${r.id}`)}
          />
          <Button
            type="link"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(r.id)}
          />
          <Button
            type="link"
            icon={<ProfileOutlined />}
            onClick={() => navigate(`/mouvements/fiche/${r.id}`)}
          />
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1>Liste des Mouvements</h1>

      <Form
        form={form}
        layout="inline"
        onFinish={onSearch}
        style={{ marginBottom: 16 }}
      >
        <Form.Item name="date_range" label="Période">
          <RangePicker />
        </Form.Item>
        <Form.Item name="type">
          <Input placeholder="Type de Mouvement" />
        </Form.Item>
        <Form.Item name="motif">
          <Input placeholder="Motif" />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SearchOutlined />}
          >
            Rechercher
          </Button>
        </Form.Item>
        <Form.Item>
          <Button onClick={onReset}>
            Réinitialiser
          </Button>
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/mouvements/add')}
        >
          Ajouter un Mouvement
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadMouvements}
        >
          Actualiser
        </Button>
      </Space>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Spin>
    </div>
  );
}
