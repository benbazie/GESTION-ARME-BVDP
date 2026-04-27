// src/components/EntiteForm.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Select,
  message,
  Spin,
  Switch,
  InputNumber,
  Space,
  Modal
} from 'antd';
import { useWatch } from 'antd/lib/form/Form';
import moment from 'moment';
import './EntiteForm.css';
import api from '../api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const { Option } = Select;

// ID par défaut pour BVDP (à adapter)
const DEFAULT_BVDP_ID = 1;
const INITIAL_VALUES = {
  nom: '',
  code: '',
  description: '',
  type: '',
  region_id: null,
  province_id: null,
  commune_id: null,
  village_secteur_id: null,
  entite_id: null,
  coord_parent_id: null,
  statut: 'actif',
  population: null,
  actif: true
};

// Hook générique pour charger une liste via IPC (channel de type "List")
function useIpcList(channel, params = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await (window.api && typeof window.api.call === 'function'
        ? window.api.call(channel, params || {})
        : (async () => { throw new Error('IPC unavailable') })()
      );
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error(`Erreur ${channel}`, err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [channel, JSON.stringify(params)]);

  useEffect(() => { load() }, [load]);

  return { data, loading, reload: load };
}

// safe parse helper (texte ou json ou vide)
async function safeParseResponse(res) {
  if (!res) return null;
  if (res.status === 204 || res.status === 205) return null;
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text) } catch { return text }
}

const safeCall = async (name, payload) => {
  const api = window.electronAPI || window.api;
  const params = Object.fromEntries(
    Object.entries(payload || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  if (api?.[name]) return api[name](params);
  if (api?.call) return api.call(name, params);
  if (!/^get/i.test(name)) return [];
  const resource = name
    .replace(/^get/i, '')
    .replace(/List$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/${resource}${qs ? `?${qs}` : ''}`);
  return res.ok ? res.json() : [];
};
const asArray = (value) =>
  Array.isArray(value)
    ? value
    : Array.isArray(value?.rows)
    ? value.rows
    : Array.isArray(value?.data)
    ? value.data
    : [];

const requiredIf = (predicate, message = "Champ requis") => ({
  validator: (_, value) => {
    try {
      if (!predicate?.()) return Promise.resolve();
      if (value !== undefined && value !== null && `${value}`.trim() !== "") return Promise.resolve();
      return Promise.reject(new Error(message));
    } catch (err) {
      return Promise.reject(new Error(message));
    }
  },
});

export default function EntiteForm() {
  const { mode, id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [listsLoading, setListsLoading] = useState(false);
  const selectedRegion = useWatch('region_id', form);
  const selectedProvince = useWatch('province_id', form);
  const selectedCommune = useWatch('commune_id', form);

  const isMountedRef = useRef(true);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [localites, setLocalites] = useState([]);
  const [entitesMeres, setEntitesMeres] = useState([]);
  const [coordinationRegionales, setCoordinationRegionales] = useState([]);
  const [coordinationProvinciales, setCoordinationProvinciales] = useState([]);
  const [coordinationCommunales, setCoordinationCommunales] = useState([]);
  const [lookupsReady, setLookupsReady] = useState(false);
  const [initialEntityHydrated, setInitialEntityHydrated] = useState(() => !id);

  const regionValue = Form.useWatch('region_id', form);
  const provinceValue = Form.useWatch('province_id', form);
  const communeValue = Form.useWatch('commune_id', form);
  const coordinationType = Form.useWatch('type', form);

  const safeApiCall = useCallback(async (method, payload) => {
    const fn = api?.[method] || window.electronAPI?.[method];
    if (typeof fn !== 'function') return [];
    try {
      const result = await fn(payload);
      if (Array.isArray(result?.rows)) return result.rows;
      if (Array.isArray(result?.data)) return result.data;
      return Array.isArray(result) ? result : [];
    } catch (err) {
      console.warn(`[EntiteForm] ${method} KO:`, err?.message || err);
      return [];
    }
  }, []);

  const loadLookups = useCallback(async () => {
    setListsLoading(true);
    setLookupsReady(false);
    try {
      const [
        regs,
        provs,
        comms,
        locs,
        parents,
        coordsReg,
        coordsProv,
        coordsComm,
      ] = await Promise.all([
        safeApiCall('getRegionsList'),
        safeApiCall('getProvincesList'),
        safeApiCall('getCommunesList'),
        safeApiCall('getLocalitesList'),
        safeApiCall('getEntitesList'),
        safeApiCall('getCoordinationRegionaleList'),
        safeApiCall('getCoordinationProvincialeList'),
        safeApiCall('getCoordinationCommunaleList'),
      ]);
      if (!isMountedRef.current) return;
      setRegions(regs);
      setProvinces(provs);
      setCommunes(comms);
      setLocalites(locs);
      setEntitesMeres(parents);
      setCoordinationRegionales(coordsReg);
      setCoordinationProvinciales(coordsProv);
      setCoordinationCommunales(coordsComm);
      setLookupsReady(true);
    } catch (err) {
      console.warn('[EntiteForm] loadLookups:', err?.message || err);
      if (isMountedRef.current) setLookupsReady(true);
    } finally {
      if (isMountedRef.current) setListsLoading(false);
    }
  }, [safeApiCall]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    setInitialEntityHydrated(!id);
  }, [id]);

  const handleGenerateCode = useCallback(() => {
    const rawName = form.getFieldValue('nom') || '';
    const normalized = rawName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const code = normalized || `ENT-${Date.now().toString(36).toUpperCase()}`;
    form.setFieldsValue({ code });
  }, [form]);

  const normalizeEntityRecord = useCallback((raw) => {
    if (!raw) return null;
    let record = raw;
    if (Array.isArray(record)) record = record[0] || null;
    if (record?.rows && Array.isArray(record.rows)) record = record.rows[0] || null;
    if (record?.data && Array.isArray(record.data)) record = record.data[0] || null;
    if (!record || typeof record !== 'object') return null;
    const hydrated = { ...record };
    if (hydrated.date_dotation) {
      try { hydrated.date_dotation = moment(hydrated.date_dotation); } catch { /* ignore */ }
    }
    if (hydrated.created_at) {
      try { hydrated.created_at = moment(hydrated.created_at); } catch { /* ignore */ }
    }
    if (hydrated.updated_at) {
      try { hydrated.updated_at = moment(hydrated.updated_at); } catch { /* ignore */ }
    }
    return hydrated;
  }, []);

  useEffect(() => {
    if (!id) {
      form.resetFields();
      setInitialEntityHydrated(true);
      return;
    }
    setInitialEntityHydrated(false);
    form.resetFields();
  }, [id, form]);

  useEffect(() => {
    if (!id || !lookupsReady || initialEntityHydrated) return;
    form.resetFields();
    let mounted = true;
    setSaving(true);
    (async () => {
      try {
        const candidates = [
          ['getEntites', id],
          ['getEntitesList', { id }],
          ['getEntite', id],
          ['getEntitesById', id]
        ];
        let record = null;
        if (window.electronAPI) {
          for (const [ch, arg] of candidates) {
            if (typeof window.electronAPI[ch] === 'function') {
              try { record = await window.electronAPI[ch](arg); } catch {}
              if (record) break;
            }
          }
        }
        if (!record && window.api && typeof window.api.call === 'function') {
          for (const [ch, arg] of candidates) {
            try {
              const res = await window.api.call(ch, arg);
              if (res && typeof res === 'object') {
                record = res;
                break;
              }
            } catch {}
          }
        }
        if (!record) {
          const res = await fetch(`/api/entites/${id}`);
          if (res.ok) record = await safeParseResponse(res);
        }
        record = normalizeEntityRecord(record);
        if (mounted) {
          if (record) {
            form.setFieldsValue(record);
          } else {
            message.warning('Enregistrement introuvable');
          }
          setInitialEntityHydrated(true);
        }
      } catch (err) {
        if (mounted) {
          message.error('Erreur de chargement');
          setInitialEntityHydrated(true);
        }
      } finally {
        if (mounted) setSaving(false);
      }
    })();
    return () => { mounted = false };
  }, [id, lookupsReady, initialEntityHydrated, form, normalizeEntityRecord]);

  const prepareValues = useCallback((vals = {}) => {
    const merged = { ...INITIAL_VALUES, ...vals };
    if (mode === 'coord' && !merged.entite_id) {
      merged.entite_id = DEFAULT_BVDP_ID;
    }
    return merged;
  }, [mode]);

  const ensureGeoConsistency = useCallback((payload) => {
    const issues = [];
    const findById = (list, value) =>
      list.find(item => String(item.id) === String(value));
    if (payload.region_id && !findById(regions, payload.region_id)) {
      issues.push('La région sélectionnée est introuvable.');
    }
    const province = payload.province_id && findById(provinces, payload.province_id);
    if (payload.province_id && !province) {
      issues.push('La province sélectionnée est introuvable.');
    } else if (province && payload.region_id && String(province.region_id) !== String(payload.region_id)) {
      issues.push('Province et région ne correspondent pas.');
    }
    const commune = payload.commune_id && findById(communes, payload.commune_id);
    if (payload.commune_id && !commune) {
      issues.push('La commune sélectionnée est introuvable.');
    } else if (commune && payload.province_id && String(commune.province_id) !== String(payload.province_id)) {
      issues.push('Commune et province ne correspondent pas.');
    }
    const localite = payload.localite_id && findById(localites, payload.localite_id);
    if (payload.localite_id && !localite) {
      issues.push('La localité sélectionnée est introuvable.');
    } else if (localite && payload.commune_id && String(localite.commune_id) !== String(payload.commune_id)) {
      issues.push('Localité et commune ne correspondent pas.');
    }
    if (issues.length) {
      const error = new Error(issues.join(' '));
      error.isValidationError = true;
      throw error;
    }
  }, [regions, provinces, communes, localites]);

  const handleRegionChange = useCallback((value) => {
    form.setFieldsValue({ region_id: value || undefined, province_id: undefined, commune_id: undefined, localite_id: undefined });
  }, [form]);

  const handleProvinceChange = useCallback((value) => {
    form.setFieldsValue({ province_id: value || undefined, commune_id: undefined, localite_id: undefined });
  }, [form]);

  const handleCommuneChange = useCallback((value) => {
    form.setFieldsValue({
      commune_id: value || undefined,
      localite_id: undefined,
      village_secteur_id: undefined,
    });
  }, [form]);

  const handleEntityChange = useCallback(async (entiteId) => {
    form.setFieldsValue({ entite_id: entiteId || undefined });
    if (!entiteId) return;
    try {
      await safeApiCall('getSousEntitesList', { entite_id: entiteId });
    } catch (err) {
      console.warn('[EntiteForm] handleEntityChange:', err?.message || err);
      message.error("Impossible de charger les sous-entités");
    }
  }, [form, safeApiCall]);

  const onFinish = async (values) => {
    const payload = prepareValues(values);
    setSaving(true);
    try {
      ensureGeoConsistency(payload);
    } catch (err) {
      setSaving(false);
      message.error(err.message || "Incohérence géographique détectée");
      return;
    }

    // helper utilitaire qui essaie plusieurs variantes de nommage et fallback HTTP
    async function tryCreate(payload) {
      // 1) electronAPI direct helpers (preferés)
      try {
        const tk = window.electronAPI;
        const candidates = {
          mere: ['createEntites','createEntite','addEntite','addEntites'],
          sous: ['createSousEntites','createSousEntite','addSousEntite','addSousEntites'],
          coord: ['createCoordinations','createCoordination','addCoordination','addCoordinations']
        };
        const set = mode === 'sous' ? candidates.sous : (mode === 'coord' ? candidates.coord : candidates.mere);
        if (tk) {
          for (const name of set) {
            if (typeof tk[name] === 'function') {
              return await tk[name](payload);
            }
          }
        }
      } catch (e) {
        console.debug('electronAPI create helper failed', e && e.message);
      }

      // 2) window.api.call (IPC-first generic) with common names
      try {
        if (window.api && typeof window.api.call === 'function') {
          const candidates = mode === 'sous'
            ? ['createSousEntites','createSousEntite','addSousEntite','addSousEntites']
            : mode === 'coord'
              ? ['createCoordinations','createCoordination','addCoordination','addCoordinations']
              : ['createEntites','createEntite','addEntite','addEntites'];
          for (const ch of candidates) {
            try {
              const res = await window.api.call(ch, payload);
              if (typeof res !== 'undefined') return res;
            } catch (e) {
              // ignorer et essayer la suivante
            }
          }
        }
      } catch (e) {
        console.debug('window.api.call create attempts failed', e && e.message);
      }

      // 3) HTTP fallback (POST /api/<table>)
      try {
        const table = mode === 'sous' ? 'sous_entites' : (mode === 'coord' ? 'coordinations' : 'entites');
        const url = `/api/${table}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.status === 201 || res.status === 200) {
          return await safeParseResponse(res);
        }
        if (res.status === 204) return null;
        const text = await res.text();
        const err = new Error(`HTTP ${res.status} ${text || ''}`);
        err.status = res.status;
        throw err;
      } catch (e) {
        throw e;
      }
    }

    // helper update (supports create vs update logic)
    async function tryUpdate(id, payload) {
      // 1) electronAPI direct
      try {
        const tk = window.electronAPI;
        const candidates = {
          mere: ['updateEntites','updateEntite','editEntite'],
          sous: ['updateSousEntites','updateSousEntite'],
          coord: ['updateCoordinations','updateCoordination']
        };
        const set = mode === 'sous' ? candidates.sous : (mode === 'coord' ? candidates.coord : candidates.mere);
        if (tk) {
          for (const name of set) {
            if (typeof tk[name] === 'function') {
              return await tk[name]({ id, ...payload });
            }
          }
        }
      } catch (e) { console.debug('electronAPI update failed', e && e.message) }

      // 2) window.api.call fallback
      try {
        if (window.api && typeof window.api.call === 'function') {
          const candidates = mode === 'sous' ? ['updateSousEntites','updateSousEntite'] : (mode === 'coord' ? ['updateCoordinations','updateCoordination'] : ['updateEntites','updateEntite']);
          for (const ch of candidates) {
            try {
              const res = await window.api.call(ch, { id, ...payload });
              if (typeof res !== 'undefined') return res;
            } catch (e) {}
          }
        }
      } catch (e) {}

      // 3) HTTP fallback (PUT /api/<table>/:id)
      try {
        const table = mode === 'sous' ? 'sous_entites' : (mode === 'coord' ? 'coordinations' : 'entites');
        const url = `/api/${table}/${id}`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) return await safeParseResponse(res);
        const text = await res.text();
        const err = new Error(`HTTP ${res.status} ${text || ''}`);
        err.status = res.status;
        throw err;
      } catch (e) { throw e; }
    }

    try {
      let res;
      if (id) {
        // update
        res = await (async () => {
          // reuse existing update logic (window.api / http) - omitted here for brevity
          return await tryUpdate(id, payload);
        })();
      } else {
        // create
        res = await (async () => {
          return await tryCreate(payload);
        })();
      }
      message.success(res?.message || 'Opération réussie');
      loadLookups();
      navigate('/entites');
    } catch (err) {
      console.error('Enregistrement failed', err);
      const userMessage = (err && (err.message || (err.payload && err.payload.message))) || 'Erreur lors de l\'opération';
      message.error(userMessage);
    } finally {
      setSaving(false);
    }
  };

  const isLoading = listsLoading || !lookupsReady || (id ? !initialEntityHydrated : false);

  const [mapVisible, setMapVisible] = useState(false);
  const [mapCenter, setMapCenter] = useState([12.3, -1.5]);
  const mapCenterRef = useRef(mapCenter);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkerRef = useRef(null);
  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
  const mapStyleUrl = MAPTILER_KEY
	? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
	: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
if (!MAPTILER_KEY) {
	console.warn('[EntiteForm] MapTiler key manquante, utilisation d’un fond OpenStreetMap');
}

  useEffect(() => {
	mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  const openMapPicker = useCallback(() => {
	const lat = parseFloat(form.getFieldValue('latitude')) || mapCenterRef.current[0];
	const lng = parseFloat(form.getFieldValue('longitude')) || mapCenterRef.current[1];
	const next = [lat, lng];
	setMapCenter(next);
	mapCenterRef.current = next;
	setMapVisible(true);
  }, [form, setMapCenter]);

  const updateMapMarker = useCallback((latlng) => {
	const next = [latlng.lat, latlng.lng];
	setMapCenter(next);
	mapCenterRef.current = next;
  }, []);

  const applyMapSelection = useCallback(() => {
	form.setFieldsValue({
		latitude: mapCenter[0].toFixed(6),
		longitude: mapCenter[1].toFixed(6),
	});
	setMapVisible(false);
  }, [form, mapCenter]);

  useEffect(() => {
	if (!mapVisible) return undefined;
	const container = mapContainerRef.current;
	if (!container) return undefined;
	if (!mapInstanceRef.current) {
		const map = L.map(container, { center: mapCenter, zoom: 7, zoomControl: true });
		L.tileLayer(mapStyleUrl, {
			attribution: '&copy; CartoDB & OpenStreetMap',
		}).addTo(map);
		L.control.scale({ imperial: false }).addTo(map);
		mapInstanceRef.current = map;
	}
	const map = mapInstanceRef.current;
	map.setView(mapCenter, 7, { animate: true });
	if (!mapMarkerRef.current) {
		mapMarkerRef.current = L.marker(mapCenter, { draggable: true }).addTo(map);
		mapMarkerRef.current.on('dragend', () => updateMapMarker(mapMarkerRef.current.getLatLng()));
	} else {
		mapMarkerRef.current.setLatLng(mapCenter);
	}
	const handleClick = (evt) => updateMapMarker(evt.latlng);
	map.on('click', handleClick);
	return () => {
		map.off('click', handleClick);
	};
}, [mapVisible, mapCenter, updateMapMarker]);

  // Rendu des champs communs (modifié : règle dynamique et ajout lat/lng)
  const renderCommon = () => (
    <>
      <Form.Item name="nom" label="Nom" rules={[{ required: true, message: 'Nom obligatoire' }]}>
        <Input placeholder="Nom" />
      </Form.Item>

      <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Code obligatoire' }]}>
        <Space.Compact style={{ width: '100%' }}>
          <Input placeholder="Code" />
          <Button onClick={handleGenerateCode}>Générer</Button>
        </Space.Compact>
      </Form.Item>
      <Form.Item name="statut" label="Statut">
        <Select placeholder="Sélectionnez un statut" allowClear>
          <Option value="actif">Actif</Option>
          <Option value="inactif">Inactif</Option>
          <Option value="archives">Archivé</Option>
        </Select>
      </Form.Item>
      <Form.Item name="population" label="Population estimée">
        <InputNumber placeholder="Population" style={{ width: '100%' }} min={0} />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} maxLength={400} showCount placeholder="Description" />
      </Form.Item>

      {mode === 'mere' && (
        <Form.Item name="entite_mere_id" label="Entité mère">
          <Select
            placeholder="Sélectionnez l'entité de rattachement"
            allowClear
            options={entitesMeres.map(e => ({ value: e.id, label: e.nom }))}
          />
        </Form.Item>
      )}
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
      {mode !== 'sous' && (
        <Form.Item name="localite_id" label="Localité">
          <Select
            placeholder="Sélectionnez une localité"
            allowClear
            options={filteredLocalites.map(l => ({ value: l.id, label: l.nom }))}
            disabled={!filteredCommunes.length}
          />
        </Form.Item>
      )}

      {/* pour sous-entité on propose la localité (obligatoire seulement si commune choisie) */}
      {mode === 'sous' && (
        <Form.Item
          name="village_secteur_id"
          label="Localité / Secteur"
          rules={[requiredIf(() => !!form.getFieldValue('commune_id'))]}
        >
          <Select placeholder="Sélectionnez une localité" allowClear disabled={!selectedCommune}>
            {filteredLocalites.map(l => (
              <Option key={l.id} value={l.id}>{l.nom}</Option>
            ))}
          </Select>
        </Form.Item>
      )}

      {/* Géolocalisation optionnelle */}
      <Form.Item label="Géolocalisation (optionnel)" style={{ marginBottom: 0 }}>
		<Space.Compact block>
			<Form.Item name="latitude" noStyle>
				<Input placeholder="Latitude (ex: 12.3456)" />
			</Form.Item>
			<Form.Item name="longitude" noStyle>
				<Input placeholder="Longitude (ex: -1.2345)" />
			</Form.Item>
			<Button type="dashed" onClick={openMapPicker}>
				Ouvrir la carte
			</Button>
		</Space.Compact>
	</Form.Item>
	<Modal
		title="Choisir une position"
		open={mapVisible}
		onCancel={() => setMapVisible(false)}
		onOk={applyMapSelection}
		width={900}
		bodyStyle={{ padding: '0 24px 24px', minHeight: 560 }}
	  >
		<div ref={mapContainerRef} className="map-modal" />
		<Button type="link" onClick={() => {
			if (mapInstanceRef.current) {
				const current = mapInstanceRef.current.getCenter();
				setMapCenter([current.lat, current.lng]);
			}
		}}>Recentrer sur la position actuelle</Button>
	  </Modal>

      {/* Sous-entité : sélection entité mère */}
      {mode === 'sous' && (
        <Form.Item
          name="entite_id"
          label="Entité Mère"
          rules={[{ validator: async (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Entité mère requise')) }]}
        >
          <Select placeholder="Sélectionnez une entité mère" allowClear onChange={handleEntityChange}>
            {(entitesMeres || []).map(m => (
              <Option key={m.id} value={m.id}>{m.nom}</Option>
            ))}
          </Select>
        </Form.Item>
      )}
    </>
  );

  // Rendu des champs de coordination (inchangé)
  const renderCoordination = () => {
    const isProvincial = coordinationType === 'provincial';
    const isCommunale = coordinationType === 'communale';

    return (
      <>
        <Form.Item
          name="type"
          label="Type de Coordination"
          rules={[{ required: true, message: 'Type requis' }]
        }>
          <Select placeholder="regional / provincial / communale">
            <Option value="regional">Régional</Option>
            <Option value="provincial">Provincial</Option>
            <Option value="communale">Communale</Option>
          </Select>
        </Form.Item>
        <Form.Item
          name="region_id"
          label="Région"
          rules={[{ required: true, message: 'Région requise' }]}
        >
          <Select
            placeholder="Sélectionner la région"
            allowClear
            options={regions.map(r => ({ value: r.id, label: r.nom }))}
            onChange={handleRegionChange}
          />
        </Form.Item>
        {(isProvincial || isCommunale) && (
          <Form.Item
            name="province_id"
            label="Province"
            rules={[{ required: true, message: 'Province requise' }]}
          >
            <Select
              placeholder="Sélectionner la province"
              allowClear
              options={filteredProvinces.map(p => ({ value: p.id, label: p.nom }))}
              onChange={handleProvinceChange}
              disabled={!filteredProvinces.length}
            />
          </Form.Item>
        )}
        {isCommunale && (
          <Form.Item
            name="commune_id"
            label="Commune"
            rules={[{ required: true, message: 'Commune requise' }]}
          >
            <Select
              placeholder="Sélectionner la commune"
              allowClear
              options={filteredCommunes.map(c => ({ value: c.id, label: c.nom }))}
              onChange={handleCommuneChange}
              disabled={!filteredCommunes.length}
            />
          </Form.Item>
        )}
        {isProvincial && (
          <Form.Item
            name="coord_parent_id"
            label="Coordination Régionale parent"
            rules={[{ required: true, message: 'Parent requis' }]}
          >
            <Select
              placeholder="Choisir une coordination régionale"
              allowClear
              options={regionalParentOptions.map(c => ({ value: c.id, label: c.nom }))}
              disabled={!regionalParentOptions.length}
            />
          </Form.Item>
        )}
        {isCommunale && (
          <Form.Item
            name="coord_parent_id"
            label="Coordination Provinciale parent"
            rules={[{ required: true, message: 'Parent requis' }]}
          >
            <Select
              placeholder="Choisir une coordination provinciale"
              allowClear
              options={provincialParentOptions.map(c => ({ value: c.id, label: c.nom }))}
              disabled={!provincialParentOptions.length}
            />
          </Form.Item>
        )}
      </>
    );
  };

  const filteredProvinces = useMemo(() => (
    regions.length && regionValue
      ? provinces.filter(p => String(p.region_id) === String(regionValue))
      : provinces
  ), [regionValue, provinces, regions]);

  const filteredCommunes = useMemo(() => (
    communes.length && provinceValue
      ? communes.filter(c => String(c.province_id) === String(provinceValue))
      : communes
  ), [provinceValue, communes]);

  const filteredLocalites = useMemo(() => (
    localites.length && communeValue
      ? localites.filter(l => String(l.commune_id) === String(communeValue))
      : localites
  ), [communeValue, localites]);

  return (
    <div className="entite-form">
      <video autoPlay loop muted className="video-bg">
        <source src="/assets/video/futuristic.mp4" type="video/mp4" />
      </video>
      <div className="form-panel">
        <h2>{id ? `Modifier` : `Ajouter`} {
          mode === 'mere' ? 'Entité Mère'
            : mode === 'sous' ? 'Sous-Entité'
            : 'Coordination'
        }</h2>
        <Spin spinning={isLoading || saving}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={INITIAL_VALUES}
            className="futuristic-form"
          >
            <Space className="form-toolbar">
              <Button onClick={loadLookups} loading={listsLoading}>
                Recharger les listes
              </Button>
            </Space>
            <div className="form-section">
              <h3 className="section-title">Informations générales</h3>
              {mode === 'coord' ? renderCoordination() : renderCommon()}
            </div>
            <div className="form-section">
              <h3 className="section-title">Paramètres</h3>
              <Form.Item
                name="actif"
                label="Entité active"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>
            <Form.Item className="form-actions">
              <Button type="primary" htmlType="submit" loading={saving}>
                {id ? 'Mettre à jour' : 'Ajouter'}
              </Button>
              <Button onClick={() => navigate('/entites')} style={{ marginLeft: 8 }}>
                Annuler
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </div>
    </div>
  );
}
