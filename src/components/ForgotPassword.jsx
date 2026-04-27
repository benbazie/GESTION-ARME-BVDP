import { Typography } from 'antd';
// src/components/ForgotPassword.jsx
import React, { useState } from 'react';
import {
  Modal,
      open={visible}
  Button,
  Form,
  Input,
  Alert,
  Space,
  message
} from 'antd';
import {
  MailOutlined,
  LoadingOutlined,
  CopyOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export default function ForgotPassword({ visible, onClose }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Envoi de la demande de reset
  const handleSubmit = async ({ email }) => {
    setLoading(true);
    try {
      await window.api.call('forgotPassword', { email });
      setSent(true);
      message.success('Un lien de réinitialisation vous a été envoyé');
    } catch (err) {
      console.error('forgotPassword', err);
      message.error(err.message || 'Échec de l’envoi du lien');
    } finally {
      setLoading(false);
    }
  };

  // Copier l’email d’admin dans le presse-papier
  const handleCopy = () => {
    navigator.clipboard.writeText('admin@example.com');
    message.success("Adresse copiée");
  };

  return (
    <Modal
      visible={visible}
      title={<Title level={4}>Mot de passe oublié</Title>}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Fermer
        </Button>
      ]}
      maskClosable={false}
    >
      {!sent ? (
        <>
          <Paragraph>
            Entrez votre adresse email pour recevoir un lien de
            réinitialisation.
          </Paragraph>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Email requis' },
                { type: 'email', message: 'Email invalide' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="votre.email@exemple.com"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={loading ? <LoadingOutlined /> : null}
                  loading={loading}
                >
                  Envoyer le lien
                </Button>
                <Button onClick={onClose}>Annuler</Button>
              </Space>
            </Form.Item>
          </Form>
        </>
      ) : (
        <>
          <Alert
            type="success"
            showIcon
            message="Lien envoyé"
            description="Vérifiez votre boîte mail pour réinitialiser votre mot de passe."
            style={{ marginBottom: 16 }}
          />
          <Paragraph>
            Si vous ne recevez rien, contactez l’administrateur&nbsp;:
          </Paragraph>
          <Space>
            <Text strong>benbazi@live.fr ou au 00226 66033228</Text>
            <Button
              icon={<CopyOutlined />}
              onClick={handleCopy}
              size="small"
            />
          </Space>
        </>
      )}
    </Modal>
  );
}
