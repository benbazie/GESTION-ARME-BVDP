// src/components/DocumentsList.js
import React, { useState, useEffect } from "react";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import "./DocumentsList.css";

function DocumentsList() {
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // Chargement des documents via IPC
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const result = await window.api.call("getDocuments", {});
      const mapped = result.map((item) => ({
        ...item,
        key: item.id.toString(),
      }));
      setData(mapped);
    } catch (err) {
      message.error(err.message || "Erreur lors du chargement des documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Suppression d'un document via IPC
  const deleteDocument = (id) => {
    Modal.confirm({
      title: "Confirmer la suppression",
      content: "Voulez-vous supprimer ce document ?",
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        setLoading(true);
        try {
          await window.api.call("deleteDocument", { id });
          message.success("Document supprimé avec succès");
          loadDocuments();
        } catch (err) {
          message.error(err.message || "Erreur lors de la suppression");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Filtrage par titre ou description
  const filteredData = data.filter(
    (item) =>
      item.title?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { title: "Titre",       dataIndex: "title",       key: "title" },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    { title: "Date",        dataIndex: "date",        key: "date" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          <Link to={`/documents/edit/${record.id}`}>
            <Button type="primary">Modifier</Button>
          </Link>
          <Button
            type="primary"
            danger
            onClick={() => deleteDocument(record.id)}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="documents-list-container">
      <div className="documents-list-header">
        <h1>Documents</h1>
        <Link to="/documents/add">
          <Button type="primary" icon={<PlusOutlined />}>
            Ajouter un document
          </Button>
        </Link>
      </div>
      <div className="documents-list-search">
        <Input
          placeholder="Rechercher par titre ou description..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: "20px", maxWidth: "300px" }}
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

export default DocumentsList;
