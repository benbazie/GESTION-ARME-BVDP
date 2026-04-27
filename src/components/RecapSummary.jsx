import { Typography } from 'antd';
// src/components/RecapSummary.jsx
import React, { useMemo } from "react";
import {
  Card,
  Collapse,
  Table,
  Progress,
  Row,
  Col,
  Statistic,
  Typography,
} from "antd";

const { Panel } = Collapse;
const { Title } = Typography;

export default function RecapSummary({ armes }) {
  // Nombre total d'armes
  const totalArmes = armes.length;

  // Définition des champs à résumer
  const fields = [
    { key: "type", label: "Type" },
    { key: "categorie", label: "Catégorie" },
    { key: "statut", label: "Statut" },
    { key: "etat", label: "État" },
    { key: "lotDesignation", label: "Lot" },
  ];

  // Calcul des données agrégées, memoisé pour optimiser la perf
  const summaryByField = useMemo(() => {
    return fields.map(({ key, label }) => {
      const counts = armes.reduce((acc, a) => {
        const v = a[key] ?? "Non défini";
        acc[v] = (acc[v] || 0) + 1;
        return acc;
      }, {});

      // Convertit en array trié par nombre décroissant
      const rows = Object.entries(counts)
        .map(([value, count]) => ({
          key: `${key}-${value}`,
          valeur: value,
          nombre: count,
          pourcentage: totalArmes > 0 ? (count / totalArmes) * 100 : 0,
        }))
        .sort((a, b) => b.nombre - a.nombre);

      return { fieldKey: key, label, rows };
    });
  }, [armes]);

  // Colonnes partagées par tous les tableaux
  const columns = [
    {
      title: "Valeur",
      dataIndex: "valeur",
      key: "valeur",
    },
    {
      title: "Nombre",
      dataIndex: "nombre",
      key: "nombre",
      align: "right",
      width: 100,
    },
    {
      title: "%",
      dataIndex: "pourcentage",
      key: "pourcentage",
      align: "right",
      width: 120,
      render: (pct) => (
        <div>
          <Progress
            percent={Number(pct.toFixed(1))}
            size="small"
            strokeWidth={8}
            format={(p) => `${p}%`}
          />
        </div>
      ),
    },
  ];

  return (
    <Card bordered style={{ marginTop: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            Récapitulatif global
          </Title>
          <Text type="secondary">
            Total d’armes : <Statistic value={totalArmes} formatter={(v) => v} />
          </Text>
        </Col>
      </Row>

      <Collapse accordion>
        {summaryByField.map(({ fieldKey, label, rows }) => (
          <Panel header={`${label} (${rows.length} valeurs)`} key={fieldKey}>
            <Table
              dataSource={rows}
              columns={columns}
              pagination={false}
              size="small"
              bordered
            />
          </Panel>
        ))}
      </Collapse>
    </Card>
  );
}
