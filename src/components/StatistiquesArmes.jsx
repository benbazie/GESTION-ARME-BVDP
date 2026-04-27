import { Typography } from 'antd';
// src/components/StatistiquesArmes.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Input,
  Table,
  Spin,
  Button,
  Modal,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import './StatistiquesArmes.css';

const { Title } = Typography;
const { Search } = Input;
const { error: showError } = Modal;

export default function StatistiquesArmes() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 1. Chargement des stats via IPC
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.api.call("getStatistiquesArmes", {});
      // structure attendue : [{ id, nom, total }, …]
      setData(list);
    } catch (err) {
      console.error("getStatistiquesArmes", err);
      showError({
        title: "Erreur",
        content: "Impossible de charger les statistiques d'armes.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 2. Filtrage en mémoire
  const filteredData = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return data;
    return data.filter((item) =>
      item.nom.toLowerCase().includes(q)
    );
  }, [data, searchText]);

  // 3. Colonnes du tableau
  const columns = [
    {
      title: "Nom de l'Arme",
      dataIndex: "nom",
      key: "nom",
      sorter: (a, b) => a.nom.localeCompare(b.nom),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      align: "right",
      sorter: (a, b) => a.total - b.total,
      width: 120,
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                Statistiques Armes ({data.length} catégories)
              </Title>
            </Col>
            <Col>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadStats}
                aria-label="Rafraîchir"
              />
            </Col>
          </Row>
        }
        style={{ margin: 24 }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={8}>
            <Search
              placeholder="Rechercher une arme…"
              enterButton={<SearchOutlined />}
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={(v) => setSearchText(v)}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="nom"
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>
    </Spin>
  );
}
