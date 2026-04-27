import React, { useEffect, useState, useCallback } from "react";
import { Form, Input, Select, Button, message, Modal } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import "./CoordinationCommunaleForm.css";

const { Option } = Select;

function getPreposition(nomCommune) {
  if (!nomCommune) return "DE";
  if (/^(les|des|aux)\b/i.test(nomCommune)) return "DES";
  if (/^(le|du)\b/i.test(nomCommune)) return "DU";
  if (/^(la|de la|l')/i.test(nomCommune) || /^[aeiouyâêîôûéèëïüœ]/i.test(nomCommune)) return "DE LA";
  return "DE";
}

export default function CoordinationCommunaleForm({ initialValues = {}, onSuccess }) {
  const [form] = Form.useForm();
  const [coordProvinciales, setCoordProvinciales] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [filteredCommunes, setFilteredCommunes] = useState([]);
  const [regions, setRegions] = useState([]); // <-- Correction ici
  const [provinces, setProvinces] = useState([]); // <-- Ajout ici
  const [localites, setLocalites] = useState([]);
  const [entites, setEntites] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  // Correction : charge toutes les coordinations provinciales
  const loadCoordProvinciales = useCallback(async () => {
    let data = [];
    if (window.electronAPI?.getCoordinationProvinciales) {
      // Si besoin, tu peux passer un paramètre pour filtrer par régionale
      data = await window.electronAPI.getCoordinationProvinciales();
    } else if (window.electronAPI?.getCoordinationProvincialeList) {
      data = await window.electronAPI.getCoordinationProvincialeList();
    }
    setCoordProvinciales(Array.isArray(data) ? data : []);
  }, []);

  // Charger toutes les communes
  const loadCommunes = useCallback(async () => {
    const data = await window.electronAPI.getCommunes();
    setCommunes(Array.isArray(data) ? data : []);
  }, []);

  // Charger les régions (correction)
  const loadRegions = useCallback(async () => {
    const data = await window.electronAPI.getRegions?.();
    setRegions(Array.isArray(data) ? data : []);
  }, []);

  // Charger toutes les provinces
  const loadProvinces = useCallback(async () => {
    const data = await window.electronAPI.getProvinces?.();
    setProvinces(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadCoordProvinciales();
    loadCommunes();
    loadRegions();
    loadProvinces(); // <-- Ajout ici
  }, [loadCoordProvinciales, loadCommunes, loadRegions, loadProvinces]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      window.electronAPI.getCoordinationCommunaleById(id)
        .then(data => {
          if (data) {
            form.setFieldsValue(data);
            if (data.localite_ids) {
              form.setFieldsValue({ localite_ids: data.localite_ids });
            }
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, form]);

  // Ajoute ce useEffect pour générer le code automatiquement
  useEffect(() => {
    const nom = form.getFieldValue("nom");
    const region_id = form.getFieldValue("region_id");
    const province_id = form.getFieldValue("province_id");
    if (nom && region_id && province_id && !form.getFieldValue("code")) {
      let codeRegion = "";
      let codeProvince = "";
      if (regions && regions.length) {
        const reg = regions.find(r => r.id === region_id);
        codeRegion = reg?.code || "";
      }
      if (provinces && provinces.length) {
        const prov = provinces.find(p => p.id === province_id);
        codeProvince = prov?.code || "";
      }
      let codeCommune = "";
      const parts = nom.trim().split(/[\s\-]+/);
      if (parts.length === 1) {
        codeCommune = parts[0].substring(0, 2).toUpperCase();
      } else {
        codeCommune = parts.map(w => w[0]).join("").toUpperCase();
      }
      form.setFieldsValue({ code: `CR-${codeRegion}-${codeProvince}-${codeCommune}` });
    }
  }, [form.getFieldValue("nom"), form.getFieldValue("region_id"), form.getFieldValue("province_id"), regions, provinces]);

  // Filtrer les communes selon la province de la coordination provinciale sélectionnée
  const handleCoordProvincialeChange = (coordProvincialeId) => {
    const coord = coordProvinciales.find(c => c.id === coordProvincialeId);
    if (!coord) {
      setFilteredCommunes([]);
      form.setFieldsValue({ commune_id: undefined, nom: "", code: "" });
      return;
    }
    const filtered = communes.filter(c => String(c.province_id) === String(coord.province_id));
    setFilteredCommunes(filtered);
    form.setFieldsValue({ commune_id: undefined, nom: "", code: "" });
  };

  // Lorsqu'on sélectionne une commune, génère le nom et le code automatiquement
  const handleCommuneChange = (communeId) => {
    const commune = communes.find(c => c.id === communeId);
    if (!commune) {
      form.setFieldsValue({ nom: "", code: "" });
      return;
    }
    const prepo = getPreposition(commune.nom);
    const nom = `COORDINATION COMMUNALE ${prepo} ${commune.nom.toUpperCase()}`;
    const coordProvincialeId = form.getFieldValue("parent_id");
    const coordProvinciale = coordProvinciales.find(c => c.id === coordProvincialeId);
    const code = [
      (coordProvinciale?.code || coordProvinciale?.nom || "").toUpperCase(),
      (commune.code || commune.nom || "").toUpperCase()
    ].filter(Boolean).join('-');
    form.setFieldsValue({ nom, code });
  };

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      const coordProvinciale = coordProvinciales.find(c => c.id === values.parent_id);
      const commune = communes.find(c => c.id === values.commune_id);
      const province_id = coordProvinciale?.province_id;
      const region_id = coordProvinciale?.region_id;
      let code = values.code?.trim();
      if (!code) {
        code = [
          (coordProvinciale?.code || coordProvinciale?.nom || "").toUpperCase(),
          (commune?.code || commune?.nom || "").toUpperCase()
        ].filter(Boolean).join('-');
      }
      const payload = {
        nom: values.nom?.trim() || "",
        code,
        commune_id: values.commune_id,
        province_id,
        region_id,
        parent_id: values.parent_id,
        description: values.description?.trim() || "",
        entite_id: values.entite_id,
      };
      if (!payload.nom || !payload.code || !payload.commune_id || !payload.province_id || !payload.region_id || !payload.parent_id) {
        Modal.error({ title: "Champs obligatoires manquants", content: "nom, code, commune, province, région, coordination provinciale" });
        setLoading(false);
        return;
      }
      await window.electronAPI.addCoordinationCommunale(payload);
      message.success("Coordination communale ajoutée !");
      if (onSuccess) onSuccess();
    } catch (e) {
      Modal.error({ title: "Erreur lors de l'enregistrement", content: e?.message || "Erreur inconnue" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bridge = window.electronAPI || window.api || {};
    const loadEntites = async () => {
      try {
        const list =
          (await bridge.getEntitesList?.()) ??
          (await bridge.getEntites?.()) ??
          [];
        setEntites(Array.isArray(list) ? list : []);
      } catch {
        setEntites([]);
      }
    };
    loadEntites();
  }, []);

  return (
    <div className="coordination-communale-form">
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleFinish}
      >
        <Button
          type="default"
          style={{ marginBottom: 16 }}
          onClick={() => navigate("/dashboard/coordinations/communale")}
        >
          Retour à la liste
        </Button>
        <Form.Item
          label="Coordination provinciale"
          name="parent_id"
          rules={[{ required: true, message: "Sélectionnez une coordination provinciale" }]}
        >
          <Select
            placeholder="Sélectionnez une coordination provinciale"
            onChange={handleCoordProvincialeChange}
            allowClear
            showSearch
            optionFilterProp="children"
            loading={coordProvinciales.length === 0}
          >
            {coordProvinciales.map(cp => (
              <Option key={cp.id} value={cp.id}>{cp.nom}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          label="Commune"
          name="commune_id"
          rules={[{ required: true, message: "Sélectionnez une commune" }]}
        >
          <Select
            placeholder="Sélectionnez une commune"
            allowClear
            onChange={handleCommuneChange}
            showSearch
            optionFilterProp="children"
          >
            {filteredCommunes.map(c => (
              <Option key={c.id} value={c.id}>{c.nom} ({c.code})</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          label="Nom"
          name="nom"
          rules={[{ required: true, message: "Nom requis" }]}
        >
          <Input disabled />
        </Form.Item>
        <Form.Item
          label="Code (laissé vide pour auto-générer)"
          name="code"
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
        >
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          label="Localités"
          name="localite_ids"
          rules={[{ required: true, message: "Veuillez sélectionner au moins une localité" }]}
        >
          <Select
            mode="multiple"
            placeholder="Sélectionnez une ou plusieurs localités"
            optionFilterProp="children"
            showSearch
            filterOption={(input, option) =>
              (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
            }
          >
            {localites.map((loc) => (
              <Select.Option key={loc.id} value={loc.id}>
                {loc.nom}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="entite_id"
          label="Entité de rattachement"
          rules={[{ required: true, message: "Sélectionnez l'entité porteuse" }]}
        >
          <Select placeholder="Choisir une entité">
            {entites.map((entite) => (
              <Option key={entite.id} value={entite.id}>
                {entite.nom || entite.code || `Entité #${entite.id}`}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Enregistrer
          </Button>
        </Form.Item>
        <Button
          type="default"
          style={{ marginTop: 8 }}
          onClick={() => navigate("/dashboard/coordinations/communale")}
        >
          Retour à la liste
        </Button>
      </Form>
    </div>
  );
}
