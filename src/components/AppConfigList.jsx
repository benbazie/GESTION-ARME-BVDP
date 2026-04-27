// src/components/AppConfigList.js
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Modal, Space, Table, message, Checkbox } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import "./AppConfigList.css";
import ExportHeaderFooterConfig from "./ExportHeaderFooterConfig";
import api from '../api'; // Ajoute cet import en haut si ce n'est pas déjà fait

function AppConfigList() {
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeKey, setActiveKey] = useState(null);

  // Utilitaire pour choisir la bonne API
  const getApi = () =>
    (window.electronAPI && typeof window.electronAPI.call === "function")
      ? window.electronAPI
      : (window.api && typeof window.api.call === "function")
      ? window.api
      : (api && typeof api.call === "function")
      ? api
      : null;

  // Chargement des configurations via IPC
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const api = getApi();
      if (!api) throw new Error("API non disponible (call)");
      const configs = await api.call("getAppConfigList", {});
      setData(Array.isArray(configs) ? configs : []);
      // Trouve la config active
      const active = configs.find(c => c.is_active);
      setActiveKey(active ? active.id : null);
    } catch (err) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Ajout/édition d'une configuration
  const handleEdit = (record = null) => {
    setEditingConfig(record ? { ...record, valeur: parseConfigValue(record.valeur) } : { valeur: {} });
    setModalVisible(true);
  };

  // Sauvegarde (ajout ou édition)
  const handleSave = async (cfg) => {
    setSaving(true);
    try {
      const api = getApi();
      if (!api) throw new Error("API non disponible (call)");
      if (editingConfig && editingConfig.id) {
        await api.call("updateAppConfig", {
          ...editingConfig,
          valeur: JSON.stringify(cfg),
        });
      } else {
        await api.call("createAppConfig", {
          nom_param: cfg.name || "header_footer",
          valeur: JSON.stringify(cfg),
          description: "Configuration entête/pied de page"
        });
      }
      setModalVisible(false);
      setEditingConfig(null);
      message.success("Configuration enregistrée !");
      fetchConfigs();
    } catch (err) {
      // Affiche le message d'erreur détaillé du backend si présent
      let msg = "Erreur lors de la sauvegarde de la configuration";
      if (err?.response?.data?.error) msg += " : " + err.response.data.error;
      else if (err?.message) msg += " : " + err.message;
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Suppression
  const handleDelete = (record) => {
    Modal.confirm({
      title: "Supprimer cette configuration ?",
      content: "Cette action est irréversible.",
      okText: "Supprimer",
      okType: "danger",
      cancelText: "Annuler",
      onOk: async () => {
        try {
          const api = getApi();
          if (!api) throw new Error("API non disponible (call)");
          await api.call("deleteAppConfig", record.id);
          message.success("Configuration supprimée");
          fetchConfigs();
        } catch (err) {
          message.error("Erreur lors de la suppression");
        }
      }
    });
  };

  // Activer une configuration
  const handleSetActive = async (record) => {
    try {
      const api = getApi();
      if (!api) throw new Error("API non disponible (call)");
      // Désactive toutes les configs actives sauf celle-ci
      for (const cfg of data) {
        if (cfg.id !== record.id && cfg.is_active) {
          await api.call("updateAppConfig", {
            id: cfg.id,
            nom_param: cfg.nom_param,
            valeur: typeof cfg.valeur === "object" ? JSON.stringify(cfg.valeur) : cfg.valeur,
            description: cfg.description,
            is_active: 0
          });
        }
      }
      // Active celle-ci (valeur doit être une chaîne JSON)
      await api.call("updateAppConfig", {
        id: record.id,
        nom_param: record.nom_param,
        valeur: typeof record.valeur === "object" ? JSON.stringify(record.valeur) : record.valeur,
        description: record.description,
        is_active: 1
      });
      setActiveKey(record.id);
      message.success("Configuration activée !");
      fetchConfigs();
    } catch (err) {
      message.error("Erreur lors de l'activation");
    }
  };

  // Parse la valeur JSON
  function parseConfigValue(val) {
    try {
      return typeof val === "string" ? JSON.parse(val) : val || {};
    } catch {
      return {};
    }
  }

  // Colonnes du tableau
  const columns = [
    {
      title: "Nom",
      dataIndex: "nom_param",
      key: "nom_param",
      render: (val, record) => (
        <span style={{ fontWeight: record.is_active ? "bold" : "normal" }}>
          {val}
        </span>
      )
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Actif",
      key: "is_active",
      align: "center",
      render: (_, record) => (
        <Checkbox
          checked={!!record.is_active}
          onChange={() => handleSetActive(record)}
          disabled={!!record.is_active}
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          <Button type="primary" onClick={() => handleEdit(record)}>
            Modifier
          </Button>
          <Button
            type="primary"
            danger
            onClick={() => handleDelete(record)}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>Configurations de l’application</h2>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Input.Search
          placeholder="Rechercher une configuration"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 320 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleEdit(null)}
        >
          Nouvelle configuration entête/pied de page
        </Button>
      </div>
      <Table
        rowKey={record => record.id || record.nom_param}
        loading={loading}
        columns={columns}
        dataSource={data.filter(
          (item) =>
            (item.nom_param &&
              item.nom_param.toLowerCase().includes(searchText.toLowerCase())) ||
            (item.description &&
              item.description.toLowerCase().includes(searchText.toLowerCase()))
        )}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        open={modalVisible}
        title={editingConfig && editingConfig.id ? "Modifier la configuration" : "Nouvelle configuration"}
        onCancel={() => { setModalVisible(false); setEditingConfig(null); }}
        footer={null}
        width={900}
        destroyOnClose
      >
        <ExportHeaderFooterConfig
          value={editingConfig ? editingConfig.valeur : {}}
          onChange={cfg => setEditingConfig(ec => ({ ...ec, valeur: cfg }))}
          onAddConfig={handleSave}
          configs={data.map(cfg => ({
            key: cfg.id,
            name: cfg.nom_param,
            ...parseConfigValue(cfg.valeur)
          }))}
          selectedConfigKey={editingConfig?.id}
        />
        <div style={{ textAlign: "right", marginTop: 24 }}>
          <Button
            type="primary"
            loading={saving}
            onClick={() => handleSave(editingConfig?.valeur)}
          >
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default AppConfigList;
