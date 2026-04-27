// src/components/StockList.js
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
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import './StockList.css';

const { Search } = Input;
const { error: showError } = Modal;

export default function StockList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 1. Charger le stock via IPC
  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.api.call("getStockMagasin", {});
      // on s'attend à : [{ id, magasin_id, equipement_type, equipement_id, quantite, dernier_mise_a_jour }, …]
      setData(list);
    } catch (err) {
      console.error("getStockMagasin", err);
      showError({
        title: "Erreur",
        content: "Impossible de charger le stock du magasin.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  // 2. Filtrage local avec useMemo
  const filteredData = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (item) =>
        item.equipement_type.toLowerCase().includes(q) ||
        String(item.magasin_id).includes(q) ||
        String(item.equipement_id).includes(q)
    );
  }, [data, searchText]);

  // 3. Colonnes du tableau
  const columns = [
    {
      title: "Magasin ID",
      dataIndex: "magasin_id",
      key: "magasin_id",
      width: 100,
      sorter: (a, b) => a.magasin_id - b.magasin_id,
    },
    {
      title: "Type d'Équipement",
      dataIndex: "equipement_type",
      key: "equipement_type",
      sorter: (a, b) => a.equipement_type.localeCompare(b.equipement_type),
    },
    {
      title: "Équipement ID",
      dataIndex: "equipement_id",
      key: "equipement_id",
      width: 120,
      sorter: (a, b) => a.equipement_id - b.equipement_id,
    },
    {
      title: "Quantité",
      dataIndex: "quantite",
      key: "quantite",
      width: 100,
      align: "right",
      sorter: (a, b) => a.quantite - b.quantite,
    },
    {
      title: "Dernière MAJ",
      dataIndex: "dernier_mise_a_jour",
      key: "dernier_mise_a_jour",
      width: 180,
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <h3 style={{ margin: 0 }}>Stock du Magasin ({data.length})</h3>
            </Col>
            <Col>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadStock}
                aria-label="Rafraîchir le stock"
              />
            </Col>
          </Row>
        }
        style={{ margin: 24 }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Search
              placeholder="Rechercher un équipement…"
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
          rowKey={(record) =>
            `${record.magasin_id}-${record.equipement_type}-${record.equipement_id}`
          }
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>
    </Spin>
  );
}
