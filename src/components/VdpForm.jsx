import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  Form,
  Input,
  DatePicker,
  Upload,
  Button,
  Select,
  Row,
  Col,
  Divider,
  Spin,
  message,
  Modal,
  Space,
  Typography,
  Descriptions,
  Checkbox,
  Tag,
} from "antd";
import {
  UploadOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import moment from "moment";
import QRCode from "qrcode";
import api from "../api";
import "./VdpForm.css";
import ArmeForm from "./ArmeForm";

const { Title, Text } = Typography;
const { Option } = Select;

const MAX_PHOTO_SIZE_MB = 20;

const resolveApiBase = () => {
  const candidate =
    window.api?.client?.defaults?.baseURL ||
    window.api?.baseURL ||
    window.api?.API_BASE_URL ||
    import.meta.env?.VITE_API_URL;
  if (candidate) return String(candidate).replace(/\/$/, "");
  const origin =
    typeof window !== "undefined" && typeof window.location?.origin === "string"
      ? window.location.origin
      : "";
  if (origin && origin.startsWith("http")) {
    return `${origin.replace(/\/$/, "")}/api`;
  }
  return "http://127.0.0.1:3001/api";
};

const requestJson = async (method, path, body = null) => {
  const base = resolveApiBase();
  const target = path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
  const headers = { "Content-Type": "application/json" };
  try {
    const stored = localStorage.getItem("auth-token") || localStorage.getItem("auth_token");
    if (stored) {
      headers.Authorization = stored.startsWith("Bearer ") ? stored : `Bearer ${stored}`;
    }
  } catch {}
  const upper = String(method || "GET").toUpperCase();
  const init = { method: upper, headers, credentials: "include" };
  if (upper === "GET" && body && typeof body === "object") {
    const qs = new URLSearchParams(
      Object.entries(body).filter(([, v]) => v != null && v !== "")
    ).toString();
    const res = await fetch(qs ? `${target}?${qs}` : target, init);
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return res.status === 204 ? null : res.json();
  }
  if (body != null && upper !== "GET") init.body = JSON.stringify(body);
  const res = await fetch(target, init);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.status === 204 ? null : res.json();
};

const unwrapVdpRecord = (data) => {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) return data[0] || null;
  if (Array.isArray(data.rows)) return data.rows[0] || null;
  if (Array.isArray(data.data)) return data.data[0] || null;
  if (data.data && typeof data.data === "object") return data.data;
  if (data.item && typeof data.item === "object") return data.item;
  if (data.result && typeof data.result === "object") return data.result;
  return data;
};

const unwrapVdpCollection = (input) => {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.rows)) return input.rows;
  if (Array.isArray(input.data)) return input.data;
  return [];
};

const pickVdpFromCollection = (collection, target) => {
  const entries = unwrapVdpCollection(collection);
  if (!entries.length) return null;
  const targetStr = String(target);
  return entries.find((item) => {
    if (!item) return false;
    return [item.id, item.ID, item.uuid, item.UUID]
      .filter((v) => v !== undefined && v !== null)
      .some((v) => String(v) === targetStr);
  }) || null;
};

export default function VdpForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [qrCodeURL, setQrCodeURL] = useState("");
  const photoStoreRef = useRef({ preview: null, payload: null });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [inheritedLocation, setInheritedLocation] = useState(null);

  // États pour la dotation d'arme
  const [showArmeSection, setShowArmeSection] = useState(false);
  const [availableArmes, setAvailableArmes] = useState([]);
  const [selectedArmeId, setSelectedArmeId] = useState(null);
  const [selectedArme, setSelectedArme] = useState(null);
  const [armesLoading, setArmesLoading] = useState(false);

  // État pour le formulaire d'arme intégré (modal)
  const [showArmeFormModal, setShowArmeFormModal] = useState(false);

  const invokeBridge = useCallback(async (method, ...args) => {
    const fn = window.electronAPI?.[method];
    if (typeof fn !== "function") return { executed: false, result: null };
    const result = await fn(...args);
    return { executed: true, result };
  }, []);

  // Charger les armes non dotées
  const loadAvailableArmes = useCallback(async (search = "") => {
    setArmesLoading(true);
    try {
      let armes = [];
      try {
        armes = await api.getArmesList?.({ statut: "non dotée" }) || [];
      } catch {
        armes = await requestJson("GET", "/armes", { statut: "non dotée" });
      }
      const list = Array.isArray(armes) ? armes : armes?.rows || [];
      const nonDotees = list.filter(a => 
        a.statut === "non dotée" || 
        !a.statut || 
        a.statut.toLowerCase().includes("non")
      );
      if (search) {
        const needle = search.toLowerCase();
        return nonDotees.filter(a =>
          (a.numero_serie || "").toLowerCase().includes(needle) ||
          (a.designation || "").toLowerCase().includes(needle) ||
          (a.type || "").toLowerCase().includes(needle)
        );
      }
      setAvailableArmes(nonDotees);
      return nonDotees;
    } catch (err) {
      console.warn("[VdpForm] Erreur chargement armes:", err);
      setAvailableArmes([]);
      return [];
    } finally {
      setArmesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showArmeSection) {
      loadAvailableArmes();
    }
  }, [showArmeSection, loadAvailableArmes]);

  const handleArmeSelect = useCallback((armeId) => {
    setSelectedArmeId(armeId || null);
    if (!armeId) {
      setSelectedArme(null);
      setInheritedLocation(null);
      return;
    }
    const arme = availableArmes.find(a => String(a.id) === String(armeId));
    setSelectedArme(arme || null);
    if (arme) {
      setInheritedLocation({
        region_nom: arme.region_nom,
        province_nom: arme.province_nom,
        commune_nom: arme.commune_nom,
        localite_nom: arme.localite_nom,
        entite_nom: arme.entite_nom,
        sous_entite_nom: arme.sous_entite_nom,
        coordination_regionale_nom: arme.coordination_regionale_nom,
        coordination_provinciale_nom: arme.coordination_provinciale_nom,
        coordination_communale_nom: arme.coordination_communale_nom,
      });
    }
  }, [availableArmes]);

  const handleArmeSearch = useCallback(async (value) => {
    if (!value || value.length < 2) {
      await loadAvailableArmes();
      return;
    }
    const filtered = await loadAvailableArmes(value);
    setAvailableArmes(filtered);
  }, [loadAvailableArmes]);

  // Callback pour fermer le modal ArmeForm et recharger les armes
  const handleArmeFormModalClose = useCallback(async () => {
    setShowArmeFormModal(false);
    await loadAvailableArmes();
    message.info("Sélectionnez l'arme nouvellement créée dans la liste déroulante.");
  }, [loadAvailableArmes]);

  const loadVdp = useCallback(async () => {
    if (isNew) {
      photoStoreRef.current = { preview: null, payload: null };
      setPhotoPreview(null);
      form.resetFields();
      setQrCodeURL("");
      return;
    }
    setLoading(true);
    try {
      const normalizedId = Number.isNaN(Number(id)) ? id : Number(id);
      const attempts = [
        async () => {
          const { executed, result } = await invokeBridge("getVdpById", normalizedId);
          return executed ? result : null;
        },
        async () => (typeof api?.getVdpById === "function" ? api.getVdpById(normalizedId) : null),
        async () => requestJson("GET", `/vdp/${id}`),
      ];
      let record = null;
      for (const getter of attempts) {
        try {
          const candidate = await getter();
          record = unwrapVdpRecord(candidate);
          if (record) break;
        } catch {}
      }
      if (!record) {
        const listAttempts = [
          async () => {
            const { executed, result } = await invokeBridge("getVdpList", { includeDeleted: true });
            return executed ? result : null;
          },
          async () => (typeof api?.getVdpList === "function" ? api.getVdpList({ includeDeleted: true }) : null),
          async () => requestJson("GET", "/vdp", { includeDeleted: true }),
        ];
        for (const getter of listAttempts) {
          try {
            const collection = await getter();
            record = pickVdpFromCollection(collection, normalizedId);
            if (record) break;
          } catch {}
        }
      }
      if (!record) {
        Modal.error({ title: "Introuvable", content: "VDP non trouvé." });
        return navigate("/vdp", { replace: true });
      }
      const normalizePhoto = (value) => {
        if (!value) return null;
        if (typeof value === "string" && value.startsWith("data:")) {
          return { preview: value, payload: value.split(",")[1] || "" };
        }
        const base64 = typeof value === "string" ? value : "";
        return { preview: `data:image/jpeg;base64,${base64}`, payload: base64 };
      };
      const photoData = normalizePhoto(record.photo);
      photoStoreRef.current = photoData || { preview: null, payload: null };
      setPhotoPreview(photoData?.preview || null);
      const initialValues = {
        ...record,
        date_naissance: record.date_naissance && moment(record.date_naissance),
        date_cnib: record.date_cnib && moment(record.date_cnib),
        date_recrutement: record.date_recrutement && moment(record.date_recrutement),
        statut_autre_comment: record.statut_vdp === "Autre" ? record.observation || undefined : undefined,
      };
      form.setFieldsValue(initialValues);
      setQrCodeURL(record.code_qr || "");
    } catch (err) {
      message.error("Erreur de chargement du formulaire.");
    } finally {
      setLoading(false);
    }
  }, [isNew, id, form, navigate, invokeBridge]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const dotations = await api.getDotationsByVdp?.(id) || [];
        if (dotations.length > 0) {
          const activeDotation = dotations.find(d => d.statut !== 'cloturée') || dotations[0];
          if (activeDotation?.items?.length) {
            const armeItem = activeDotation.items.find(item => item.resource_type === 'arme');
            if (armeItem?.resource_id) {
              const arme = await api.getArmeById?.(armeItem.resource_id);
              if (arme) {
                setInheritedLocation({
                  region_nom: arme.region_nom,
                  province_nom: arme.province_nom,
                  commune_nom: arme.commune_nom,
                  localite_nom: arme.localite_nom,
                  entite_nom: arme.entite_nom,
                  sous_entite_nom: arme.sous_entite_nom,
                  coordination_regionale_nom: arme.coordination_regionale_nom,
                  coordination_provinciale_nom: arme.coordination_provinciale_nom,
                  coordination_communale_nom: arme.coordination_communale_nom,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[VdpForm] Erreur chargement localisation héritée:', err);
      }
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      await loadVdp();
      setLoading(false);
    })();
  }, [loadVdp]);

  const beforeUpload = (file) => {
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setPhotoError(`La photo dépasse ${MAX_PHOTO_SIZE_MB} Mo.`);
      return false;
    }
    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1] || dataUrl;
      photoStoreRef.current = { preview: dataUrl, payload: base64 };
      setPhotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const clearPhoto = useCallback(() => {
    photoStoreRef.current = { preview: null, payload: null };
    setPhotoPreview(null);
  }, []);

  const watchStatut = Form.useWatch("statut_vdp", form);
  const watchNom = Form.useWatch("nom", form);
  const watchPrenom = Form.useWatch("prenom", form);
  const watchNumeroCnib = Form.useWatch("numero_cnib", form);
  const watchContacts = Form.useWatch("contacts", form);
  const watchContactUrgence1 = Form.useWatch("contact_urgence1", form);

  useEffect(() => {
    const nom = typeof watchNom === "string" ? watchNom.trim() : "";
    const prenom = typeof watchPrenom === "string" ? watchPrenom.trim() : "";
    const cnib = typeof watchNumeroCnib === "string" ? watchNumeroCnib.trim() : "";
    const contactPrincipal = typeof watchContacts === "string" ? watchContacts.trim() : "";
    const contactUrgence = typeof watchContactUrgence1 === "string" ? watchContactUrgence1.trim() : "";
    if (!nom || !prenom || !cnib || !contactPrincipal || !contactUrgence) {
      setQrCodeURL("");
      return;
    }
    let cancelled = false;
    const payload = JSON.stringify({
      nom,
      prenom,
      numero_cnib: cnib,
      contact_principal: contactPrincipal,
      contact_urgence1: contactUrgence,
    });
    QRCode.toDataURL(payload, { errorCorrectionLevel: "H" })
      .then((url) => { if (!cancelled) setQrCodeURL(url); })
      .catch(() => { if (!cancelled) setQrCodeURL(""); });
    return () => { cancelled = true; };
  }, [watchNom, watchPrenom, watchNumeroCnib, watchContacts, watchContactUrgence1]);

  const createDotationForVdp = async (vdpId, armeId) => {
    try {
      const dotationPayload = {
        dotation_type: "individuelle",
        beneficiary_type: "vdp",
        vdp_id: vdpId,
        statut: "active",
        date_dotation: moment().format("YYYY-MM-DD"),
        items: [
          {
            resource_type: "arme",
            resource_id: armeId,
            quantite: 1,
            status: "assigné",
          },
        ],
      };
      await api.createDotation?.(dotationPayload) || 
        await requestJson("POST", "/dotations", dotationPayload);
      
      await api.updateArme?.({ id: armeId, statut: "dotée" }) ||
        await requestJson("PUT", `/armes/${armeId}`, { statut: "dotée" });
      
      return true;
    } catch (err) {
      console.error("[VdpForm] Erreur création dotation:", err);
      message.warning("Le VDP a été créé mais la dotation a échoué.");
      return false;
    }
  };

  const handleSubmit = async (action) => {
    try {
      setSaving(true);
      const vals = await form.validateFields();
      if (!vals.nom || !vals.prenom || !vals.contact_urgence1) {
        message.error("Nom, prénom et contact d'urgence sont requis.");
        setSaving(false);
        return;
      }
      if (vals.statut_vdp === "Autre" && !vals.statut_autre_comment && !vals.observation) {
        message.error("Précisez le statut pour la valeur « Autre ».");
        setSaving(false);
        return;
      }

      const { statut_autre_comment, observation, ...rest } = vals;
      const mergedObservation =
        rest.statut_vdp === "Autre"
          ? (statut_autre_comment || "").concat(
              statut_autre_comment && observation ? `\n${observation}` : observation ? observation : ""
            )
          : observation || "";

      const payload = {
        ...rest,
        photo: photoStoreRef.current.payload ?? null,
        observation: mergedObservation || null,
        code_qr: qrCodeURL || null,
        date_naissance: rest.date_naissance?.format("YYYY-MM-DD") || null,
        date_cnib: rest.date_cnib?.format("YYYY-MM-DD") || null,
        date_recrutement: rest.date_recrutement?.format("YYYY-MM-DD") || null,
        contact_urgence3: rest.contact_urgence3 || null,
        nom_personne_prevenir: rest.nom_personne_prevenir || null,
        lien_personne_prevenir: rest.lien_personne_prevenir || null,
        entite_id: null,
        sous_entite_id: null,
        coordination_id: null,
        region_id: null,
        province_id: null,
        commune_id: null,
        localite_id: null,
      };

      let resultingId = null;

      if (!isNew) {
        const normalizedId = Number.isNaN(Number(id)) ? id : Number(id);
        resultingId = normalizedId;
        const updatePayload = { ...payload, id: normalizedId };
        try {
          await api.updateVdp(updatePayload);
        } catch {
          await requestJson("PUT", `/vdp/${normalizedId}`, updatePayload);
        }
        message.success("VDP modifié");

        if (showArmeSection && selectedArmeId) {
          await createDotationForVdp(normalizedId, selectedArmeId);
          message.success("Arme dotée au VDP avec succès");
        }
      } else {
        let creation = null;
        try {
          creation = await api.createVdp(payload);
        } catch {
          creation = await requestJson("POST", "/vdp", payload);
        }
        resultingId = creation?.id ?? creation?.ID ?? creation?.insertId ?? (typeof creation === "number" ? creation : null);
        message.success("VDP ajouté");

        if (showArmeSection && selectedArmeId && resultingId) {
          await createDotationForVdp(resultingId, selectedArmeId);
          message.success("Arme dotée au VDP avec succès");
        }
      }

      if (action === "doter" && resultingId) {
        navigate(`/dashboard/vdp/doter/${resultingId}`);
      } else if (action === "continue" && isNew) {
        form.resetFields();
        photoStoreRef.current = { preview: null, payload: null };
        setPhotoPreview(null);
        setQrCodeURL("");
        setShowArmeSection(false);
        setSelectedArmeId(null);
        setSelectedArme(null);
        setInheritedLocation(null);
      } else {
        navigate("/dashboard/vdp");
      }
    } catch (err) {
      message.error(err?.response?.data?.error || err?.message || "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ margin: "100px auto", display: "block" }} />;
  }

  return (
    <div className="vdp-form-xxxl-bg">
      <Card
        className="vdp-form-xxxl-card animated fadeInDown"
        style={{ maxWidth: 1100, margin: "48px auto", borderRadius: 28, boxShadow: "0 12px 48px -18px #b0c4b1" }}
        bodyStyle={{ padding: "48px 48px 40px 48px", minHeight: 700, background: "rgba(255,255,255,0.98)" }}
        title={
          <Row justify="space-between" align="middle">
            <Col><span className="vdp-form-xxxl-title animated fadeInLeft">{isNew ? "Ajouter un VDP" : "Modifier un VDP"}</span></Col>
            <Col><Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="vdp-form-xxxl-back animated pulse">Retour</Button></Col>
          </Row>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ statut_matrimonial: undefined }} className="vdp-form-xxxl-form">
          <Divider orientation="left" className="vdp-section-xxxl-title animated fadeInLeft">État civil</Divider>
          <Row gutter={32}>
            <Col xs={24} md={8}>
              <Form.Item name="nom" label="Nom" rules={[{ required: true }]}>
                <Input size="large" placeholder="Nom" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="prenom" label="Prénom" rules={[{ required: true }]}>
                <Input size="large" placeholder="Prénom" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="sexe" label="Sexe" rules={[{ required: true }]}>
                <Select size="large" placeholder="Sexe">
                  <Option value="Masculin">Masculin</Option>
                  <Option value="Féminin">Féminin</Option>
                  <Option value="Autre">Autre</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={32}>
            <Col xs={24} md={8}>
              <Form.Item name="date_naissance" label="Date de Naissance" rules={[{ required: true }]}>
                <DatePicker size="large" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="lieu_naissance" label="Lieu de Naissance">
                <Input size="large" placeholder="Lieu de naissance" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="statut_matrimonial" label="Statut matrimonial">
                <Select size="large">
                  <Option value="Célibataire">Célibataire</Option>
                  <Option value="Marié(e)">Marié(e)</Option>
                  <Option value="Divorcé(e)">Divorcé(e)</Option>
                  <Option value="Veuf(ve)">Veuf(ve)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={32}>
            <Col xs={24} md={8}>
              <Form.Item name="nb_enfants" label="Nombre d'enfants">
                <Input size="large" type="number" min={0} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="type_vdp" label="Type VDP">
                <Select size="large">
                  <Option value="National">National</Option>
                  <Option value="Communal">Communal</Option>
                  <Option value="Dozo">Dozo</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="date_recrutement" label="Date de recrutement">
                <DatePicker size="large" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" className="vdp-section-xxxl-title animated fadeInLeft">Documentation</Divider>
          <Row gutter={32}>
            <Col xs={24} md={12}>
              <Form.Item name="numero_cnib" label="Numéro NIP de la CNIB">
                <Input size="large" placeholder="CNIB" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="date_cnib" label="Date CNIB">
                <DatePicker size="large" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" className="vdp-section-xxxl-title animated fadeInLeft">Statut</Divider>
          <Row gutter={32}>
            <Col xs={24} md={12}>
              <Form.Item name="statut_vdp" label="Statut VDP" rules={[{ required: true, message: "Sélectionnez le statut" }]}>
                <Select size="large" placeholder="Choisissez un statut">
                  <Option value="En service">En service</Option>
                  <Option value="Radié">Radié</Option>
                  <Option value="Tombé">Tombé</Option>
                  <Option value="Autre">Autre</Option>
                </Select>
              </Form.Item>
            </Col>
            {watchStatut === "Autre" && (
              <Col xs={24} md={12}>
                <Form.Item name="statut_autre_comment" label="Précision du statut" rules={[{ required: true, message: "Veuillez préciser le statut." }]}>
                  <Input.TextArea rows={3} size="large" placeholder="Détaillez le statut du VDP" />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Divider orientation="left" className="vdp-section-xxxl-title animated fadeInLeft">Coordonnées</Divider>
          <Row gutter={32}>
            <Col xs={24} md={8}>
              <Form.Item name="contacts" label="Contact principal" rules={[{ required: true, message: "Le contact principal est requis." }]}>
                <Input size="large" placeholder="Téléphone ou email principal" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="contact_urgence1" label="Contact d'urgence 1" rules={[{ required: true }]}>
                <Input size="large" placeholder="Téléphone ou email" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="contact_urgence2" label="Contact d'urgence 2">
                <Input size="large" placeholder="Téléphone ou email" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={32}>
            <Col xs={24} md={8}>
              <Form.Item name="contact_urgence3" label="Contact d'urgence 3">
                <Input size="large" placeholder="Téléphone ou email" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="nom_personne_prevenir" label="Nom de la personne à prévenir" rules={[{ required: true, message: "Le nom de la personne à prévenir est requis." }]}>
                <Input size="large" placeholder="Nom complet" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="lien_personne_prevenir" label="Lien avec la personne à prévenir">
                <Select size="large" placeholder="Sélectionnez le lien">
                  <Option value="Père">Père</Option>
                  <Option value="Mère">Mère</Option>
                  <Option value="Conjoint(e)">Conjoint(e)</Option>
                  <Option value="Frère">Frère</Option>
                  <Option value="Sœur">Sœur</Option>
                  <Option value="Enfant">Enfant</Option>
                  <Option value="Oncle">Oncle</Option>
                  <Option value="Tante">Tante</Option>
                  <Option value="Cousin(e)">Cousin(e)</Option>
                  <Option value="Ami(e)">Ami(e)</Option>
                  <Option value="Collègue">Collègue</Option>
                  <Option value="Autre">Autre</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION DOTATION D'ARME */}
          <Divider orientation="left" className="vdp-section-xxxl-title animated fadeInLeft">Dotation d'arme</Divider>
          <Card size="small" style={{ marginBottom: 24, background: '#fffbe6', border: '1px solid #ffe58f' }}>
            <Row align="middle" style={{ marginBottom: 16 }}>
              <Col>
                <Checkbox 
                  checked={showArmeSection} 
                  onChange={e => {
                    setShowArmeSection(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedArmeId(null);
                      setSelectedArme(null);
                      if (!id) setInheritedLocation(null);
                    }
                  }}
                >
                  <Text strong>Doter une arme à ce VDP maintenant</Text>
                </Checkbox>
              </Col>
            </Row>

            {showArmeSection && (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Row gutter={16} align="bottom">
                  <Col xs={24} md={14}>
                    <Form.Item label="Rechercher une arme non dotée" style={{ marginBottom: 0 }}>
                      <Select
                        showSearch
                        allowClear
                        size="large"
                        placeholder="Tapez le N° série, la désignation ou le type..."
                        value={selectedArmeId}
                        onChange={handleArmeSelect}
                        onSearch={handleArmeSearch}
                        loading={armesLoading}
                        filterOption={false}
                        notFoundContent={armesLoading ? <Spin size="small" /> : "Aucune arme disponible"}
                        style={{ width: "100%" }}
                        suffixIcon={<SearchOutlined />}
                      >
                        {availableArmes.map(arme => (
                          <Option key={arme.id} value={arme.id}>
                            <Space>
                              <Tag color="blue">{arme.numero_serie}</Tag>
                              <span>{arme.designation || arme.type || "—"}</span>
                              {arme.categorie && <Tag>{arme.categorie}</Tag>}
                            </Space>
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={10}>
                    <Button 
                      type="primary"
                      icon={<PlusOutlined />}
                      size="large"
                      onClick={() => setShowArmeFormModal(true)}
                      style={{ width: "100%" }}
                    >
                      Créer une nouvelle arme
                    </Button>
                  </Col>
                </Row>

                {selectedArme && (
                  <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                    <Title level={5} style={{ marginBottom: 8 }}>Arme sélectionnée</Title>
                    <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" bordered>
                      <Descriptions.Item label="N° Série">{selectedArme.numero_serie || "—"}</Descriptions.Item>
                      <Descriptions.Item label="Désignation">{selectedArme.designation || "—"}</Descriptions.Item>
                      <Descriptions.Item label="Type">{selectedArme.type || "—"}</Descriptions.Item>
                      <Descriptions.Item label="Catégorie">{selectedArme.categorie || "—"}</Descriptions.Item>
                      <Descriptions.Item label="État">{selectedArme.etat || "—"}</Descriptions.Item>
                      <Descriptions.Item label="Source">{selectedArme.source_nom || "—"}</Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}
              </Space>
            )}
          </Card>

          {/* SECTION LOCALISATION HÉRITÉE */}
          <Divider orientation="left" className="vdp-section-xxxl-title animated fadeInLeft">Rattachement et localisation</Divider>
          <Card size="small" style={{ marginBottom: 24, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Title level={5} style={{ marginBottom: 8 }}>Rattachement organisationnel et localisation (hérités de l'arme dotée)</Title>
            {inheritedLocation ? (
              <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" bordered>
                <Descriptions.Item label="Entité">{inheritedLocation.entite_nom || "—"}</Descriptions.Item>
                <Descriptions.Item label="Sous-entité">{inheritedLocation.sous_entite_nom || "—"}</Descriptions.Item>
                <Descriptions.Item label="Coord. régionale">{inheritedLocation.coordination_regionale_nom || "—"}</Descriptions.Item>
                <Descriptions.Item label="Coord. provinciale">{inheritedLocation.coordination_provinciale_nom || "—"}</Descriptions.Item>
                <Descriptions.Item label="Coord. communale">{inheritedLocation.coordination_communale_nom || "—"}</Descriptions.Item>
                <Descriptions.Item label="Région">{inheritedLocation.region_nom || "—"}</Descriptions.Item>
                <Descriptions.Item label="Province">{inheritedLocation.province_nom || "—"}</Descriptions.Item>
                <Descriptions.Item label="Commune">{inheritedLocation.commune_nom || "—"}</Descriptions.Item>
                <Descriptions.Item label="Localité">{inheritedLocation.localite_nom || "—"}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary" style={{ fontStyle: 'italic' }}>
                {showArmeSection 
                  ? "Sélectionnez une arme ci-dessus pour voir sa localisation."
                  : "Le rattachement organisationnel et la localisation géographique seront automatiquement attribués lors de la dotation d'une arme au VDP."
                }
              </Text>
            )}
          </Card>

          {/* Photo et QR Code */}
          <Row gutter={32}>
            <Col xs={24} md={12}>
              <Form.Item label="Photo">
                <div className="vdp-form-media-frame">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Aperçu" className="vdp-form-media-image" />
                  ) : (
                    <span className="vdp-form-media-placeholder">Aucune photo</span>
                  )}
                </div>
                <Space align="start">
                  <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload} maxCount={1}>
                    <Button size="large" icon={<UploadOutlined />}>Télécharger une photo (max {MAX_PHOTO_SIZE_MB} Mo)</Button>
                  </Upload>
                  {photoPreview && <Button type="link" danger onClick={clearPhoto}>Supprimer</Button>}
                </Space>
                {photoError && <div className="ant-form-item-explain error">{photoError}</div>}
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="QR Code">
                <div className="vdp-form-media-frame">
                  {qrCodeURL ? (
                    <img src={qrCodeURL} alt="QR Code" className="vdp-form-media-image" />
                  ) : (
                    <span className="vdp-form-media-placeholder">Généré automatiquement</span>
                  )}
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" className="vdp-section-xxxl-title animated fadeInLeft">Observations</Divider>
          <Row gutter={32}>
            <Col xs={24}>
              <Form.Item name="observation" label="Observation">
                <Input.TextArea rows={4} size="large" placeholder="Observations diverses" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "40px 0" }} />

          <Row gutter={32}>
            <Col xs={24} md={8}>
              <Button type="primary" size="large" onClick={() => handleSubmit("valider")} loading={saving} style={{ width: "100%" }}>
                {isNew ? "Ajouter et valider" : "Modifier et valider"}
              </Button>
            </Col>
            <Col xs={24} md={8}>
              <Button type="default" size="large" onClick={() => handleSubmit("continuer")} loading={saving} style={{ width: "100%" }}>
                {isNew ? "Ajouter et continuer" : "Modifier et continuer"}
              </Button>
            </Col>
            <Col xs={24} md={8}>
              <Button size="large" onClick={() => handleSubmit("doter")} loading={saving} style={{ width: "100%", background: "#faad14", borderColor: "#faad14", color: "#fff" }}>
                {isNew ? "Ajouter et doter plus tard" : "Modifier et doter"}
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* MODAL FORMULAIRE ARME EXISTANT */}
      <Modal
        open={showArmeFormModal}
        title="Créer une nouvelle arme"
        onCancel={handleArmeFormModalClose}
        footer={null}
        width="95%"
        style={{ top: 10 }}
        destroyOnClose
        bodyStyle={{ 
          maxHeight: 'calc(100vh - 100px)', 
          overflowY: 'auto',
          padding: 0 
        }}
        closable
        maskClosable={false}
      >
        <div style={{ position: 'relative' }}>
          <div style={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            zIndex: 1000,
            background: '#fff',
            padding: '4px 12px',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Après création, fermez ce modal et sélectionnez l'arme dans la liste
            </Text>
          </div>
          <ArmeForm />
        </div>
      </Modal>
    </div>
  );
}