import { useEffect, useMemo, useState } from "react";
import { Button, Card, Modal, Space, Table, Tag, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../api";

const ModeleArmeList = () => {
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([api.getModelesArmeList(), api.getTypesArmeList(), api.getCategoriesArmeList()])
      .then(([modeles, typeData, catData]) => {
        setRows(modeles || []);
        setTypes(typeData || []);
        setCategories(catData || []);
      })
      .catch(() => message.error("Chargement impossible"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const typeById = useMemo(
    () => Object.fromEntries(types.map((item) => [item.id, item.nom || item.libelle || item.code])),
    [types]
  );
  const categorieById = useMemo(
    () => Object.fromEntries(categories.map((item) => [item.id, item.nom || item.libelle || item.code])),
    [categories]
  );

  const remove = (record) => {
    Modal.confirm({
      title: "Supprimer ce modèle ?",
      okType: "danger",
      centered: true,
      onOk: () =>
        api
          .deleteModeleArme(record.id)
          .then(() => {
            message.success("Modèle supprimé");
            load();
          })
          .catch(() => message.error("Suppression impossible"))
    });
  };

  const columns = [
    { title: "Libellé", dataIndex: "nom", render: (value) => value || record.designation || "—" },
    {
      title: "Type",
      dataIndex: "type_id",
      render: (_, record) => typeById[record.type_id] || <Tag>Non défini</Tag>
    },
    {
      title: "Catégorie",
      dataIndex: "categorie_id",
      render: (_, record) => categorieById[record.categorie_id] || <Tag>Non définie</Tag>
    },
    { title: "Code", dataIndex: "code", render: (value) => value || "—" },
    {
      title: "Actions",
      width: 200,
      render: (_, record) => (
        <Space>
          <Button onClick={() => navigate(`/dashboard/config-armes/modeles/edit/${record.id}`)}>Modifier</Button>
          <Button danger onClick={() => remove(record)}>
            Supprimer
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card
      title="Modèles d'armes"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/dashboard/config-armes/modeles/add")}>
          Nouveau modèle
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10 }} />
    </Card>
  );
};

export default ModeleArmeList;
