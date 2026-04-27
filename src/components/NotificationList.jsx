// src/components/NotificationList.jsx
import React, { useState, useEffect } from "react";
import {
  Table,
  Input,
  Button,
  Space,
  message,
  Modal,
  Spin
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import "./NotificationList.css";

export default function NotificationList() {
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  // Charger les notifications via IPC
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const result = await window.api.call("getNotifications", {});
      const mapped = Array.isArray(result)
        ? result.map(item => ({ ...item, key: item.id.toString() }))
        : [];
      setData(mapped);
    } catch (err) {
      console.error("getNotifications", err);
      message.error("Erreur lors du chargement des notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Filtrer par message ou statut
  const filteredData = data.filter(notif =>
    (notif.message || "")
      .toLowerCase()
      .includes(searchText.toLowerCase()) ||
    (notif.vue ? "vue" : "non vue")
      .includes(searchText.toLowerCase())
  );

  // Marquer comme lue via IPC
  const markAsRead = async id => {
    try {
      await window.api.call("markNotificationRead", { id });
      message.success("Notification marquée comme vue");
      fetchNotifications();
    } catch (err) {
      console.error("markNotificationRead", err);
      message.error("Erreur lors du marquage");
    }
  };

  // Supprimer via IPC
  const deleteNotification = id => {
    Modal.confirm({
      title: "Confirmer la suppression",
      content: "Supprimer cette notification ?",
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        try {
          await window.api.call("deleteNotification", { id });
          message.success("Notification supprimée");
          fetchNotifications();
        } catch (err) {
          console.error("deleteNotification", err);
          message.error("Erreur lors de la suppression");
        }
      }
    });
  };

  const columns = [
    {
      title: "Message",
      dataIndex: "message",
      key: "message",
      ellipsis: true
    },
    {
      title: "Statut",
      key: "vue",
      render: (_, record) => (record.vue ? "Vue" : "Non vue")
    },
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      key: "timestamp"
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          {!record.vue && (
            <Button
              size="small"
              type="primary"
              onClick={() => markAsRead(record.id)}
            >
              Marquer comme vue
            </Button>
          )}
          <Button
            size="small"
            danger
            onClick={() => deleteNotification(record.id)}
          >
            Supprimer
          </Button>
          <Link to={`/notifications/${record.id}`}>
            <Button size="small">Détails</Button>
          </Link>
        </Space>
      )
    }
  ];

  return (
    <div className="notification-list-container">
      <div className="notification-list-header">
        <h1>Liste des Notifications</h1>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={fetchNotifications}
        >
          Rafraîchir
        </Button>
      </div>
      <div className="notification-list-search">
        <Input
          placeholder="Rechercher par message ou statut..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          prefix={<SearchOutlined />}
          allowClear
        />
      </div>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Spin>
    </div>
  );
}
