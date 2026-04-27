// src/components/RoleList.jsx
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
  Typography,
  message,
  Form, // <-- déjà présent
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import "./RoleList.css";

const { Title, Text } = Typography;
const { confirm } = Modal;
const { Search } = Input;

const parsePermissions = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map((p) => p.trim()).filter(Boolean);
  const raw = String(input).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map((p) => p.trim()).filter(Boolean);
    if (typeof parsed === "string") {
      return parsed.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
    }
    return [String(parsed).trim()].filter(Boolean);
  } catch {
    return raw.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
  }
};

export default function RoleList() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  const callBridge = useCallback(async (method, ...args) => {
    const primary = window.api;
    if (primary && typeof primary[method] === "function") return primary[method](...args);
    const fallback = window.electronAPI;
    if (fallback && typeof fallback[method] === "function") return fallback[method](...args);
    throw new Error(`Handler ${method} indisponible`);
  }, []);

  // 1. Charger la liste des rÃ´les depuis le main process
  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await callBridge("getRolesList");
      const mapped = Array.isArray(list)
        ? list.map((r) => ({
            ...r,
            key: r.id,
            permsArray: parsePermissions(r.permissions),
          }))
        : [];
      setRoles(mapped);
    } catch (err) {
      console.error("getRolesList", err);
      Modal.error({
        title: "Erreur",
        content: "Impossible de charger la liste des rôles.",
      });
    } finally {
      setLoading(false);
    }
  }, [callBridge]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // 2. Confirmation & suppression dâ€™un rÃ´le
  const deleteRole = (id) => {
    confirm({
      title: "Confirmer la suppression",
      icon: <ExclamationCircleOutlined />,
      content: "ÃŠtes-vous sÃ»r de vouloir supprimer ce rÃ´le ?",
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        setDeletingId(id);
        try {
          await callBridge("deleteRole", id);
          message.success("Rôle supprimé avec succès");
          setRoles((prev) => prev.filter((r) => r.id !== id));
        } catch (err) {
          console.error("deleteRoles", err);
          Modal.error({
            title: "Erreur",
            content: "Ã‰chec de la suppression du rÃ´le.",
          });
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  // 3. Filtrage mémoire via useMemo
  const filteredRoles = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return Array.isArray(roles) ? roles : [];
    return (Array.isArray(roles) ? roles : []).filter((r) => r.nom.toLowerCase().includes(q));
  }, [roles, searchText]);

  // 4. Colonnes du tableau
  const columns = [
    {
      title: "Nom",
      dataIndex: "nom",
      key: "nom",
      sorter: (a, b) => a.nom.localeCompare(b.nom),
    },
    {
      title: "Permissions",
      dataIndex: "permsArray",
      key: "permissions",
      render: (arr) => (arr.length ? arr.join(", ") : <Text type="secondary">N/A</Text>),
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Link to={`/roles/edit/${record.id}`}>
            <Button size="small">Modifier</Button>
          </Link>
          <Button
            size="small"
            danger
            loading={deletingId === record.id}
            onClick={() => deleteRole(record.id)}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                Liste des rôles (Total : {roles.length})
              </Title>
            </Col>
            <Col>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadRoles}
                  aria-label="RafraÃ®chir"
                />
                <Link to="/roles/add">
                  <Button type="primary" icon={<PlusOutlined />}>
                    Ajouter un RÃ´le
                  </Button>
                </Link>
              </Space>
            </Col>
          </Row>
        }
        style={{ margin: 24 }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={12}>
            <Search
              placeholder="Rechercher par nomâ€¦"
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={(v) => setSearchText(v)}
              onChange={(e) => setSearchText(e.target.value)}
              value={searchText}
            />
          </Col>
          <Col xs={24} sm={12} style={{ textAlign: "right" }}>
            <Button onClick={() => setSearchText("")}>Effacer</Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={Array.isArray(filteredRoles) ? filteredRoles : []}
          pagination={{ pageSize: 8 }}
          rowKey="id"
          bordered
        />
      </Card>
    </Spin>
  );
}

