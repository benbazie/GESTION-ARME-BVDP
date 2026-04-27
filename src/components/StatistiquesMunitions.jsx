// src/components/StatistiquesMunitions.jsx
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
import './StatistiquesMunitions.css';

const { Search } = Input;

export default function StatistiquesMunitions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Charge les statistiques de munitions via IPC
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.api.call("getStatistiquesMunitions", {});
      // structure attendue : [{ id, nom, total }, …]
      setData(list);
    } catch (err) {
      console.error("getStatistiquesMunitions", err);
      Modal.error({
        title: "Erreur",
        content: "Impossible de charger les statistiques de munitions.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Filtre local en mémoire
  const filteredData = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return data;
    return data.filter((item) => item.nom.toLowerCase().includes(q));
  }, [data, searchText]);

  // Colonnes du tableau
  const columns = [
    {
      title: "Nom Munition",
      dataIndex: "nom",
      key: "nom",
      sorter: (a, b) => a.nom.localeCompare(b.nom),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      align: "right",
      width: 120,
      sorter: (a, b) => a.total - b.total,
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <h3 style={{ margin: 0 }}>
                Statistiques Munitions ({data.length})
              </h3>
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
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="Rechercher une munition…"
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
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>
    </Spin>
  );
}
