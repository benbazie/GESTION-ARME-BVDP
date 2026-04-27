import React from 'react';
import { Button, Card, Typography, Space } from 'antd';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const DdrList = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '24px', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card
        style={{
          maxWidth: '600px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ color: '#1890ff', marginBottom: '16px' }}>
              🔧 Module DDR
            </Title>
            <Title level={4} style={{ color: '#666', marginBottom: '24px' }}>
              Désarmement, Démobilisation et Réinsertion
            </Title>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <Text style={{ fontSize: '16px', color: '#666' }}>
              Ce module est actuellement en cours de développement.
            </Text>
            <br />
            <Text style={{ fontSize: '16px', color: '#666' }}>
              Nous travaillons activement pour vous offrir cette fonctionnalité prochainement.
            </Text>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
              🚀 Module en construction, veuillez revenir plus tard
            </Text>
          </div>

          <Space size="middle">
            <Button
              type="primary"
              icon={<HomeOutlined />}
              size="large"
              onClick={() => navigate('/dashboard')}
            >
              Retour au Dashboard
            </Button>

            <Link to="/dashboard">
              <Button
                icon={<ArrowLeftOutlined />}
                size="large"
              >
                Retour à l'accueil
              </Button>
            </Link>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default DdrList;
