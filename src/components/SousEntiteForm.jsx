// SousEntiteForm.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Form, Select, message } from 'antd';
import api from '../api';

const SousEntiteForm = ({ form }) => {
  const isMountedRef = useRef(true);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [localites, setLocalites] = useState([]);

  const regionValue = Form.useWatch('region_id', form);
  const provinceValue = Form.useWatch('province_id', form);
  const communeValue = Form.useWatch('commune_id', form);

  const safeApiCall = useCallback(async (method, payload) => {
    const fn = api?.[method] || window.electronAPI?.[method];
    if (typeof fn !== 'function') return [];
    try {
      const result = await fn(payload);
      if (Array.isArray(result?.rows)) return result.rows;
      if (Array.isArray(result?.data)) return result.data;
      return Array.isArray(result) ? result : [];
    } catch (err) {
      console.warn(`[SousEntiteForm] ${method} KO:`, err?.message || err);
      return [];
    }
  }, []);

  const loadLookups = useCallback(async () => {
    const [regs, provs, comms, locs] = await Promise.all([
      safeApiCall('getRegionsList'),
      safeApiCall('getProvincesList'),
      safeApiCall('getCommunesList'),
      safeApiCall('getLocalitesList'),
    ]);
    if (!isMountedRef.current) return;
    setRegions(regs);
    setProvinces(provs);
    setCommunes(comms);
    setLocalites(locs);
  }, [safeApiCall]);

  useEffect(() => {
    loadLookups();
    return () => { isMountedRef.current = false; };
  }, [loadLookups]);

  const filteredProvinces = useMemo(() => (
    regionValue ? provinces.filter(p => String(p.region_id) === String(regionValue)) : provinces
  ), [regionValue, provinces]);

  const filteredCommunes = useMemo(() => (
    provinceValue ? communes.filter(c => String(c.province_id) === String(provinceValue)) : communes
  ), [provinceValue, communes]);

  const filteredLocalites = useMemo(() => (
    communeValue ? localites.filter(l => String(l.commune_id) === String(communeValue)) : localites
  ), [communeValue, localites]);

  const handleRegionChange = useCallback((value) => {
    form.setFieldsValue({ region_id: value || undefined, province_id: undefined, commune_id: undefined, localite_id: undefined });
  }, [form]);

  const handleProvinceChange = useCallback((value) => {
    form.setFieldsValue({ province_id: value || undefined, commune_id: undefined, localite_id: undefined });
  }, [form]);

  const handleCommuneChange = useCallback((value) => {
    form.setFieldsValue({ commune_id: value || undefined, localite_id: undefined });
  }, [form]);

  useEffect(() => {
    if (!provinceValue) return;
    const currentProvince = form.getFieldValue('province_id');
    if (currentProvince && !filteredProvinces.some(p => String(p.id) === String(currentProvince))) {
      form.setFieldsValue({ province_id: undefined, commune_id: undefined, localite_id: undefined });
    }
  }, [provinceValue, filteredProvinces, form]);

  useEffect(() => {
    if (!communeValue) return;
    const currentCommune = form.getFieldValue('commune_id');
    if (currentCommune && !filteredCommunes.some(c => String(c.id) === String(currentCommune))) {
      form.setFieldsValue({ commune_id: undefined, localite_id: undefined });
    }
  }, [communeValue, filteredCommunes, form]);

  useEffect(() => {
    const currentLocalite = form.getFieldValue('localite_id');
    if (currentLocalite && !filteredLocalites.some(l => String(l.id) === String(currentLocalite))) {
      form.setFieldsValue({ localite_id: undefined });
    }
  }, [filteredLocalites, form]);

  return (
    <Form form={form}>
      <Form.Item name="region_id" label="Région" rules={[{ required: true }]}>
        <Select
          placeholder="Sélectionnez une région"
          allowClear
          options={regions.map(r => ({ value: r.id, label: r.nom }))}
          onChange={handleRegionChange}
        />
      </Form.Item>
      <Form.Item name="province_id" label="Province">
        <Select
          placeholder="Sélectionnez une province"
          allowClear
          options={filteredProvinces.map(p => ({ value: p.id, label: p.nom }))}
          onChange={handleProvinceChange}
          disabled={!regions.length}
        />
      </Form.Item>
      <Form.Item name="commune_id" label="Commune">
        <Select
          placeholder="Sélectionnez une commune"
          allowClear
          options={filteredCommunes.map(c => ({ value: c.id, label: c.nom }))}
          onChange={handleCommuneChange}
          disabled={!filteredProvinces.length}
        />
      </Form.Item>
      <Form.Item name="localite_id" label="Localité">
        <Select
          placeholder="Sélectionnez une localité"
          allowClear
          options={filteredLocalites.map(l => ({ value: l.id, label: l.nom }))}
          disabled={!filteredCommunes.length}
        />
      </Form.Item>
    </Form>
  );
};

export default SousEntiteForm;