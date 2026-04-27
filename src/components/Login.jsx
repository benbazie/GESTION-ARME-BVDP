// src/pages/Login.jsx
import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Alert, Typography } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../logo.png'
import './Login.css'

const { Title, Text } = Typography

export default function Login() {
  const [form] = Form.useForm()
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [shake, setShake]     = useState(false)

  const { login } = useAuth()
  const navigate  = useNavigate()
  const from      = useLocation().state?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (shake) {
      const t = setTimeout(() => setShake(false), 600)
      return () => clearTimeout(t)
    }
  }, [shake])

  const onFinish = async ({ username, password }) => {
    console.log('[renderer onFinish] →', { username, password })
    if (!username || !password) {
      setError('Identifiant et mot de passe requis')
      setShake(true)
      return
    }
    setError(null)
    setLoading(true)

    try {
      await login({ username, password })
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err.payload?.error || err.message || 'Erreur inconnue'
      setError(msg)
      setShake(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Card className={`login-card${shake ? ' shake' : ''}`} bordered={false}>
        <img src={logo} alt="Logo" className="login-logo" />
        <Title level={2}>CONNEXION SGI-AMO</Title>

        {error && (
          <Alert
            type="error"
            message={error}
            description={<Button size="small" onClick={() => form.submit()}>Réessayer</Button>}
            showIcon
            className="login-error"
          />
        )}

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="username"
            label="Identifiant"
            rules={[{ required: true, message: 'Entrez votre identifiant' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Identifiant" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mot de passe"
            rules={[{ required: true, message: 'Entrez votre mot de passe' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mot de passe"
              iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              SE CONNECTER
            </Button>
          </Form.Item>
        </Form>

        <Text type="secondary">Pas de compte ? Contactez l’administrateur.</Text>
      </Card>
    </div>
  )
}
