import React, { useEffect, useState } from "react";
import { Card, Select, Button, Table, Modal, Input, Space, message } from "antd";
const { Option } = Select;

export default function CoordinationHierarchy() {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [localites, setLocalites] = useState([]);

  const [regionaleList, setRegionaleList] = useState([]);
  const [provincialeList, setProvincialeList] = useState([]);
  const [communaleList, setCommunaleList] = useState([]);
  const [localiteList, setLocaliteList] = useState([]);

  const [selectedRegionale, setSelectedRegionale] = useState(null);
  const [selectedProvinciale, setSelectedProvinciale] = useState(null);
  const [selectedCommunale, setSelectedCommunale] = useState(null);

  // Form states
  const [modal, setModal] = useState({ open: false, type: null, parentId: null });
  const [form, setForm] = useState({ nom: "", code: "", description: "", region_id: null, province_id: null, commune_id: null });

  // Load all base data
  useEffect(() => {
    window.electronAPI.getRegions().then(setRegions);
    window.electronAPI.getProvinces().then(setProvinces);
    window.electronAPI.getCommunes().then(setCommunes);
    window.electronAPI.getLocalites().then(setLocalites);

    // Correction : supporte toutes les variantes d'API
    const getCoordinationRegionales =
      window.electronAPI?.getCoordinationRegionales
        || window.electronAPI?.getCoordinationRegionaleList
        || window.electronAPI?.getCoordinationRegionale
        || (window.electronAPI?.call
            ? () => window.electronAPI.call('getCoordinationRegionales')
            : null);

    if (typeof getCoordinationRegionales === "function") {
      getCoordinationRegionales().then(setRegionaleList);
    } else {
      setRegionaleList([]);
    }
  }, []);

  // Load provinciales when regionale selected
  useEffect(() => {
    if (selectedRegionale) {
      window.electronAPI.getCoordinationProvinciales(selectedRegionale).then(setProvincialeList);
      setSelectedProvinciale(null);
      setCommunaleList([]);
      setLocaliteList([]);
    }
  }, [selectedRegionale]);

  // Load communales when provinciale selected
  useEffect(() => {
    if (selectedProvinciale) {
      window.electronAPI.getCoordinationCommunales(selectedProvinciale).then(setCommunaleList);
      setSelectedCommunale(null);
      setLocaliteList([]);
    }
  }, [selectedProvinciale]);

  // Load localités when communale selected
  useEffect(() => {
    if (selectedCommunale) {
      window.electronAPI.getLocalitesByCoordinationCommunale(selectedCommunale).then(setLocaliteList);
    }
  }, [selectedCommunale]);

  // Handlers for add
  const openAddModal = (type, parentId = null) => {
    setForm({ nom: "", code: "", description: "", region_id: null, province_id: null, commune_id: null });
    setModal({ open: true, type, parentId });
  };
  const closeModal = () => setModal({ open: false, type: null, parentId: null });

  const handleAdd = async () => {
    try {
      if (modal.type === "regionale") {
        await window.electronAPI.addCoordinationRegionale({
          nom: form.nom, code: form.code, region_id: form.region_id, description: form.description
        });
        window.electronAPI.getCoordinationRegionales().then(setRegionaleList);
      }
      if (modal.type === "provinciale") {
        await window.electronAPI.addCoordinationProvinciale({
          nom: form.nom, code: form.code, province_id: form.province_id, region_id: form.region_id, parent_id: modal.parentId, description: form.description
        });
        window.electronAPI.getCoordinationProvinciales(modal.parentId).then(setProvincialeList);
      }
      if (modal.type === "communale") {
        await window.electronAPI.addCoordinationCommunale({
          nom: form.nom, code: form.code, commune_id: form.commune_id, province_id: form.province_id, region_id: form.region_id, parent_id: modal.parentId, description: form.description
        });
        window.electronAPI.getCoordinationCommunales(modal.parentId).then(setCommunaleList);
      }
      if (modal.type === "localite") {
        await window.electronAPI.addLocaliteToCoordinationCommunale({
          localite_id: form.localite_id, coordination_commune_id: modal.parentId
        });
        window.electronAPI.getLocalitesByCoordinationCommunale(modal.parentId).then(setLocaliteList);
      }
      closeModal();
      message.success("Ajouté !");
    } catch (e) {
      message.error("Erreur lors de l'ajout");
    }
  };

  // Render
  return (
    <Card title="Hiérarchie des Coordinations" style={{ margin: 24 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        {/* Régionaux */}
        <div>
          <b>Coordination Régionale :</b>
          <Select
            style={{ minWidth: 220, marginLeft: 8 }}
            placeholder="Sélectionner une coordination régionale"
            value={selectedRegionale}
            onChange={setSelectedRegionale}
            allowClear
          >
            {(regionaleList || []).map(r => (
              <Option key={r.id} value={r.id}>{r.nom} ({(regions || []).find(x => x.id === r.region_id)?.nom || "?"})</Option>
            ))}
          </Select>
          <Button type="primary" style={{ marginLeft: 8 }} onClick={() => openAddModal("regionale")}>Ajouter</Button>
        </div>
        {/* Provinciales */}
        {selectedRegionale && (
          <div>
            <b>Coordination Provinciale :</b>
            <Select
              style={{ minWidth: 220, marginLeft: 8 }}
              placeholder="Sélectionner une coordination provinciale"
              value={selectedProvinciale}
              onChange={setSelectedProvinciale}
              allowClear
            >
              {(provincialeList || []).map(p => (
                <Option key={p.id} value={p.id}>{p.nom} ({(provinces || []).find(x => x.id === p.province_id)?.nom || "?"})</Option>
              ))}
            </Select>
            <Button type="primary" style={{ marginLeft: 8 }} onClick={() => openAddModal("provinciale", selectedRegionale)}>Ajouter</Button>
          </div>
        )}
        {/* Communales */}
        {selectedProvinciale && (
          <div>
            <b>Coordination Communale :</b>
            <Select
              style={{ minWidth: 220, marginLeft: 8 }}
              placeholder="Sélectionner une coordination communale"
              value={selectedCommunale}
              onChange={setSelectedCommunale}
              allowClear
            >
              {(communaleList || []).map(c => (
                <Option key={c.id} value={c.id}>{c.nom} ({(communes || []).find(x => x.id === c.commune_id)?.nom || "?"})</Option>
              ))}
            </Select>
            <Button type="primary" style={{ marginLeft: 8 }} onClick={() => openAddModal("communale", selectedProvinciale)}>Ajouter</Button>
          </div>
        )}
        {/* Localités */}
        {selectedCommunale && (
          <div>
            <b>Localités gérées :</b>
            <Table
              dataSource={localiteList || []}
              columns={[
                { title: "Nom", dataIndex: "localite_nom", key: "localite_nom" },
                { title: "ID", dataIndex: "localite_id", key: "localite_id" }
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
            <Button type="primary" style={{ marginTop: 8 }} onClick={() => openAddModal("localite", selectedCommunale)}>Ajouter une localité</Button>
          </div>
        )}
      </Space>
      {/* Modal d'ajout */}
      <Modal
        open={modal.open}
        title={`Ajouter une coordination ${modal.type || ""}`}
        onCancel={closeModal}
        onOk={handleAdd}
        okText="Valider"
      >
        {modal.type === "regionale" && (
          <>
            <Input placeholder="Nom" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={{ marginBottom: 8 }} />
            <Input placeholder="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={{ marginBottom: 8 }} />
            <Select
              placeholder="Région"
              style={{ width: "100%", marginBottom: 8 }}
              value={form.region_id}
              onChange={v => setForm(f => ({ ...f, region_id: v }))}
            >
              {(regions || []).map(r => <Option key={r.id} value={r.id}>{r.nom}</Option>)}
            </Select>
            <Input.TextArea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </>
        )}
        {modal.type === "provinciale" && (
          <>
            <Input placeholder="Nom" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={{ marginBottom: 8 }} />
            <Input placeholder="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={{ marginBottom: 8 }} />
            <Select
              placeholder="Province"
              style={{ width: "100%", marginBottom: 8 }}
              value={form.province_id}
              onChange={v => setForm(f => ({ ...f, province_id: v }))}
            >
              {(provinces || []).map(p => <Option key={p.id} value={p.id}>{p.nom}</Option>)}
            </Select>
            <Select
              placeholder="Région"
              style={{ width: "100%", marginBottom: 8 }}
              value={form.region_id}
              onChange={v => setForm(f => ({ ...f, region_id: v }))}
            >
              {(regions || []).map(r => <Option key={r.id} value={r.id}>{r.nom}</Option>)}
            </Select>
            <Input.TextArea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </>
        )}
        {modal.type === "communale" && (
          <>
            <Input placeholder="Nom" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={{ marginBottom: 8 }} />
            <Input placeholder="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={{ marginBottom: 8 }} />
            <Select
              placeholder="Commune"
              style={{ width: "100%", marginBottom: 8 }}
              value={form.commune_id}
              onChange={v => setForm(f => ({ ...f, commune_id: v }))}
            >
              {(communes || []).map(c => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
            </Select>
            <Select
              placeholder="Province"
              style={{ width: "100%", marginBottom: 8 }}
              value={form.province_id}
              onChange={v => setForm(f => ({ ...f, province_id: v }))}
            >
              {(provinces || []).map(p => <Option key={p.id} value={p.id}>{p.nom}</Option>)}
            </Select>
            <Select
              placeholder="Région"
              style={{ width: "100%", marginBottom: 8 }}
              value={form.region_id}
              onChange={v => setForm(f => ({ ...f, region_id: v }))}
            >
              {(regions || []).map(r => <Option key={r.id} value={r.id}>{r.nom}</Option>)}
            </Select>
            <Input.TextArea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </>
        )}
        {modal.type === "localite" && (
          <>
            <Select
              placeholder="Localité"
              style={{ width: "100%", marginBottom: 8 }}
              value={form.localite_id}
              onChange={v => setForm(f => ({ ...f, localite_id: v }))}
            >
              {(localites || []).map(l => <Option key={l.id} value={l.id}>{l.nom}</Option>)}
            </Select>
          </>
        )}
      </Modal>
    </Card>
  );
}
