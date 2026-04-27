// src/components/ConfigArmeForm.js
import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { Form, Input, Select, Button, Card, message, Spin } from "antd";
import api from '../api'
const { Option } = Select

const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI

function tryCallVariants(variants, ...args) {
  return (async () => {
    for (const name of variants) {
      try {
        if (isElectron() && window.electronAPI && typeof window.electronAPI[name] === 'function') {
          return await window.electronAPI[name](...args)
        }
        if (api && typeof api[name] === 'function') {
          return await api[name](...args)
        }
      } catch (err) {
        console.warn(`[tryCallVariants] ${name} failed:`, err && err.message ? err.message : err)
      }
    }
    throw new Error(`No API method found: ${variants.join(', ')}`)
  })()
}

const ConfigArmeForm = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [typeOptions, setTypeOptions] = useState([]);
  const [categorieOptions, setCategorieOptions] = useState([]);
  const [modeleOptions, setModeleOptions] = useState([]);
  const [record, setRecord] = useState(null);
  const isEdit = Boolean(id);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadConfig()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    Promise.all([
      api.getTypesArmeList(),
      api.getCategoriesArmeList(),
      api.getModelesArmeList()
    ])
      .then(([types, categories, modeles]) => {
        setTypeOptions(types || []);
        setCategorieOptions(categories || []);
        setModeleOptions(modeles || []);
      })
      .catch(() => message.error("Chargement des référentiels impossible"));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const variants = ['getConfigArmeById', 'getConfigArmesById', 'getConfig_armeById'];
        const data = await tryCallVariants(variants, id);
        if (cancelled) return;
        if (!data) {
          message.error("Configuration d'arme introuvable");
          navigate("/dashboard/config-armes");
          return;
        }
        setRecord(data);
      } catch (error) {
        if (!cancelled) {
          console.error("[ConfigArmeForm] load", error);
          message.error("Impossible de charger la configuration d'arme");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, id, navigate]);

  const loadConfig = async () => {
    setLoading(true)
    try {
      const variants = ['getConfigArmeById', 'getConfigArmesById', 'getConfig_armeById']
      const data = await tryCallVariants(variants, id)
      if (!data) {
        message.error("Configuration d'arme introuvable")
        navigate('/dashboard/config-armes')
        return
      }
      form.setFieldsValue(data)
      onTypeChange(data.type)
      onCategorieChange(data.categorie)
    } catch (err) {
      console.error('Erreur load config_arme:', err)
      message.error("Impossible de charger la configuration d'arme")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isEdit || !record) return;
    form.setFieldsValue({
      type_id:
        record.type_id ??
        record.type_arme_id ??
        (record.type ? record.type.toString().trim() : null),
      categorie_id:
        record.categorie_id ??
        record.categorie_arme_id ??
        (record.categorie ? record.categorie.toString().trim() : null),
      modele_id:
        record.modele_id ??
        record.modele_arme_id ??
        (record.designation ? record.designation.toString().trim() : null),
      designation: record.designation || "",
      code: record.code || ""
    });
  }, [isEdit, record, form]);

  const selectedTypeId = Form.useWatch("type_id", form);
  const selectedCategorieId = Form.useWatch("categorie_id", form);

  const ensureArray = (value) => (Array.isArray(value) ? value : []);

  const deriveTypesFromConfigs = (configs) => {
    const seen = new Set();
    return ensureArray(configs).reduce((acc, item) => {
      const label = (item?.type ?? "").toString().trim();
      if (!label || seen.has(label)) return acc;
      seen.add(label);
      acc.push({ id: label, nom: label });
      return acc;
    }, []);
  };

  const deriveCategoriesFromConfigs = (configs) => {
    const seen = new Set();
    return ensureArray(configs).reduce((acc, item) => {
      const typeLabel = (item?.type ?? "").toString().trim();
      const categoryLabel = (item?.categorie ?? item?.categorie_arme ?? "").toString().trim();
      if (!categoryLabel) return acc;
      const key = `${typeLabel}::${categoryLabel}`;
      if (seen.has(key)) return acc;
      seen.add(key);
      acc.push({
        id: categoryLabel,
        nom: categoryLabel,
        type_id: typeLabel || undefined
      });
      return acc;
    }, []);
  };

  const deriveModelesFromConfigs = (configs) => {
    const seen = new Set();
    return ensureArray(configs).reduce((acc, item) => {
      const label = (item?.designation ?? item?.modele ?? item?.modele_arme ?? "").toString().trim();
      if (!label || seen.has(label)) return acc;
      seen.add(label);
      acc.push({
        id: label,
        nom: label,
        categorie_id: (item?.categorie ?? item?.categorie_arme ?? "").toString().trim() || undefined,
        type_id: (item?.type ?? "").toString().trim() || undefined
      });
      return acc;
    }, []);
  };

  useEffect(() => {
    let cancelled = false;

    const safeFetch = async (loader) => {
      try {
        const result = await loader();
        return ensureArray(result);
      } catch (error) {
        if (error?.response?.status !== 404) {
          console.warn("[ConfigArmeForm] Chargement référentiel", error);
        }
        return [];
      }
    };

    (async () => {
      const configs = await safeFetch(() => api.getConfigArmeList());
      const [types, categories, modeles] = await Promise.all([
        safeFetch(() => api.getTypesArmeList()),
        safeFetch(() => api.getCategoriesArmeList()),
        safeFetch(() => api.getModelesArmeList())
      ]);
      if (cancelled) return;

      setTypeOptions(types.length ? types : deriveTypesFromConfigs(configs));
      setCategorieOptions(categories.length ? categories : deriveCategoriesFromConfigs(configs));
      setModeleOptions(modeles.length ? modeles : deriveModelesFromConfigs(configs));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTypeKey = selectedTypeId != null ? String(selectedTypeId) : null;
  const selectedCategorieKey = selectedCategorieId != null ? String(selectedCategorieId) : null;

  useEffect(() => {
    if (!selectedTypeKey) return;
    const current = form.getFieldValue("categorie_id");
    if (!current) return;
    const hasMatch = categorieOptions.some((item) => {
      const optionId = item?.id ?? item?.value ?? item?.nom ?? item?.libelle;
      if (optionId == null || String(optionId) !== String(current)) return false;
      const optionType = item?.type_id ?? item?.type_arme_id ?? item?.type;
      return optionType != null && String(optionType) === selectedTypeKey;
    });
    if (!hasMatch) {
      form.setFieldsValue({ categorie_id: null });
    }
  }, [selectedTypeKey, categorieOptions, form]);

  useEffect(() => {
    const current = form.getFieldValue("modele_id");
    if (!current) return;
    const hasMatch = modeleOptions.some((item) => {
      const optionId = item?.id ?? item?.value ?? item?.nom ?? item?.designation ?? item?.libelle;
      if (optionId == null || String(optionId) !== String(current)) return false;
      const optionType = item?.type_id ?? item?.type_arme_id ?? item?.type;
      if (selectedTypeKey && optionType != null && String(optionType) !== selectedTypeKey) return false;
      if (selectedCategorieKey) {
        const optionCategorie = item?.categorie_id ?? item?.categorie_arme_id ?? item?.categorie;
        if (optionCategorie == null || String(optionCategorie) !== selectedCategorieKey) return false;
      }
      return true;
    });
    if (!hasMatch) {
      form.setFieldsValue({ modele_id: null });
    }
  }, [selectedTypeKey, selectedCategorieKey, modeleOptions, form]);

  const buildLookup = (options) =>
    options.reduce((acc, item) => {
      const key =
        item?.id ??
        item?.value ??
        item?.code ??
        item?.nom ??
        item?.libelle ??
        item?.designation;
      if (key == null) return acc;
      const label = item?.nom || item?.libelle || item?.code || item?.designation || item?.label || String(key);
      acc[String(key)] = label;
      return acc;
    }, {});

  const typeById = useMemo(() => buildLookup(typeOptions), [typeOptions]);
  const categorieById = useMemo(() => buildLookup(categorieOptions), [categorieOptions]);
  const modeleById = useMemo(() => buildLookup(modeleOptions), [modeleOptions]);

  const handleSubmit = async (values) => {
    const { lot, ...cleanValues } = values;
    const normalizeId = (value) => {
      if (value === undefined || value === "" || value === null) return null;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const asNumber = Number(trimmed);
        return Number.isFinite(asNumber) ? asNumber : null;
      }
      return null;
    };
    const typeKey = cleanValues.type_id != null ? String(cleanValues.type_id) : "";
    const categorieKey = cleanValues.categorie_id != null ? String(cleanValues.categorie_id) : "";
    const modeleKey = cleanValues.modele_id != null ? String(cleanValues.modele_id) : "";
    const payload = {
      ...cleanValues,
      type_id: normalizeId(cleanValues.type_id),
      categorie_id: normalizeId(cleanValues.categorie_id),
      modele_id: normalizeId(cleanValues.modele_id),
      type: typeById[typeKey] || null,
      categorie: categorieById[categorieKey] || null,
      designation: modeleById[modeleKey] || cleanValues.designation || null
    };
    setSubmitting(true);
    try {
      if (id) {
        const variants = ['updateConfigArme', 'updateConfigArmes', 'update_config_arme'];
        await tryCallVariants(variants, payload);
        message.success("Mise à jour réussie");
      } else {
        const variants = ['createConfigArme', 'createConfigArmes', 'create_config_arme'];
        await tryCallVariants(variants, payload);
        message.success("Création réussie");
      }
      navigate("/dashboard/config-armes");
    } catch (err) {
      console.error("Erreur save:", err);
      message.error("Erreur lors de la sauvegarde");
    } finally {
      setSubmitting(false);
    }
  }

  const selectOptions = useMemo(
    () => ({
      type: typeOptions.map((item) => ({
        value: item.id ?? item.value ?? item.nom ?? item.libelle,
        label: item.nom || item.libelle || item.code || item.designation || item.label
      })),
      categorie: categorieOptions
        .filter((item) => {
          if (!selectedTypeKey) return true;
          const optionType = item?.type_id ?? item?.type_arme_id ?? item?.type;
          return optionType != null && String(optionType) === selectedTypeKey;
        })
        .map((item) => ({
          value: item.id ?? item.value ?? item.nom ?? item.libelle,
          label: item.nom || item.libelle || item.code || item.designation || item.label
        })),
      modele: modeleOptions
        .filter((item) => {
          const optionType = item?.type_id ?? item?.type_arme_id ?? item?.type;
          if (selectedTypeKey && optionType != null && String(optionType) !== selectedTypeKey) {
            return false;
          }
          if (!selectedCategorieKey) return true;
          const optionCategorie = item?.categorie_id ?? item?.categorie_arme_id ?? item?.categorie;
          return optionCategorie != null && String(optionCategorie) === selectedCategorieKey;
        })
        .map((item) => ({
          value: item.id ?? item.value ?? item.nom ?? item.designation ?? item.libelle,
          label: item.nom || item.designation || item.libelle || item.code || item.label
        }))
    }),
    [typeOptions, categorieOptions, modeleOptions, selectedTypeKey, selectedCategorieKey]
  );

  return (
    <Spin spinning={loading}>
      <Card style={{ maxWidth: 600, margin: 'auto', padding: 20 }}
            title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard/config-armes')} />
          <div style={{ fontWeight: 700 }}>{id ? 'Modifier' : 'Ajouter'} Configuration d'Arme</div>
        </div>
      }>
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item
            name="type_id"
            label="Type d'arme"
            rules={[{ required: true, message: "Sélectionnez un type" }]}
          >
            <Select
              placeholder="Choisissez un type"
              options={selectOptions.type}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="categorie_id"
            label="Catégorie d'arme"
            rules={[{ required: true, message: "Sélectionnez une catégorie" }]}
          >
            <Select
              placeholder="Choisissez une catégorie"
              options={selectOptions.categorie}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="modele_id"
            label="Modèle d'arme"
            rules={[{ required: true, message: "Sélectionnez un modèle" }]}
          >
            <Select
              placeholder="Choisissez un modèle"
              options={selectOptions.modele}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="code" label="Code interne">
            <Input placeholder="Code interne optionnel" />
          </Form.Item>
          <Form.Item name="designation" label="Libellé affiché">
            <Input placeholder="Libellé affiché (écrase le modèle si rempli)" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {isEdit ? "Mettre à jour" : "Enregistrer"}
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate("/dashboard/config-armes")}>
              Annuler
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate("/dashboard/config-armes")}>
              Retour configurations
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  )
}

export default ConfigArmeForm
