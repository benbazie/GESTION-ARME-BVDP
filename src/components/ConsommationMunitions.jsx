// src/components/ConsommationMunitions.js
import React, { useState, useEffect } from "react";
import { SearchOutlined } from "@ant-design/icons";
import "./ConsommationMunitions.css";

function ConsommationMunitions() {
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // Chargement des consommations via IPC
  const loadConsommations = async () => {
    setLoading(true);
    try {
      const json = await window.api.call("getConsommationMunitions", {});
      const mapped = json.map((item) => ({
        ...item,
        key: item.id.toString(),
      }));
      setData(mapped);
    } catch (err) {
      message.error(
        err.message || "Erreur lors du chargement des consommations de munitions"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsommations();
  }, []);

  // Filtrage par ID munition ou remarque
  const filteredData = data.filter(
    (item) =>
      item.munition_id
        .toString()
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      item.remarque?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { title: "ID Munition",           dataIndex: "munition_id",         key: "munition_id" },
    { title: "Quantité Consommée",    dataIndex: "quantite_consommee", key: "quantite_consommee" },
    { title: "Date de Consommation",  dataIndex: "date_consommation",  key: "date_consommation" },
    { title: "Remarque",              dataIndex: "remarque",            key: "remarque", ellipsis: true },
  ];

  return (
    <div className="consommation-munitions-container">
      <h1>Consommation Munitions</h1>
      <Input
        placeholder="Rechercher par ID munition ou remarque..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        prefix={<SearchOutlined />}
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

export default ConsommationMunitions;
