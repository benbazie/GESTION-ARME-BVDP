import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Form,
  Input,
  Button,
  Select,
  DatePicker,
  Card,
  Typography,
  message,
  Row,
  Col,
  Space,
  Divider,
} from "antd";
import {
  SaveOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import moment from "moment";
import api from '../api';

const { Title } = Typography;
const { Option } = Select;

/**
 * Formulaire d'arme intégré (embedded) pour être utilisé dans un modal
 * @param {function} onSuccess - Callback appelé après création réussie avec l'arme créée
 * @param {function} onCancel - Callback pour fermer le formulaire
 */
export default function ArmeFormEmbedded({ onSuccess, onCancel }) {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lookups
  const [configArmes, setConfigArmes] = useState([]);
  const [sourcesArmement, setSourcesArmement] = useState([]);
  const [entites, setEntites] = useState([]);
  const [regions, setRegions] = useState([]);
  const [allProvinces, setAllProvinces] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [allCommunes, setAllCommunes] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [sousEntites, setSousEntites] = useState([]);
  const [coordinationRegionales, setCoordinationRegionales] = useState([]);
  const [coordinationProvinciales, setCoordinationProvinciales] = useState([]);
  const [coordinationCommunales, setCoordinationCommunales] = useState([]);
  const [coordinationLocales, setCoordinationLocales] = useState([]);
  const [secondLevelOptions, setSecondLevelOptions] = useState([]);

  // Cascade config
  const [uniqueTypes, setUniqueTypes] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableConfigurations, setAvailableConfigurations] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState(null);

  const typeValue = Form.useWatch('type', form);
  const categorieValue = Form.useWatch('categorie', form);
  const configValue = Form.useWatch('config_arme_id', form);
  const currentEntiteId = Form.useWatch("entite_id", form);
  const currentCoordinationRegionaleId = Form.useWatch("coordination_regionale_id", form);
  const currentCoordinationProvincialeId = Form.useWatch("coordination_provinciale_id", form);
  const currentCoordinationCommunaleId = Form.useWatch("coordination_communale_id", form);

  // Load lookups - corriger le chargement des sources
  useEffect(() => {
    (async () => {
      try {
        const [cfgs, ents, regs, provs, comms, coordRegs, sources] = await Promise.all([
          api.getConfigArmeList?.() || [],
          api.getEntiteList?.() || api.getEntitesList?.() || [],
          api.getRegionsList?.() || [],
          api.getProvincesList?.() || [],
          api.getCommunesList?.() || [],
          api.getCoordinationRegionaleList?.() || [],
          api.getSourcesArmement?.() || api.getSourcesArmesList?.() || [],
        ]);
        setConfigArmes(Array.isArray(cfgs) ? cfgs : cfgs?.rows || []);
        setUniqueTypes(Array.from(new Set((Array.isArray(cfgs) ? cfgs : cfgs?.rows || []).map(c => c.type).filter(Boolean))));
        setEntites(Array.isArray(ents) ? ents : ents?.rows || []);
        setRegions(Array.isArray(regs) ? regs : regs?.rows || []);
        setAllProvinces(Array.isArray(provs) ? provs : provs?.rows || []);
        setProvinces(Array.isArray(provs) ? provs : provs?.rows || []);
        setAllCommunes(Array.isArray(comms) ? comms : comms?.rows || []);
        setCommunes(Array.isArray(comms) ? comms : comms?.rows || []);
        setCoordinationRegionales(Array.isArray(coordRegs) ? coordRegs : coordRegs?.rows || []);
        // Normaliser les sources
        const srcList = Array.isArray(sources) ? sources : sources?.rows || [];
        setSourcesArmement(srcList);
        console.log('[ArmeFormEmbedded] Sources chargées:', srcList.length);
      } catch (err) {
        console.error("Chargement lookups:", err);
        message.error("Erreur chargement données de référence");
      }
    })();
  }, []);

  // Type change cascade
  useEffect(() => {
    if (!typeValue) {
      setAvailableCategories([]);
      setAvailableConfigurations([]);
      setSelectedConfigId(null);
      return;
    }
    const categories = Array.from(
      new Set(configArmes.filter(cfg => cfg.type === typeValue).map(cfg => cfg.categorie).filter(Boolean))
    );
    setAvailableCategories(categories);
    if (categorieValue && !categories.includes(categorieValue)) {
      form.setFieldsValue({ categorie: undefined, config_arme_id: undefined, designation: undefined });
    }
  }, [typeValue, categorieValue, configArmes, form]);

  // Categorie change cascade
  useEffect(() => {
    if (!typeValue || !categorieValue) {
      setAvailableConfigurations([]);
      setSelectedConfigId(null);
      return;
    }
    const configs = configArmes.filter(cfg => cfg.type === typeValue && cfg.categorie === categorieValue);
    setAvailableConfigurations(configs);
    if (configValue && !configs.some(cfg => cfg.id === configValue)) {
      form.setFieldsValue({ config_arme_id: undefined, designation: undefined });
    }
  }, [typeValue, categorieValue, configValue, configArmes, form]);

  // Config change cascade
  useEffect(() => {
    setSelectedConfigId(configValue || null);
    if (!configValue) return;
    const cfg = configArmes.find(item => item.id === configValue);
    if (cfg?.designation) {
      form.setFieldsValue({ designation: cfg.designation });
    }
  }, [configValue, configArmes, form]);

  const buildSecondLevelOptions = useCallback((sousList = [], coordList = []) => {
    const sousOpts = sousList.map((s) => ({ value: `sous:${s.id}`, label: s.nom }));
    const coordOpts = coordList.map((c) => ({ value: `coord:${c.id}`, label: c.nom }));
    return [...sousOpts, ...coordOpts];
  }, []);

  const loadSousEntites = useCallback(async (entiteId) => {
    if (!entiteId) {
      setSousEntites([]);
      return [];
    }
    try {
      const rows = await api.getSousEntitesList?.({ entite_id: entiteId }) || [];
      const list = Array.isArray(rows) ? rows : rows?.rows || [];
      setSousEntites(list);
      return list;
    } catch {
      setSousEntites([]);
      return [];
    }
  }, []);

  const loadCoordinationRegionales = useCallback(async (entiteId) => {
    if (!entiteId) {
      setCoordinationRegionales([]);
      return [];
    }
    try {
      const list = await api.getCoordinationRegionaleList?.({ entite_id: entiteId }) || [];
      const rows = Array.isArray(list) ? list : [];
      setCoordinationRegionales(rows);
      return rows;
    } catch {
      setCoordinationRegionales([]);
      return [];
    }
  }, []);

  const loadCoordinationProvinciales = useCallback(async (coordRegionaleId) => {
    if (!coordRegionaleId) {
      setCoordinationProvinciales([]);
      return [];
    }
    try {
      const list = await api.getCoordinationProvincialeList?.({ parent_id: coordRegionaleId }) || [];
      setCoordinationProvinciales(Array.isArray(list) ? list : []);
      return Array.isArray(list) ? list : [];
    } catch {
      setCoordinationProvinciales([]);
      return [];
    }
  }, []);

  const loadCoordinationCommunales = useCallback(async (coordProvincialeId) => {
    if (!coordProvincialeId) {
      setCoordinationCommunales([]);
      return [];
    }
    try {
      const list = await api.getCoordinationCommunaleList?.({ parent_id: coordProvincialeId }) || [];
      setCoordinationCommunales(Array.isArray(list) ? list : []);
      return Array.isArray(list) ? list : [];
    } catch {
      setCoordinationCommunales([]);
      return [];
    }
  }, []);

  const loadCoordinationLocales = useCallback(async (coordCommunaleId) => {
    if (!coordCommunaleId) {
      setCoordinationLocales([]);
      return [];
    }
    try {
      const list = await api.getLocalitesByCoordinationCommunale?.(coordCommunaleId) || [];
      setCoordinationLocales(Array.isArray(list) ? list : []);
      return Array.isArray(list) ? list : [];
    } catch {
      setCoordinationLocales([]);
      return [];
    }
  }, []);

  // Entité change cascade
  useEffect(() => {
    if (!currentEntiteId) {
      setSousEntites([]);
      setCoordinationRegionales([]);
      setSecondLevelOptions([]);
      return;
    }
    (async () => {
      const [sousList, coordList] = await Promise.all([
        loadSousEntites(currentEntiteId),
        loadCoordinationRegionales(currentEntiteId),
      ]);
      setSecondLevelOptions(buildSecondLevelOptions(sousList, coordList));
    })();
  }, [currentEntiteId, loadSousEntites, loadCoordinationRegionales, buildSecondLevelOptions]);

  useEffect(() => {
    if (!currentCoordinationRegionaleId) {
      setCoordinationProvinciales([]);
      return;
    }
    loadCoordinationProvinciales(currentCoordinationRegionaleId);
  }, [currentCoordinationRegionaleId, loadCoordinationProvinciales]);

  useEffect(() => {
    if (!currentCoordinationProvincialeId) {
      setCoordinationCommunales([]);
      return;
    }
    loadCoordinationCommunales(currentCoordinationProvincialeId);
  }, [currentCoordinationProvincialeId, loadCoordinationCommunales]);

  useEffect(() => {
    if (!currentCoordinationCommunaleId) {
      setCoordinationLocales([]);
      return;
    }
    loadCoordinationLocales(currentCoordinationCommunaleId);
  }, [currentCoordinationCommunaleId, loadCoordinationLocales]);

  const handleEntiteSelect = useCallback(async (entiteId) => {
    form.setFieldsValue({
      sous_entite_id: undefined,
      coordination_regionale_id: undefined,
      coordination_provinciale_id: undefined,
      coordination_communale_id: undefined,
      coordination_locale_id: undefined,
      second_level_choice: undefined,
    });
    if (!entiteId) {
      setSousEntites([]);
      setCoordinationRegionales([]);
      setSecondLevelOptions([]);
      return;
    }
    const [sousList, coordList] = await Promise.all([
      loadSousEntites(entiteId),
      loadCoordinationRegionales(entiteId),
    ]);
    setSecondLevelOptions(buildSecondLevelOptions(sousList, coordList));
  }, [form, loadSousEntites, loadCoordinationRegionales, buildSecondLevelOptions]);

  const handleSecondLevelSelect = useCallback(async (rawValue) => {
    form.setFieldsValue({
      second_level_choice: rawValue || undefined,
      sous_entite_id: undefined,
      coordination_regionale_id: undefined,
      coordination_provinciale_id: undefined,
      coordination_communale_id: undefined,
      coordination_locale_id: undefined,
    });
    if (!rawValue) return;
    const [kind, id] = rawValue.split(":");
    const parsedId = Number(id);
    if (kind === "sous") {
      form.setFieldsValue({ sous_entite_id: parsedId });
      return;
    }
    if (kind === "coord") {
      form.setFieldsValue({ coordination_regionale_id: parsedId });
      await loadCoordinationProvinciales(parsedId);
    }
  }, [form, loadCoordinationProvinciales]);

  const handleRegionChange = useCallback((regionId) => {
    form.setFieldsValue({ province_id: undefined, commune_id: undefined, localite_id: undefined });
    if (!regionId) {
      setProvinces(allProvinces);
      setCommunes(allCommunes);
      setLocalites([]);
      return;
    }
    const filtered = allProvinces.filter(p => String(p.region_id) === String(regionId));
    setProvinces(filtered);
    const provinceIds = new Set(filtered.map(p => String(p.id)));
    setCommunes(allCommunes.filter(c => provinceIds.has(String(c.province_id))));
    setLocalites([]);
  }, [allProvinces, allCommunes, form]);

  const handleProvinceChange = useCallback((provinceId) => {
    form.setFieldsValue({ commune_id: undefined, localite_id: undefined });
    if (!provinceId) {
      setCommunes(allCommunes);
      setLocalites([]);
      return;
    }
    setCommunes(allCommunes.filter(c => String(c.province_id) === String(provinceId)));
    setLocalites([]);
  }, [allCommunes, form]);

  const handleCommuneChange = useCallback(async (communeId) => {
    form.setFieldsValue({ localite_id: undefined });
    if (!communeId) {
      setLocalites([]);
      return;
    }
    try {
      const locs = await api.getLocalitesList?.({ commune_id: communeId }) || [];
      setLocalites(Array.isArray(locs) ? locs : []);
    } catch {
      setLocalites([]);
    }
  }, [form]);

  const handleTypeChange = useCallback(() => {
    form.setFieldsValue({ categorie: undefined, config_arme_id: undefined, designation: undefined });
    setAvailableConfigurations([]);
    setSelectedConfigId(null);
  }, [form]);

  const handleCategorieChange = useCallback(() => {
    form.setFieldsValue({ config_arme_id: undefined, designation: undefined });
    setSelectedConfigId(null);
  }, [form]);

  const handleConfigChange = useCallback((configId) => {
    setSelectedConfigId(configId || null);
    if (!configId) {
      form.setFieldsValue({ designation: undefined });
      return;
    }
    const cfg = configArmes.find(item => item.id === configId);
    if (cfg?.designation) {
      form.setFieldsValue({ designation: cfg.designation });
    }
  }, [form, configArmes]);

  const onFinish = async (values) => {
    setIsSubmitting(true);
    try {
      const cfg = configArmes.find(c => c.id === selectedConfigId);
      const payload = {
        ...values,
        designation: cfg?.designation || values.designation,
        config_arme_id: selectedConfigId || null,
        source_arme_id: values.source_arme_id || null,
        date_entree: values.date_entree ? values.date_entree.format("YYYY-MM-DD") : null,
        statut: "non dotée", // Arme créée non dotée par défaut
        position: values.position || "MAGASIN",
        mobilite: values.mobilite || "normale",
      };

      // Création via API
      let result;
      try {
        result = await api.createArme?.(payload);
      } catch (err) {
        // Fallback via electronAPI
        if (window.electronAPI?.createArme) {
          result = await window.electronAPI.createArme(payload);
        } else {
          throw err;
        }
      }

      const createdArme = {
        id: result?.id ?? result?.insertId ?? result?.lastID,
        ...payload,
        ...result,
      };

      message.success("Arme créée avec succès");
      
      if (typeof onSuccess === 'function') {
        onSuccess(createdArme);
      }
    } catch (err) {
      console.error("[ArmeFormEmbedded] Erreur création:", err);
      message.error(err?.response?.data?.error || err?.message || "Erreur lors de la création de l'arme");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        statut: "non dotée",
        position: "MAGASIN",
        mobilite: "normale",
        etat: "Bon État",
      }}
    >
      <Title level={5} style={{ marginBottom: 16 }}>Nouvelle arme</Title>

      {/* Numéro de série */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="numero_serie"
            label="Numéro de série"
            rules={[{ required: true, message: "Le numéro de série est requis" }]}
          >
            <Input placeholder="Ex: SN12345" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="designation" label="Désignation (auto)">
            <Input disabled placeholder="Sera rempli automatiquement" />
          </Form.Item>
        </Col>
      </Row>

      {/* Configuration (Type → Catégorie → Modèle) */}
      <Divider orientation="left">Configuration</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: "Le type est requis" }]}
          >
            <Select placeholder="Type d'arme" onChange={handleTypeChange} allowClear>
              {uniqueTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="categorie"
            label="Catégorie"
            rules={[{ required: true, message: "La catégorie est requise" }]}
          >
            <Select
              placeholder="Catégorie"
              onChange={handleCategorieChange}
              disabled={!typeValue}
              allowClear
            >
              {availableCategories.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="config_arme_id"
            label="Modèle"
            rules={[{ required: true, message: "Le modèle est requis" }]}
          >
            <Select
              placeholder="Modèle"
              onChange={handleConfigChange}
              disabled={!categorieValue}
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {availableConfigurations.map(cfg => (
                <Option key={cfg.id} value={cfg.id}>
                  {cfg.designation}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {/* Rattachement */}
      <Divider orientation="left">Rattachement</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            name="entite_id"
            label="Entité"
            rules={[{ required: true, message: "L'entité est requise" }]}
          >
            <Select
              placeholder="Entité"
              onChange={handleEntiteSelect}
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {entites.map(e => <Option key={e.id} value={e.id}>{e.nom}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="second_level_choice" label="Sous-entité / Coordination">
            <Select
              placeholder="Sous-entité ou coordination"
              onChange={handleSecondLevelSelect}
              disabled={!currentEntiteId}
              allowClear
            >
              {secondLevelOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="source_arme_id" label="Source d'armement" rules={[{ required: true }]}>
            <Select placeholder="Source" showSearch optionFilterProp="children" allowClear>
              {sourcesArmement.map(src => (
                <Option key={src.id} value={src.id}>
                  {src.nom || src.designation || `Source #${src.id}`}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {/* Coordination cascade (si sélectionnée) */}
      {coordinationProvinciales.length > 0 && (
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="coordination_provinciale_id" label="Coord. provinciale">
              <Select placeholder="Coordination provinciale" allowClear>
                {coordinationProvinciales.map(c => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          {coordinationCommunales.length > 0 && (
            <Col xs={24} md={8}>
              <Form.Item name="coordination_communale_id" label="Coord. communale">
                <Select placeholder="Coordination communale" allowClear>
                  {coordinationCommunales.map(c => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          )}
          {coordinationLocales.length > 0 && (
            <Col xs={24} md={8}>
              <Form.Item name="coordination_locale_id" label="Localité">
                <Select placeholder="Localité" allowClear>
                  {coordinationLocales.map(l => <Option key={l.id} value={l.id}>{l.nom}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>
      )}

      {/* Localisation géographique */}
      <Divider orientation="left">Localisation géographique</Divider>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item name="region_id" label="Région">
            <Select
              placeholder="Région"
              onChange={handleRegionChange}
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {regions.map(r => <Option key={r.id} value={r.id}>{r.nom}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="province_id" label="Province">
            <Select
              placeholder="Province"
              onChange={handleProvinceChange}
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {provinces.map(p => <Option key={p.id} value={p.id}>{p.nom}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="commune_id" label="Commune">
            <Select
              placeholder="Commune"
              onChange={handleCommuneChange}
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {communes.map(c => <Option key={c.id} value={c.id}>{c.nom}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="localite_id" label="Localité">
            <Select placeholder="Localité" showSearch optionFilterProp="children" allowClear>
              {localites.map(l => <Option key={l.id} value={l.id}>{l.nom}</Option>)}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {/* État et position */}
      <Divider orientation="left">État et position</Divider>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item name="etat" label="État" rules={[{ required: true }]}>
            <Select placeholder="État">
              <Option value="Bon État">Bon État</Option>
              <Option value="Mauvais État Réparable">Mauvais État Réparable</Option>
              <Option value="Mauvais État Non Réparable">Mauvais État Non Réparable</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="position" label="Position">
            <Select placeholder="Position">
              <Option value="MAGASIN">En magasin</Option>
              <Option value="REPARATION">En réparation</Option>
              <Option value="OPERATION">En opération</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="mobilite" label="Mobilité">
            <Select placeholder="Mobilité">
              <Option value="normale">Normale</Option>
              <Option value="emportee">Emportée</Option>
              <Option value="recuperee">Récupérée</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="date_entree" label="Date d'entrée">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Col>
      </Row>

      {/* Hidden fields for cascade */}
      <Form.Item name="sous_entite_id" hidden><Input /></Form.Item>
      <Form.Item name="coordination_regionale_id" hidden><Input /></Form.Item>

      {/* Actions */}
      <Divider />
      <Row justify="end">
        <Space>
          <Button icon={<CloseOutlined />} onClick={onCancel}>
            Annuler
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            htmlType="submit"
            loading={isSubmitting}
          >
            Créer l'arme
          </Button>
        </Space>
      </Row>
    </Form>
  );
}
