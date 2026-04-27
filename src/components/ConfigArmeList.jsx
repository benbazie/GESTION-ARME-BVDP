// src/components/ConfigArmeList.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Button, Card, Col, Row, Space, Spin, Statistic, Table, Tag, Typography, message, Modal } from "antd";
import api from "../api";

const { confirm } = Modal;
const isElectron = () => typeof window !== "undefined" && !!window.electronAPI;

/**
 * Try multiple API names (electron preload or http api) and return first successful result.
 * If none available, return a safe empty value (array) instead of throwing.
 */
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
  console.warn("Aucune méthode API disponible parmi :", variants.join(", "));
  return []; // safe fallback
}

const ConfigArmeList = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [typeOptions, setTypeOptions] = useState([]);
  const [categorieOptions, setCategorieOptions] = useState([]);
  const [modeleOptions, setModeleOptions] = useState([]);
  const [overview, setOverview] = useState({ total: 0, types: 0, categories: 0, modeles: 0, latest: [] });

  // Sécurité : timeout pour désactiver le loader si jamais il reste bloqué
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setLoading(false), 10000);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const variants = [
        "getConfigArmes",
        "getConfigArmeList",
        "getConfigArmesList",
        "getConfig_armeList",
        "getConfig_armesList"
      ];
      const data = await callPossible(variants);
      const arr = Array.isArray(data) ? data : (data && Array.isArray(data.rows) ? data.rows : []);
      setItems(arr);
    } catch (err) {
      setLoadError("Erreur lors du chargement des configurations d'armes");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    Promise.all([
      api.getConfigArmeList(),
      api.getTypesArmeList(),
      api.getCategoriesArmeList(),
      api.getModelesArmeList()
    ])
      .then(([configs, types, categories, modeles]) => {
        setItems(configs || []);
        setTypeOptions(types || []);
        setCategorieOptions(categories || []);
        setModeleOptions(modeles || []);
      })
      .catch(() => message.error("Chargement impossible"));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await api.getConfigArmeList();
        if (!mounted) return;
        const entries = Array.isArray(list) ? list : [];
        const typeSet = new Set();
        const categorieSet = new Set();
        const modeleSet = new Set();
        entries.forEach((item) => {
          if (!item) return;
          if (item.type) typeSet.add(String(item.type).trim());
          if (item.categorie || item.categorie_arme) categorieSet.add(String(item.categorie || item.categorie_arme).trim());
          if (item.designation || item.modele || item.modele_arme) modeleSet.add(String(item.designation || item.modele || item.modele_arme).trim());
        });
        const latest = entries
          .filter((item) => item && (item.updated_at || item.created_at))
          .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
          .slice(0, 4);
        setOverview({
          total: entries.length,
          types: typeSet.size,
          categories: categorieSet.size,
          modeles: modeleSet.size,
          latest
        });
      } catch (error) {
        if (!mounted) return;
        console.warn('[ConfigArmeList] résumé indisponible :', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const removeItem = (id) => {
    if (id == null) {
      message.error("ID invalide");
      return;
    }
    confirm({
      title: "Confirmer la suppression",
      icon: <ExclamationCircleOutlined />,
      content: "Voulez-vous supprimer cette configuration d'arme ?",
      okText: "Supprimer",
      okType: "danger",
      cancelText: "Annuler",
      onOk: async () => {
        setLoading(true);
        try {
          const variants = [
            "deleteConfigArmes",
            "deleteConfigArme",
            "deleteConfig_arme",
            "delete_config_arme"
          ];
          await callPossible(variants, id);
          message.success("Configuration supprimée");
          await loadList();
        } catch (err) {
          console.error("Erreur suppression :", err);
          message.error("Erreur lors de la suppression");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const typeById = useMemo(
    () => Object.fromEntries(typeOptions.map((item) => [item.id, item.nom || item.libelle || item.code])),
    [typeOptions]
  );
  const categorieById = useMemo(
    () => Object.fromEntries(categorieOptions.map((item) => [item.id, item.nom || item.libelle || item.code])),
    [categorieOptions]
  );
  const modeleById = useMemo(
    () => Object.fromEntries(modeleOptions.map((item) => [item.id, item.nom || item.designation || item.libelle])),
    [modeleOptions]
  );

  const columns = [
    {
      title: "Type",
      dataIndex: "type_id",
      render: (_, record) => typeById[record.type_id] || record.type || "—"
    },
    {
      title: "Catégorie",
      dataIndex: "categorie_id",
      render: (_, record) => categorieById[record.categorie_id] || record.categorie || "—"
    },
    {
      title: "Modèle",
      dataIndex: "modele_id",
      render: (_, record) => modeleById[record.modele_id] || record.designation || "—"
    },
    {
      title: "Code",
      dataIndex: "code",
      render: (value) => value || <Tag color="default">Aucun</Tag>
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/dashboard/config-armes/form/${record.id}`)}
          >
            Modifier
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeItem(record.id)}
          >
            Supprimer
          </Button>
        </Space>
      )
    }
  ];

  const formatSummaryDate = (value) => {
    if (!value) return 'Non daté'
    try {
      return new Date(value).toLocaleDateString('fr-FR')
    } catch {
      return 'Non daté'
    }
  }
  const latestConfigs = overview.latest || [];

  return (
    <div className="config-arme-list-page">
      <Card className="config-arme-overview" style={{ marginBottom: 24 }} bordered={false}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Synthèse des configurations
          </Typography.Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Configurations actives" value={overview.total} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Types couverts" value={overview.types} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Catégories" value={overview.categories} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Libellés de modèles" value={overview.modeles} />
            </Col>
          </Row>
          {latestConfigs.length > 0 && (
            <Space wrap>
              {latestConfigs.map((item) => (
                <Tag key={`config-${item.id ?? item.code ?? item.designation}`} color="blue">
                  {(item.designation || item.modele || item.type || 'Sans libellé')} · {formatSummaryDate(item.updated_at || item.created_at)}
                </Tag>
              ))}
            </Space>
          )}
        </Space>
      </Card>
      <Card
        title="Configurations d'armes"
        extra={
          <Space>
            <Button onClick={() => navigate("/dashboard/config-armes/types")}>Types</Button>
            <Button onClick={() => navigate("/dashboard/config-armes/categories")}>Catégories</Button>
            <Button onClick={() => navigate("/dashboard/config-armes/modeles")}>Modèles</Button>
            <Button type="primary" onClick={() => navigate("/dashboard/config-armes/form")}>
              Nouvelle configuration
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading}>
          {loadError ? (
            <div style={{ color: "red", textAlign: "center", margin: 24 }}>{loadError}</div>
          ) : (
            <Table
              bordered
              dataSource={items}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default ConfigArmeList;
