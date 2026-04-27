// src/components/DocumentsEtat.js
import React, { useState, useEffect } from "react";
import { SearchOutlined } from "@ant-design/icons";
import "./DocumentsEtat.css";

function DocumentsEtat() {
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // Chargement des états via IPC
  const loadDocumentsEtat = async () => {
    setLoading(true);
    try {
      const result = await window.api.call("getDocumentsEtat", {});
      const mapped = result.map((item) => ({
        ...item,
        key: item.id.toString(),
      }));
      setData(mapped);
    } catch (err) {
      message.error(err.message || "Erreur lors du chargement des états");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocumentsEtat();
  }, []);

  // Filtrage par titre
  const filteredData = data.filter((item) =>
    item.title?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { title: "Titre",       dataIndex: "title",       key: "title" },
    { title: "Description", dataIndex: "description", key: "description", ellipsis: true },
    { title: "Date",        dataIndex: "date",        key: "date" },
  ];

  return (
    <div className="documents-etat-container">
      <h1>États & Rapports</h1>
      <Input
        placeholder="Rechercher par titre..."
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: "20px", maxWidth: "300px" }}
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

export default DocumentsEtat;
