// src/components/TransfertMagasinModal.jsx
import React, { useEffect, useState } from 'react';
import {
  Alert, Button, Form, InputNumber, Modal, Select, Space, Table, Tag, Typography, message,
} from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import api from '../api';

const { Text } = Typography;
const { Option } = Select;

const RESOURCE_LABEL = {
  arme: 'Arme', optique: 'Optique',
  materiel_specifique: 'Matériel', munition: 'Munition',
};

/**
 * TransfertMagasinModal
 *
 * Props:
 *   open            {boolean}
 *   magasinSource   {object}  — magasin d'origine (avec id, nom)
 *   stock           {Array}   — stock actuel du magasin source
 *   onClose         {function}
 *   onSuccess       {function} — appelé après transfert réussi
 */
export default function TransfertMagasinModal({ open, magasinSource, stock = [], onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [magasins, setMagasins] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);   // items du stock sélectionnés
  const [qtValues, setQtValues] = useState({});             // quantités par resource_id

  useEffect(() => {
    if (!open) return;
    api.getMagasins?.()
      .then((r) => {
        const all = Array.isArray(r) ? r : (r?.rows || []);
        // Exclure le magasin source
        setMagasins(all.filter((m) => m.id !== magasinSource?.id));
      })
      .catch(() => {});
    setSelectedItems([]);
    setQtValues({});
    form.resetFields();
  }, [open, magasinSource, form]);

  const rowKey = (r) => `${r.resource_type}-${r.resource_id}`;

  const updateQty = (key, val) =>
    setQtValues((prev) => ({ ...prev, [key]: val }));

  const handleConfirm = async () => {
    if (!selectedItems.length) {
      message.warning('Sélectionnez au moins un article à transférer.'); return;
    }
    const destId = form.getFieldValue('magasin_dest_id');
    if (!destId) {
      message.warning('Sélectionnez un magasin de destination.'); return;
    }
    const observation = form.getFieldValue('observation') || null;

    setLoading(true);
    try {
      // Pour chaque item sélectionné : retirer du source + ajouter au dest
      await Promise.all(
        selectedItems.map(async (item) => {
          const key = rowKey(item);
          const qty = qtValues[key] || 1;

          // 1. Retirer du magasin source
          await api.removeFromStockMagasin(magasinSource.id, {
            resource_type: item.resource_type,
            resource_id:   item.resource_id,
            quantite:      qty,
            type:          'transfert_sortant',
            observation,
          });

          // 2. Ajouter au magasin destination
          await api.addToStockMagasin(destId, {
            resource_type: item.resource_type,
            resource_id:   item.resource_id,
            quantite:      qty,
            type:          'transfert_entrant',
            observation,
          });
        })
      );

      message.success(`${selectedItems.length} article(s) transféré(s) avec succès.`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      message.error(err?.response?.data?.error || err?.message || 'Erreur lors du transfert.');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Type', dataIndex: 'resource_type', width: 100,
      render: (v) => <Tag>{RESOURCE_LABEL[v] || v}</Tag>,
    },
    { title: 'N° Série', dataIndex: 'numero_serie', render: (v) => v || '—' },
    { title: 'Désignation', dataIndex: 'designation', render: (v) => v || '—' },
    {
      title: 'Stock dispo', dataIndex: 'quantite', width: 90, align: 'center',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Qté à transférer', key: 'qty', width: 130, align: 'center',
      render: (_, record) => {
        const key = rowKey(record);
        const isSelected = selectedItems.some((i) => rowKey(i) === key);
        return (
          <InputNumber
            min={1} max={record.quantite}
            value={qtValues[key] || 1}
            onChange={(v) => updateQty(key, v)}
            disabled={!isSelected}
            size="small"
            style={{ width: 70 }}
          />
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      title={
        <Space>
          <SwapOutlined />
          Transfert de stock — {magasinSource?.nom || 'Magasin'}
        </Space>
      }
      width={760}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>Annuler</Button>,
        <Button
          key="ok" type="primary" icon={<SwapOutlined />}
          loading={loading}
          onClick={handleConfirm}
          disabled={!selectedItems.length}
        >
          Transférer ({selectedItems.length} article{selectedItems.length > 1 ? 's' : ''})
        </Button>,
      ]}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert type="info" showIcon
          message="Sélectionnez les articles à transférer et choisissez le magasin de destination."
        />

        <Form form={form} layout="vertical">
          <Form.Item name="magasin_dest_id" label="Magasin de destination"
            rules={[{ required: true, message: 'Obligatoire' }]}>
            <Select showSearch allowClear placeholder="Choisir le magasin destinataire"
              optionFilterProp="children">
              {magasins.map((m) => (
                <Option key={m.id} value={m.id}>
                  {m.nom}{m.niveau ? ` — ${m.niveau}` : ''}
                  {m.nb_items_stock != null ? ` (${m.nb_items_stock} art.)` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="observation" label="Motif / Observation">
            <Form.Item name="observation" noStyle>
              <input
                placeholder="Motif du transfert…"
                style={{
                  width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9',
                  borderRadius: 6, fontSize: 14,
                }}
                onChange={(e) => form.setFieldValue('observation', e.target.value)}
              />
            </Form.Item>
          </Form.Item>
        </Form>

        <Table
          size="small"
          rowKey={rowKey}
          dataSource={stock}
          pagination={{ pageSize: 10 }}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedItems.map(rowKey),
            onChange: (_, rows) => setSelectedItems(rows),
          }}
          columns={columns}
        />

        {selectedItems.length > 0 && (
          <Text type="secondary">
            {selectedItems.length} article(s) sélectionné(s) pour transfert.
          </Text>
        )}
      </Space>
    </Modal>
  );
}
