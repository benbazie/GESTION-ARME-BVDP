// src/components/DdrList.js
import React, { useState, useEffect } from "react";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, Table, Space } from "antd";
import { Link } from "react-router-dom";
import "./DdrList.css";

function DdrList() {
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // Chargement des opérations DDR via IPC
  const loadDdrs = async () => {
    setLoading(true);
    try {
      const result = await window.api.call("getDdrDesarmements", {});
      const mappedData = result.map((item) => ({
        ...item,
        key: item.id.toString(),
      }));
      setData(mappedData);
    } catch (err) {
      message.error(err.message || "Erreur lors du chargement des opérations de DDR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDdrs();
  }, []);

  // Filtrage par méthode ou responsable
  const filteredData = data.filter(
    (item) =>
      item.methode_desarmement
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      item.responsable?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { title: "Arme ID",          dataIndex: "arme_id",            key: "arme_id" },
    { title: "VDP ID",           dataIndex: "vdp_id",             key: "vdp_id" },
    { title: "Méthode",          dataIndex: "methode_desarmement", key: "methode_desarmement" },
    { title: "Statut",           dataIndex: "statut_desarmement",  key: "statut_desarmement" },
    { title: "Date",             dataIndex: "date_desarmement",    key: "date_desarmement" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          <Link to={`/ddr_desarmement/edit/${record.id}`}>
            <Button type="primary">Modifier</Button>
          </Link>
        </Space>
      ),
    },
  ];

  return (
    <div className="ddr-list-container">
      <div className="ddr-list-header">
        <h1>Liste des Opérations de DDR</h1>
        <Link to="/ddr_desarmement/add">
          <Button type="primary" icon={<PlusOutlined />}>
            Ajouter une Opération
          </Button>
        </Link>
      </div>
      <div className="ddr-list-search">
        <Input
          placeholder="Rechercher par méthode ou responsable..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          prefix={<SearchOutlined />}
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredData}
        pagination={{ pageSize: 5 }}
        loading={loading}
      />
    </div>
  );
}

export default DdrList;
