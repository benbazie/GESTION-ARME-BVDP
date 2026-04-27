import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, Popconfirm, Space, Table, Tag, Tooltip, message } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  PlusOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import api, {
  getSourcesArmement,
  deleteSourceArmement
} from "../api";

const SourceList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);

  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getSourcesArmement();
      setSources(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("[SourceList] load:", error);
      message.error("Impossible de charger les sources.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleDelete = async (id) => {
    try {
      await deleteSourceArmement(id);
      message.success("Source supprimée.");
      loadSources();
    } catch (error) {
      console.error("[SourceList] delete:", error);
      message.error("Suppression impossible.");
    }
  };

  const columns = [
    {
      title: "Code",
      dataIndex: "code",
      sorter: (a, b) => (a.code || "").localeCompare(b.code || "")
    },
    {
      title: "Nom",
      dataIndex: "nom"
    },
    {
      title: "Description",
      dataIndex: "description",
      ellipsis: true
    },
    {
      title: "Provenance",
      dataIndex: "provenance",
      render: (value) => value || "—"
    },
    {
      title: "Source dotation",
      dataIndex: "source_dotation_id",
      render: (value) =>
        value ? <Tag color="blue">#{value}</Tag> : <Tag>Non renseigné</Tag>
    },
    {
      title: "Réception",
      dataIndex: "date_reception",
      render: (value) =>
        value ? dayjs(value).format("DD/MM/YYYY") : "—"
    },
    {
      title: "Clôture",
      dataIndex: "date_cloture",
      render: (value) =>
        value ? dayjs(value).format("DD/MM/YYYY") : "—"
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="Modifier">
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/dashboard/sources/edit/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="Supprimer cette source ?"
            okText="Oui"
            cancelText="Non"
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="Supprimer">
              <Button danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Card
      title="Sources d’armement"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadSources} />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/dashboard/sources/add")}
          >
            Nouvelle source
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={sources}
        pagination={{ pageSize: 12 }}
        scroll={{ x: 900 }}
      />
    </Card>
  );
};

export default SourceList;
