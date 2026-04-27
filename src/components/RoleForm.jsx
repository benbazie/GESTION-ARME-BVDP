// src/components/RoleForm.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Spin,
  Row,
  Col,
  Typography,
  message,
  Checkbox,
  Divider,
  Space,
  Tag,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import "./RoleForm.css";

const { Title, Text } = Typography;

const OPERATIONS = [
  { code: "read", label: "Lecture" },
  { code: "create", label: "Création" },
  { code: "update", label: "Mise à jour" },
  { code: "delete", label: "Suppression" },
  { code: "manage", label: "Gestion avancée" },
];

const SECTION_DEFINITIONS = [
  {
    key: "resources",
    label: "Ressources opérationnelles",
    tables: [
      "armes",
      "optiques",
      "materiels_specifiques",
      "munitions",
      "dotations",
      "transactions_munitions",
      "mouvements_munitions",
      "alertes_munitions",
      "lots",
      "chain_of_custody",
      "consommation_munitions",
      "vdp",
    ],
  },
  {
    key: "config",
    label: "Catalogues & configurations",
    tables: [
      "config_arme",
      "config_optique",
      "config_materiel",
      "config_munition",
      "types_arme",
      "categories_arme",
      "modeles_arme",
      "sources_dotation",
    ],
  },
  {
    key: "geo",
    label: "Référentiels géographiques",
    tables: [
      "regions",
      "provinces",
      "communes",
      "localites",
      "entites",
      "sous_entites",
      "coordinations",
      "coordination_regionale",
      "coordination_provinciale",
      "coordination_communale",
      "localite_coordination",
    ],
  },
  {
    key: "system",
    label: "Administration système",
    tables: [
      "utilisateurs",
      "roles",
      "user_roles",
      "sessions",
      "notifications",
      "app_config",
      "audit_logs",
      "sync_logs",
    ],
  },
];

const EXTRA_PERMISSIONS = [
  { value: "dashboard_view", label: "Consulter les tableaux de bord" },
  { value: "admin_manage", label: "Gestion des exports/imports" },
  { value: "module_systeme", label: "Module Système" },
  { value: "module_configurations", label: "Module Configurations" },
  { value: "module_localisation", label: "Module Localisation" },
  { value: "module_entites", label: "Module Entités" },
  { value: "module_coordinations", label: "Module Coordinations" },
  { value: "module_ddr", label: "Module DDR" },
  { value: "module_suivi", label: "Module Suivi" },
];

const toTitle = (value) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const buildPermissions = (tables) =>
  tables.flatMap((table) =>
    OPERATIONS.map((op) => ({
      value: `${table}_${op.code}`,
      label: `${toTitle(table)} — ${op.label}`,
    }))
  );

const PERMISSION_SECTIONS = SECTION_DEFINITIONS.map((section) => ({
  key: section.key,
  label: section.label,
  permissions: buildPermissions(section.tables),
}));

const GLOBAL_SECTION = {
  key: "global",
  label: "Permissions globales",
  permissions: [
    { value: "*", label: "Super administrateur (tous les droits)" },
    ...EXTRA_PERMISSIONS,
  ],
};

const KNOWN_PERMISSION_VALUES = new Set([
  ...GLOBAL_SECTION.permissions.map((p) => p.value),
  ...PERMISSION_SECTIONS.flatMap((section) =>
    section.permissions.map((p) => p.value)
  ),
]);

export default function RoleForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [customPermissions, setCustomPermissions] = useState([]);

  const callBridge = useCallback(async (method, ...args) => {
    const primary = window.api;
    if (primary && typeof primary[method] === "function")
      return primary[method](...args);
    const fallback = window.electronAPI;
    if (fallback && typeof fallback[method] === "function")
      return fallback[method](...args);
    throw new Error(`Handler ${method} indisponible`);
  }, []);

  // 1. Charger le rôle en édition
  const loadRole = useCallback(async () => {
    if (!id) {
      setSelectedPermissions([]);
      setCustomPermissions([]);
      form.setFieldsValue({ nom: "", permissions: [] });
      return;
    }
    setLoading(true);
    try {
      const role = await callBridge("getRoleById", Number(id));
      if (!role) {
        message.error("Rôle introuvable");
        return navigate("/roles", { replace: true });
      }
      // Permissions stockées en JSON string → tableau
      const perms = Array.isArray(role.permissions)
        ? role.permissions
        : JSON.parse(role.permissions || "[]");
      const initialSelection = perms.includes("*") ? ["*"] : perms;
      setSelectedPermissions(initialSelection);
      setCustomPermissions(
        initialSelection.filter((perm) => !KNOWN_PERMISSION_VALUES.has(perm) && perm !== "*")
      );
      form.setFieldsValue({
        nom: role.nom,
        permissions: initialSelection,
      });
    } catch (err) {
      console.error("getRole", err);
      message.error("Erreur lors du chargement du rôle");
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate, callBridge]);

  useEffect(() => {
    loadRole();
  }, [loadRole]);

  useEffect(() => {
    form.setFieldsValue({ permissions: selectedPermissions });
  }, [selectedPermissions, form]);

  const isSuperAdmin = selectedPermissions.includes("*");

  const handleToggle = (value, checked) => {
    if (value === "*") {
      setSelectedPermissions(checked ? ["*"] : []);
      return;
    }
    let next = selectedPermissions.filter((perm) => perm !== "*");
    next = checked
      ? Array.from(new Set([...next, value]))
      : next.filter((perm) => perm !== value);
    setSelectedPermissions(next);
  };

  const handleSelectAll = () => {
    const all = Array.from(KNOWN_PERMISSION_VALUES).filter((perm) => perm !== "*");
    const merged = Array.from(new Set([...all, ...customPermissions]));
    setSelectedPermissions(merged);
  };

  const handleClearAll = () => setSelectedPermissions([]);

  const handleSetSuperAdmin = () => setSelectedPermissions(["*"]);

  // 2. Soumettre le formulaire (create/update)
  const onFinish = async (values) => {
    setSaving(true);
    try {
      const effectivePermissions = selectedPermissions.includes("*")
        ? ["*"]
        : selectedPermissions;
      const payload = {
        nom: values.nom.trim(),
        permissions: effectivePermissions,
      };

      if (id) {
        await callBridge("updateRole", { id: Number(id), ...payload });
        message.success("Rôle mis à jour avec succès");
        navigate("/roles", { replace: true });
      } else {
        const created = await callBridge("createRole", payload);
        message.success("Rôle créé avec succès");
        if (created && created.id) {
          navigate(`/roles/edit/${created.id}`, { replace: true });
        } else {
          navigate("/roles", { replace: true });
        }
      }
    } catch (err) {
      console.error("saveRole", err);
      if (err?.status === 500 && err?.payload?.detail?.includes("UNIQUE")) {
        message.error("Un rôle portant ce nom existe déjà.");
      } else {
        message.error("Erreur lors de la sauvegarde du rôle");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Row justify="center" style={{ padding: 24 }}>
        <Col xs={24} sm={20} md={16} lg={12}>
          <Card
            className="role-form-card"
            title={
              <div style={{ display: "flex", alignItems: "center" }}>
                <Button
                  type="link"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/roles")}
                />
                <Title level={4} style={{ margin: 0 }}>
                  {id ? "Modifier le Rôle" : "Ajouter un Rôle"}
                </Title>
              </div>
            }
          >
            <Text type="secondary">
              Remplissez le nom du rôle puis cochez les permissions souhaitées.
            </Text>

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              style={{ marginTop: 16 }}
              disabled={saving}
            >
              <Form.Item
                name="nom"
                label="Nom du Rôle *"
                rules={[
                  { required: true, message: "Le nom du rôle est requis" },
                  { whitespace: true, message: "Le nom ne peut être vide" },
                ]}
              >
                <Input placeholder="Ex : gestionnaire_operations" />
              </Form.Item>

              <Form.Item label="Permissions">
                <Space size="small" wrap style={{ marginBottom: 8 }}>
                  <Button size="small" onClick={handleSelectAll}>
                    Tout sélectionner
                  </Button>
                  <Button size="small" onClick={handleClearAll}>
                    Tout désélectionner
                  </Button>
                  <Button size="small" type="primary" onClick={handleSetSuperAdmin}>
                    Super administrateur
                  </Button>
                </Space>
                {[GLOBAL_SECTION, ...PERMISSION_SECTIONS].map((section) => (
                  <div key={section.key} style={{ marginBottom: 12 }}>
                    <Divider orientation="left" plain>
                      {section.label}
                    </Divider>
                    <Space size={[12, 8]} wrap>
                      {section.permissions.map((perm) => (
                        <Checkbox
                          key={perm.value}
                          checked={selectedPermissions.includes(perm.value)}
                          disabled={isSuperAdmin && perm.value !== "*"}
                          onChange={(e) => handleToggle(perm.value, e.target.checked)}
                        >
                          {perm.label}
                        </Checkbox>
                      ))}
                    </Space>
                  </div>
                ))}
                {customPermissions.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Divider orientation="left" plain>
                      Permissions personnalisées
                    </Divider>
                    <Space size={[8, 8]} wrap>
                      {customPermissions.map((perm) => (
                        <Tag key={perm} color="geekblue">
                          {perm}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
              </Form.Item>

              <Form.Item name="permissions" hidden>
                <Input type="hidden" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={saving}
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

