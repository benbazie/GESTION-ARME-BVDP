import React, {
  forwardRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
} from "react";
import { Modal, Checkbox, message } from "antd";
import api from "../api";

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
const tablePriority = new Map([
  ["regions", 10],
  ["provinces", 20],
  ["communes", 30],
  ["localites", 40],
  ["entites", 50],
  ["sous_entites", 60],
  ["coordinations", 70],
  ["coordination_regionale", 80],
  ["coordination_provinciale", 90],
  ["coordination_communale", 100],
  ["localite_coordination", 110],
]);
const priorityOf = (name) => tablePriority.get(name) ?? 1000;
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

const BackupManager = forwardRef(({ onResettingChange }, ref) => {
  const [exportVisible, setExportVisible] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedTables, setSelectedTables] = useState(
    FLAT_EXPORT_TABLES.map((t) => t.key)
  );
  const [resettingDb, setResettingDb] = useState(false);

  useEffect(() => {
    onResettingChange?.(resettingDb);
  }, [resettingDb, onResettingChange]);

  const methodCandidatesFor = useCallback((tableKey) => {
    const variants = new Set([tableKey, API_PATH_ALIASES[tableKey] || tableKey]);
    return Array.from(variants).map((variant) => `get${toPascal(variant)}List`);
  }, []);

  const fetchTableData = useCallback(
    async (tableKey) => {
      const methodNames = methodCandidatesFor(tableKey);
      const invoke = async (target) => {
        if (!target) return null;
        for (const name of methodNames) {
          if (typeof target[name] === "function") {
            const result = await target[name]();
            if (Array.isArray(result)) return result;
            if (Array.isArray(result?.rows)) return result.rows;
            if (Array.isArray(result?.data)) return result.data;
            if (result !== null && result !== undefined) return result;
          }
        }
        return null;
      };
      const fromBridge =
        (await invoke(window.electronAPI)) ??
        (await invoke(window.api)) ??
        (await invoke(api));
      if (fromBridge !== null) return fromBridge;

      try {
        const apiPath = (API_PATH_ALIASES[tableKey] || tableKey).replace(/^\//, "");
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
          `${baseURL.replace(/\/$/, "")}/${apiPath}`,
          {
            headers: token
              ? {
                  Authorization: token.startsWith("Bearer ")
                    ? token
                    : `Bearer ${token}`,
                }
              : {},
            credentials: "include",
          }
        );
        if (!response.ok) return null;
        const payload = await response.json();
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.rows)) return payload.rows;
        if (Array.isArray(payload?.data)) return payload.data;
        return payload ?? null;
      } catch (err) {
        console.error(`[export] ${tableKey} fallback:`, err);
        return null;
      }
    },
    [methodCandidatesFor]
  );

  const setSelection = useCallback((updater) => {
    setSelectedTables((prev) => {
      const base = FLAT_EXPORT_TABLES.map((t) => t.key);
      const next =
        typeof updater === "function" ? updater(prev) : Array.from(updater);
      const normalized = new Set(next);
      return base.filter((key) => normalized.has(key));
    });
  }, []);

  const toggleTable = useCallback(
    (tableKey, checked) =>
      setSelection((prev) => {
        const draft = new Set(prev);
        if (checked) draft.add(tableKey);
        else draft.delete(tableKey);
        return draft;
      }),
    [setSelection]
  );

  const toggleGroup = useCallback(
    (group, checked) => {
      const keys = group.tables.map((t) => t.key);
      setSelection((prev) => {
        const draft = new Set(prev);
        keys.forEach((key) => (checked ? draft.add(key) : draft.delete(key)));
        return draft;
      });
    },
    [setSelection]
  );

  const handleExportOk = useCallback(async () => {
    setExportLoading(true);
    try {
      const orderedTables = FLAT_EXPORT_TABLES.filter(({ key }) =>
        selectedTables.includes(key)
      );
      const filename = `export-gestion-armes-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      const data = {};
      const failures = [];
      for (const { key: tbl } of orderedTables) {
        try {
          const tableData = await fetchTableData(tbl);
          if (tableData !== null) data[tbl] = tableData;
          else failures.push(tbl);
        } catch (err) {
          console.error(`[export] ${tbl}:`, err);
          failures.push(tbl);
        }
      }
      if (!Object.keys(data).length)
        throw new Error(
          "Aucune donnée exportée. Vérifiez les tables sélectionnées."
        );
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      if (failures.length) {
        message.warning(
          `Export partiel : ${failures.join(", ")} non récupérées.`
        );
      } else {
        message.success("Export JSON téléchargé !");
      }
      setExportVisible(false);
    } catch (err) {
      message.error(`Erreur lors de l'export : ${err.message}`);
    } finally {
      setExportLoading(false);
    }
  }, [fetchTableData, selectedTables]);

  const promptImportSelection = useCallback((tableKeys) => {
    return new Promise((resolve) => {
      if (!tableKeys.length) {
        resolve([]);
        return;
      }
      let selected = new Set(tableKeys);
      Modal.confirm({
        title: "Sélectionner les tables à importer",
        content: (
          <Checkbox.Group
            defaultValue={Array.from(selected)}
            style={{ display: "grid", gap: 6, marginTop: 12 }}
            options={tableKeys.map((key) => ({ label: key, value: key }))}
            onChange={(values) => {
              selected = new Set(values);
            }}
          />
        ),
        okText: "Importer",
        cancelText: "Annuler",
        onOk: () => {
          if (!selected.size) {
            message.warning("Sélectionnez au moins une table.");
            return Promise.reject();
          }
          resolve(Array.from(selected));
          return Promise.resolve();
        },
        onCancel: () => resolve(null),
      });
    });
  }, []);

  const triggerImport = useCallback(() => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          message.error("Fichier JSON invalide");
          return;
        }
        const forceableTables = new Set(["armes"]);
        const availableTables = Object.keys(data)
          .filter((name) => Array.isArray(data[name]))
          .sort((a, b) => priorityOf(a) - priorityOf(b));

        const selectedTables = await promptImportSelection(availableTables);
        if (!selectedTables || !selectedTables.length) {
          message.info("Import annulé.");
          return;
        }

        const toPascalLocal = (value) => toPascal(value);
        const toSingularLocal = (value) => toSingularPascal(value);
        const buildMethodCandidates = (table) => {
          const pascal = toPascalLocal(table);
          const singular = toSingularLocal(table);
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
          if (!provider || typeof provider[methodName] !== "function")
            return undefined;
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
          const methodName = `get${toPascalLocal(table)}List`;
          let rows = [];
          const provider =
            window.electronAPI?.[methodName] ?? window.api?.[methodName] ?? null;
          if (provider) {
            try {
              rows = unwrapList(
                await callProviderMethod(provider, methodName, {
                  includeDeleted: true,
                })
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
          return (
            rows.find((entry) => entry && String(entry.id) === target) || null
          );
        };
        const ensureFromCache = (table, item) => {
          const cache = existingCache.get(table);
          if (!cache) return;
          const index = cache.findIndex(
            (entry) => entry && String(entry.id) === String(item.id)
          );
          if (index >= 0) cache[index] = { ...cache[index], ...item };
        };
        const hydrateGeoFields = async (table, record) => {
          if (!record || typeof record !== "object") return;
          const setIfMissing = (key, value) => {
            if (
              value != null &&
              value !== "" &&
              (record[key] == null || record[key] === "")
            ) {
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
              const provinceRow = await findCachedRow(
                "provinces",
                record.province_id
              );
              setIfMissing("region_id", provinceRow?.region_id);
            }
            return;
          }
          if (table === "localites") {
            if (record.commune_id) {
              const communeRow = await findCachedRow(
                "communes",
                record.commune_id
              );
              setIfMissing("region_id", communeRow?.region_id);
              setIfMissing("province_id", communeRow?.province_id);
            }
            if (!record.commune_id && record.province_id) {
              const provinceRow = await findCachedRow(
                "provinces",
                record.province_id
              );
              setIfMissing("region_id", provinceRow?.region_id);
            }
            return;
          }
          if (table === "sous_entites" || table === "coordinations") {
            if (record.entite_id) {
              const entiteRow = await findCachedRow(
                "entites",
                record.entite_id
              );
              setIfMissing("region_id", entiteRow?.region_id);
              setIfMissing("province_id", entiteRow?.province_id);
              setIfMissing("commune_id", entiteRow?.commune_id);
              setIfMissing("localite_id", entiteRow?.localite_id);
            }
            return;
          }
          if (table === "coordination_provinciale") {
            if (record.province_id) {
              const provinceRow = await findCachedRow(
                "provinces",
                record.province_id
              );
              setIfMissing("region_id", provinceRow?.region_id);
            }
            if (record.parent_id) {
              const regional = await findCachedRow(
                "coordination_regionale",
                record.parent_id
              );
              setIfMissing("region_id", regional?.region_id ?? regional?.region);
            }
            return;
          }
          if (table === "coordination_communale") {
            if (record.commune_id) {
              const communeRow = await findCachedRow(
                "communes",
                record.commune_id
              );
              setIfMissing("province_id", communeRow?.province_id);
              setIfMissing("region_id", communeRow?.region_id);
            }
            if (record.parent_id) {
              const prov = await findCachedRow(
                "coordination_provinciale",
                record.parent_id
              );
              setIfMissing("province_id", prov?.province_id);
              setIfMissing("region_id", prov?.region_id);
            }
          }
        };
        const markInserted = (table, item) => {
          const cache = existingCache.get(table);
          if (!cache) return;
          cache.push(item);
        };

        let total = 0;
        let doublons = 0;
        let inserted = 0;
        let errors = 0;
        const duplicates = [];
        const errorsDetails = [];
        const hide = message.loading("Import en cours...", 0);
        const orderedTables = selectedTables
          .slice()
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
                    String(entry.uuid).toLowerCase() ===
                      String(working.uuid).toLowerCase()
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
                if (forceableTables.has(tbl))
                  duplicates.push({ table: tbl, item: working });
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
            const closeForced = message.loading(
              "Ajout des doublons autorisés...",
              0
            );
            let forcedInserted = 0;
            const duplicatesByTable = duplicates.reduce((acc, entry) => {
              acc[entry.table] = acc[entry.table] || [];
              acc[entry.table].push(entry);
              return acc;
            }, {});
            const orderedDuplicateTables = Object.keys(duplicatesByTable).sort(
              (a, b) => priorityOf(a) - priorityOf(b)
            );
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
                    id:
                      item?.item?.id ??
                      item?.item?.uuid ??
                      "(sans identifiant)",
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
          message.success(
            `Import terminé : ${inserted} insérés, ${doublons} doublons ignorés`
          );
          return;
        }
        if (inserted > 0) {
          message.warning(
            `Import partiel : ${inserted} insérés, ${doublons} doublons ignorés, ${errors} erreurs`
          );
          if (errorsDetails.length)
            console.warn("[import] erreurs:", errorsDetails.slice(0, 20));
          return;
        }
        if (doublons && !inserted) {
          message.info(`Aucune donnée insérée. ${doublons} doublons détectés.`);
          if (errorsDetails.length)
            console.warn("[import] erreurs:", errorsDetails.slice(0, 20));
          return;
        }
        if (errorsDetails.length) {
          const preview = errorsDetails
            .slice(0, 3)
            .map(
              (err) => `${err.table} (${err.id}): ${err.message}`
            )
            .join(" | ");
          message.error(
            `Aucune donnée importée. ${errors} erreur(s). Exemple: ${preview}`
          );
          console.error("[import] détail erreurs:", errorsDetails);
        } else {
          message.error("Aucune donnée importée.");
        }
      };
      input.click();
    } catch (err) {
      message.error(`Erreur lors de l'import : ${err.message}`);
    }
  }, [promptImportSelection]);

  const confirmReset = useCallback(() => {
    if (resettingDb) return;
    Modal.confirm({
      title: "Réinitialiser la base de données ?",
      icon: <></>,
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
            if (!resetFn)
              throw new Error("Fonction resetDatabase indisponible.");
            await resetFn({ skipBackup: false });
            message.success(
              "Base locale réinitialisée. Redémarrez l'application avant de réimporter."
            );
          } catch (err) {
            console.error("[BackupManager] resetDatabase:", err);
            message.error(err?.message || "Échec de la réinitialisation.");
          } finally {
            setResettingDb(false);
            resolve();
          }
        }),
    });
  }, [resettingDb]);

  useImperativeHandle(
    ref,
    () => ({
      openExportModal: () => setExportVisible(true),
      triggerImport,
      confirmReset,
    }),
    [triggerImport, confirmReset]
  );

  return (
    <Modal
      title="Exporter les données"
      open={exportVisible}
      onOk={handleExportOk}
      onCancel={() => setExportVisible(false)}
      okText="Exporter"
      cancelText="Annuler"
      okButtonProps={{ loading: exportLoading }}
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
});

export default BackupManager;
