import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../contexts/AuthContext'

export default function PrivateRoute() {
  const { user, loading } = useAuth()

  // Tant que l’auth est en cours de vérification, on affiche un loader
  if (loading) {
    return <Spin fullscreen tip="Vérification de la session..." />
  }

  return user
    ? <Outlet />
    : <Navigate to="/login" replace />
}
