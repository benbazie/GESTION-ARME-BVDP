// src/components/DocumentsImpression.js
import React, { useState, useEffect } from "react";
import { SearchOutlined } from "@ant-design/icons";
import ExportManager from "./impression/ExportManager";
import "./DocumentsImpression.css";

function DocumentsImpression() {
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const columns = ["title", "description", "date"];

  // Chargement des documents d'impression via IPC
  const fetchDocs = async () => {
    setLoading(true);
    try {
      const result = await window.api.call("getDocumentsImpression", {});
      // Assure que chaque item a une clé string
      setData(
        result.map((item) => ({
          ...item,
          key: item.id.toString(),
        }))
      );
    } catch (err) {
      message.error(err.message || "Erreur lors du chargement des documents d'impression");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  // Impression dans une nouvelle fenêtre
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const content = `
      <html>
        <head>
          <title>Documents & Impression</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Documents & Impression</h1>
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Description</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (doc) => `
                  <tr>
                    <td>${doc.title}</td>
                    <td>${doc.description}</td>
                    <td>${doc.date}</td>
                  </tr>
                `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  // Filtrage local sur le titre
  const filteredData = data.filter((item) =>
    item.title.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="documents-impression-container">
      <h1>Documents & Impression</h1>

      <ExportManager data={data} columns={columns} fileName="Documents_Impression" />

      <Button onClick={handlePrint} style={{ marginBottom: "20px" }}>
        Imprimer
      </Button>

      <Input
        placeholder="Rechercher par titre..."
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: "20px", maxWidth: "300px" }}
      />

      <Table
        columns={[
          { title: "Titre", dataIndex: "title", key: "title" },
          {
            title: "Description",
            dataIndex: "description",
            key: "description",
            ellipsis: true,
          },
          { title: "Date", dataIndex: "date", key: "date" },
        ]}
        dataSource={filteredData}
        loading={loading}
        pagination={{ pageSize: 10 }}
        rowKey="key"
      />
    </div>
  );
}

export default DocumentsImpression;
