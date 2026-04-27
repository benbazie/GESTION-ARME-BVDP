import React, { useState, useEffect } from "react";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Table, Spin, Button, Space, message } from "antd";
import api from "../api";

const ConfigMaterielList = () => {
  const [loading, setLoading] = useState(false);
  const [materiels, setMateriels] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadMateriels();
  }, []);

  const isElectron = () => typeof window !== "undefined" && !!window.electronAPI;

  const loadMateriels = async () => {
    try {
      setLoading(true);
      console.log("Appel de getConfigMateriel...");
      let data;
      if (isElectron() && window.electronAPI.getConfigMaterielList) {
        data = await window.electronAPI.getConfigMaterielList();
      } else {
        data = await api.getConfigMaterielList();
      }
      console.log("Données reçues:", data);
      if (!data) {
        console.error("Pas de données reçues");
        setMateriels([]);
        return;
      }
      setMateriels(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur complète:", error);
      message.error("Erreur lors du chargement des configurations de matériel");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      if (isElectron() && window.electronAPI.deleteConfigMateriel) {
        await window.electronAPI.deleteConfigMateriel(id);
      } else {
        await api.deleteConfigMateriel(id);
      }
      message.success("Configuration de matériel supprimée");
      loadMateriels();
    } catch (error) {
      console.error("Erreur lors de la suppression :", error);
      message.error("Erreur lors de la suppression de la configuration de matériel");
    }
  };

  const columns = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
    },
    {
      title: "Catégorie",
      dataIndex: "categorie",
      key: "categorie",
    },
    {
      title: "Désignation",
      dataIndex: "designation",
      key: "designation",
    },
    {
      title: "Observation",
      dataIndex: "observation",
      key: "observation",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/config-materiel/form/${record.id}`)}
          >
            Modifier
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/dashboard/config-materiel/form")}
        >
          Ajouter Configuration de Matériel
        </Button>
      </div>
      <Spin spinning={loading}>
        <Table
          bordered
          dataSource={materiels}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Spin>
    </div>
  );
};

export default ConfigMaterielList;
