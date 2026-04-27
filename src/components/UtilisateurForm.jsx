// src/components/UtilisateurForm.js
import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Button,
  Select,
  Spin,
  message,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import "./UtilisateurForm.css";
import api from "../api";

const { Option } = Select;

const API_BASE_URL =
  api?.http?.defaults?.baseURL?.replace(/\/$/, "") ||
  api?.defaults?.baseURL?.replace(/\/$/, "") ||
  (import.meta.env?.VITE_API_URL || "http://127.0.0.1:3001/api");

const restFetch = async (url, options) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (response.ok) return response.json();
  const payload = await response.json().catch(() => ({}));
  const error = new Error(payload?.error || "Requête invalide");
  error.status = response.status;
  error.payload = payload;
  throw error;
};

const utilisateursApi = {
  async getById(id) {
    if (typeof window.api?.getUtilisateursById === "function") return window.api.getUtilisateursById(id);
    if (typeof window.api?.getUtilisateurById === "function") return window.api.getUtilisateurById(id);
    if (typeof api.getUtilisateursById === "function") return api.getUtilisateursById(id);
    if (typeof api.getUtilisateurById === "function") return api.getUtilisateurById(id);
    return restFetch(`${API_BASE_URL}/utilisateurs/${id}`);
  },
  async create(body) {
    if (typeof window.api?.createUtilisateurs === "function") return window.api.createUtilisateurs(body);
    if (typeof api.createUtilisateurs === "function") return api.createUtilisateurs(body);
    return restFetch(`${API_BASE_URL}/utilisateurs`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  async update(id, body) {
    const payload = { ...body, id: Number(id) };
    if (typeof window.api?.updateUtilisateurs === "function") return window.api.updateUtilisateurs(payload);
    if (typeof window.api?.updateUtilisateur === "function") {
      return window.api.updateUtilisateur.length >= 2
        ? window.api.updateUtilisateur(Number(id), body)
        : window.api.updateUtilisateur(payload);
    }
    if (typeof api.updateUtilisateurs === "function") return api.updateUtilisateurs(payload);
    if (typeof api.updateUtilisateur === "function") return api.updateUtilisateur(payload);
    return restFetch(`${API_BASE_URL}/utilisateurs/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};

export default function UtilisateurForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams(); // mode édition si présent
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [entites, setEntites] = useState([]);
  const [sousEntites, setSousEntites] = useState([]);
  const [coordRegionales, setCoordRegionales] = useState([]);
  const [coordProvinciales, setCoordProvinciales] = useState([]);
  const [coordCommunales, setCoordCommunales] = useState([]);

  const callBridge = useCallback(async (method, ...args) => {
    const primary = window.api;
    if (primary && typeof primary[method] === "function") return primary[method](...args);
    const fallback = window.electronAPI;
    if (fallback && typeof fallback[method] === "function") return fallback[method](...args);
    throw new Error(`Handler ${method} indisponible`);
  }, []);

  // 1. Charger la liste des rôles
  const loadRoles = useCallback(async () => {
    try {
      const list = await callBridge("getRolesList");
      setRoles(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("getRolesList", err);
      message.error("Impossible de charger les rôles");
    }
  }, [callBridge]);

  // 2. En mode édition, récupérer l'utilisateur
  const loadUtilisateur = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await utilisateursApi.getById(Number(id));
      if (!data) {
        message.error("Utilisateur introuvable");
        return navigate("/dashboard/utilisateurs", { replace: true });
      }
      form.setFieldsValue({
        username: data.username,
        nom: data.nom,
        prenom: data.prenom,
        grade: data.grade,
        contact: data.contact,
        email: data.email,
        entite_id: data.entite_id,
        sous_entite_id: data.sous_entite_id,
        coordination_regionale_id: data.coordination_regionale_id,
        coordination_provinciale_id: data.coordination_provinciale_id,
        coordination_communale_id: data.coordination_communale_id,
        role_id: data.role_id ?? undefined,
      });
    } catch (error) {
      console.error("getUtilisateurById", error);
      message.error("Erreur lors du chargement de l'utilisateur");
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate]);

  const loadLookups = useCallback(async () => {
    try {
      const [
        entitesData,
        sousEntitesData,
        coordRegData,
        coordProvData,
        coordComData,
      ] = await Promise.all([
        api.getEntitesList?.() ?? [],
        api.getSousEntitesList?.() ?? [],
        api.getCoordinationRegionaleList?.() ?? [],
        api.getCoordinationProvincialeList?.() ?? [],
        api.getCoordinationCommunaleList?.() ?? [],
      ]);
      setEntites(Array.isArray(entitesData) ? entitesData : []);
      setSousEntites(Array.isArray(sousEntitesData) ? sousEntitesData : []);
      setCoordRegionales(Array.isArray(coordRegData) ? coordRegData : []);
      setCoordProvinciales(Array.isArray(coordProvData) ? coordProvData : []);
      setCoordCommunales(Array.isArray(coordComData) ? coordComData : []);
    } catch (error) {
      console.warn("lookup load failed", error);
    }
  }, []);

  useEffect(() => {
    loadRoles();
    loadLookups();
    loadUtilisateur();
  }, [loadRoles, loadLookups, loadUtilisateur]);

  // 3. Soumission du formulaire
  const handleFinish = async (values) => {
    const payload = {
      username: values.username.trim(),
      role_id: values.role_id ? Number(values.role_id) : null,
      nom: values.nom?.trim() || null,
      prenom: values.prenom?.trim() || null,
      grade: values.grade?.trim() || null,
      contact: values.contact?.trim() || null,
      email: values.email?.trim() || null,
      entite_id: values.entite_id ?? null,
      sous_entite_id: values.sous_entite_id ?? null,
      coordination_regionale_id: values.coordination_regionale_id ?? null,
      coordination_provinciale_id: values.coordination_provinciale_id ?? null,
      coordination_communale_id: values.coordination_communale_id ?? null,
    };
    if (values.password) payload.password = values.password;
    setSaving(true);
    try {
      if (id) {
        await utilisateursApi.update(Number(id), payload);
        message.success("Utilisateur mis à jour avec succès");
      } else {
        await utilisateursApi.create(payload);
        message.success("Nouvel utilisateur créé avec succès");
      }
      navigate("/dashboard/utilisateurs");
    } catch (error) {
      console.error("saveUtilisateur", error);
      message.error("Erreur lors de la sauvegarde de l'utilisateur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row justify="center" style={{ margin: 24 }}>
        <Col xs={24} sm={20} md={16} lg={12}>
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center" }}>
                <Button
                  type="link"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/dashboard/utilisateurs")}
                />
                <h3 style={{ margin: 0 }}>
                  {id ? "Modifier l'Utilisateur" : "Ajouter un Utilisateur"}
                </h3>
              </div>
            }
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleFinish}
              disabled={saving}
            >
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="nom"
                    label="Nom"
                    rules={[{ required: true, message: "Nom requis" }]}
                  >
                    <Input placeholder="Nom" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="prenom"
                    label="Prénom"
                    rules={[{ required: true, message: "Prénom requis" }]}
                  >
                    <Input placeholder="Prénom" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="grade" label="Grade">
                    <Input placeholder="Grade / fonction" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="contact" label="Téléphone">
                    <Input placeholder="Contact" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: "email", message: "Email invalide" }]}
              >
                <Input placeholder="Adresse email" />
              </Form.Item>
              <Form.Item
                name="username"
                label="Identifiant *"
                rules={[
                  { required: true, message: "Veuillez saisir le nom d'utilisateur" },
                  { whitespace: true, message: "Le nom ne peut être vide" },
                ]}
              >
                <Input placeholder="Ex : johndoe" />
              </Form.Item>

              <Form.Item
                name="password"
                label={id ? "Nouveau mot de passe" : "Mot de passe *"}
                rules={[
                  !id && { required: true, message: "Veuillez saisir un mot de passe" },
                  { min: 6, message: "Minimum 6 caractères" },
                ].filter(Boolean)}
              >
                <Input.Password placeholder={id ? "Laisser vide pour conserver" : "Ex : ******"} />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirmation du mot de passe"
                dependencies={["password"]}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const current = getFieldValue("password");
                      if (!current) return Promise.resolve();
                      return value === current
                        ? Promise.resolve()
                        : Promise.reject(new Error("Les mots de passe ne correspondent pas"));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Confirmez le mot de passe" />
              </Form.Item>

              <Form.Item
                name="role_id"
                label="Rôle *"
                rules={[{ required: true, message: "Veuillez sélectionner un rôle" }]}
              >
                <Select placeholder="Sélectionner un rôle">
                  {roles.map((r) => (
                    <Option key={r.id} value={r.id}>
                      {r.nom}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="entite_id" label="Entité">
                    <Select
                      allowClear
                      placeholder="Choisir une entité"
                      onChange={() => {
                        form.setFieldsValue({
                          sous_entite_id: undefined,
                          coordination_regionale_id: undefined,
                          coordination_provinciale_id: undefined,
                          coordination_communale_id: undefined,
                        });
                      }}
                    >
                      {entites.map((entite) => (
                        <Option key={entite.id} value={entite.id}>
                          {entite.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="sous_entite_id" label="Sous-entité">
                    <Select allowClear placeholder="Filtrée par entité sélectionnée">
                      {sousEntites
                        .filter(
                          (item) =>
                            !form.getFieldValue("entite_id") ||
                            String(item.entite_id) === String(form.getFieldValue("entite_id"))
                        )
                        .map((item) => (
                          <Option key={item.id} value={item.id}>
                            {item.nom}
                          </Option>
                        ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item name="coordination_regionale_id" label="Coord. régionale">
                    <Select
                      allowClear
                      placeholder="Sélectionner"
                      onChange={() => {
                        form.setFieldsValue({
                          coordination_provinciale_id: undefined,
                          coordination_communale_id: undefined,
                        });
                      }}
                    >
                      {coordRegionales.map((coord) => (
                        <Option key={coord.id} value={coord.id}>
                          {coord.nom}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="coordination_provinciale_id" label="Coord. provinciale">
                    <Select
                      allowClear
                      placeholder="Filtrée par coord. régionale"
                      onChange={() => form.setFieldsValue({ coordination_communale_id: undefined })}
                    >
                      {coordProvinciales
                        .filter(
                          (coord) =>
                            !form.getFieldValue("coordination_regionale_id") ||
                            String(coord.parent_id) ===
                              String(form.getFieldValue("coordination_regionale_id"))
                        )
                        .map((coord) => (
                          <Option key={coord.id} value={coord.id}>
                            {coord.nom}
                          </Option>
                        ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="coordination_communale_id" label="Coord. communale">
                    <Select allowClear placeholder="Filtrée par coord. provinciale">
                      {coordCommunales
                        .filter(
                          (coord) =>
                            !form.getFieldValue("coordination_provinciale_id") ||
                            String(coord.parent_id) ===
                              String(form.getFieldValue("coordination_provinciale_id"))
                        )
                        .map((coord) => (
                          <Option key={coord.id} value={coord.id}>
                            {coord.nom}
                          </Option>
                        ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                  block
                >
                  {id ? "Mettre à jour" : "Enregistrer"}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
