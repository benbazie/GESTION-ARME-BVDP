import React, { useEffect, useState } from "react";
import { Table, Button, Card, Space, Spin } from "antd";
import { PlusOutlined, PrinterOutlined, DownloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./CoordinationList.css";

export default function CoordinationList() {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [regionaleList, setRegionaleList] = useState([]);
  const [provincialeList, setProvincialeList] = useState([]);
  const [communaleList, setCommunaleList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [modal, setModal] = useState({ open: false, type: null, record: null, parentId: null });
  const [form, setForm] = useState({ nom: "", code: "", description: "", region_id: null, province_id: null, commune_id: null });

  // Filtre pour chaque niveau
  const [selectedRegionale, setSelectedRegionale] = useState(null);
  const [selectedProvinciale, setSelectedProvinciale] = useState(null);

  const navigate = useNavigate();

  // Helper robuste pour charger les coordinations régionales
  const fetchCoordinationRegionales = async () => {
    const api = window.electronAPI || window.api || {};
    if (typeof api.getCoordinationRegionales === "function") {
      return api.getCoordinationRegionales();
    }
    if (typeof api.getCoordinationRegionaleList === "function") {
      return api.getCoordinationRegionaleList();
    }
    if (typeof api.getCoordinationRegionale === "function") {
      return api.getCoordinationRegionale();
    }
    if (typeof api.call === "function") {
      // fallback générique
      return api.call("getCoordinationRegionales");
    }
    return [];
  };

  // Chargement initial
  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.electronAPI.getRegions(),
      window.electronAPI.getProvinces(),
      window.electronAPI.getCommunes(),
      fetchCoordinationRegionales()
    ]).then(([regs, provs, comms, regios]) => {
      setRegions(regs || []);
      setProvinces(provs || []);
      setCommunes(comms || []);
      setRegionaleList(regios || []);
      setLoading(false);
    });
  }, []);

  // Provinciales dépend de la régionale sélectionnée
  useEffect(() => {
    if (selectedRegionale) {
      window.electronAPI.getCoordinationProvinciales(selectedRegionale).then(setProvincialeList);
    } else {
      setProvincialeList([]);
    }
    setSelectedProvinciale(null);
    setCommunaleList([]);
  }, [selectedRegionale]);

  // Communales dépend de la provinciale sélectionnée
  useEffect(() => {
    if (selectedProvinciale) {
      window.electronAPI.getCoordinationCommunales(selectedProvinciale).then(setCommunaleList);
    } else {
      setCommunaleList([]);
    }
  }, [selectedProvinciale]);

  // Modal helpers
  const openModal = (type, parentId = null, record = null) => {
    setForm(record ? { ...record } : { nom: "", code: "", description: "", region_id: null, province_id: null, commune_id: null });
    setModal({ open: true, type, parentId, record });
  };
  const closeModal = () => setModal({ open: false, type: null, record: null, parentId: null });

  // Ajout/édition
  const handleSave = async () => {
    try {
      if (modal.type === "regionale") {
        if (!form.nom || !form.region_id) return message.warning("Nom et région requis");
        const payload = {
          nom: form.nom,
          code: form.code,
          region_id: form.region_id,
          description: form.description
        };
        if (modal.record) {
          await window.electronAPI.updateCoordinationRegionale(modal.record.id, payload);
        } else {
          await window.electronAPI.addCoordinationRegionale(payload);
        }
        setRegionaleList(await window.electronAPI.getCoordinationRegionales());
      }
      if (modal.type === "provinciale") {
        if (!form.nom || !form.province_id || !form.region_id || !modal.parentId)
          return message.warning("Nom, province, région et coordination régionale requis");
        const payload = {
          nom: form.nom,
          code: form.code,
          province_id: form.province_id,
          region_id: form.region_id,
          parent_id: modal.parentId,
          description: form.description
        };
        if (modal.record) {
          await window.electronAPI.updateCoordinationProvinciale(modal.record.id, payload);
        } else {
          await window.electronAPI.addCoordinationProvinciale(payload);
        }
        setProvincialeList(await window.electronAPI.getCoordinationProvinciales(modal.parentId));
      }
      if (modal.type === "communale") {
        if (!form.nom || !form.commune_id || !form.province_id || !form.region_id || !modal.parentId)
          return message.warning("Nom, commune, province, région et coordination provinciale requis");
        const payload = {
          nom: form.nom,
          code: form.code,
          commune_id: form.commune_id,
          province_id: form.province_id,
          region_id: form.region_id,
          parent_id: modal.parentId,
          description: form.description
        };
        if (modal.record) {
          await window.electronAPI.updateCoordinationCommunale(modal.record.id, payload);
        } else {
          await window.electronAPI.addCoordinationCommunale(payload);
        }
        setCommunaleList(await window.electronAPI.getCoordinationCommunales(modal.parentId));
      }
      closeModal();
      message.success("Enregistré !");
    } catch (e) {
      // Affiche l'erreur dans une modal explicite
      let detail = e?.message || e?.toString() || "Erreur inconnue";
      if (e?.response?.data?.error) detail += "\n" + e.response.data.error;
      if (e?.response?.data?.detail) detail += "\n" + e.response.data.detail;
      Modal.error({
        title: "Erreur lors de l'enregistrement",
        content: (
          <div style={{ whiteSpace: "pre-wrap" }}>
            {detail}
          </div>
        ),
        width: 600,
      });
      // Affiche aussi dans la console pour debug
      console.error("[CoordinationList] Erreur lors de l'ajout/édition :", e);
    }
  };

  // Impression
  const handlePrint = () => window.print();
  // Export CSV
  const handleExport = (data, filename) => {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(",")].concat(data.map(row => keys.map(k => `"${row[k] ?? ""}"`).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // Colonnes pour Table
  const columns = (level) => [
    { title: "Nom", dataIndex: "nom", key: "nom" },
    { title: "Code", dataIndex: "code", key: "code" },
    ...(level === "regionale"
      ? [{ title: "Région", dataIndex: "region_nom", key: "region_nom" }]
      : level === "provinciale"
      ? [{ title: "Province", dataIndex: "province_nom", key: "province_nom" }]
      : [{ title: "Commune", dataIndex: "commune_nom", key: "commune_nom" }]),
    { title: "Description", dataIndex: "description", key: "description" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button type="link" onClick={() => openModal(level, level === "regionale" ? null : (level === "provinciale" ? selectedRegionale : selectedProvinciale), record)}>
          Modifier
        </Button>
      )
    }
  ];

  return (
    <Card
      title="Liste des Coordinations"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/dashboard/coordinations/add")}
        >
          Ajouter
        </Button>
      }
      style={{ margin: 24 }}
    >
      <Table
        columns={columns("regionale")}
        dataSource={regionaleList}
        rowKey="id"
        loading={loading}
        bordered
        pagination={{ pageSize: 10 }}
      />
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .coordination-list-container, .coordination-list-container * { visibility: visible; }
          .coordination-list-container { position: absolute; top: 0; left: 0; width: 100%; background: #fff; }
          .ant-modal, .ant-modal-mask, .ant-btn, .ant-tabs-nav, .ant-select, .ant-input { display: none !important; }
        }
      `}</style>
      {loading && <Spin size="large" style={{ position: "fixed", top: "40%", left: "50%" }} />}
    </Card>
  );
}
