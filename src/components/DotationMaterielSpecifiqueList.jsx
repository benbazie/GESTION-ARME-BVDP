// src/components/DotationMaterielSpecifiqueList.jsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  DatePicker,
  Space,
  Card,
  message,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import './DotationMaterielSpecifiqueList.css';

export default function DotationMaterielSpecifiqueList() {
  const [dotations, setDotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterForm] = Form.useForm();
  const navigate = useNavigate();

  // 1. Charger toutes les dotations puis filtrer le type "materiel_specifique"
  const loadDotations = async () => {
    setLoading(true);
    try {
      const data = await window.api.call('getDotations', {});
      const filtered = (Array.isArray(data) ? data : []).filter(
        item => item.ressource_type === 'materiel_specifique'
      );
      setDotations(filtered);
    } catch {
      message.error(
        "Erreur lors du chargement des dotations de matériel spécifique."
      );
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
    if (values.code_dotation) {
      filtered = filtered.filter(item =>
        item.code_dotation
          ?.toLowerCase()
          .includes(values.code_dotation.toLowerCase())
      );
    }
    if (values.date_dotation) {
      const sd = moment(values.date_dotation).format('YYYY-MM-DD');
      filtered = filtered.filter(
        item => moment(item.date_dotation).format('YYYY-MM-DD') === sd
      );
    }
    setDotations(filtered);
  };

  const onReset = () => {
    filterForm.resetFields();
    loadDotations();
  };

  // 3. Suppression
  const deleteDotation = async id => {
    try {
      await window.api.call('deleteDotation', { id });
      message.success("Dotation supprimée avec succès.");
      loadDotations();
    } catch {
      message.error("Erreur lors de la suppression de la dotation.");
    }
  };

  // 4. Colonnes
  const columns = [
    {
      title: "Code Dotation",
      dataIndex: "code_dotation",
      key: "code_dotation",
      sorter: (a, b) => a.code_dotation.localeCompare(b.code_dotation),
      render: text => <strong>{text}</strong>
    },
    {
      title: "Référence VDP",
      key: "vdp_reference",
      render: (_, record) =>
        record.vdp_id && record.vdp ? (
          <div className="vdp-reference">
            <strong>
              {record.vdp.nom} {record.vdp.prenom}
            </strong>
            <div className="vdp-details">
              {record.vdp.entite && `Entité : ${record.vdp.entite}`}
              <br />
              {record.vdp.region && `Région : ${record.vdp.region}`}{" "}
              {record.vdp.province && `Province : ${record.vdp.province}`}{" "}
              {record.vdp.commune && `Commune : ${record.vdp.commune}`}
            </div>
          </div>
        ) : (
          "-"
        )
    },
    {
      title: "Référence Entité",
      key: "entite_reference",
      render: (_, record) =>
        record.entite_id && record.entite ? (
          <div className="entite-reference">
            <strong>{record.entite.nom}</strong>
            <div className="entite-details">
              {record.entite.region && `Région : ${record.entite.region}`}{" "}
              {record.entite.province && `Province : ${record.entite.province}`}{" "}
              {record.entite.commune && `Commune : ${record.entite.commune}`}
            </div>
          </div>
        ) : (
          "-"
        )
    },
    {
      title: "ID Matériel",
      dataIndex: "ressource_id",
      key: "ressource_id",
      sorter: (a, b) => a.ressource_id - b.ressource_id
    },
    {
      title: "Date Dotation",
      dataIndex: "date_dotation",
      key: "date_dotation",
      render: date => moment(date).format("LL"),
      sorter: (a, b) => moment(a.date_dotation) - moment(b.date_dotation)
    },
    {
      title: "Statut",
      dataIndex: "statut",
      key: "statut",
      sorter: (a, b) => a.statut.localeCompare(b.statut),
      render: text => (
        <span
          className={text === "active" ? "status-active" : "status-inactive"}
        >
          {text}
        </span>
      )
    },
    {
      title: "Observation",
      dataIndex: "observation",
      key: "observation",
      ellipsis: true
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          <Button
            icon={<EditOutlined />}
            onClick={() =>
              navigate(`/dotations/materielspecifique/form/${record.id}`)
            }
          >
            Modifier
          </Button>
          <Popconfirm
            title="Confirmer la suppression ?"
            onConfirm={() => deleteDotation(record.id)}
            okText="Oui"
            cancelText="Non"
          >
            <Button icon={<DeleteOutlined />} danger>
              Supprimer
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="dotation-materiel-specifique-list">
      <Card
        title="Filtrer les dotations de matériel spécifique"
        className="filter-card"
      >
        <Form form={filterForm} layout="inline" onFinish={onSearch}>
          <Form.Item name="code_dotation">
            <Input placeholder="Rechercher par code" />
          </Form.Item>
          <Form.Item name="date_dotation">
            <DatePicker placeholder="Date de dotation" />
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
              <Button onClick={onReset} icon={<ReloadOutlined />}>
                Réinitialiser
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/dashboard/dotation-materiel/add")}
              >
                Ajouter une dotation
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="Liste des dotations de matériel spécifique"
        className="list-card"
      >
        <Table
          columns={columns}
          dataSource={dotations}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 5, showSizeChanger: true }}
          bordered
        />
      </Card>
    </div>
  );
}
 