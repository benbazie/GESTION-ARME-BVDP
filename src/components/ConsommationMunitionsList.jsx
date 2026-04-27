// src/components/ConsommationMunitionsList.js
import React, { useState, useEffect } from "react";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import "./ConsommationMunitionsList.css";

function ConsommationMunitionsList() {
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // Chargement des consommations via IPC
  const fetchConsommations = async () => {
    setLoading(true);
    try {
      const result = await window.api.call("getConsommationMunitions", {});
      const mappedData = result.map((item) => ({
        ...item,
        key: item.id.toString(),
      }));
      setData(mappedData);
    } catch (err) {
      message.error(
        err.message || "Erreur lors du chargement des consommations de munitions"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsommations();
  }, []);

  // Suppression d'un enregistrement via IPC
  const deleteConsommation = (id) => {
    Modal.confirm({
      title: "Confirmer la suppression",
      content: "Êtes-vous sûr de vouloir supprimer cet enregistrement ?",
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        setLoading(true);
        try {
          await window.api.call("deleteConsommationMunition", { id });
          message.success("Enregistrement supprimé avec succès");
          fetchConsommations();
        } catch (err) {
          message.error(err.message || "Erreur lors de la suppression");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Filtrage par munition_id ou remarque
  const filteredData = data.filter(
    (item) =>
      item.munition_id
        .toString()
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      item.remarque?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: "ID Munition",
      dataIndex: "munition_id",
      key: "munition_id",
    },
    {
      title: "Quantité Consommée",
      dataIndex: "quantite_consommee",
      key: "quantite_consommee",
    },
    {
      title: "Date de Consommation",
      dataIndex: "date_consommation",
      key: "date_consommation",
    },
    {
      title: "Remarque",
      dataIndex: "remarque",
      key: "remarque",
      ellipsis: true,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          <Link to={`/consommation_munitions/edit/${record.id}`}>
            <Button type="primary">Modifier</Button>
          </Link>
          <Button
            type="primary"
            danger
            onClick={() => deleteConsommation(record.id)}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="consommation-list-container">
      <div className="consommation-list-header">
        <h1>Liste des Consommations de Munitions</h1>
        <Link to="/consommation_munitions/add">
          <Button type="primary" icon={<PlusOutlined />}>
            Ajouter
          </Button>
        </Link>
      </div>
      <div className="consommation-list-search">
        <Input
          placeholder="Rechercher par ID munition ou remarque..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          prefix={<SearchOutlined />}
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        pagination={{ pageSize: 5 }}
      />
    </div>
  );
}

export default ConsommationMunitionsList;
