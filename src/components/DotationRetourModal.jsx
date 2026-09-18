import React, { useState, useEffect } from 'react';
import {
  Modal, Button, Table, Select, Input, Form,
  Tag, Space, Typography, Alert, message
} from 'antd';
import { BankOutlined } from '@ant-design/icons';
import api from '../api';
import { usePermissions } from '../hooks/usePermissions';

const { Text } = Typography;
const { Option } = Select;

const CONDITIONS = ['bon', 'mauvais', 'détérioré', 'perdu', 'détruit'];

const RESOURCE_LABEL = {
  arme:               'Arme',
  optique:            'Optique',
  materiel_specifique: 'Matériel',
  munition:           'Munition',
};

const resourceDisplay = (item) => {
  if (item.resource_type === 'arme')               return item.arme_numero_serie   || item.arme_designation   || `Arme #${item.resource_id}`;
  if (item.resource_type === 'optique')            return item.optique_numero_serie || item.optique_designation || `Optique #${item.resource_id}`;
  if (item.resource_type === 'materiel_specifique') return item.materiel_numero_serie || item.materiel_designation || `Matériel #${item.resource_id}`;
  if (item.resource_type === 'munition')           return `${item.munition_designation || 'Munition'} (${item.quantite} unités)`;
  return `Ressource #${item.resource_id}`;
};

/**
 * DotationRetourModal
 *
 * Props:
 *   open        {boolean}  — visibilité
 *   dotation    {object}   — dotation complète avec items
 *   onClose     {function} — fermer sans confirmer
 *   onSuccess   {function(updatedDotation)} — appelé après retour réussi
 */
export default function DotationRetourModal({ open, dotation, onClose, onSuccess }) {
  const [form]     = Form.useForm();
  const [loading,  setLoading]  = useState(false);
  const [itemData, setItemData] = useState([]);
  const [magasins, setMagasins] = useState([]);
  const { myMagasinId } = usePermissions();

  useEffect(() => {
    if (!open) return;
    api.getMagasins?.()
      .then((rows) => setMagasins(Array.isArray(rows) ? rows : (rows?.rows || [])))
      .catch(() => {});
    if (myMagasinId) {
      form.setFieldValue('magasin_retour_id', myMagasinId);
    }
  }, [open, myMagasinId, form]);

  // Initialise les données par item quand la modale s'ouvre
  useEffect(() => {
    if (!open || !dotation?.items) return;
    const initial = (dotation.items || [])
      .filter((i) => i.status !== 'retourné')
      .map((i) => ({
        id:               i.id,
        resource_type:    i.resource_type,
        resource_id:      i.resource_id,
        quantite:         i.quantite || 1,
        label:            resourceDisplay(i),
        condition_retour: '',
        quantite_retour:  i.resource_type === 'munition' ? 0 : undefined,
        selected:         true,
      }));
    setItemData(initial);
    form.setFieldsValue({ observation: '' });
  }, [open, dotation, form]);

  const updateItem = (id, field, value) => {
    setItemData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleConfirm = async () => {
    const observation = form.getFieldValue('observation');
    const selectedItems = itemData.filter((i) => i.selected);

    if (!selectedItems.length) {
      message.warning('Sélectionnez au moins un item à retourner.');
      return;
    }

    const magasinRetourId = form.getFieldValue('magasin_retour_id') || null;

    const body = {
      observation:      observation || null,
      magasin_retour_id: magasinRetourId,
      items: selectedItems.map((i) => ({
        id:               i.id,
        condition_retour: i.condition_retour || null,
        quantite_retour:  i.resource_type === 'munition' ? Number(i.quantite_retour ?? 0) : undefined,
      })),
    };

    setLoading(true);
    try {
      const updated = await api.retourDotation(dotation.id, body);
      message.success('Retour de dotation enregistré.');
      onSuccess?.(updated);
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Erreur lors du retour';
      if (msg === 'DOTATION_ALREADY_CLOSED') {
        message.error('Cette dotation est déjà clôturée.');
      } else {
        message.error(`Échec : ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const activeItems = (dotation?.items || []).filter((i) => i.status !== 'retourné');
  const alreadyReturned = (dotation?.items || []).filter((i) => i.status === 'retourné');

  const columns = [
    {
      title: 'Ressource',
      dataIndex: 'label',
      render: (label, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{label}</Text>
          <Tag color="blue" style={{ fontSize: 11 }}>
            {RESOURCE_LABEL[record.resource_type] || record.resource_type}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Condition retour',
      dataIndex: 'condition_retour',
      width: 160,
      render: (val, record) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          placeholder="Condition"
          value={val || undefined}
          onChange={(v) => updateItem(record.id, 'condition_retour', v)}
          allowClear
        >
          {CONDITIONS.map((c) => (
            <Option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Qté retournée',
      dataIndex: 'quantite_retour',
      width: 120,
      render: (val, record) =>
        record.resource_type === 'munition' ? (
          <Input
            type="number"
            size="small"
            min={0}
            max={record.quantite}
            value={val ?? 0}
            onChange={(e) =>
              updateItem(record.id, 'quantite_retour', Number(e.target.value))
            }
            addonAfter={`/ ${record.quantite}`}
          />
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Inclure',
      dataIndex: 'selected',
      width: 70,
      render: (val, record) => (
        <input
          type="checkbox"
          checked={val}
          onChange={(e) => updateItem(record.id, 'selected', e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
      ),
    },
  ];

  const beneficiaryLabel = dotation?.vdp_nom
    ? `${dotation.vdp_nom} ${dotation.vdp_prenom || ''}`.trim()
    : dotation?.entite_nom || '—';

  return (
    <Modal
      open={open}
      title={
        <Space>
          Retour de dotation
          {dotation?.code && <Tag color="orange">{dotation.code}</Tag>}
        </Space>
      }
      width={720}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          Annuler
        </Button>,
        <Button
          key="confirm"
          type="primary"
          danger
          loading={loading}
          onClick={handleConfirm}
          disabled={!itemData.some((i) => i.selected)}
        >
          Confirmer le retour
        </Button>,
      ]}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="info"
          showIcon
          message={
            <span>
              Bénéficiaire : <Text strong>{beneficiaryLabel}</Text>
              {dotation?.date_dotation && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  — dotation du {new Date(dotation.date_dotation).toLocaleDateString('fr-FR')}
                </Text>
              )}
            </span>
          }
        />

        {activeItems.length === 0 ? (
          <Alert type="success" message="Tous les items ont déjà été retournés." showIcon />
        ) : (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={itemData}
            columns={columns}
          />
        )}

        {alreadyReturned.length > 0 && (
          <Alert
            type="success"
            showIcon
            message={`${alreadyReturned.length} item(s) déjà retourné(s)`}
          />
        )}

        <Form form={form} layout="vertical">
          <Form.Item
            name="magasin_retour_id"
            label={<Space><BankOutlined /> Magasin de retour (armurerie)</Space>}
            extra="Optionnel — précisez le magasin dans lequel la ressource est réintégrée."
          >
            <Select
              allowClear showSearch
              placeholder="Sélectionner un magasin"
              optionFilterProp="children"
            >
              {magasins.map((m) => (
                <Option key={m.id} value={m.id}>
                  {m.nom}{m.niveau ? ` — ${m.niveau}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="observation" label="Observation (optionnel)">
            <Input.TextArea rows={2} placeholder="Motif, état général, remarques…" />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
}
