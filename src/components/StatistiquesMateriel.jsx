// src/components/StatistiquesMateriel.jsx
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
  Typography,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import './StatistiquesMateriel.css';

const { Title } = Typography;
const { Search } = Input;

export default function StatistiquesMateriel() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Charge les stats via IPC
  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.api.call("getStatistiquesMateriel", {});
      // Sécurise le setData pour éviter le .map sur undefined ou objet
      setData(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("getStatistiquesMateriel", err);
      Modal.error({
        title: "Erreur",
        content: "Impossible de charger les statistiques de matériel.",
      });
      setData([]); // Sécurise aussi en cas d'erreur
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Filtrage en mémoire avec useMemo
  const filteredData = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return Array.isArray(data) ? data : [];
    return (Array.isArray(data) ? data : []).filter((item) =>
      item.nom.toLowerCase().includes(q)
    );
  }, [data, searchText]);

  // Colonnes du tableau avec tri
  const columns = [
    {
      title: "Nom Matériel",
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
                Statistiques Matériel Spécifique ({data.length})
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
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="Rechercher un matériel…"
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
          dataSource={Array.isArray(filteredData) ? filteredData : []}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>
    </Spin>
  );
}
