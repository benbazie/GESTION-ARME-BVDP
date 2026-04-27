// src/components/DotationMaterielSpecifiqueForm.jsx
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
import './DotationMaterielSpecifiqueForm.css';

const { Option } = Select;

export default function DotationMaterielSpecifiqueForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [vdpOptions, setVdpOptions] = useState([]);
  const [entiteOptions, setEntiteOptions] = useState([]);
  const [subEntities, setSubEntities] = useState([]);

  // Charger les VDP
  useEffect(() => {
    (async () => {
      try {
        const data = await window.api.call('getVDPs', {});
        setVdpOptions(Array.isArray(data) ? data : []);
      } catch {
        message.error('Erreur lors du chargement des VDP');
      }
    })();
  }, []);

  // Charger les entités
  useEffect(() => {
    (async () => {
      try {
        const data = await window.api.call('getEntites', {});
        setEntiteOptions(Array.isArray(data) ? data : []);
      } catch {
        message.error('Erreur lors du chargement des entités');
      }
    })();
  }, []);

  // Charger la dotation existante en édition
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
        if (data.entite_id) {
          await handleEntityChange(data.entite_id);
        }
      } catch {
        message.error('Erreur lors du chargement de la dotation');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, form]);

  // Charger les sous-entités / coordinations d’une entité
  const handleEntityChange = async entiteId => {
    try {
      const data = await window.api.call(
        'getSubEntitiesByEntite',
        { entiteId }
      );
      setSubEntities(Array.isArray(data) ? data : []);
    } catch {
      message.error('Erreur lors du chargement des sous-entités');
    }
  };

  // Soumettre le formulaire
  const onFinish = async values => {
    setLoading(true);
    try {
      // Formater les dates
      values.date_dotation = values.date_dotation.format('YYYY-MM-DD');
      if (values.date_integration) {
        values.date_integration = values.date_integration.format('YYYY-MM-DD');
      }
      // Fixer le type de ressource
      values.ressource_type = 'materiel_specifique';

      if (id) {
        await window.api.call('updateDotation', { id, ...values });
        message.success('Dotation mise à jour avec succès');
      } else {
        await window.api.call('createDotation', values);
        message.success('Dotation créée avec succès');
      }
      navigate('/dashboard/dotation-materiel');
    } catch {
      message.error('Erreur lors de l’enregistrement de la dotation');
    } finally {
      setLoading(false);
    }
  };

  // État du type de dotation (individuelle / collective)
  const typeDot = Form.useWatch('type_dotation', form);

  return (
    <div className="dotation-materiel-specifique-form">
      <Card
        title={
          id
            ? 'Modifier Dotation Matériel Spécifique'
            : 'Créer Dotation Matériel Spécifique'
        }
        className="form-card"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ type_dotation: 'individuelle' }}
        >
          <Form.Item
            name="code_dotation"
            label="Code Dotation"
          >
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
                  <Option
                    key={vdp.id}
                    value={vdp.id}
                    data={vdp}
                  >
                    {vdp.nom} {vdp.prenom} – CNIB : {vdp.cnib}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <>
              <Form.Item
                name="entite_id"
                label="Sélectionner une Entité"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  placeholder="Choisissez une entité"
                  onChange={handleEntityChange}
                >
                  {entiteOptions.map(e => (
                    <Option key={e.id} value={e.id}>
                      {e.nom}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {subEntities.length > 0 && (
                <Form.Item
                  name="sous_entite_id"
                  label="Sous-entité / Coordination"
                  rules={[{ required: true }]}
                >
                  <Select placeholder="Choisissez une option">
                    {subEntities.map(sub => (
                      <Option key={sub.id} value={sub.id}>
                        {sub.nom}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
            </>
          )}

          <Form.Item
            name="ressource_id"
            label="ID du Matériel"
            rules={[{ required: true }]}
          >
            <Input placeholder="ID du matériel spécifique" />
          </Form.Item>

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
              <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate("/dashboard/dotation-materiel")}
              >
                Annuler
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
