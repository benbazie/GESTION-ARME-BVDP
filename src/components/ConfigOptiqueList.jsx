// src/components/ConfigOptiqueList.js
import React, { useState, useEffect } from "react";
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Table, Spin, Button, Space, Modal, message } from "antd";
import api from "../api";

const { confirm } = Modal;
const isElectron = () => typeof window !== "undefined" && !!window.electronAPI;

async function callPossible(variants, ...args) {
  for (const name of variants) {
    try {
      if (isElectron() && window.electronAPI && typeof window.electronAPI[name] === "function") {
        return await window.electronAPI[name](...args);
      }
      if (api && typeof api[name] === "function") {
        return await api[name](...args);
      }
    } catch (err) {
      console.warn(`[callPossible] ${name} failed:`, err && (err.message || err));
    }
  }
  throw new Error("Aucune méthode API disponible: " + variants.join(", "));
}

const ConfigOptiqueList = () => {
  const [loading, setLoading] = useState(false);
  const [optiques, setOptiques] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { loadOptiques(); }, []);

  const loadOptiques = async () => {
    setLoading(true);
    try {
      const variants = [
        "getConfigOptiqueList",
        "getConfigOptiquesList",
        "getConfig_OptiqueList",
        "getConfig_optiqueList"
      ];
      const data = await callPossible(variants);
      setOptiques(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement optiques:", error);
      message.error("Erreur lors du chargement des configurations d'optiques");
      setOptiques([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    if (id == null) return message.error("ID invalide pour la suppression");
    confirm({
      title: "Confirmer la suppression",
      icon: <ExclamationCircleOutlined />,
      content: "Voulez-vous vraiment supprimer cette configuration d'optique ?",
      okText: "Supprimer",
      okType: "danger",
      cancelText: "Annuler",
      onOk: async () => {
        setLoading(true);
        try {
          const variants = [
            "deleteConfigOptique",
            "deleteConfigOptiques",
            "delete_config_optique",
            "deleteConfig_optique"
          ];
          await callPossible(variants, id);
          message.success("Configuration d'optique supprimée");
          await loadOptiques();
        } catch (err) {
          console.error("Erreur suppression:", err);
          message.error("Erreur lors de la suppression de la configuration d'optique");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const columns = [
    { title: "Type", dataIndex: "type", key: "type" },
    { title: "Catégorie", dataIndex: "categorie", key: "categorie" },
    { title: "Désignation", dataIndex: "designation", key: "designation" },
    { title: "Observation", dataIndex: "observation", key: "observation" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/config-optique/form/${record.id}`)}
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
          onClick={() => navigate("/dashboard/config-optique/form")}
        >
          Ajouter Configuration d'Optique
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table
          bordered
          dataSource={optiques}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Spin>
    </div>
  );
};

export default ConfigOptiqueList;
