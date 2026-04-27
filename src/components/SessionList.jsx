// src/components/SessionList.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Table,
  Input,
  Button,
  Space,
  Row,
  Col,
  Spin,
  Modal,
  message,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import "./SessionList.css";

const { Search } = Input;
const { confirm } = Modal;

export default function SessionList() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchText, setSearchText] = useState("");

  const callBridge = useCallback(async (method, ...args) => {
    const primary = window.api;
    if (primary && typeof primary[method] === "function") return primary[method](...args);
    const fallback = window.electronAPI;
    if (fallback && typeof fallback[method] === "function") return fallback[method](...args);
    throw new Error(`Handler ${method} indisponible`);
  }, []);

  // 1. Charger toutes les sessions via IPC
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const provider = window.api?.getActiveSessions ? window.api : api;
      const list = await provider.getActiveSessions();
      setSessions(
        Array.isArray(list)
          ? list.map((s) => ({
              ...s,
              key: s.id,
              statut: s.statut || (s.logout_at ? "inactive" : "active"),
            }))
          : []
      );
    } catch (err) {
      console.error("getActiveSessions", err);
      Modal.error({
        title: "Erreur",
        content: "Impossible de charger les sessions.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const timer = setInterval(loadSessions, 30000);
    return () => clearInterval(timer);
  }, [loadSessions]);

  // 2. Supprimer une session après confirmation
  const deleteSession = useCallback((id) => {
    confirm({
      title: "Confirmer la suppression",
      content: "Voulez-vous vraiment supprimer cette session ?",
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        setDeletingId(id);
        try {
          await callBridge("deleteSession", id);
          message.success("Session supprimée avec succès");
          setSessions((prev) => prev.filter((s) => s.id !== id));
        } catch (err) {
          console.error("deleteSession", err);
          Modal.error({
            title: "Erreur",
            content: "Échec de la suppression de la session.",
          });
        } finally {
          setDeletingId(null);
        }
      },
    });
  }, [callBridge]);

  // 3. Filtrage par User ID ou token
  const filteredSessions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      [
        s.user_id,
        s.username,
        s.nom,
        s.prenom,
        s.token,
        s.statut,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [sessions, searchText]);

  // 4. Définition des colonnes du tableau
  const columns = [
    {
      title: "Utilisateur",
      key: "user",
      render: (_, record) =>
        record.username ||
        [record.nom, record.prenom].filter(Boolean).join(" ") ||
        record.user_id ||
        "—",
    },
    {
      title: "Statut",
      dataIndex: "statut",
      key: "statut",
      width: 120,
      render: (value) => (
        <span className={`session-status-tag ${value === "active" ? "is-active" : "is-inactive"}`}>
          {value === "active" ? "Actif" : "Inactif"}
        </span>
      ),
    },
    {
      title: "Token",
      dataIndex: "token",
      key: "token",
      ellipsis: true,
    },
    {
      title: "Ouverture",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
    },
    {
      title: "Fermeture",
      dataIndex: "logout_at",
      key: "logout_at",
      width: 180,
      render: (value) => value || "—",
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          loading={deletingId === record.id}
          onClick={() => deleteSession(record.id)}
        >
          Supprimer
        </Button>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <h3>Liste des Sessions (Total : {sessions.length})</h3>
            </Col>
            <Col>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadSessions}
                  aria-label="Rafraîchir"
                />
              </Space>
            </Col>
          </Row>
        }
        style={{ margin: 24 }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12}>
            <Search
              placeholder="Rechercher par utilisateur, token ou statut…"
              enterButton={<SearchOutlined />}
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={(v) => setSearchText(v)}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredSessions}
          pagination={{ pageSize: 10 }}
          rowKey="id"
          bordered
        />
      </Card>
    </Spin>
  );
}
