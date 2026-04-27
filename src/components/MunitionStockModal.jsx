import React, { useState, useEffect } from "react";
import { Modal, Form, InputNumber, Select, Input, Button, Table, Card, Statistic, Space, Row, Col, message, Tag } from "antd";
import { PlusOutlined, MinusOutlined, HistoryOutlined, AlertOutlined } from "@ant-design/icons";
import moment from "moment";

const { TextArea } = Input;
const { Option } = Select;

export default function MunitionStockModal({ 
  visible, 
  onClose, 
  munition, 
  onUpdate,
  config 
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [mouvements, setMouvements] = useState([]);
  const [typeOperation, setTypeOperation] = useState('ENTREE');

  useEffect(() => {
    if (visible && munition) {
      loadMouvements();
      form.setFieldsValue({
        type_mouvement: 'ENTREE',
        quantite: 0,
        motif: '',
        observations: ''
      });
    }
  }, [visible, munition]);

  const loadMouvements = async () => {
    // Charger l'historique des mouvements
    try {
      const data = await api.call('getMouvementsMunitions', { munition_id: munition.id });
      setMouvements(data || []);
    } catch (error) {
      console.error('Erreur chargement mouvements:', error);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const payload = {
        munition_id: munition.id,
        config_munition_id: munition.config_munition_id,
        type_mouvement: values.type_mouvement,
        quantite: Math.abs(values.quantite),
        quantite_avant: munition.stock_disponible,
        motif: values.motif,
        observations: values.observations,
        localite_id: munition.localite_id
      };

      // Calculer la nouvelle quantité
      const nouvelleQuantite = values.type_mouvement === 'ENTREE' 
        ? munition.stock_disponible + Math.abs(values.quantite)
        : munition.stock_disponible - Math.abs(values.quantite);

      if (nouvelleQuantite < 0) {
        message.error('Stock insuffisant pour cette sortie');
        return;
      }

      payload.quantite_apres = nouvelleQuantite;

      // Enregistrer le mouvement
      await api.call('createMouvementMunition', payload);

      // Mettre à jour le stock
      await api.call('updateMunition', {
        id: munition.id,
        stock_disponible: nouvelleQuantite
      });

      message.success('Mouvement enregistré avec succès');
      onUpdate(nouvelleQuantite);
      onClose();
    } catch (error) {
      message.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const generateFicheRecap = () => {
    const data = {
      munition,
      config,
      mouvements,
      statistiques: {
        totalEntrees: mouvements.filter(m => m.type_mouvement === 'ENTREE').reduce((sum, m) => sum + m.quantite, 0),
        totalSorties: mouvements.filter(m => ['SORTIE', 'DOTATION'].includes(m.type_mouvement)).reduce((sum, m) => sum + m.quantite, 0),
        dernierMouvement: mouvements[0]
      }
    };

    // Générer et ouvrir la fiche récapitulative
    const html = generateRecapHTML(data);
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const generateRecapHTML = (data) => `
    <html>
      <head>
        <title>Fiche Récapitulative - ${data.config?.designation}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .section { margin: 20px 0; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat-item { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Fiche Récapitulative Munition</h1>
          <h2>${data.config?.designation || 'N/A'}</h2>
          <p>Généré le ${moment().format('DD/MM/YYYY HH:mm')}</p>
        </div>
        
        <div class="section">
          <h3>Informations Générales</h3>
          <p><strong>Type:</strong> ${data.config?.type || 'N/A'}</p>
          <p><strong>Calibre:</strong> ${data.config?.calibre || 'N/A'}</p>
          <p><strong>Stock Actuel:</strong> ${data.munition?.stock_disponible || 0}</p>
          <p><strong>Seuil Critique:</strong> ${data.munition?.seuil_critique || 0}</p>
        </div>

        <div class="stats">
          <div class="stat-item">
            <h4>Total Entrées</h4>
            <p>${data.statistiques.totalEntrees}</p>
          </div>
          <div class="stat-item">
            <h4>Total Sorties</h4>
            <p>${data.statistiques.totalSorties}</p>
          </div>
          <div class="stat-item">
            <h4>Balance</h4>
            <p>${data.statistiques.totalEntrees - data.statistiques.totalSorties}</p>
          </div>
        </div>

        <div class="section">
          <h3>Historique des Mouvements</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Quantité</th>
                <th>Stock Avant</th>
                <th>Stock Après</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              ${data.mouvements.map(m => `
                <tr>
                  <td>${moment(m.date_mouvement).format('DD/MM/YYYY HH:mm')}</td>
                  <td>${m.type_mouvement}</td>
                  <td>${m.quantite}</td>
                  <td>${m.quantite_avant}</td>
                  <td>${m.quantite_apres}</td>
                  <td>${m.motif || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;

  const getStockStatus = () => {
    const stock = munition?.stock_disponible || 0;
    const seuil = munition?.seuil_critique || 0;
    
    if (stock <= 0) return { status: 'Rupture', color: 'red', icon: <AlertOutlined /> };
    if (stock <= seuil) return { status: 'Critique', color: 'orange', icon: <AlertOutlined /> };
    return { status: 'Normal', color: 'green', icon: null };
  };

  const stockStatus = getStockStatus();

  const mouvementColumns = [
    {
      title: 'Date',
      dataIndex: 'date_mouvement',
      render: date => moment(date).format('DD/MM/YY HH:mm')
    },
    {
      title: 'Type',
      dataIndex: 'type_mouvement',
      render: type => {
        const colors = { 'ENTREE': 'green', 'SORTIE': 'red', 'DOTATION': 'orange', 'TRANSFERT': 'blue' };
        return <Tag color={colors[type]}>{type}</Tag>;
      }
    },
    {
      title: 'Qté',
      dataIndex: 'quantite',
      align: 'right'
    },
    {
      title: 'Résultat',
      dataIndex: 'quantite_apres',
      align: 'right'
    },
    {
      title: 'Motif',
      dataIndex: 'motif',
      ellipsis: true
    }
  ];

  return (
    <Modal
      title={`Gestion Stock - ${config?.designation || 'Munition'}`}
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={null}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="Stock Actuel" value={munition?.stock_disponible || 0} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="Seuil Critique" value={munition?.seuil_critique || 0} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="État" 
                value={stockStatus.status}
                valueStyle={{ color: stockStatus.color }}
                prefix={stockStatus.icon}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="Localité" 
                value={munition?.localite_nom || 'Non assigné'}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Nouveau Mouvement" size="small">
          <Form form={form} onFinish={handleSubmit} layout="vertical">
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item 
                  name="type_mouvement" 
                  label="Type d'opération"
                  rules={[{ required: true }]}
                >
                  <Select onChange={setTypeOperation}>
                    <Option value="ENTREE">
                      <PlusOutlined style={{ color: 'green' }} /> Entrée
                    </Option>
                    <Option value="SORTIE">
                      <MinusOutlined style={{ color: 'red' }} /> Sortie
                    </Option>
                    <Option value="DOTATION">
                      <MinusOutlined style={{ color: 'orange' }} /> Dotation
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item 
                  name="quantite" 
                  label="Quantité"
                  rules={[{ required: true, min: 1 }]}
                >
                  <InputNumber 
                    min={1} 
                    max={typeOperation === 'ENTREE' ? undefined : munition?.stock_disponible}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="motif" label="Motif">
                  <Input placeholder="Motif du mouvement" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="observations" label="Observations">
              <TextArea rows={2} placeholder="Observations complémentaires" />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Enregistrer le mouvement
              </Button>
              <Button icon={<HistoryOutlined />} onClick={generateFicheRecap}>
                Fiche Récapitulative
              </Button>
            </Space>
          </Form>
        </Card>

        <Card title="Historique des Mouvements" size="small">
          <Table
            dataSource={mouvements}
            columns={mouvementColumns}
            size="small"
            pagination={{ pageSize: 8 }}
            rowKey="id"
            scroll={{ y: 200 }}
          />
        </Card>
      </Space>
    </Modal>
  );
}
