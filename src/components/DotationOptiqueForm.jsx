// src/components/DotationOptiqueForm.jsx
import React, { useEffect, useState } from 'react';
import {
  Form,
  Input,
  Button,
  Radio,
  DatePicker,
  Select,
  Space,
  Card,
  message
} from 'antd';
import moment from 'moment';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import './DotationOptiqueForm.css';

const { Option } = Select;

export default function DotationOptiqueForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [vdpOptions, setVdpOptions] = useState([]);
  const [entiteOptions, setEntiteOptions] = useState([]);

  // 1. Charger la liste des VDP
  useEffect(() => {
    ;(async () => {
      try {
        const data = await window.api.call('getVDPs', {});
        setVdpOptions(Array.isArray(data) ? data : []);
      } catch {
        message.error('Erreur lors du chargement des VDP');
      }
    })();
  }, []);

  // 2. Charger la liste des entités
  useEffect(() => {
    ;(async () => {
      try {
        const data = await window.api.call('getEntites', {});
        setEntiteOptions(Array.isArray(data) ? data : []);
      } catch {
        message.error('Erreur lors du chargement des entités');
      }
    })();
  }, []);

  // 3. En édition, charger la dotation existante
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    ;(async () => {
      try {
        const data = await window.api.call('getDotationById', { id });
        if (data.date_dotation) {
          data.date_dotation = moment(data.date_dotation);
        }
        if (data.date_integration) {
          data.date_integration = moment(data.date_integration);
        }
        form.setFieldsValue(data);
      } catch {
        message.error('Erreur lors du chargement de la dotation');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form]);

  // 4. Soumettre le formulaire
  const onFinish = async values => {
    setLoading(true);
    try {
      values.date_dotation = values.date_dotation.format('YYYY-MM-DD');
      if (values.date_integration) {
        values.date_integration = values.date_integration.format('YYYY-MM-DD');
      }
      values.ressource_type = 'optique';

      if (id) {
        await window.api.call('updateDotation', { id, ...values });
        message.success('Dotation mise à jour avec succès.');
      } else {
        await window.api.call('createDotation', values);
        message.success('Dotation créée avec succès.');
      }
      navigate('/dashboard/dotation-optique');
    } catch {
      message.error("Erreur lors de l'enregistrement de la dotation.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Watcher pour le type de dotation
  const typeDot = Form.useWatch('type_dotation', form) || 'individuelle';

  return (
    <div className="dotation-optique-form">
      <Card
        title={id ? 'Modifier Dotation Optique' : 'Créer Dotation Optique'}
        className="form-card"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ type_dotation: 'individuelle' }}
        >
          {/* Code généré en base */}
          <Form.Item name="code_dotation" label="Code Dotation">
            <Input placeholder="(généré automatiquement)" disabled />
          </Form.Item>

          <Form.Item
            name="type_dotation"
            label="Type de Dotation"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio value="individuelle">Individuelle</Radio>
              <Radio value="collective">Collective</Radio>
            </Radio.Group>
          </Form.Item>

          {typeDot === 'individuelle' ? (
            <Form.Item
              name="vdp_id"
              label="Sélectionner un VDP"
              rules={[{ required: true }]}
            >
              <Select
                showSearch
                placeholder="Recherchez un VDP"
                optionFilterProp="children"
                filterOption={(input, option) => {
                  const d = option.data || {};
                  return (
                    d.nom?.toLowerCase().includes(input.toLowerCase()) ||
                    d.prenom?.toLowerCase().includes(input.toLowerCase()) ||
                    d.cnib?.toLowerCase().includes(input.toLowerCase())
                  );
                }}
              >
                {vdpOptions.map(vdp => (
                  <Option key={vdp.id} value={vdp.id} data={vdp}>
                    {vdp.nom} {vdp.prenom} – CNIB : {vdp.cnib}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item
              name="entite_id"
              label="Sélectionner une Entité"
              rules={[{ required: true }]}
            >
              <Select
                showSearch
                placeholder="Choisissez une entité"
                optionFilterProp="children"
              >
                {entiteOptions.map(ent => (
                  <Option key={ent.id} value={ent.id}>
                    {ent.nom}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="ressource_id"
            label="ID de l'Optique"
            rules={[{ required: true }]}
          >
            <Input placeholder="ID de l'optique dotée" />
          </Form.Item>

          <Form.Item
            name="date_dotation"
            label="Date de Dotation"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="date_integration" label="Date d'Intégration">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="observation" label="Observation">
            <Input.TextArea
              rows={3}
              placeholder="Observation (facultatif)"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
              >
                {id ? 'Mettre à jour' : 'Créer'}
              </Button>
              <Button onClick={() => navigate('/dashboard/dotation-optique')}>
                Annuler
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
