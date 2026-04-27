// src/components/SyncLogsList.js
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
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import "./SyncLogsList.css";

const { Search } = Input;

export default function SyncLogsList() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 1. Chargement des logs via IPC
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.api.call("getSyncLogs", {});
      setLogs(list);
    } catch (err) {
      console.error("getSyncLogs", err);
      Modal.error({
        title: "Erreur",
        content: "Impossible de charger les logs de synchronisation.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 2. Filtrage en mémoire (source, table, action)
  const filteredLogs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) =>
      (log.source    || "").toLowerCase().includes(q) ||
      (log.table_name|| "").toLowerCase().includes(q) ||
      (log.action    || "").toLowerCase().includes(q)
    );
  }, [logs, searchText]);

  // 3. Définition des colonnes
  const columns = [
    {
      title: "Source",
      dataIndex: "source",
      key: "source",
      sorter: (a, b) => a.source.localeCompare(b.source),
      width: 150,
    },
    {
      title: "Table",
      dataIndex: "table_name",
      key: "table_name",
      sorter: (a, b) => a.table_name.localeCompare(b.table_name),
      width: 150,
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      sorter: (a, b) => a.action.localeCompare(b.action),
      width: 120,
    },
    {
      title: "Nb Records",
      dataIndex: "nb_records",
      key: "nb_records",
      align: "right",
      sorter: (a, b) => a.nb_records - b.nb_records,
      width: 100,
    },
    {
      title: "Statut",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "SUCCESS", value: "SUCCESS" },
        { text: "FAILED",  value: "FAILED"  },
      ],
      onFilter: (value, record) => record.status === value,
      width: 120,
    },
    {
      title: "Erreur",
      dataIndex: "error_message",
      key: "error_message",
      ellipsis: true,
    },
    {
      title: "Horodatage",
      dataIndex: "timestamp",
      key: "timestamp",
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      width: 180,
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <h3 style={{ margin: 0 }}>
                Logs de synchronisation ({logs.length})
              </h3>
            </Col>
            <Col>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadLogs}
                aria-label="Rafraîchir"
              />
            </Col>
          </Row>
        }
        style={{ margin: 24 }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={16} md={12} lg={8}>
            <Search
              placeholder="Filtrer par source, table ou action…"
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
          dataSource={filteredLogs}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>
    </Spin>
  );
}
