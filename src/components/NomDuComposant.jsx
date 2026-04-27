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

export default function RoleList() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  // 1. Charger la liste des rÃ´les depuis le main process
  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.getRolesList();
      const mapped = Array.isArray(list) ? list.map((r) => ({
        ...r,
        key: r.id,
        permsArray: Array.isArray(r.permissions)
          ? r.permissions
          : JSON.parse(r.permissions || "[]"),
      })) : [];
      setRoles(mapped);
    } catch (err) {
      console.error("getRolesList", err);
      Modal.error({
        title: "Erreur",
        content: "Impossible de charger la liste des rÃ´les.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

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
          await window.electronAPI.deleteRoles(id);
          message.success("RÃ´le supprimÃ© avec succÃ¨s");
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

  // 3. Filtrage mÃ©moire via useMemo
  const filteredRoles = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.nom.toLowerCase().includes(q));
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
                Liste des RÃ´les (Total : {roles.length})
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
          dataSource={filteredRoles}
          pagination={{ pageSize: 8 }}
          rowKey="id"
          bordered
        />
      </Card>
    </Spin>
  );
}