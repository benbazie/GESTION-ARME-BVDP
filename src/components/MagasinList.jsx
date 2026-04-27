// src/components/MagasinList.js
import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Input,
  Button,
  Space,
  Spin,
  message
} from "antd";
import {
  SearchOutlined,
  PlusOutlined
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import "./MagasinList.css";

export default function MagasinList() {
  const navigate = useNavigate();
  const [magasins, setMagasins] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. Charger la liste des magasins via IPC
  const loadMagasins = async () => {
    setLoading(true);
    try {
      const data = await window.api.call("getMagasins", {});
      // On attend un tableau d'objets { id, nom_magasin, responsable_nom, responsable_prenom, contact, adresse }
      setMagasins(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("getMagasins", err);
      message.error("Erreur lors du chargement des magasins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMagasins();
  }, []);

  // 2. Filtrer localement par nom du magasin
  const filtered = useMemo(() => {
    return magasins.filter(m =>
      m.nom_magasin
        .toLowerCase()
        .includes(searchText.toLowerCase())
    );
  }, [magasins, searchText]);

  // 3. Colonnes du tableau
  const columns = [
    {
      title: "Nom du Magasin",
      dataIndex: "nom_magasin",
      key: "nom_magasin",
      sorter: (a, b) => a.nom_magasin.localeCompare(b.nom_magasin),
    },
    {
      title: "Responsable",
      key: "responsable",
      render: (_, r) =>
        `${r.responsable_nom || ""} ${r.responsable_prenom || ""}`,
    },
    {
      title: "Contact",
      dataIndex: "contact",
      key: "contact",
    },
    {
      title: "Adresse",
      dataIndex: "adresse",
      key: "adresse",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Link to={`/magasin/edit/${r.id}`}>
            <Button type="primary">Modifier</Button>
          </Link>
        </Space>
      ),
    },
  ];

  return (
    <div className="magasin-list-container">
      <div className="magasin-list-header">
        <h1>Liste des Magasins</h1>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/magasin/add")}
          >
            Ajouter un Magasin
          </Button>
        </Space>
      </div>

      <div className="magasin-list-search" style={{ margin: "16px 0" }}>
        <Input
          placeholder="Rechercher par nom..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          prefix={<SearchOutlined />}
          allowClear
        />
      </div>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          bordered
        />
      </Spin>
    </div>
  );
}
