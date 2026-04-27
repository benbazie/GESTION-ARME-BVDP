import React, { useState, useEffect } from "react";
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Table, Spin, Button, Space, message, Modal } from "antd";
import api from "../api";

const { confirm } = Modal;

const ConfigMunitionList = () => {
  const [loading, setLoading] = useState(false);
  const [munitions, setMunitions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadMunitions();
  }, []);

  const isElectron = () => typeof window !== "undefined" && !!window.electronAPI;

  // Try multiple API method name variants to be tolerant
  const callPossible = async (possibilities, ...args) => {
    for (const fn of possibilities) {
      try {
        // electronAPI
        if (isElectron() && window.electronAPI && typeof window.electronAPI[fn] === "function") {
          return await window.electronAPI[fn](...args);
        }
        // frontend api object
        if (api && typeof api[fn] === "function") {
          return await api[fn](...args);
        }
      } catch (err) {
        // try next variant
        console.warn(`[callPossible] ${fn} failed:`, err.message || err);
      }
    }
    throw new Error("Aucune méthode API disponible pour " + possibilities.join(', '));
  };

  const loadMunitions = async () => {
    setLoading(true);
    try {
      const variants = [
        "getConfigMunitionList",
        "getConfigMunitionsList",
        "getConfigMunitionList", // duplicate safe
        "getConfig_munitionList",
        "getConfig_munitionsList",
        "getConfig_ressource_arme" // unlikely but safe
      ];
      const data = await callPossible(variants);
      setMunitions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement configurations:", error);
      message.error("Erreur lors du chargement des configurations de munitions");
      setMunitions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    if (id == null) {
      message.error("ID invalide pour la suppression");
      return;
    }
    confirm({
      title: "Confirmer la suppression",
      icon: <ExclamationCircleOutlined />,
      content: "Voulez-vous vraiment supprimer cette configuration de munition ?",
      okText: "Supprimer",
      okType: "danger",
      cancelText: "Annuler",
      onOk: async () => {
        setLoading(true);
        try {
          const variants = [
            "deleteConfigMunition",
            "deleteConfigMunitions",
            "deleteConfig_munition",
            "deleteConfig_munitions"
          ];
          await callPossible(variants, id);
          message.success("Configuration de munition supprimée");
          await loadMunitions();
        } catch (error) {
          console.error("Erreur suppression :", error);
          message.error("Erreur lors de la suppression de la configuration de munition");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const columns = [
    { title: "Type", dataIndex: "type", key: "type" },
    { title: "Calibre", dataIndex: "calibre", key: "calibre" },
    { title: "Désignation", dataIndex: "designation", key: "designation" },
    { title: "Observation", dataIndex: "observation", key: "observation" },
    { title: "Seuil Critique", dataIndex: "seuil_critique", key: "seuil_critique" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/config-munition/form/${record.id}`)}
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
      )
    }
  ];

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/dashboard/config-munition/form")}
        >
          Ajouter Configuration de Munition
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table
          bordered
          dataSource={munitions}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Spin>
    </div>
  );
};

export default ConfigMunitionList;
