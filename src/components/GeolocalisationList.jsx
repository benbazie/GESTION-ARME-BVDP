// src/components/GeolocalisationList.js
import React, { useState, useEffect } from "react";
import {
  Table,
  Input,
  Button,
  Space,
  message,
  Modal,
  Spin,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./GeolocalisationList.css";

export default function GeolocalisationList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. Charger toutes les géolocalisations via IPC
  const loadData = async () => {
    setLoading(true);
    try {
      const result = await window.api.call("getAllGeoloc", {});
      if (Array.isArray(result)) {
        const mapped = result.map(item => ({
          key: String(item.id),
          id: item.id,
          nom: item.nom,
          latitude: item.lat,
          longitude: item.lng,
          description: item.popupText,
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("getAllGeoloc", err);
      message.error("Erreur lors du chargement des localisations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2. Filtrer localement par nom ou description
  const filtered = data.filter(item =>
    (item.nom || "")
      .toLowerCase()
      .includes(searchText.toLowerCase()) ||
    (item.description || "")
      .toLowerCase()
      .includes(searchText.toLowerCase())
  );

  // 3. Supprimer une localisation via IPC
  const deleteGeoloc = id => {
    Modal.confirm({
      title: "Confirmer la suppression",
      content: "Êtes-vous sûr de vouloir supprimer cette localisation ?",
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        try {
          await window.api.call("deleteGeoloc", { id });
          message.success("Localisation supprimée");
          loadData();
        } catch (err) {
          console.error("deleteGeoloc", err);
          message.error("Erreur lors de la suppression");
        }
      },
    });
  };

  // 4. Colonnes du tableau
  const columns = [
    {
      title: "Nom",
      dataIndex: "nom",
      key: "nom",
    },
    {
      title: "Latitude",
      dataIndex: "latitude",
      key: "latitude",
    },
    {
      title: "Longitude",
      dataIndex: "longitude",
      key: "longitude",
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            onClick={() => navigate(`/geolocalisation/edit/${record.id}`)}
          >
            Modifier
          </Button>
          <Button
            danger
            onClick={() => deleteGeoloc(record.id)}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="geolocalisation-list-container">
      <div className="geolocalisation-list-header">
        <h1>Liste des Localisations</h1>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/geolocalisation/add")}
          >
            Ajouter
          </Button>
        </Space>
      </div>

      <div className="geolocalisation-list-search">
        <Input
          placeholder="Rechercher par nom ou description…"
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
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Spin>
    </div>
  );
}
