import { useEffect, useMemo, useState } from "react";
import { Button, Card, Modal, Select, Space, Table, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api";

const CategorieArmeList = () => {
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [typeFilter, setTypeFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([api.getCategoriesArmeList(), api.getTypesArmeList()])
      .then(([categories, typeData]) => {
        setRows(categories || []);
        setTypes(typeData || []);
      })
      .catch(() => message.error("Chargement impossible"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = (record) => {
    Modal.confirm({
      title: "Supprimer cette catégorie ?",
      okType: "danger",
      centered: true,
      onOk: () =>
        api
          .deleteCategorieArme(record.id)
          .then(() => {
            message.success("Catégorie supprimée");
            load();
          })
          .catch(() => message.error("Suppression impossible"))
    });
  };

  const typeById = useMemo(
    () => Object.fromEntries(types.map((item) => [item.id, item.nom || item.libelle || item.code])),
    [types]
  );
  const filteredRows = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter(
      (item) => Number(item.type_id ?? item.type_arme_id) === Number(typeFilter)
    );
  }, [rows, typeFilter]);

  const columns = [
    {
      title: "Type",
      dataIndex: "type_id",
      render: (_, record) =>
        typeById[record.type_id] ||
        typeById[record.type_arme_id] ||
        "—"
    },
    { title: "Libellé", dataIndex: "nom", render: (value) => value || "—" },
    { title: "Code", dataIndex: "code", render: (value) => value || "—" },
    {
      title: "Actions",
      width: 180,
      render: (_, record) => (
        <Space>
          <Button onClick={() => navigate(`/dashboard/config-armes/categories/edit/${record.id}`)}>Modifier</Button>
          <Button danger onClick={() => remove(record)}>
            Supprimer
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card
      title="Catégories d'armes"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="Filtrer par type"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value || null)}
            options={types.map((item) => ({
              value: item.id,
              label: item.nom || item.libelle || item.code
            }))}
            style={{ minWidth: 160 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/dashboard/config-armes/categories/add")}
          >
            Nouvelle catégorie
          </Button>
        </Space>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={filteredRows} pagination={{ pageSize: 10 }} />
    </Card>
  );
};

export default CategorieArmeList;
