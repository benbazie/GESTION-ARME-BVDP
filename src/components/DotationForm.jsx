// src/components/DotationForm.js
import React, { useEffect, useState } from 'react';
import {
  Form,
  Input,
  Button,
  Radio,
  DatePicker,
  Select,
  Space,
  message,
  Card
} from 'antd';
import moment from 'moment';
import { useNavigate, useParams } from 'react-router-dom';

const { TextArea } = Input;
const { Option } = Select;

export default function DotationForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [vdpOptions, setVdpOptions] = useState([]);
  const [entiteOptions, setEntiteOptions] = useState([]);

  // Chargement des VDP et entités depuis IPC
  useEffect(() => {
    ;(async () => {
      try {
        const vdps = await window.api.call('getVDPs', {});
        setVdpOptions(Array.isArray(vdps) ? vdps : []);
      } catch {
        message.error('Erreur lors du chargement des VDP');
      }
    })();
    ;(async () => {
      try {
        const ents = await window.api.call('getEntites', {});
        setEntiteOptions(Array.isArray(ents) ? ents : []);
      } catch {
        message.error('Erreur lors du chargement des entités');
      }
    })();
  }, []);

  // En édition, charger la dotation existante
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    ;(async () => {
      try {
        const data = await window.api.call('getDotationById', { id });
        if (data.date_dotation) data.date_dotation = moment(data.date_dotation);
        if (data.date_integration) data.date_integration = moment(data.date_integration);
        form.setFieldsValue(data);
      } catch {
        message.error('Erreur lors du chargement de la dotation');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form]);

  // Watchers pour afficher les champs conditionnels
  const resourceType = Form.useWatch('ressource_type', form);
  const dotationType = Form.useWatch('type_dotation', form);

  // Soumission du formulaire
  const onFinish = async values => {
    setLoading(true);
    try {
      // Formatage des dates
      values.date_dotation = values.date_dotation
        ? values.date_dotation.format('YYYY-MM-DD')
        : null;
      values.date_integration = values.date_integration
        ? values.date_integration.format('YYYY-MM-DD')
        : null;

      if (id) {
        await window.api.call('updateDotation', { id, ...values });
        message.success('Dotation mise à jour');
      } else {
        await window.api.call('createDotation', values);
        message.success('Dotation créée');
      }
      navigate('/dotations');
    } catch {
      message.error("Erreur lors de l'enregistrement de la dotation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={id ? 'Modifier Dotation' : 'Nouvelle Dotation'}
      style={{ margin: '20px' }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ type_dotation: 'individuelle' }}
      >
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

        {dotationType === 'individuelle' ? (
          <Form.Item
            name="vdp_id"
            label="VDP"
            rules={[{ required: true }]}
          >
            <Select placeholder="Choisir un VDP">
              {vdpOptions.map(v => (
                <Option key={v.id} value={v.id}>
                  {v.nom} {v.prenom}
                </Option>
              ))}
            </Select>
          </Form.Item>
        ) : (
          <Form.Item
            name="entite_id"
            label="Entité / Sous-entité / Coordination"
            rules={[{ required: true }]}
          >
            <Select placeholder="Choisir une entité">
              {entiteOptions.map(e => (
                <Option key={e.id} value={e.id}>
                  {e.nom}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item
          name="ressource_type"
          label="Type de Ressource"
          rules={[{ required: true }]}
        >
          <Select placeholder="Choisir un type">
            <Option value="arme">Arme</Option>
            <Option value="munition">Munition</Option>
            <Option value="optique">Optique</Option>
            <Option value="materiel_specifique">
              Matériel spécifique
            </Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="ressource_id"
          label="ID de la Ressource"
          rules={[{ required: true }]}
        >
          <Input placeholder="ID de la ressource dotée" />
        </Form.Item>

        {resourceType === 'munition' && (
          <Form.Item
            name="quantite"
            label="Quantité (Munitions)"
            rules={[{ required: true }]}
          >
            <Input type="number" placeholder="Quantité" />
          </Form.Item>
        )}

        <Form.Item
          name="date_dotation"
          label="Date de Dotation"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="date_integration"
          label="Date d'Intégration"
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="observation" label="Observation">
          <TextArea rows={3} placeholder="Observation (facultatif)" />
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
            <Button onClick={() => navigate('/dotations')}>
              Annuler
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
