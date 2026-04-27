// src/components/AuditLogsList.js
import React, { useState, useEffect } from "react";
import { SearchOutlined } from "@ant-design/icons";
import "./AuditLogsList.css";

function AuditLogsList() {
  const [logs, setLogs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // Chargement des logs d'audit via IPC
  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const result = await window.api.call("getAuditLogs", {});
      const mappedLogs = result.map((log) => ({
        ...log,
        key: log.id.toString(),
      }));
      setLogs(mappedLogs);
    } catch (err) {
      message.error(err.message || "Erreur lors du chargement des logs d'audit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // Filtrage par table ou action
  const filteredData = logs.filter(
    (log) =>
      log.table_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { title: "User ID",    dataIndex: "user_id",    key: "user_id"    },
    { title: "Table",      dataIndex: "table_name", key: "table_name" },
    { title: "Record ID",  dataIndex: "record_id",  key: "record_id"  },
    { title: "Action",     dataIndex: "action",     key: "action"     },
    { title: "Details",    dataIndex: "details",    key: "details",    ellipsis: true },
    { title: "Timestamp",  dataIndex: "timestamp",  key: "timestamp"  },
  ];

  return (
    <div className="audit-logs-container">
      <div className="audit-logs-header">
        <h1>Logs d'Audit</h1>
      </div>
      <div className="audit-logs-search">
        <Input
          placeholder="Rechercher par table ou action..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          prefix={<SearchOutlined />}
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}

export default AuditLogsList;
