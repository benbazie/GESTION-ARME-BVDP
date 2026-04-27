import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Progress,
  Modal,
  Space,
  Divider,
  Checkbox,
  Result,
  Radio,
  Descriptions
} from "antd";
import {
  AimOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  RadarChartOutlined
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import VdpForm from "./VdpForm";
import "./ArmeForm.css";
import api from '../api';

const { Title, Text } = Typography;
const { Option } = Select;

const REQUIRED_FIELDS = [
  { name: "numero_serie", label: "Numéro de série" },
  { name: "type", label: "Type d'arme" },
  { name: "categorie", label: "Catégorie" },
  { name: "config_arme_id", label: "Modèle" },
  { name: "entite_id", label: "Entité" },
  { name: "source_arme_id", label: "Source d’armement" },
  { name: "statut", label: "Statut" },
  { name: "etat", label: "État" }
];

export default function ArmeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const mountedRef = useRef(true);

  // Définition de isEditMode - doit être ici, avant tout useCallback qui l'utilise
  const isEditMode = !!id && id !== "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [formValues, setFormValues] = useState(null);
  // progress
  const [progressPercent, setProgressPercent] = useState(0);
  // Gestion des doublons
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [dupModalVisible, setDupModalVisible] = useState(false);
  const [dupRecord, setDupRecord] = useState(null);
  const [dupResolutionSerial, setDupResolutionSerial] = useState("");

  // lookups
  const [configArmes, setConfigArmes] = useState([]);
  const [sourcesArmement, setSourcesArmement] = useState([]);
  const [entites, setEntites] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [allProvinces, setAllProvinces] = useState([]);
  const [allCommunes, setAllCommunes] = useState([]);
  const [positions, setPositions] = useState([
    { code: "MAGASIN", label: "En magasin" },
    { code: "REPARATION", label: "En réparation" },
    { code: "OPERATION", label: "En opération" },
    { code: "HORSUSAGE", label: "Hors usage" },
   
  ]);
  const [mobiliteOptions] = useState([
    { value: "normale", label: "Normale" },
    { value: "emportee", label: "Emportée" },
    { value: "recuperee", label: "Récupérée" },
  ]);
  const [rattachementMode, setRattachementMode] = useState("sous_entite");
  const [coordinationRegionales, setCoordinationRegionales] = useState([]);
  const [coordinationProvinciales, setCoordinationProvinciales] = useState([]);
  const [coordinationCommunales, setCoordinationCommunales] = useState([]);
  const [coordinationLocales, setCoordinationLocales] = useState([]);
  const [coordinations, setCoordinations] = useState([]);
  const [sousCoordinations, setSousCoordinations] = useState([]);
  const [selectedCoordination, setSelectedCoordination] = useState(null);

  // cascade
  const [uniqueTypes, setUniqueTypes] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableConfigurations, setAvailableConfigurations] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedConfigId, setSelectedConfigId] = useState(null);

  // UI & modals
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVdpForm, setShowVdpForm] = useState(false);
  const [createdRecord, setCreatedRecord] = useState(null);
  const [quickStats, setQuickStats] = useState({ today: 0, week: 0, month: 0, since: 0 });
  const statsSinceRef = useRef(moment().startOf("year"));
  const entiteSelectionRef = useRef(false);

  const typeValue = Form.useWatch('type', form);
  const categorieValue = Form.useWatch('categorie', form);
  const configValue = Form.useWatch('config_arme_id', form);
  const rattachementChoiceValue = Form.useWatch("rattachement_choice", form);
  const statutValue = Form.useWatch("statut", form);
  const sousEntiteValue = Form.useWatch("sous_entite_id", form);
  const coordProvValue = Form.useWatch("coordination_provinciale_id", form);
  const coordCommValue = Form.useWatch("coordination_communale_id", form);
  const coordLocaleValue = Form.useWatch("coordination_locale_id", form);
  const regionValue = Form.useWatch("region_id", form);
  const provinceValue = Form.useWatch("province_id", form);
  const localiteValue = Form.useWatch("localite_id", form);
  const secondLevelChoiceValue = Form.useWatch("second_level_choice", form);

  // template
  const [entryTemplate, setEntryTemplate] = useState(null);
  const [sousEntites, setSousEntites] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [mixedChildren, setMixedChildren] = useState([]);
  const [mixedLookup, setMixedLookup] = useState(new Map());
  const [coordProv, setCoordProv] = useState([]);
  const [coordComm, setCoordComm] = useState([]);
  const [coordLocalites, setCoordLocalites] = useState([]);
  const [selection, setSelection] = useState({ level: null, id: null });
  const [rattachementOptions, setRattachementOptions] = useState([]);
  const [secondLevelOptions, setSecondLevelOptions] = useState([]);

  const buildSecondLevelOptions = useCallback((sousList = [], coordList = []) => {
    const sousOpts = sousList.map((s) => ({ value: `sous:${s.id}`, label: s.nom }));
    const coordOpts = coordList.map((c) => ({ value: `coord:${c.id}`, label: c.nom }));
    return [...sousOpts, ...coordOpts];
  }, []);

  const syncSecondLevelOptions = useCallback((sousList = [], coordList = []) => {
    setSecondLevelOptions(buildSecondLevelOptions(sousList, coordList));
  }, [buildSecondLevelOptions]);

  const safeGet = useCallback(async (factory) => {
    if (typeof factory !== 'function') return null;
    try {
      const result = await factory();
      return result ?? null;
    } catch (error) {
      console.warn('[ArmeForm] safeGet:', error?.message || error);
      return null;
    }
  }, []);

  const normalizeRows = useCallback((payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }, []);

  const callDataSources = useCallback(async (methodVariants = [], argVariants = [[]]) => {
    for (const method of methodVariants) {
      const fn = api[method] || window.electronAPI?.[method];
      if (typeof fn !== "function") continue;
      for (const args of argVariants) {
        try {
          const result = await fn(...args);
          if (result !== undefined && result !== null) return result;
        } catch (err) {
          console.warn(`[${method}] indisponible:`, err?.message || err);
        }
      }
    }
    return null;
  }, []);

  const fetchSousEntitesByEntite = useCallback(async (entiteId) => {
    if (!entiteId) return [];
    const argsMatrix = [
      [entiteId],
      [{ entite_id: entiteId }],
    ];
    const result = await callDataSources(
      ['getSousEntitesByEntite', 'getSousEntitesList', 'getSousEntiteList'],
      argsMatrix
    );
    return normalizeRows(result);
  }, [callDataSources, normalizeRows]);

  const loadSousEntites = useCallback(async (entiteId) => {
    if (!entiteId) {
      setSousEntites([]);
      return [];
    }
    try {
      const rows = await fetchSousEntitesByEntite(entiteId);
      setSousEntites(rows);
      return rows;
    } catch (error) {
      console.warn('[ArmeForm] loadSousEntites:', error?.message || error);
      setSousEntites([]);
      return [];
    }
  }, [fetchSousEntitesByEntite]);

  const loadCoordinationRegionales = useCallback(async (entiteId) => {
    if (!entiteId) {
      setCoordinationRegionales([]);
      return [];
    }
    try {
      const list = await (api.getCoordinationRegionaleList?.({ entite_id: entiteId }) ?? api.getCoordinationRegionales?.({ entite_id: entiteId }) ?? api.getCoordinationRegionales?.());
      const rows = Array.isArray(list) ? list : [];
      setCoordinationRegionales(rows);
      return rows;
    } catch (error) {
      console.warn('[ArmeForm] loadCoordinationRegionales:', error?.message || error);
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
      const list = await api.getCoordinationProvincialeList({ parent_id: coordRegionaleId });
      const rows = Array.isArray(list) ? list : [];
      setCoordinationProvinciales(rows);
      return rows;
    } catch (error) {
      console.warn('[ArmeForm] loadCoordinationProvinciales:', error?.message || error);
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
      const list = await api.getCoordinationCommunaleList({ parent_id: coordProvincialeId });
      const rows = Array.isArray(list) ? list : [];
      setCoordinationCommunales(rows);
      return rows;
    } catch (error) {
      console.warn('[ArmeForm] loadCoordinationCommunales:', error?.message || error);
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
      const list = await api.getLocalitesByCoordinationCommunale(coordCommunaleId);
      const rows = Array.isArray(list) ? list : [];
      setCoordinationLocales(rows);
      return rows;
    } catch (error) {
      console.warn('[ArmeForm] loadCoordinationLocales:', error?.message || error);
      setCoordinationLocales([]);
      return [];
    }
  }, []);

  // utilitaire pour comparer les identifiants en chaîne
  const matchId = useCallback((value) => {
    if (value === undefined || value === null) return null;
    return String(value);
  }, []);

  const loadProvinces = useCallback((regionId) => {
    if (!allProvinces.length) {
      setProvinces([]);
      return [];
    }
    if (!regionId) {
      setProvinces(allProvinces);
      return allProvinces;
    }
    const filtered = allProvinces.filter(
      (province) => String(province.region_id) === String(regionId)
    );
    setProvinces(filtered);
    return filtered;
  }, [allProvinces]);

  const loadCommunes = useCallback((provinceId) => {
    if (!allCommunes.length) {
      setCommunes([]);
      return [];
    }
    if (!provinceId) {
      setCommunes(allCommunes);
      return allCommunes;
    }
    const filtered = allCommunes.filter(
      (commune) => String(commune.province_id) === String(provinceId)
    );
    setCommunes(filtered);
    return filtered;
  }, [allCommunes]);

  const handleRegionChange = useCallback((regionId) => {
    form.setFieldsValue({
      province_id: undefined,
      commune_id: undefined,
      localite_id: undefined,
    });
    const provincesForRegion = loadProvinces(regionId);
    if (!regionId) {
      setCommunes(allCommunes);
      setLocalites([]);
      return;
    }
    const provinceIds = new Set(provincesForRegion.map((p) => String(p.id)));
    const nextCommunes = allCommunes.filter((commune) =>
      provinceIds.has(String(commune.province_id))
    );
    setCommunes(nextCommunes);
    setLocalites([]);
  }, [allCommunes, form, loadProvinces]);

  const handleProvinceChange = useCallback((provinceId) => {
    form.setFieldsValue({
      commune_id: undefined,
      localite_id: undefined,
    });
    loadCommunes(provinceId);
    setLocalites([]);
  }, [form, loadCommunes]);

  const handleCommuneChange = useCallback(async (communeId) => {
    form.setFieldsValue({ localite_id: undefined });
    if (!communeId) {
      setLocalites([]);
      return;
    }
    try {
      const locs = await api.getLocalitesList({ commune_id: communeId });
      setLocalites(Array.isArray(locs) ? locs : []);
    } catch (error) {
      console.warn('[ArmeForm] handleCommuneChange:', error?.message || error);
      setLocalites([]);
    }
  }, [form]);

  const applyGeoFromNode = useCallback(async (node = {}) => {
    const regionId = node?.region_id ?? null;
    const provinceId = node?.province_id ?? null;
    const communeId = node?.commune_id ?? null;

    form.setFieldsValue({
      region_id: regionId || undefined,
      province_id: undefined,
      commune_id: undefined,
      localite_id: undefined,
    });

    handleRegionChange(regionId);
    if (provinceId) {
      form.setFieldsValue({ province_id: provinceId });
      handleProvinceChange(provinceId);
    }
    if (communeId) {
      form.setFieldsValue({ commune_id: communeId });
      await handleCommuneChange(communeId);
    }
  }, [form, handleRegionChange, handleProvinceChange, handleCommuneChange]);

  // observe les sélections clés
  const currentEntiteId = Form.useWatch("entite_id", form);
  const currentCoordinationRegionaleId = Form.useWatch("coordination_regionale_id", form);
  const currentCoordinationProvincialeId = Form.useWatch("coordination_provinciale_id", form);
  const currentCoordinationCommunaleId = Form.useWatch("coordination_communale_id", form);
  const currentCoordinationLocaleId = Form.useWatch("coordination_locale_id", form);
  const currentCommuneId = Form.useWatch("commune_id", form);

  const summaryData = useMemo(() => {
    const entiteLabel = entites.find(e => String(e.id) === String(currentEntiteId))?.nom;
    const coordLabel = coordinationRegionales.find(c => String(c.id) === String(currentCoordinationRegionaleId))?.nom;
    const sousEntiteLabel = sousEntites.find(s => String(s.id) === String(sousEntiteValue))?.nom;
    const coordProvLabel = coordinationProvinciales.find(p => String(p.id) === String(coordProvValue))?.nom;
    const coordCommLabel = coordinationCommunales.find(c => String(c.id) === String(coordCommValue))?.nom;
    const coordLocaleLabel = coordinationLocales.find(l => String(l.id) === String(coordLocaleValue))?.nom;
    const regionLabel = regions.find(r => String(r.id) === String(regionValue))?.nom;
    const provinceLabel = provinces.find(p => String(p.id) === String(provinceValue))?.nom;
    const communeLabel = communes.find(c => String(c.id) === String(currentCommuneId))?.nom;
    const localiteLabel = localites.find(l => String(l.id) === String(localiteValue))?.nom;

    return [
      {
        label: "Rattachement",
        value: entiteLabel ? `Entité • ${entiteLabel}` : coordLabel ? `Coordination • ${coordLabel}` : "—"
      },
      {
        label: "Sous niveau",
        value: entiteLabel
          ? (sousEntiteLabel || "—")
          : [coordProvLabel, coordCommLabel, coordLocaleLabel].filter(Boolean).join(" · ") || "—"
      },
      {
        label: "Localisation",
        value: [regionLabel, provinceLabel, communeLabel, localiteLabel].filter(Boolean).join(" · ") || "—"
      },
      {
        label: "Configuration",
        value: [typeValue, categorieValue, form.getFieldValue("designation")].filter(Boolean).join(" · ") || "—"
      },
      {
        label: "Statut",
        value: statutValue || "—"
      }
    ];
  }, [
    entites,
    coordinationRegionales,
    sousEntites,
    coordinationProvinciales,
    coordinationCommunales,
    coordinationLocales,
    regions,
    provinces,
    communes,
    localites,
    currentEntiteId,
    currentCoordinationRegionaleId,
    sousEntiteValue,
    coordProvValue,
    coordCommValue,
    coordLocaleValue,
    regionValue,
    provinceValue,
    currentCommuneId,
    localiteValue,
    typeValue,
    categorieValue,
    statutValue,
    form
  ]);

  // helpers to call ipc aliases (tries several)
  const ipcCall = async (name, ...args) => {
    try {
      if (window.electronAPI && typeof window.electronAPI[name] === "function") {
        return await window.electronAPI[name](...args);
      }
      if (window.electronAPI && typeof window.electronAPI.invoke === "function") {
        return await window.electronAPI.invoke(name, ...args);
      }
      throw new Error(`IPC ${name} non disponible`);
    } catch (err) {
      throw err;
    }
  };

  const httpCall = async (method, route, payload) => {
    const caller =
      window.electronAPI?.callAPI ||
      window.safeElectronAPI?.callAPI ||
      window.electronAPI?.httpCall ||
      window.safeElectronAPI?.httpCall;
    if (!caller) return null;
    return caller(method, route, payload);
  };

  const nowDate = () => moment().format("YYYY-MM-DD");

  const refreshQuickStats = async () => {
    try {
      const today = moment().format("YYYY-MM-DD");
      const isoWeekStart = moment().startOf("isoWeek").format("YYYY-MM-DD");
      const monthStart = moment().startOf("month").format("YYYY-MM-DD");
      const sinceStart = statsSinceRef.current.format("YYYY-MM-DD");
      const [resToday, resWeek, resMonth, resSince] = await Promise.all([
        ipcCall("getDashboardArmes", { startDate: today, endDate: today }).catch(() => null),
        ipcCall("getDashboardArmes", { startDate: isoWeekStart, endDate: today }).catch(() => null),
        ipcCall("getDashboardArmes", { startDate: monthStart, endDate: today }).catch(() => null),
        ipcCall("getDashboardArmes", { startDate: sinceStart, endDate: today }).catch(() => null),
      ]);
      setQuickStats({
        today: Number(resToday?.total || 0),
        week: Number(resWeek?.total || 0),
        month: Number(resMonth?.total || 0),
        since: Number(resSince?.total || 0),
      });
    } catch (err) {
      console.warn("Impossible d’actualiser les compteurs rapides:", err);
    }
  };

  const buildDupRecord = (record, fallback = {}) => ({
    id: record?.id || null,
    numero_serie: record?.numero_serie || fallback.numero_serie || "—",
    designation: record?.designation || fallback.designation || "—",
    categorie: record?.categorie || fallback.categorie || "—",
    source_arme_id: record?.source_arme_id || fallback.source_arme_id || null,
    entite: record?.entite_id || record?.entite || null,
    date_creation: record?.created_at || record?.createdAt || record?.date_entree || null
  });



  // load lookups
  useEffect(() => {
    (async () => {
      try {
        const [
          cfgs,
          ents,
          regs,
          provs,
          comms,
          coordRegs
        ] = await Promise.all([
          api.getConfigArmeList(),
          api.getEntiteList(),
          api.getRegionsList(),
          api.getProvincesList(),
          api.getCommunesList(),
          api.getCoordinationRegionaleList?.() ?? api.getCoordinationRegionales?.()
        ]);
        setConfigArmes(Array.isArray(cfgs) ? cfgs : []);
        setUniqueTypes(Array.from(new Set((Array.isArray(cfgs) ? cfgs : []).map(c => c.type).filter(Boolean))));
        setEntites(Array.isArray(ents) ? ents : []);
        setRegions(Array.isArray(regs) ? regs : []);
        setProvinces(Array.isArray(provs) ? provs : []);
        const provArray = Array.isArray(provs) ? provs : [];
        setAllProvinces(provArray);
        const commArray = Array.isArray(comms) ? comms : [];
        setAllCommunes(commArray);
        setCoordinationRegionales(Array.isArray(coordRegs) ? coordRegs : []);
        // Charger dynamiquement les positions si besoin
        if (api.getEtatsPositionList) {
          try {
            const posList = await api.getEtatsPositionList();
            if (Array.isArray(posList) && posList.length) {
              setPositions(posList.map(p => ({
                code: p.code,
                label: p.libelle || p.code,
                id: p.id
              })));
            }
          } catch {}
        }
        let sources = [];
        if (api.getSourcesArmeList) {
          sources = await api.getSourcesArmeList();
        } else if (api.getSourcesArmementList) {
          sources = await api.getSourcesArmementList();
        } else {
          sources = await window.electronAPI?.getSourcesArmement?.().catch(() => []);
        }
        setSourcesArmement(Array.isArray(sources?.rows) ? sources.rows : Array.isArray(sources) ? sources : []);
        await refreshQuickStats();
      } catch (err) {
        console.error("Chargement lookups:", err);
        message.error("Erreur chargement données de référence");
      }
    })();
  }, []);
  useEffect(() => {
    if (form.getFieldValue("ownership_type") === "region") {
      if (typeof filterProvinces === "function") filterProvinces(form.getFieldValue("region_id"));
      if (typeof filterCommunes === "function") filterCommunes(form.getFieldValue("province_id"));
    }
    // eslint-disable-next-line
  }, [allProvinces, allCommunes, form]);

  
  // --- Handlers pour le chargement en cascade ---
  const handleRattachementModeChange = useCallback((mode) => {
    setRattachementMode(mode);
    if (mode === "sous_entite") {
      form.setFieldsValue({
        coordination_regionale_id: undefined,
        coordination_provinciale_id: undefined,
        coordination_communale_id: undefined,
        coordination_locale_id: undefined
      });
    } else {
      form.setFieldsValue({ sous_entite_id: undefined });
    }
  }, [form]);

  const handleEntiteSelect = useCallback(async (entiteId) => {
    entiteSelectionRef.current = true;
    try {
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
      syncSecondLevelOptions(sousList, coordList);
      const entiteNode = entites.find((e) => String(e.id) === String(entiteId));
      await applyGeoFromNode(entiteNode);
    } finally {
      entiteSelectionRef.current = false;
    }
  }, [form, loadSousEntites, loadCoordinationRegionales, syncSecondLevelOptions, entites, applyGeoFromNode]);

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
      const node = sousEntites.find((s) => String(s.id) === String(parsedId));
      await applyGeoFromNode(node);
      return;
    }
    if (kind === "coord") {
      form.setFieldsValue({ coordination_regionale_id: parsedId });
      await loadCoordinationProvinciales(parsedId);
      const node = coordinationRegionales.find((c) => String(c.id) === String(parsedId));
      await applyGeoFromNode(node);
    }
  }, [form, loadCoordinationProvinciales, sousEntites, coordinationRegionales, applyGeoFromNode]);

  const handleProvincialeChange = useCallback(async (coordProvId) => {
    form.setFieldsValue({
      coordination_provinciale_id: coordProvId || undefined,
      coordination_communale_id: undefined,
      coordination_locale_id: undefined,
    });
    if (!coordProvId) {
      setCoordinationCommunales([]);
      setCoordinationLocales([]);
      return;
    }
    const node = coordinationProvinciales.find((p) => String(p.id) === String(coordProvId));
    await applyGeoFromNode(node);
    await loadCoordinationCommunales(coordProvId);
  }, [form, loadCoordinationCommunales, coordinationProvinciales, applyGeoFromNode]);

  const handleCommunaleChange = useCallback(async (coordCommId) => {
    form.setFieldsValue({
      coordination_communale_id: coordCommId || undefined,
      coordination_locale_id: undefined,
    });
    if (!coordCommId) {
      setCoordinationLocales([]);
      return;
    }
    const node = coordinationCommunales.find((c) => String(c.id) === String(coordCommId));
    await applyGeoFromNode(node);
    await loadCoordinationLocales(coordCommId);
  }, [form, loadCoordinationLocales, coordinationCommunales, applyGeoFromNode]);

  const handleLocaleChange = useCallback(async (coordLocaleId) => {
    form.setFieldsValue({ coordination_locale_id: coordLocaleId || undefined });
    if (!coordLocaleId) return;
    const node = coordinationLocales.find((l) => String(l.id) === String(coordLocaleId));
    await applyGeoFromNode(node);
  }, [form, coordinationLocales, applyGeoFromNode]);

  const handleTypeChange = useCallback(() => {
    form.setFieldsValue({
      categorie: undefined,
      config_arme_id: undefined,
      designation: undefined,
    });
    setAvailableConfigurations([]);
    setSelectedConfigId(null);
  }, [form]);

  const handleCategorieChange = useCallback(() => {
    form.setFieldsValue({
      config_arme_id: undefined,
      designation: undefined,
    });
    setSelectedConfigId(null);
  }, [form]);

  const handleConfigChange = useCallback((configId) => {
    setSelectedConfigId(configId || null);
    if (!configId) {
      form.setFieldsValue({ designation: undefined });
    }
  }, [form]);

  // progress update
  const updateProgress = () => {
    const v = form.getFieldsValue();
    const fields = [
      "entite_id",
      "sous_entite_id",
      "coordination_regionale_id",
      "coordination_provinciale_id",
      "coordination_communale_id",
      "coordination_locale_id",
      "region_id",
      "province_id",
      "commune_id",
      "type",
      "categorie",
      "designation",
      "numero_serie",
      "statut",
      "etat",
      "source_arme_id",
      "date_entree"
    ];
    let filled = 0;
    fields.forEach(f => {
      if (v[f]) filled++;
    });
    const percent = Math.round((filled / fields.length) * 100);
    setProgressPercent(percent);
  };

  useEffect(() => {
    updateProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, selectedCategory, selectedConfigId]);

  // load item if editing
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = (await ipcCall("getArmeById", id).catch(() => ipcCall("getArme", id).catch(()=>null))) || null;
        if (!data) { message.error("Aucune arme trouvée"); return; }
        form.setFieldsValue({
          ...data,
          source_arme_id: data.source_arme_id ?? null,
          date_entree: data.date_entree ? moment(data.date_entree) : null,
          date_sortie: data.date_sortie ? moment(data.date_sortie) : null,
          ownership_type: data.ownership_type || (data.entite_id ? "entite" : (data.region_id ? "region" : undefined)),
          region_id: data.region_id || null,
          province_id: data.province_id || null,
          commune_id: data.commune_id || null,
          entite_id: data.entite_id || null,
          sous_entite_id: data.sous_entite_id || null,
        });
        if (data.region_id) loadProvinces(data.region_id);
        if (data.province_id) loadCommunes(data.province_id);
        if (data.entite_id) loadSousEntites(data.entite_id);
        // cascade config
        const cfg = configArmes.find(c => c.designation === data.designation);
        if (cfg) {
          setSelectedType(cfg.type);
          setSelectedCategory(cfg.categorie);
          setSelectedConfigId(cfg.id);
          const cats = Array.from(new Set((configArmes || []).filter(i => i.type === cfg.type).map(i => i.categorie)));
          setAvailableCategories(cats);
          setAvailableConfigurations((configArmes || []).filter(i => i.type === cfg.type && i.categorie === cfg.categorie));
        }
        const hasCoordination =
          data.coordination_regionale_id ||
          data.coordination_provinciale_id ||
          data.coordination_communale_id ||
          data.coordination_locale_id;
        const inferredMode = data.sous_entite_id
          ? "sous_entite"
          : hasCoordination
          ? "coordination"
          : "sous_entite";
        setRattachementMode(inferredMode);
        if (inferredMode === "coordination" && data.entite_id) {
          await loadCoordinationRegionales(data.entite_id);
          if (data.coordination_regionale_id) {
            await loadCoordinationProvinciales(data.coordination_regionale_id);
          }
          if (data.coordination_provinciale_id) {
            await loadCoordinationCommunales(data.coordination_provinciale_id);
          }
          if (data.coordination_communale_id) {
            await loadCoordinationLocales(data.coordination_communale_id);
          }
        }
        if (inferredMode === "sous_entite" && data.entite_id) loadSousEntites(data.entite_id);
        if (inferredMode === "coordination" && data.entite_id) loadCoordinationRegionales(data.entite_id);
      } catch (err) {
        message.error("Erreur chargement arme");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, configArmes, loadSousEntites, loadCoordinationRegionales]);

 0

  // onFinish flow
  const onFinish = async (values) => {
    setIsSubmitting(true);
    try {
      const { contacts: _ignoredContacts, ...cleanValues } = values;
      const cleanedPayload = Object.fromEntries(
        Object.entries({
          ...cleanValues,
          designation: configArmes.find(c => c.id === selectedConfigId)?.designation || values.designation,
          config_arme_id: selectedConfigId || null,
          source_arme_id: values.source_arme_id || null,
          date_entree: values.date_entree ? values.date_entree.format("YYYY-MM-DD") : null,
          date_sortie: values.date_sortie ? values.date_sortie.format("YYYY-MM-DD") : null,
          position: values.position || "",
          mobilite: values.mobilite || "normale",
        }).filter(([_, v]) => v !== undefined && v !== "")
      );

      form.setFields([
        { name: "numero_serie", errors: [] },
        { name: "categorie", errors: [] },
        { name: "config_arme_id", errors: [] },
        { name: "source_arme_id", errors: [] }
      ]);

      // Vérifie le doublon sur la combinaison (numéro, type, catégorie, source)
      const dup = await checkDuplicate(
        cleanedPayload.numero_serie,
        cleanedPayload.type,
        cleanedPayload.categorie,
        cleanedPayload.source_arme_id
      );
      if (dup && !id) {
        await triggerDuplicateModal(cleanedPayload, dup);
        form.scrollToField("numero_serie", { block: "center" });
        return;
      }

      // Dotation VDP
      if (showVdpForm && values.vdp) {
        cleanedPayload.vdp = values.vdp;
        cleanedPayload.statut = "dotée";
      }

      let res;
      if (id) {
        await ipcCall("updateArme", { ...cleanedPayload, id }).catch(err => { throw err; });
        message.success("Arme mise à jour");
        navigate("/armes");
      } else {
        try {
          res = await ipcCall("createArme", cleanedPayload);
        } catch (err) {
          const detail = err?.payload?.detail || err?.message || err?.response?.data?.error || "";
          const isDuplicate =
            /doublon/i.test(detail) ||
            /UNIQUE constraint failed: armes\.numero_serie/i.test(detail) ||
            err?.payload?.code === "SQLITE_CONSTRAINT" ||
            err?.response?.status === 409;

          if (isDuplicate) {
            await triggerDuplicateModal(cleanedPayload);
            return;
          }

          const fallbackDup = await checkDuplicate(cleanedPayload.numero_serie).catch(() => null);
          if (fallbackDup) {
            await triggerDuplicateModal(cleanedPayload, fallbackDup);
            return;
          }

          await triggerDuplicateModal(cleanedPayload);
          return;
        }
        const newId = res?.id ?? res?.newId ?? res?.insertId ?? res?.lastID ?? null;
        const createdAt = res?.created_at || res?.createdAt || nowDate();
        message.success("Arme créée avec succès");
        setCreatedRecord({
          id: newId,
          numero_serie: cleanedPayload.numero_serie,
          designation: cleanedPayload.designation,
          source_arme_id: cleanedPayload.source_arme_id || null,
          date_creation: createdAt
        });
        setSuccessModalVisible(true);
        await refreshQuickStats();
        const template = {
          ownership_type: cleanedPayload.ownership_type || null,
          entite_id: cleanedPayload.entite_id || null,
          sous_entite_id: cleanedPayload.sous_entite_id || null,
          region_id: cleanedPayload.region_id || null,
          type: cleanedPayload.type || null,
          categorie: cleanedPayload.categorie || null,
          source_arme_id: cleanedPayload.source_arme_id || null,
          designation: cleanedPayload.designation || null,
        };
        setEntryTemplate(template);
        form.setFieldsValue({ ...template, numero_serie: undefined, date_entree: undefined, date_sortie: undefined });
        updateProgress();
      }
    } catch (err) {
      const msg = err?.payload?.detail || err?.message || "Erreur serveur";
      message.error(msg);
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  }

  // Ajout : lors de la réintégration (retour en stock), statut repasse à "non dotée"
  // À appeler lors d'une action de réintégration (ex : bouton ou workflow spécifique)
  const handleReintegrate = async (armeId) => {
    try {
      await ipcCall("updateArme", { id: armeId, statut: "non dotée" });
      message.success("Arme réintégrée (statut repassé à non dotée)");
      navigate("/armes");
    } catch (err) {
      message.error("Erreur lors de la réintégration");
    }
  };

  // Duplicate modal actions
  const handleDupCancel = () => {
    closeDuplicateModal();
  };
  const handleDupAddAnyway = async () => {
    try {
      closeDuplicateModal();
      setIsSubmitting(true);
      const values = form.getFieldsValue();
      const { contacts: _ignoredContacts, ...cleanValues } = values;
      const config = configArmes.find(c => c.id === selectedConfigId);
      const designation = config ? config.designation : values.designation;
      const payload = {
        ...cleanValues,
        designation,
        config_arme_id: selectedConfigId || null,
        source_arme_id: values.source_arme_id || null,
        date_entree: values.date_entree ? values.date_entree.format("YYYY-MM-DD") : null,
        date_sortie: values.date_sortie ? values.date_sortie.format("YYYY-MM-DD") : null,
      };
      payload.numero_serie = appendNdpSuffix(payload.numero_serie);
      form.setFieldsValue({ numero_serie: payload.numero_serie });
      let res;
      try {
        res = await ipcCall("createArme", payload);
      } catch (err) {
        const detail = err?.payload?.detail || err?.message || "";
        if (/UNIQUE constraint failed: armes\.numero_serie/i.test(detail)) {
          const serverDup = await checkDuplicate(payload.numero_serie, designation, payload.categorie, payload.source_arme_id).catch(() => null);
          await triggerDuplicateModal(payload, serverDup);
          return;
        }
        throw err;
      }
      const newId = res?.id ?? res?.newId ?? res?.insertId ?? res?.lastID ?? null;
      const createdAt = res?.created_at || res?.createdAt || nowDate();
      message.success("Arme créée (doublon confirmé)");
      setCreatedRecord({
        id: newId,
        numero_serie: payload.numero_serie,
        designation,
        source_arme_id: payload.source_arme_id || null,
        date_creation: createdAt
      });
      await refreshQuickStats();
      setSuccessModalVisible(true);
    } catch (err) {
      message.error(err?.message || "Erreur lors de la création");
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  };
  const handleDupNewEntry = () => {
    const template = entryTemplate || {};
    closeDuplicateModal();
    message.destroy();
    form.setFields([
      { name: "numero_serie", errors: [] },
      { name: "categorie", errors: [] },
      { name: "config_arme_id", errors: [] }
    ]);
    form.setFieldsValue({ ...template, numero_serie: undefined, date_entree: undefined, date_sortie: undefined });
    updateProgress();
  };
  const handleSuccessContinue = () => {
    closeSuccessModal();
    form.setFields([
      { name: "numero_serie", errors: [] },
      { name: "categorie", errors: [] },
      { name: "config_arme_id", errors: [] }
    ]);
  };

  const handleSuccessGoList = () => {
    closeSuccessModal();
    navigate("/armes");
  };
  const handleNavigate = (path) => navigate(path);

  const handleSubmitClick = () => {
    form.validateFields().then(() => form.submit()).catch(() => {});
  };
  const handleResetClick = () => {
    form.resetFields();
    if (entryTemplate) form.setFieldsValue(entryTemplate);
    form.setFields([
      { name: "numero_serie", errors: [] },
      { name: "categorie", errors: [] },
      { name: "config_arme_id", errors: [] }
    ]);
    setShowVdpForm(false);
    updateProgress();
  };
  const handleNewEntryClick = () => {
    form.resetFields();
    if (entryTemplate) form.setFieldsValue(entryTemplate);
    form.setFields([
      { name: "numero_serie", errors: [] },
      { name: "categorie", errors: [] },
      { name: "config_arme_id", errors: [] }
    ]);
    setShowVdpForm(false);
    updateProgress();
  };
  const handleGoList = () => navigate("/armes");
  const handleGoDashboard = () => navigate("/dashboard");

  const sinceLabel = statsSinceRef.current.format("DD/MM/YYYY");

  // Top professional nav
  const TopNav = () => (
    <Row justify="space-between" align="middle" className="arme-form-toolbar">
      <Col>
        <Space>
          <Button onClick={() => navigate("/armes")}>← Liste des armes</Button>
          <Button onClick={() => { form.resetFields(); if (entryTemplate) form.setFieldsValue(entryTemplate); }}>Nouvelle saisie (modèle)</Button>
          <Button onClick={() => navigate("/dashboard")}>Dashboard</Button>
        </Space>
      </Col>
      <Col>
        <Space>
          <Button onClick={() => { form.validateFields().then(()=>form.submit()).catch(()=>{}); }} type="primary">Valider</Button>
          <Button onClick={() => { form.resetFields(); if (entryTemplate) form.setFieldsValue(entryTemplate); updateProgress(); }}>Réinitialiser</Button>
        </Space>
      </Col>
    </Row>
  );

  const sourceLabelById = useCallback(
     (sourceId) => {
       if (!sourceId) return "—";
       const found = sourcesArmement.find((item) => String(item.id) === String(sourceId));
       return found ? (found.nom || found.designation || `Source #${sourceId}`) : `Source #${sourceId}`;
     },
     [sourcesArmement]
   );

  useEffect(() => {
    setSelectedType(typeValue || '');
    if (!typeValue) {
      setAvailableCategories([]);
      setAvailableConfigurations([]);
      setSelectedConfigId(null);
      return;
    }
    const categories = Array.from(
      new Set(
        configArmes
          .filter(cfg => cfg.type === typeValue)
          .map(cfg => cfg.categorie)
          .filter(Boolean)
      )
    );
    setAvailableCategories(categories);
    if (categorieValue && !categories.includes(categorieValue)) {
      form.setFieldsValue({ categorie: undefined, config_arme_id: undefined, designation: undefined });
    }
  }, [typeValue, categorieValue, configArmes, form]);

  useEffect(() => {
    setSelectedCategory(categorieValue || '');
    if (!typeValue || !categorieValue) {
      setAvailableConfigurations([]);
      setSelectedConfigId(null);
      if (configValue) form.setFieldsValue({ config_arme_id: undefined, designation: undefined });
      return;
    }
    const configs = configArmes.filter(
      cfg => cfg.type === typeValue && cfg.categorie === categorieValue
    );
    setAvailableConfigurations(configs);
    if (configValue && !configs.some(cfg => cfg.id === configValue)) {
      form.setFieldsValue({ config_arme_id: undefined, designation: undefined });
    }
  }, [typeValue, categorieValue, configValue, configArmes, form]);

  useEffect(() => {
    setSelectedConfigId(configValue || null);
    if (!configValue) return;
    const cfg = configArmes.find(item => item.id === configValue);
    if (cfg?.designation) {
      form.setFieldsValue({
        designation: cfg.designation,
        type: cfg.type || typeValue,
        categorie: cfg.categorie || categorieValue
      });
    }
  }, [configValue, configArmes, form, typeValue, categorieValue]);

  // cascade watchers
  useEffect(() => {
    if (!currentEntiteId) {
      setSousEntites([]);
      setCoordinationRegionales([]);
      setCoordinationProvinciales([]);
      setCoordinationCommunales([]);
      setCoordinationLocales([]);
      setSecondLevelOptions([]);
      form.setFieldsValue({
        sous_entite_id: undefined,
        coordination_regionale_id: undefined,
        coordination_provinciale_id: undefined,
        coordination_communale_id: undefined,
        coordination_locale_id: undefined
      });
      return;
    }
    (async () => {
      const [sousList, coordList] = await Promise.all([
        loadSousEntites(currentEntiteId),
        loadCoordinationRegionales(currentEntiteId),
      ]);
      syncSecondLevelOptions(sousList, coordList);
    })();
  }, [
    currentEntiteId,
    form,
    loadCoordinationRegionales,
    loadSousEntites,
    syncSecondLevelOptions,
  ]);

  useEffect(() => {
    if (!currentCoordinationRegionaleId) {
      setCoordinationProvinciales([]);
      setCoordinationCommunales([]);
      setCoordinationLocales([]);
      form.setFieldsValue({
        coordination_provinciale_id: undefined,
        coordination_communale_id: undefined,
        coordination_locale_id: undefined
      });
      return;
    }
    loadCoordinationProvinciales(currentCoordinationRegionaleId);
  }, [currentCoordinationRegionaleId, form, loadCoordinationProvinciales]);

  useEffect(() => {
    if (!currentCoordinationProvincialeId) {
      setCoordinationCommunales([]);
      setCoordinationLocales([]);
      form.setFieldsValue({
        coordination_communale_id: undefined,
        coordination_locale_id: undefined
      });
      return;
    }
    loadCoordinationCommunales(currentCoordinationProvincialeId);
  }, [currentCoordinationProvincialeId, form, loadCoordinationCommunales]);

  useEffect(() => {
    if (!currentCoordinationCommunaleId) {
      setCoordinationLocales([]);
      form.setFieldsValue({ coordination_locale_id: undefined });
      return;
    }
    loadCoordinationLocales(currentCoordinationCommunaleId);
  }, [currentCoordinationCommunaleId, form, loadCoordinationLocales]);

  useEffect(() => {
    const entiteOpts = entites.map((entite) => ({
      value: `entite:${entite.id}`,
      label: `Entité • ${entite.nom}`,
    }));
    const coordOpts = coordinationRegionales.map((coord) => ({
      value: `coord:${coord.id}`,
      label: `Coordination • ${coord.nom}`,
    }));
    setRattachementOptions([...entiteOpts, ...coordOpts]);
  }, [entites, coordinationRegionales]);

  const handleRattachementSelect = useCallback(async (value) => {
    form.setFieldsValue({
      rattachement_choice: value || undefined,
      entite_id: undefined,
      coordination_regionale_id: undefined,
      sous_entite_id: undefined,
      coordination_provinciale_id: undefined,
      coordination_communale_id: undefined,
      coordination_locale_id: undefined,
    });
    setSousEntites([]);
    setCoordinationProvinciales([]);
    setCoordinationCommunales([]);
    setCoordinationLocales([]);
    if (!value) return;
    const [kind, rawId] = value.split(':');
    const idNum = Number(rawId);
    if (kind === 'entite') {
      await handleEntiteSelect(idNum);
      return;
    }
    if (kind === 'coord') {
      form.setFieldsValue({ coordination_regionale_id: idNum });
      await loadCoordinationProvinciales(idNum);
      const node = coordinationRegionales.find((c) => String(c.id) === String(idNum));
      await applyGeoFromNode(node);
    }
  }, [form, handleEntiteSelect, loadCoordinationProvinciales, applyGeoFromNode, coordinationRegionales]);

  // === DUPLICATE CHECK ===
  const checkDuplicate = useCallback(async (numeroSerie) => {
    if (!numeroSerie || numeroSerie.trim() === "") {
      setDuplicateWarning(null);
      return null;
    }
    if (isEditMode) {
      setDuplicateWarning(null);
      return null;
    }
    setCheckingDuplicate(true);
    try {
      // Utiliser api.checkDuplicate ou api.checkArmeDuplicate ou fallback direct
      let existing = null;
      if (typeof api.checkDuplicate === 'function') {
        existing = await api.checkDuplicate(numeroSerie.trim());
      } else if (typeof api.checkArmeDuplicate === 'function') {
        existing = await api.checkArmeDuplicate(numeroSerie.trim());
      } else {
        // Fallback : appel direct à l'API
        try {
          const response = await api.call('get', '/armes/check', { numero_serie: numeroSerie.trim() });
          existing = response;
        } catch (fallbackErr) {
          console.warn("[ArmeForm] Fallback checkDuplicate:", fallbackErr?.message || fallbackErr);
          existing = null;
        }
      }
      
      if (existing && existing.id) {
        setDuplicateWarning(existing);
        return existing;
      } else {
        setDuplicateWarning(null);
        return null;
      }
    } catch (error) {
      console.warn("[ArmeForm] Erreur vérification doublon:", error?.message || error);
      setDuplicateWarning(null);
      return null;
    } finally {
      setCheckingDuplicate(false);
    }
  }, [isEditMode]);

  const fieldLabelMap = useMemo(
    () => Object.fromEntries(REQUIRED_FIELDS.map(({ name, label }) => [name, label])),
    []
  );
  const handleFinishFailed = useCallback(({ errorFields = [] }) => {
    const missing = errorFields
      .map(({ name }) => fieldLabelMap[Array.isArray(name) ? name[0] : name])
      .filter(Boolean);
    if (missing.length) {
      message.error(`Champs obligatoires manquants : ${Array.from(new Set(missing)).join(", ")}`);
    }
  }, [fieldLabelMap]);

  const openDuplicateModal = useCallback((record, reason = "numero", payload = {}) => {
    const normalized = buildDupRecord(record, payload);
    setDupRecord({
      ...normalized,
      reason,
      messageText: reason === "numero"
        ? "Ce numéro de série est déjà utilisé. Modifiez-le ou forcez l'ajout."
        : "Un doublon a été détecté. Ajustez les valeurs ou forcez l'ajout."
    });
    setDupResolutionSerial(payload.numero_serie || form.getFieldValue("numero_serie") || "");
    setDupModalVisible(true);
  }, [buildDupRecord, form]);

  const triggerDuplicateModal = useCallback(async (payload, record = null, reason = "numero") => {
    if (record) {
      openDuplicateModal(record, reason, payload);
      return;
    }
    try {
      const refreshed = await checkDuplicate(payload.numero_serie);
      openDuplicateModal(refreshed || payload, reason, payload);
    } catch {
      openDuplicateModal(payload, reason, payload);
    }
  }, [checkDuplicate, openDuplicateModal]);

  const appendNdpSuffix = useCallback((serial = "") => {
    const trimmed = String(serial || "").trim();
    if (!trimmed) return "NDP";
    return /-NDP$/i.test(trimmed) ? trimmed : `${trimmed}-NDP`;
  }, []);

  const closeDuplicateModal = useCallback(() => {
    setDupModalVisible(false);
    setDupRecord(null);
    setDupResolutionSerial("");
  }, []);

  const closeSuccessModal = useCallback(() => {
    setSuccessModalVisible(false);
    setCreatedRecord(null);
  }, []);

  const handleDupApplyNewSerial = useCallback(() => {
    const trimmed = dupResolutionSerial.trim();
    if (!trimmed) {
      message.warning("Veuillez renseigner un nouveau numéro de série.");
      return;
    }
    form.setFieldsValue({ numero_serie: trimmed });
    closeDuplicateModal();
    message.success("Numéro de série mis à jour. Relancez l'enregistrement.");
  }, [dupResolutionSerial, form, closeDuplicateModal]);

  return (
    <>
      <div className="arme-form-page">
        <div className="arme-form-overlay" />
        <Card bordered className="arme-form-shell arme-form-shell-light">
          <section className="arme-form-guidelines">
            <Title level={4} className="arme-form-guidelines__title">Procédure recommandée</Title>
            <ul className="arme-form-guidelines__list">
              <li>Choisir la propriété (entité / région) et compléter les niveaux hiérarchiques demandés.</li>
              <li>Sélectionner type, catégorie puis configuration pour récupérer automatiquement la désignation.</li>
              <li>Affecter la source, fixer l’état et renseigner les dates utiles avant validation.</li>
              <li>Activer la dotation VDP si nécessaire pour lier immédiatement l’arme à un volontaire.</li>
            </ul>
            <Text className="arme-form-guidelines__hint">
              Un avertissement s’affiche en cas de doublon. Vous pouvez confirmer l’ajout ou revenir à une saisie propre.
            </Text>
          </section>

          <section className="arme-form-hero">
            <div className="arme-form-hero__content">
              <span className="arme-form-hero__badge">Gestion opérationnelle</span>
              <Title level={2} className="arme-form-hero__title">
                {id ? "Modifier l'arme sélectionnée" : "Enregistrer une nouvelle arme"}
              </Title>
              <Text className="arme-form-hero__subtitle">
                Sélectionnez la propriété, associez la bonne configuration puis validez l’intégrité logistique avant dotation.
              </Text>
              <div className="arme-form-hero__features">
                <Button
                  type="primary"
                  size="middle"
                  className="arme-form-hero__feature-btn"
                  icon={<SettingOutlined />}
                  onClick={() => handleNavigate("/dashboard/config-armes")}
                >
                  Configurations liées
                </Button>
                <Button
                  size="middle"
                  className="arme-form-hero__feature-btn arme-form-hero__feature-btn--secondary"
                  icon={<AimOutlined />}
                  onClick={() => handleNavigate("/dashboard/sources")}
                >
                  Suivi des sources
                </Button>
                <Button
                  size="middle"
                  className="arme-form-hero__feature-btn arme-form-hero__feature-btn--tertiary"
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => handleNavigate("/dashboard/dotation-arme")}
                >
                  Affectations VDP
                </Button>
              </div>
              <div className="arme-form-hero__metrics">
                <div className="arme-form-hero__metric">
                  <span className="arme-form-hero__metric-label">Aujourd’hui</span>
                  <span className="arme-form-hero__metric-value">{quickStats.today}</span>
                </div>
                <div className="arme-form-hero__metric">
                  <span className="arme-form-hero__metric-label">Cette semaine</span>
                  <span className="arme-form-hero__metric-value">{quickStats.week}</span>
                </div>
                <div className="arme-form-hero__metric">
                  <span className="arme-form-hero__metric-label">Ce mois</span>
                  <span className="arme-form-hero__metric-value">{quickStats.month}</span>
                </div>
                <div className="arme-form-hero__metric">
                  <span className="arme-form-hero__metric-label">Depuis {sinceLabel}</span>
                  <span className="arme-form-hero__metric-value">{quickStats.since}</span>
                </div>
              </div>
            </div>
            <div className="arme-form-hero__illustration">
              <div className="arme-form-hero__weapon arme-form-hero__weapon--primary" />
              <div className="arme-form-hero__weapon arme-form-hero__weapon--secondary" />
              <div className="arme-form-hero__weapon arme-form-hero__weapon--tertiary" />
              <div className="arme-form-hero__shield" />
              <div className="arme-form-hero__spark" />
              <div className="arme-form-hero__pulse" />
            </div>
          </section>

          <Divider className="arme-form-divider" />

          <Progress
            percent={progressPercent}
            size="small"
            status={progressPercent < 100 ? "active" : "success"}
            className="arme-form-progress"
          />

          <div className="arme-form-actions-bar">
            <Space wrap size="middle">
              <Button
                type="primary"
                icon={<SafetyCertificateOutlined />}
                onClick={handleSubmitClick}
                loading={isSubmitting}
              >
                Valider
              </Button>
              <Button
                icon={<RadarChartOutlined />}
                onClick={handleResetClick}
              >
                Réinitialiser
              </Button>
              <Button
                icon={<AimOutlined />}
                onClick={handleNewEntryClick}
              >
                Nouvelle saisie
              </Button>
              <Button onClick={handleGoList}>
                Liste des armes
              </Button>
              <Button onClick={handleGoDashboard}>
                Tableau de bord
              </Button>
            </Space>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            onFinishFailed={handleFinishFailed}
            onValuesChange={updateProgress}
            className="arme-form arme-form-light"
          >
            {/* champs cachés conservés pour les cascades */}
            <Form.Item name="coordination_regionale_id" hidden>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item name="sous_entite_id" hidden>
              <Input type="hidden" />
            </Form.Item>
            {/* Section Numéro de série */}
            <Card size="small" className="arme-form-section arme-form-section--serial">
               <Title level={5} style={{ textAlign: 'center', marginBottom: 12, fontSize: '1.6rem',fontWeight: 700}}>Saisie références Arme</Title>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="numero_serie"
                    label={<b>Numéro de Série *</b>}
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="SN12345" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="designation"
                    label={<b>Désignation (automatique)</b>}
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Désignation" disabled />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section propriété */}
            <Card size="small" className="arme-form-section">
              <Title level={5} style={{ textAlign: 'center', marginBottom: 12, fontSize: '1.6rem',fontWeight: 700}}>Position administrative et géographique</Title>
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="entite_id"
                    label="Entité "
                    rules={[{ required: true, message: "Sélectionnez une entité" }]}
                  >
                    <Select
                      placeholder="Choisissez une entité"
                      allowClear
                      onChange={handleEntiteSelect}
                    >
                      {entites.map((entite) => (
                        <Option key={entite.id} value={entite.id}>
                          {entite.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="second_level_choice" label="sous-entité / coordination régionale">
                    <Select
                      placeholder="Sélectionnez un sous-entité ou une coordination régionale"
                      allowClear
                      disabled={!currentEntiteId}
                      optionLabelProp="label"
                      dropdownMatchSelectWidth={false}
                      onChange={handleSecondLevelSelect}
                    >
                      {secondLevelOptions.map(option => (
                        <Option key={option.value} value={option.value} label={option.label}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12} align="top">
                {/* sous-entité */}
                {coordinationProvinciales.length > 0 && (
                  <Col xs={24} md={6}>
                    <Form.Item name="coordination_provinciale_id" label="Coordination provinciale">
                      <Select
                        placeholder="Choisissez une coordination provinciale"
                        onChange={handleProvincialeChange}
                        allowClear
                        disabled={!currentCoordinationRegionaleId}
                        optionLabelProp="label"
                        dropdownMatchSelectWidth={false}
                      >
                        {coordinationProvinciales.map((item) => (
                          <Option key={item.id} value={item.id} label={item.nom} title={item.nom}>
                            {item.nom}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                )}
                {coordinationCommunales.length > 0 && (
                  <Col xs={24} md={6}>
                    <Form.Item name="coordination_communale_id" label="Coordination communale">
                      <Select
                        placeholder="Choisissez une coordination communale"
                        onChange={handleCommunaleChange}
                        allowClear
                        optionLabelProp="label"
                        dropdownMatchSelectWidth={false}
                      >
                        {coordinationCommunales.map((item) => (
                          <Option key={item.id} value={item.id} label={item.nom} title={item.nom}>
                            {item.nom}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                )}
                {coordinationLocales.length > 0 && (
                  <Col xs={24} md={6}>
                    <Form.Item name="coordination_locale_id" label="Localité rattachée">
                      <Select
                        placeholder="Choisissez une localité"
                        allowClear
                        optionLabelProp="label"
                        dropdownMatchSelectWidth={false}
                      >
                        {coordinationLocales.map((item) => (
                          <Option key={item.id} value={item.id} label={item.nom} title={item.nom}>
                            {item.nom}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                )}
              </Row>
              <Row gutter={12}>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="region_id"
                    label="Région"
                  >
                    <Select
                      placeholder="Sélectionner région"
                      onChange={handleRegionChange}
                      showSearch
                      optionFilterProp="children"
                      allowClear
                    >
                      {regions.map(r => (
                        <Option key={r.id} value={r.id}>
                          {r.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="province_id" label="Province">
                    <Select
                      placeholder="Province"
                      onChange={handleProvinceChange}
                      allowClear
                      showSearch
                      optionFilterProp="children"
                    >
                      {provinces.map(p => (
                        <Option key={p.id} value={p.id}>
                          {p.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="commune_id" label="Commune">
                    <Select
                      placeholder="Commune"
                      onChange={handleCommuneChange}
                      allowClear
                      showSearch
                      optionFilterProp="children"
                    >
                      {communes.map(cm => (
                        <Option key={cm.id} value={cm.id}>
                          {cm.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="localite_id" label="Localité">
                    <Select
                      placeholder="Localité"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                    >
                      {localites.map(loc => (
                        <Option key={loc.id} value={loc.id}>
                          {loc.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section configuration */}
            <Card size="small" className="arme-form-section">
              <Title level={5} style={{ textAlign: 'center', marginBottom: 12, fontSize: '1.6rem',fontWeight: 700}}>Configuration de l'arme</Title>
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item name="type" label="Type Arme *" rules={[{ required: true }]}>
                    <Select placeholder="Type Arme" onChange={handleTypeChange} allowClear>
                      {uniqueTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="categorie" label="Catégorie Arme" rules={[{ required: true }]}>
                    <Select placeholder="Catégorie Arme" onChange={handleCategorieChange} disabled={!selectedType}>
                      {availableCategories.map(c => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="config_arme_id" label="Modèle Arme" rules={[{ required: true }]}>
                    <Select
                      placeholder="Modèle Arme"
                      disabled={!selectedCategory}
                      showSearch
                      optionFilterProp="children"
                      onChange={handleConfigChange}
                    >
                      {availableConfigurations.map(cfg => (
                        <Option key={cfg.id} value={cfg.id}>
                          {cfg.designation} ({cfg.type} / {cfg.categorie})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section statut, état, source, position, mobilité */}
            <Card size="small" className="arme-form-section">
              <Title level={5} style={{ textAlign: 'center', marginBottom: 12, fontSize: '1.6rem',fontWeight: 700}}>Statut, état, source , position et mobilité</Title>
              <Row gutter={12}>
                <Col xs={24} md={6}>
                  <Form.Item name="statut" label="Statut *" rules={[{ required: true }]}>
                    <Select placeholder="Statut">
                      <Option value="dotée">dotée</Option>
                      <Option value="non dotée">non dotée</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="etat" label="État *" rules={[{ required: true }]}>
                    <Select placeholder="État">
                      <Option value="Bon État">Bon État</Option>
                      <Option value="Mauvais État Réparable">Mauvais État Réparable</Option>
                      <Option value="Mauvais État Non Réparable">Mauvais État Non Réparable</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="source_arme_id" label="Source d’armement *" rules={[{ required: true }]}>
                    <Select placeholder="Choisir une source">
                      {sourcesArmement.map(source => (
                        <Option key={source.id} value={source.id}>
                          {source.nom || source.designation || `Source #${source.id}`}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="position" label="Position *" rules={[{ required: true }]}>
                    <Select placeholder="Position">
                      <Option value="En magasin">En magasin</Option>
                      <Option value="En réparation">En réparation</Option>
                      <Option value="En opération">En opération</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col xs={24} md={6}>
                  <Form.Item name="date_entree" label="Date d'entrée">
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="date_sortie" label="Date de sortie">
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="mobilite" label="Mobilité *" rules={[{ required: true }]}>
                    <Select placeholder="Mobilité">
                      {mobiliteOptions.map(opt => (
                        <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Dotation VDP */}
            <Row align="middle" style={{ marginTop: 8 }}>
              <Col>
                <Title level={5} style={{ marginBottom: 0 }}>Dotation VDP</Title>
                <Checkbox checked={showVdpForm} onChange={e => setShowVdpForm(e.target.checked)}>
                  Affecter à un VDP maintenant
                </Checkbox>
              </Col>
            </Row>
            {showVdpForm && (
              <Card size="small" className="arme-form-section arme-form-section--vdp">
                <Form.Item name="vdp" label="Dotation VDP">
                  <VdpForm embedded />
                </Form.Item>
              </Card>
            )}

            <Form.Item className="arme-form-actions">
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Button onClick={() => navigate("/armes")}>Annuler</Button>
                <Button type="primary" onClick={() => form.validateFields().then(()=>form.submit()).catch(()=>{})} loading={isSubmitting}>
                  {id ? "Enregistrer" : "Ajouter et vérifier"}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>

      {/* Duplicate modal */}
      <Modal
        open={dupModalVisible}
        title="Doublon détecté"
        onCancel={handleDupCancel}
        footer={[
          <Button key="change" onClick={handleDupApplyNewSerial}>Mettre à jour le numéro</Button>,
          <Button key="skip" onClick={handleDupNewEntry}>Passer à une nouvelle arme</Button>,
          <Button key="force" type="primary" onClick={handleDupAddAnyway}>
            Ajouter quand même
          </Button>
        ]}
      >
        <div style={{ marginBottom: 12 }}>
          {dupRecord?.messageText}
        </div>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Numéro de série">{dupRecord?.numero_serie || "—"}</Descriptions.Item>
          <Descriptions.Item label="Désignation">{dupRecord?.designation || "—"}</Descriptions.Item>
          <Descriptions.Item label="Catégorie">{dupRecord?.categorie || "—"}</Descriptions.Item>
          <Descriptions.Item label="Source d’armement">{sourceLabelById(dupRecord?.source_arme_id)}</Descriptions.Item>
          <Descriptions.Item label="Entité">{dupRecord?.entite || "—"}</Descriptions.Item>
          <Descriptions.Item label="Date de création">
            {dupRecord?.date_creation ? moment(dupRecord.date_creation).format("YYYY-MM-DD") : "—"}
          </Descriptions.Item>
        </Descriptions>
        <Divider />
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text strong>Modifier le numéro de série</Text>
          <Input
            value={dupResolutionSerial}
            placeholder="Saisissez un nouveau numéro unique"
            onChange={(event) => setDupResolutionSerial(event.target.value)}
          />
          <Text type="secondary">Enregistrez un numéro différent puis relancez la sauvegarde.</Text>
        </Space>
      </Modal>

      {/* Success modal */}
      <Modal
        open={successModalVisible}
        onCancel={closeSuccessModal}
        footer={null}
        width={520}
        className="arme-form-success"
      >
        <Result
          status="success"
          title="Arme ajoutée avec succès"
          extra={[
            <Button type="primary" key="list" onClick={handleSuccessGoList}>
              Voir la liste des armes
            </Button>,
            <Button key="new" onClick={handleSuccessContinue}>
              Ajouter une autre arme
            </Button>
          ]}
        >
          <div className="arme-form-success-details">
            <p><b>Numéro de série:</b> {createdRecord?.numero_serie}</p>
            <p><b>Désignation:</b> {createdRecord?.designation}</p>
            <p><b>Source d’armement :</b> {sourceLabelById(createdRecord?.source_arme_id)}</p>
            <p><b>Date de création:</b> {createdRecord?.date_creation ? moment(createdRecord.date_creation).format("YYYY-MM-DD") : "—"}</p>
          </div>
        </Result>
      </Modal>
    </>
  );
};