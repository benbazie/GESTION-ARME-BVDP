import { useEffect, useState } from "react";
import { Button, Card, Modal, Space, Table, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api";

const TypeArmeList = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api
      .getTypesArmeList()
      .then((data) => setRows(data || []))
      .catch(() => message.error("Chargement impossible"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = (record) => {
    Modal.confirm({
      title: "Supprimer ce type ?",
      okType: "danger",
      centered: true,
      onOk: () =>
        api
          .deleteTypeArme(record.id)
          .then(() => {
            message.success("Type supprimé");
            load();
          })
          .catch(() => message.error("Suppression impossible"))
    });
  };

  const columns = [
    { title: "Libellé", dataIndex: "nom", render: (value) => value || "—" },
    { title: "Code", dataIndex: "code", render: (value) => value || "—" },
    {
      title: "Actions",
      width: 180,
      render: (_, record) => (
        <Space>
          <Button onClick={() => navigate(`/dashboard/config-armes/types/edit/${record.id}`)}>Modifier</Button>
          <Button danger onClick={() => remove(record)}>
            Supprimer
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card
      title="Types d'armes"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/dashboard/config-armes/types/add")}>
          Nouveau type
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10 }} />
    </Card>
  );
};

export default TypeArmeList;
