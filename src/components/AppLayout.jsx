// src/components/AppLayout.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Layout, Menu, Dropdown, Button, Avatar, Modal, message, Form, Input, Checkbox } from "antd";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  DashboardOutlined,
  UserOutlined,
  BarsOutlined,
  SettingOutlined,
  TeamOutlined,
  FileOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  ClusterOutlined,
  UploadOutlined,
  DownloadOutlined,
  SaveOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import ExportHeaderFooterConfig from "./ExportHeaderFooterConfig";
import api from "../api";
import BackupManager from "./BackupManager";
import "./AppLayout.css";

const { Header, Sider, Content, Footer } = Layout;

const normalizeStringList = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (item == null ? [] : [String(item)]))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    if (raw === 'ALL' || raw === '*') return ['*'];
    try {
      const parsed = JSON.parse(raw);
      return normalizeStringList(parsed);
    } catch {
      // CSV/space separated
      return raw
        .split(/[\s,;]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part === 'ALL' ? '*' : part));
    }
  }

  if (typeof value === 'object') {
    if (Array.isArray(value.permissions)) return normalizeStringList(value.permissions);
    if (typeof value.permissions === 'string') return normalizeStringList(value.permissions);
  }

  return [];
};

const normalizeRoleNames = (rolesValue) => {
  if (!rolesValue) return [];
  if (!Array.isArray(rolesValue)) return normalizeStringList(rolesValue);
  return rolesValue
    .map((role) => {
      if (!role) return null;
      if (typeof role === 'string') return role;
      if (typeof role === 'object') return role.nom || role.name || role.label || role.code || null;
      return String(role);
    })
    .filter(Boolean)
    .map((role) => String(role).trim())
    .filter(Boolean);
};

const MODULE_PERMISSION_MAP = {
  systeme: 'module_systeme',
  configurations: 'module_configurations',
  localisation: 'module_localisation',
  entites: 'module_entites',
  // Conteneur (menu) : l'accès réel est géré par sous-modules ci-dessous.
  coordinations: 'module_coordinations',
  coordination_regionale: 'coordination_regionale_read',
  coordination_provinciale: 'coordination_provinciale_read',
  coordination_communale: 'coordination_communale_read',
  localite_coordination: 'localite_coordination_read',
  ddr: 'module_ddr',
  suivi: 'module_suivi',
};

const MODULE_FALLBACK_PERMISSIONS = {
  coordinations: [
    'coordinations_read',
    'coordinations_manage',
    'coordination_regionale_read',
    'coordination_provinciale_read',
    'coordination_communale_read',
    'localite_coordination_read',
  ],
  coordination_regionale: [
    'module_coordinations',
    'coordinations_read',
    'coordinations_manage',
    'coordination_regionale_read',
    'coordination_regionale_create',
    'coordination_regionale_update',
    'coordination_regionale_delete',
    'coordination_regionale_manage',
  ],
  coordination_provinciale: [
    'module_coordinations',
    'coordinations_read',
    'coordinations_manage',
    'coordination_provinciale_read',
    'coordination_provinciale_create',
    'coordination_provinciale_update',
    'coordination_provinciale_delete',
    'coordination_provinciale_manage',
  ],
  coordination_communale: [
    'module_coordinations',
    'coordinations_read',
    'coordinations_manage',
    'coordination_communale_read',
    'coordination_communale_create',
    'coordination_communale_update',
    'coordination_communale_delete',
    'coordination_communale_manage',
    // L'écran communale consomme aussi les localités liées
    'localite_coordination_read',
    'localite_coordination_create',
    'localite_coordination_update',
    'localite_coordination_delete',
    'localite_coordination_manage',
  ],
  localite_coordination: [
    'module_coordinations',
    'localite_coordination_read',
    'localite_coordination_create',
    'localite_coordination_update',
    'localite_coordination_delete',
    'localite_coordination_manage',
    'coordination_communale_read',
  ],
  localisation: ['localites_read', 'provinces_read', 'communes_read', 'regions_read'],
  configurations: ['config_arme_read', 'config_munition_read', 'config_materiel_read', 'config_optique_read'],
  systeme: ['roles_manage', 'utilisateurs_manage', 'audit_logs_read'],
  entites: ['entites_read', 'sous_entites_read'],
  ddr: ['ddr_read'],
  suivi: ['munition/history_read', 'munition/alerts_read'],
};

const MODULE_PATHS = {
  systeme: [
    '/audit-logs',
    '/sync-logs',
    '/sessions',
    '/notifications',
    '/config-app',
    '/consommation-munitions',
    '/utilisateurs',
    '/roles',
  ],
  configurations: [
    '/config-arme',
    '/config-munition',
    '/config-optique',
    '/config-materiel',
    '/sources',
    '/lots',
  ],
  localisation: ['/regions', '/provinces', '/communes', '/localites'],
  entites: ['/entites'],
  // On évite de bloquer toutes les coordinations en bloc : contrôle fin par sous-écran.
  coordinations: ['/dashboard/coordinations'],
  coordination_regionale: ['/dashboard/coordinations/regionale'],
  coordination_provinciale: ['/dashboard/coordinations/provinciale'],
  coordination_communale: ['/dashboard/coordinations/communale'],
  ddr: ['/ddr'],
  suivi: ['/munition/history', '/munition/alerts'],
};

const pathMatchesModule = (pathname, moduleKey) => {
  const bases = MODULE_PATHS[moduleKey] || [];
  return bases.some((base) => pathname === base || pathname.startsWith(`${base}/`));
};

const resolveModuleFromPath = (pathname) => {
  // Choisit le module le plus spécifique (base la plus longue) pour éviter
  // qu'un module "conteneur" (/dashboard/coordinations) bloque ses sous-pages.
  if (!pathname) return null;
  let best = null;
  let bestLen = -1;
  for (const [moduleKey, bases] of Object.entries(MODULE_PATHS)) {
    for (const base of bases || []) {
      if (!base) continue;
      const match = pathname === base || pathname.startsWith(`${base}/`);
      if (match && base.length > bestLen) {
        best = moduleKey;
        bestLen = base.length;
      }
    }
  }
  return best;
};

function getSelectedMenuKey(pathname) {
  if (pathname.startsWith("/dashboard/coordinations/regionale")) return "/dashboard/coordinations/regionale";
  if (pathname.startsWith("/dashboard/coordinations/provinciale")) return "/dashboard/coordinations/provinciale";
  if (pathname.startsWith("/dashboard/coordinations/communale")) return "/dashboard/coordinations/communale";
  if (pathname.startsWith("/dashboard")) return "/dashboard";
  return pathname;
}

// Liste des tables exportables
const EXPORT_GROUPS = [
  {
    key: "geo",
    label: "Hiérarchie géographique",
    tables: [
      { key: "regions", label: "Régions" },
      { key: "provinces", label: "Provinces" },
      { key: "communes", label: "Communes" },
      { key: "localites", label: "Localités" },
    ],
  },
  {
    key: "structures",
    label: "Structures & coordinations",
    tables: [
      { key: "entites", label: "Entités" },
      { key: "sous_entites", label: "Sous-entités" },
      { key: "coordinations", label: "Coordinations" },
      { key: "coordination_regionale", label: "Coord. régionales" },
      { key: "coordination_provinciale", label: "Coord. provinciales" },
      { key: "coordination_communale", label: "Coord. communales" },
      { key: "localite_coordination", label: "Coord. localités" },
    ],
  },
  {
    key: "catalogues",
    label: "Catalogues de configuration",
    tables: [
      { key: "config_armes", label: "Config Armes" },
      { key: "config_optiques", label: "Config Optiques" },
      { key: "config_materiels", label: "Config Matériels" },
      { key: "config_munitions", label: "Config Munitions" },
    ],
  },
  {
    key: "ressources",
    label: "Ressources opérationnelles",
    tables: [
      { key: "armes", label: "Armes" },
      { key: "optiques", label: "Optiques" },
      { key: "materiels_specifiques", label: "Matériel spécifique" },
      { key: "munitions", label: "Munitions" },
      { key: "lots", label: "Lots" },
      { key: "dotations", label: "VDP" },
    ],
  },
];

const FLAT_EXPORT_TABLES = EXPORT_GROUPS.flatMap((group) => group.tables);

const API_PATH_ALIASES = {
  config_armes: "config_arme",
  config_optiques: "config_optique",
  config_materiels: "config_materiel",
  config_munitions: "config_munition",
  materiels_specifiques: "materiels_specifiques",
};

// Module dédié d’export (à placer dans le même fichier ou à extraire)
function useExportModal() {
  const modalRef = useRef();
  const [visible, setVisible] = useState(false);
  const [selectedTables, setSelectedTables] = useState(
    FLAT_EXPORT_TABLES.map((t) => t.key)
  );
  const [loading, setLoading] = useState(false);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);
  const toPascalCase = (value = "") =>
    value
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

  const methodCandidatesFor = (tableKey) => {
    const variants = new Set([
      tableKey,
      API_PATH_ALIASES[tableKey] || tableKey,
    ]);
    return Array.from(variants).map((variant) => `get${toPascalCase(variant)}List`);
  };

  const fetchTableData = async (tableKey) => {
    const methodNames = methodCandidatesFor(tableKey);

    const invoke = async (target) => {
      if (!target) return null;
      for (const methodName of methodNames) {
        if (typeof target[methodName] === "function") {
          const result = await target[methodName]();
          if (Array.isArray(result)) return result;
          if (result && Array.isArray(result.rows)) return result.rows;
          if (result && Array.isArray(result.data)) return result.data;
          if (result !== null && result !== undefined) return result;
        }
      }
      return null;
    };

    const providerResult =
      (await invoke(window.electronAPI)) ??
      (await invoke(window.api)) ??
      (await invoke(api));

    if (providerResult !== null) return providerResult;

    try {
      const apiPath = (API_PATH_ALIASES[tableKey] || tableKey).replace(/^\//, "");
      const httpPath = tableKey.replace(/^\//, "");
      const baseURL =
        api?.client?.defaults?.baseURL ||
        api?.defaults?.baseURL ||
        import.meta.env?.VITE_API_URL ||
        `${window.location.origin}/api`;
      const token =
        window.localStorage?.getItem("token") ||
        window.localStorage?.getItem("authToken") ||
        null;
      const response = await fetch(
        `${baseURL.replace(/\/$/, "")}/${httpPath}`,
        {
          headers: token
            ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
            : {},
          credentials: "include",
        }
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.rows)) return data.rows;
      if (data && Array.isArray(data.data)) return data.data;
      return data ?? null;
    } catch (fallbackErr) {
      console.error(`[export] ${tableKey} fetch fallback:`, fallbackErr);
      return null;
    }
  };

  const setSelection = (updater) =>
    setSelectedTables((prev) => {
      const next = new Set(
        typeof updater === "function" ? updater(prev) : updater
      );
      return FLAT_EXPORT_TABLES.map((t) => t.key).filter((key) =>
        next.has(key)
      );
    });

  const toggleTable = (tableKey, checked) =>
    setSelection((prev) => {
      const draft = new Set(prev);
      if (checked) draft.add(tableKey);
      else draft.delete(tableKey);
      return draft;
    });

  const toggleGroup = (group, checked) => {
    const keys = group.tables.map((t) => t.key);
    setSelection((prev) => {
      const draft = new Set(prev);
      keys.forEach((key) => (checked ? draft.add(key) : draft.delete(key)));
      return draft;
    });
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const orderedTables = FLAT_EXPORT_TABLES.filter(({ key }) =>
        selectedTables.includes(key)
      );
      const fileName = `export-gestion-armes-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      const data = {};
      const failures = [];
      for (const { key: tbl } of orderedTables) {
        try {
          const tableData = await fetchTableData(tbl);
          if (tableData !== null) {
            data[tbl] = tableData;
          } else {
            failures.push(tbl);
          }
        } catch (err) {
          console.error(`[export] ${tbl}:`, err);
          failures.push(tbl);
        }
      }
      if (!Object.keys(data).length) {
        throw new Error("Aucune donnée exportée. Vérifiez les tables sélectionnées.");
      }
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      if (failures.length) {
        message.warning(`Export partiel : ${failures.join(", ")} non récupérées.`);
      } else {
        message.success("Export JSON téléchargé !");
      }
      hide();
    } catch (e) {
      message.error("Erreur lors de l'export : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const ExportModal = (
    <Modal
      title="Exporter les données"
      open={visible}
      onOk={handleExport}
      onCancel={hide}
      okText="Exporter"
      cancelText="Annuler"
      okButtonProps={{ loading }}
    >
      <div style={{ display: "grid", gap: 12 }}>
        {EXPORT_GROUPS.map((group) => {
          const groupKeys = group.tables.map((t) => t.key);
          const allChecked = groupKeys.every((key) =>
            selectedTables.includes(key)
          );
          const partiallyChecked =
            !allChecked &&
            groupKeys.some((key) => selectedTables.includes(key));
          return (
            <div
              key={group.key}
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong>{group.label}</strong>
                <Checkbox
                  indeterminate={partiallyChecked}
                  checked={allChecked}
                  onChange={(e) => toggleGroup(group, e.target.checked)}
                >
                  Tout sélectionner
                </Checkbox>
              </div>
              <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                {group.tables.map((table) => (
                  <Checkbox
                    key={table.key}
                    checked={selectedTables.includes(table.key)}
                    onChange={(e) => toggleTable(table.key, e.target.checked)}
                  >
                    {table.label}
                  </Checkbox>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "#888", marginTop: 12 }}>
        Le fichier sera enregistré dans le dossier choisi.
      </p>
    </Modal>
  );

  return { show, ExportModal };
}

// Nouvelle fonction d’import avec feedback utilisateur
async function importAllDataFromFile() {
  const toPascal = (value = "") =>
    value
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

  const toSingularPascal = (value = "") => {
    const pascal = toPascal(value);
    return pascal.endsWith("s") ? pascal.slice(0, -1) : pascal;
  };

  const buildMethodCandidates = (table) => {
    const pascal = toPascal(table);
    const singular = toSingularPascal(table);
    const bases = new Set([pascal, singular]);
    const suffixes = ["add", "create", "insert"];
    const list = [];
    bases.forEach((base) => {
      suffixes.forEach((prefix) => list.push(`${prefix}${base}`));
    });
    return list;
  };

  const resolveCall = async (table, payload, allowForce = false) => {
    const methods = buildMethodCandidates(table);
    const targets = [window.electronAPI, window.api, api];
    let lastError = null;

    for (const target of targets) {
      if (!target) continue;
      for (const method of methods) {
        if (typeof target[method] === "function") {
          try {
            return await target[method](payload);
          } catch (err) {
            lastError = err;
          }
        }
      }
    }

    // Fallback via api.call si disponible (ex: api.call('createCommune', payload))
    for (const method of methods) {
      try {
        const result = await api.call?.(method, payload);
        if (result !== undefined && result !== null) return result;
      } catch (err) {
        lastError = err;
      }
    }

    if (!allowForce && lastError) throw lastError;
    if (!allowForce) throw new Error(`Aucun handler trouvé pour ${table}`);
    return null;
  };

  const callProviderMethod = async (provider, methodName, ...args) => {
    if (!provider || typeof provider[methodName] !== "function") return undefined;
    try {
      return await provider[methodName](...args);
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      if (status === 404) return null;
      throw err;
    }
  };

  const unwrapList = (result) => {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.rows)) return result.rows;
    if (Array.isArray(result?.data)) return result.data;
    return [];
  };

  const existingCache = new Map();
  const loadExistingForTable = async (table) => {
    if (existingCache.has(table)) return existingCache.get(table);
    const methodName = `get${toPascal(table)}List`;
    let rows = [];
    const provider =
      window.electronAPI?.[methodName] ? window.electronAPI :
      window.api?.[methodName] ? window.api :
      null;
    if (provider) {
      try {
        rows = unwrapList(
          await callProviderMethod(provider, methodName, { includeDeleted: true })
        );
      } catch (err) {
        const status = err?.status ?? err?.response?.status;
        if (status !== 404) throw err;
      }
    }
    existingCache.set(table, rows);
    return rows;
  };

  const findCachedRow = async (table, id) => {
    if (!id) return null;
    const rows = await loadExistingForTable(table);
    const target = String(id);
    return rows.find((entry) => entry && String(entry.id) === target) || null;
  };

  const ensureFromCache = (table, item) => {
    const cache = existingCache.get(table);
    if (!cache) return;
    const idx = cache.findIndex((entry) => entry && String(entry.id) === String(item.id));
    if (idx >= 0) cache[idx] = { ...cache[idx], ...item };
  };

  const hydrateGeoFields = async (table, record) => {
    if (!record || typeof record !== "object") return;

    const setIfMissing = (key, value) => {
      if (value != null && value !== "" && (record[key] == null || record[key] === "")) {
        record[key] = value;
      }
    };

    if (table === "provinces") {
      if (!record.region_id && record.region) {
        const regionRow = await findCachedRow("regions", record.region);
        setIfMissing("region_id", regionRow?.id);
      }
      return;
    }

    if (table === "communes") {
      if (!record.region_id && record.province_id) {
        const provinceRow = await findCachedRow("provinces", record.province_id);
        setIfMissing("region_id", provinceRow?.region_id);
      }
      return;
    }

    if (table === "localites") {
      if (record.commune_id) {
        const communeRow = await findCachedRow("communes", record.commune_id);
        setIfMissing("region_id", communeRow?.region_id);
        setIfMissing("province_id", communeRow?.province_id);
      }
      if (!record.commune_id && record.province_id) {
        const provinceRow = await findCachedRow("provinces", record.province_id);
        setIfMissing("region_id", provinceRow?.region_id);
      }
      return;
    }

    if (table === "sous_entites") {
      if (record.entite_id) {
        const entiteRow = await findCachedRow("entites", record.entite_id);
        setIfMissing("region_id", entiteRow?.region_id);
        setIfMissing("province_id", entiteRow?.province_id);
        setIfMissing("commune_id", entiteRow?.commune_id);
        setIfMissing("localite_id", entiteRow?.localite_id);
      }
      return;
    }

    if (table === "coordinations") {
      if (record.entite_id) {
        const entiteRow = await findCachedRow("entites", record.entite_id);
        setIfMissing("region_id", entiteRow?.region_id);
        setIfMissing("province_id", entiteRow?.province_id);
        setIfMissing("commune_id", entiteRow?.commune_id);
        setIfMissing("localite_id", entiteRow?.localite_id);
      }
      return;
    }

    if (table === "coordination_provinciale") {
      if (record.province_id) {
        const provinceRow = await findCachedRow("provinces", record.province_id);
        setIfMissing("region_id", provinceRow?.region_id);
      }
      if (record.parent_id) {
        const regional = await findCachedRow("coordination_regionale", record.parent_id);
        setIfMissing("region_id", regional?.region_id ?? regional?.region);
      }
      return;
    }

    if (table === "coordination_communale") {
      if (record.commune_id) {
        const communeRow = await findCachedRow("communes", record.commune_id);
        setIfMissing("province_id", communeRow?.province_id);
        setIfMissing("region_id", communeRow?.region_id);
      }
      if (record.parent_id) {
        const prov = await findCachedRow("coordination_provinciale", record.parent_id);
        setIfMissing("province_id", prov?.province_id);
        setIfMissing("region_id", prov?.region_id);
      }
      return;
    }
  };

  const markInserted = (table, item) => {
    const cache = existingCache.get(table);
    if (!cache) return;
    cache.push(item);
  };

  try {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        message.error("Fichier JSON invalide");
        return;
      }
      let total = 0, doublons = 0, inserted = 0, errors = 0;
      const duplicates = [];
      const errorsDetails = [];
      const forceableTables = new Set(["armes"]);
      const hide = message.loading("Import en cours...", 0);
      const tablePriority = new Map([
        ['regions', 10],
        ['provinces', 20],
        ['communes', 30],
        ['localites', 40],
        ['entites', 50],
        ['sous_entites', 60],
        ['coordinations', 70],
        ['coordination_regionale', 80],
        ['coordination_provinciale', 90],
        ['coordination_communale', 100],
        ['localite_coordination', 110],
      ]);
      const priorityOf = (name) => tablePriority.get(name) ?? 1000;
      const orderedTables = Object.keys(data)
        .sort((a, b) => priorityOf(a) - priorityOf(b));
      for (const tbl of orderedTables) {
        const items = Array.isArray(data[tbl]) ? data[tbl] : [];
        for (const item of items) {
          let exists = false;
          try {
            const working = { ...item };
            await hydrateGeoFields(tbl, working);
            if (working.id != null) ensureFromCache(tbl, working);

            const existingRows = await loadExistingForTable(tbl);
            if (working.id != null) {
              exists = existingRows.some(
                (entry) => entry && String(entry.id) === String(working.id)
              );
            }
            if (!exists && working.uuid) {
              exists = existingRows.some(
                (entry) =>
                  entry?.uuid &&
                  String(entry.uuid).toLowerCase() === String(working.uuid).toLowerCase()
              );
            }
            if (!exists && tbl === "armes" && working.numero_serie) {
              exists = existingRows.some(
                (entry) =>
                  entry?.numero_serie &&
                  String(entry.numero_serie).toLowerCase() ===
                    String(working.numero_serie).toLowerCase()
              );
            }
            if (exists) {
              if (forceableTables.has(tbl)) duplicates.push({ table: tbl, item: working });
              doublons++;
              total++;
              continue;
            }
            const cloned = { ...working };
            delete cloned.id;
            const result = await resolveCall(tbl, cloned);
            if (result && result.id != null) {
              const insertedRow = { ...cloned, id: result.id };
              markInserted(tbl, insertedRow);
              await hydrateGeoFields(tbl, insertedRow);
              ensureFromCache(tbl, insertedRow);
            } else if (working.id != null) {
              const fallbackRow = { ...cloned, id: working.id };
              markInserted(tbl, fallbackRow);
              await hydrateGeoFields(tbl, fallbackRow);
              ensureFromCache(tbl, fallbackRow);
            }
            inserted++;
            total++;
          } catch (err) {
            errors++;
            errorsDetails.push({
              table: tbl,
              id: item?.id ?? item?.uuid ?? "(sans identifiant)",
              message: err?.message || "erreur inconnue",
            });
          }
        }
      }
      hide();
      if (duplicates.length) {
        const wantsDuplicates = await new Promise((resolve) => {
          Modal.confirm({
            title: "Doublons détectés",
            content: `${duplicates.length} enregistrements existent déjà. Voulez-vous les ajouter malgré tout ?`,
            okText: "Ajouter malgré tout",
            cancelText: "Ignorer",
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (wantsDuplicates) {
          const closeForced = message.loading("Ajout des doublons autorisés...", 0);
          let forcedInserted = 0;
          const duplicatesByTable = duplicates.reduce((acc, entry) => {
            acc[entry.table] = acc[entry.table] || [];
            acc[entry.table].push(entry);
            return acc;
          }, {});
          const orderedDuplicateTables = Object.keys(duplicatesByTable)
            .sort((a, b) => priorityOf(a) - priorityOf(b));
          for (const tableName of orderedDuplicateTables) {
            for (const item of duplicatesByTable[tableName]) {
              const payload = { ...item.item, forceDuplicate: true };
              delete payload.id;
              try {
                await hydrateGeoFields(tableName, payload);
                const result = await resolveCall(tableName, payload, true);
                if (result && result.id != null) {
                  const insertedRow = { ...payload, id: result.id };
                  markInserted(tableName, insertedRow);
                  await hydrateGeoFields(tableName, insertedRow);
                  ensureFromCache(tableName, insertedRow);
                }
                forcedInserted++;
              } catch (err) {
                errors++;
                errorsDetails.push({
                  table: tableName,
                  id: item?.item?.id ?? item?.item?.uuid ?? "(sans identifiant)",
                  message: err?.message || "erreur doublon",
                });
              }
            }
          }
          closeForced();
          if (forcedInserted) {
            inserted += forcedInserted;
            doublons = Math.max(0, doublons - forcedInserted);
          }
        }
      }
      if (inserted > 0 && errors === 0) {
        message.success(`Import terminé : ${inserted} insérés, ${doublons} doublons ignorés`);
        return;
      }
      if (inserted > 0) {
        message.warning(`Import partiel : ${inserted} insérés, ${doublons} doublons ignorés, ${errors} erreurs`);
        if (errorsDetails.length) {
          console.warn("[import] erreurs:", errorsDetails.slice(0, 20));
        }
        return;
      }
      if (doublons && !inserted) {
        message.info(`Aucune donnée insérée. ${doublons} doublons détectés.`);
        if (errorsDetails.length) console.warn("[import] erreurs:", errorsDetails.slice(0, 20));
        return;
      }
      if (errorsDetails.length) {
        const preview = errorsDetails.slice(0, 3).map((err) => `${err.table} (${err.id}): ${err.message}`).join(" | ");
        message.error(`Aucune donnée importée. ${errors} erreur(s). Exemple: ${preview}`);
        console.error("[import] détail erreurs:", errorsDetails);
      } else {
        message.error("Aucune donnée importée.");
      }
    };
    input.click();
  } catch (e) {
    message.error("Erreur lors de l'import : " + e.message);
  }
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [headerFooterConfig, setHeaderFooterConfig] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("headerFooterConfig")) || {};
    } catch {
      return {};
    }
  });
  const [showHeaderFooterModal, setShowHeaderFooterModal] = React.useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm] = Form.useForm();
  const [resettingDb, setResettingDb] = useState(false);
  const backupManagerRef = useRef(null);
  const displayName = user?.username || user?.nom_utilisateur || user?.prenom || "Utilisateur";
  const selectedKey = useMemo(() => getSelectedMenuKey(location.pathname), [location.pathname]);
  const exportModal = useExportModal();
  const permissionSet = useMemo(() => {
    const normalized = normalizeStringList(user?.permissions);
    return new Set(normalized);
  }, [user?.permissions]);
  const isAdminRole = useMemo(() => {
    if (!user) return false;
    const rolePool = new Set();
    normalizeRoleNames(user.roles).forEach((role) => rolePool.add(String(role).toLowerCase()));
    if (Array.isArray(user.role_labels)) {
      user.role_labels.filter(Boolean).forEach((role) => rolePool.add(String(role).toLowerCase()));
    }
    if (typeof user.role_nom === 'string') {
      user.role_nom
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
        .forEach((role) => rolePool.add(role));
    }
    if (typeof user.role_name === 'string') {
      user.role_name
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
        .forEach((role) => rolePool.add(role));
    }
    return Array.from(rolePool).some((role) => role === 'admin' || role === 'role_admin');
  }, [user]);
  const hasPermission = useCallback((permission) => {
    if (!permission) return true;
    if (permissionSet.has('*')) return true;
    return permissionSet.has(permission);
  }, [permissionSet]);
  const canAccessModule = useCallback(
    (moduleKey) => {
      if (!moduleKey) return true;
      if (isAdminRole || permissionSet.has('*')) return true;
      const perm = MODULE_PERMISSION_MAP[moduleKey];
      if (perm && hasPermission(perm)) return true;
      const fallbacks = MODULE_FALLBACK_PERMISSIONS[moduleKey] || [];
      return fallbacks.some((fallbackPerm) => hasPermission(fallbackPerm));
    },
    [hasPermission, isAdminRole, permissionSet]
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("headerFooterConfig", JSON.stringify(headerFooterConfig));
  }, [headerFooterConfig]);

  useEffect(() => {
    const matchedModule = resolveModuleFromPath(location.pathname);
    if (matchedModule && !canAccessModule(matchedModule)) {
      message.warning("Accès non autorisé pour ce module.");
      navigate("/dashboard", { replace: true });
    }
  }, [canAccessModule, location.pathname, navigate]);

  const toggleCollapse = () => setCollapsed((prev) => !prev);

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link to="/profile">Mon Profil</Link>,
    },
    {
      key: "change-password",
      icon: <ToolOutlined />,
      label: "Changer mon mot de passe",
      onClick: () => setPasswordModalVisible(true),
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Déconnexion",
      onClick: () => {
        logout();
        navigate("/login", { replace: true });
      },
    },
  ];

  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      setChangingPassword(true);
      await window.api.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success("Mot de passe mis à jour");
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (err) {
      if (!err?.errorFields) {
        message.error("Impossible de mettre à jour le mot de passe");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResetDatabase = useCallback(() => {
    if (resettingDb) return;
    Modal.confirm({
      title: "Réinitialiser la base de données ?",
      icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
      content:
        "Cette action efface la base locale et la remplace par la version de référence. Exportez vos données avant de continuer.",
      okText: "Oui, réinitialiser",
      cancelText: "Annuler",
      okButtonProps: { danger: true },
      onOk: () =>
        new Promise(async (resolve) => {
          setResettingDb(true);
          try {
            const resetFn =
              window.electronAPI?.resetDatabase ||
              window.safeElectronAPI?.resetDatabase ||
              api.resetDatabase;
            if (!resetFn) throw new Error("Fonction resetDatabase indisponible.");
            await resetFn({ skipBackup: false });
            message.success("Base locale réinitialisée. Redémarrez l'application avant de réimporter.");
          } catch (err) {
            console.error("[AppLayout] resetDatabase:", err);
            message.error(err?.message || "Échec de la réinitialisation.");
          } finally {
            setResettingDb(false);
            resolve();
          }
        }),
    });
  }, [resettingDb]);

  const sidebarItems = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Dashboard</Link>,
    },
    {
      key: "/vdp",
      icon: <UserOutlined />,
      label: <Link to="/vdp">Gestion VDP</Link>,
    },
    {
      key: "ressources",
      icon: <BarsOutlined />,
      label: "Ressources",
      children: [
        { key: "/armes", label: <Link to="/armes">Armes</Link> },
        { key: "/munition", label: <Link to="/munition">Munition</Link> },
        { key: "/optique", label: <Link to="/optique">Optique</Link> },
        { key: "/materiel", label: <Link to="/materiel">Matériel spé.</Link> },
      ],
    },
    {
      key: "configurations",
      icon: <SettingOutlined />,
      label: "Configurations",
      children: [
        { key: "/config-arme", label: <Link to="/config-arme">Config. Armes</Link> },
        { key: "/config-munition", label: <Link to="/config-munition">Config. Munitions</Link> },
        { key: "/config-optique", label: <Link to="/config-optique">Config. Optiques</Link> },
        { key: "/config-materiel", label: <Link to="/config-materiel">Config. Matériel</Link> },
        { key: "/sources", label: <Link to="/sources">Sources</Link> },
        { key: "/lots", label: <Link to="/lots">Lots</Link> },
      ],
    },
    {
      key: "dotations",
      icon: <FileOutlined />,
      label: "Dotations",
      children: [
        { key: "/dotation-arme", label: <Link to="/dotation-arme">Arme</Link> },
        { key: "/dotation-munition", label: <Link to="/dotation-munition">Munition</Link> },
        { key: "/dotation-optique", label: <Link to="/dotation-optique">Optique</Link> },
        { key: "/dotation-materiel", label: <Link to="/dotation-materiel">Matériel</Link> },
        { key: "/dotation-rapide", label: <Link to="/dotation-rapide">Rapide</Link> },
      ],
    },
    {
      key: "localisation",
      icon: <TeamOutlined />,
      label: "Localisation",
      children: [
        { key: "/regions", label: <Link to="/regions">Régions</Link> },
        { key: "/provinces", label: <Link to="/provinces">Provinces</Link> },
        { key: "/communes", label: <Link to="/communes">Communes</Link> },
        { key: "/localites", label: <Link to="/localites">Localités</Link> },
      ],
    },
    {
      key: "/entites",
      icon: <EnvironmentOutlined />,
      label: <Link to="/entites">Entités</Link>,
    },
    {
      key: "coordinations",
      icon: <TeamOutlined />,
      label: "Coordinations",
      children: [
        {
          key: "/dashboard/coordinations/regionale",
          icon: <ApartmentOutlined style={{ color: "#0077cc" }} />,
          label: <span className="menu-abr"><Link to="/dashboard/coordinations/regionale">Coord. Rég.</Link></span>,
        },
        {
          key: "/dashboard/coordinations/provinciale",
          icon: <ApartmentOutlined style={{ color: "#00b894" }} />,
          label: <span className="menu-abr"><Link to="/dashboard/coordinations/provinciale">Coord. Prov.</Link></span>,
        },
        {
          key: "/dashboard/coordinations/communale",
          icon: <ClusterOutlined style={{ color: "#e17055" }} />,
          label: <span className="menu-abr"><Link to="/dashboard/coordinations/communale">Coord. Com.</Link></span>,
        },
      ],
    },
    {
      key: "systeme",
      icon: <SafetyCertificateOutlined />,
      label: "Système",
      children: [
        { key: "/audit-logs", label: <Link to="/audit-logs">Audit Logs</Link> },
        { key: "/sync-logs", label: <Link to="/sync-logs">Sync Logs</Link> },
        { key: "/sessions", label: <Link to="/sessions">Sessions</Link> },
        { key: "/notifications", label: <Link to="/notifications">Notifications</Link> },
        { key: "/config-app", label: <Link to="/config-app">App Config</Link> },
        { key: "/consommation-munitions", label: <Link to="/consommation-munitions">Consommation</Link> },
        { key: "/utilisateurs", label: <Link to="/utilisateurs">Utilisateurs</Link> },
        { key: "/roles", label: <Link to="/roles">Rôles</Link> },
      ],
    },
    {
      key: "/ddr",
      icon: <ThunderboltOutlined />,
      label: <Link to="/ddr">DDR</Link>,
    },
    {
      key: "suivi",
      icon: <EyeOutlined />,
      label: "Suivi",
      children: [
        { key: "/munition/history", label: <Link to="/munition/history">Historique munitions</Link> },
        { key: "/munition/alerts", label: <Link to="/munition/alerts">Alertes munitions</Link> },
      ],
    },
    {
      key: "sauvegarde",
      icon: <SaveOutlined />,
      label: "Sauvegarde",
      children: [
        {
          key: "sauvegarde-export",
          icon: <DownloadOutlined />,
          label: (
            <span onClick={() => backupManagerRef.current?.openExportModal()}>
              Exporter les données
            </span>
          ),
        },
        {
          key: "sauvegarde-import",
          icon: <UploadOutlined />,
          label: (
            <span onClick={() => backupManagerRef.current?.triggerImport()}>
              Importer des données
            </span>
          ),
        },
        {
          key: "sauvegarde-reset",
          icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
          label: "Réinitialiser la base",
          onClick: () => backupManagerRef.current?.confirmReset(),
          danger: true,
          disabled: resettingDb,
        },
      ],
    },
  ];

  const horizontalItems = [
    {
      key: "stats",
      label: "Statistiques",
      children: [
        { key: "/stats/vdp", label: <Link to="/stats/vdp">VDP</Link> },
        { key: "/stats/entites", label: <Link to="/stats/entites">Entités</Link> },
        { key: "/stats/armes", label: <Link to="/stats/armes">Armes</Link> },
        { key: "/stats/munitions", label: <Link to="/stats/munitions">Munitions</Link> },
        { key: "/stats/optiques", label: <Link to="/stats/optiques">Optiques</Link> },
        { key: "/stats/materiel", label: <Link to="/stats/materiel">Matériel</Link> },
      ],
    },
    {
      key: "documents",
      label: "Documents",
      children: [
        { key: "/documents/impression", label: <Link to="/documents/impression">Impression</Link> },
        { key: "/documents/etat", label: <Link to="/documents/etat">États</Link> },
      ],
    },
  ];

  const toggleHeaderFooterConfig = () => setShowHeaderFooterModal((prev) => !prev);

  return (
    <div className="app-layout-background">
      <div className="app-layout-glow" aria-hidden="true" />
      <div className="app-layout-stars" aria-hidden="true" />
      <Layout className="app-layout">
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={toggleCollapse}
          breakpoint="lg"
          collapsedWidth={80}
          className="custom-sider"
        >
          <div className="logo">{collapsed ? "AMO" : "AMO MANAGER"}</div>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[selectedKey]}
            items={sidebarItems}
            className="custom-menu"
          />
        </Sider>
        <Layout>
          <Header className="app-header">
            <Button type="text" onClick={toggleCollapse} className="toggle-button">
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </Button>
            <div className="header-title">SYSTÈME DE GESTION AMO</div>
            <div className="header-right">
              <span className="time-display">{currentTime.toLocaleTimeString()}</span>
              <span className="user-display">{displayName}</span>
              <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
                <Avatar icon={<UserOutlined />} />
              </Dropdown>
            </div>
          </Header>
          <Menu
            mode="horizontal"
            items={horizontalItems}
            className="horizontal-menu"
          />
          <Content className="app-content">
            <Outlet />
            <BackupManager
              ref={backupManagerRef}
              onResettingChange={setResettingDb}
            />
          </Content>
          <Footer className="app-footer">
            © 2025 SYSTÈME DE GESTION AMO – Tous droits réservés
          </Footer>
        </Layout>
      </Layout>

      <Modal
        title="Changer mon mot de passe"
        open={passwordModalVisible}
        onCancel={() => {
          passwordForm.resetFields();
          setPasswordModalVisible(false);
        }}
        onOk={handlePasswordSubmit}
        okText="Mettre à jour"
        cancelText="Annuler"
        confirmLoading={changingPassword}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            rules={[{ required: true, message: "Veuillez saisir un nouveau mot de passe" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirmez le nouveau mot de passe"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Veuillez confirmer le nouveau mot de passe" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("newPassword") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error("Les mots de passe ne correspondent pas"));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

