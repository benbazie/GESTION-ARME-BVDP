// src/components/AuditLogs.js
import React, { useState, useEffect } from "react";
import { SearchOutlined } from "@ant-design/icons";
import "./AuditLogs.css";

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // Chargement des logs d'audit via IPC
  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await window.api.call("getAuditLogs", {});
      const mappedData = data.map((log) => ({
        ...log,
        key: log.id.toString(),
      }));
      setLogs(mappedData);
    } catch (err) {
      message.error(err.message || "Erreur lors du chargement des logs d'audit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // Filtrer les logs par table_name ou action
  const filteredData = logs.filter(
    (log) =>
      log.table_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { title: "User ID",    dataIndex: "user_id",    key: "user_id" },
    { title: "Table",      dataIndex: "table_name", key: "table_name" },
    { title: "Record ID",  dataIndex: "record_id",  key: "record_id" },
    { title: "Action",     dataIndex: "action",     key: "action" },
    { title: "Details",    dataIndex: "details",    key: "details",    ellipsis: true },
    { title: "Timestamp",  dataIndex: "timestamp",  key: "timestamp" },
  ];

  return (
    <div className="audit-logs-container">
      <h1>Logs d'Audit</h1>
      <Input
        placeholder="Rechercher par table ou action..."
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="audit-logs-search"
      />
      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}

export default AuditLogs;
