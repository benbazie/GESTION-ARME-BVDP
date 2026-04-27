// src/components/MouvementForm.js
import React, { useEffect, useState } from 'react';
import {
  Form,
  Input,
  Button,
  DatePicker,
  Select,
  Spin,
  message
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';

const { Option } = Select;

export default function MouvementForm() {
  const { id } = useParams();  
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Charger le mouvement en édition
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    (async () => {
      try {
        const data = await window.api.call('getMouvement', { id });
        form.setFieldsValue({
          date_mouvement: data.date_mouvement
            ? moment(data.date_mouvement)
            : null,
          type:   data.type,
          motif:  data.motif
        });
      } catch (err) {
        console.error('getMouvement', err);
        message.error('Erreur lors du chargement du mouvement');
        navigate('/mouvements');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Soumettre création ou mise à jour
  const onFinish = async values => {
    const payload = {
      date_mouvement: values.date_mouvement
        ? values.date_mouvement.format('YYYY-MM-DD')
        : null,
      type:  values.type,
      motif: values.motif
    };
    setLoading(true);
    try {
      if (id) {
        await window.api.call('updateMouvement', { id, ...payload });
        message.success('Mouvement mis à jour');
      } else {
        await window.api.call('addMouvement', payload);
        message.success('Mouvement ajouté');
      }
      navigate('/mouvements');
    } catch (err) {
      console.error('saveMouvement', err);
      message.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <h2>{id ? 'Modifier le Mouvement' : 'Ajouter un Mouvement'}</h2>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            name="date_mouvement"
            label="Date de Mouvement"
            rules={[
              { required: true, message: 'Sélectionnez la date' }
            ]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Date"
            />
          </Form.Item>

          <Form.Item
            name="type"
            label="Type de Mouvement"
            rules={[
              { required: true, message: 'Sélectionnez le type' }
            ]}
          >
            <Select placeholder="Type">
              <Option value="Entrée">Entrée</Option>
              <Option value="Sortie">Sortie</Option>
              <Option value="Transfert">Transfert</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="motif"
            label="Motif"
            rules={[
              { required: true, message: 'Saisissez le motif' }
            ]}
          >
            <Input.TextArea placeholder="Motif du mouvement" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
            >
              {id ? 'Modifier' : 'Ajouter'}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </Spin>
  );
}
