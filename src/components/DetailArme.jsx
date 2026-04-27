import React, { useEffect, useState } from "react";
import { Card, Descriptions, Tag, Typography, Skeleton, Alert } from "antd";
import api from "../api";

const { Title } = Typography;

const DetailArme = ({ armeId }) => {
  const [loading, setLoading] = useState(true);
  const [arme, setArme] = useState(null);
  const [dotation, setDotation] = useState(null);
  const [vdp, setVdp] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        // Charge l'arme
        const armeData = await api.getArmeById(armeId);
        setArme(armeData);

        // Cherche une dotation active pour cette arme
        const dotations = await api.getDotationsWithDetails();
        const dotationActive = Array.isArray(dotations)
          ? dotations.find(
              (d) =>
                Array.isArray(d.items) &&
                d.items.some(
                  (item) =>
                    (item.arme_id === armeId || item.resource_id === armeId) &&
                    (!item.status || !String(item.status).toLowerCase().includes("retour"))
                )
            )
          : null;
        setDotation(dotationActive);

        // Si dotation attribuée à un VDP, charge le VDP
        if (
          dotationActive &&
          dotationActive.beneficiary_type === "vdp" &&
          dotationActive.vdp_id
        ) {
          const vdpData = await api.getVdpById(dotationActive.vdp_id);
          setVdp(vdpData);
        } else {
          setVdp(null);
        }
      } catch (err) {
        setArme(null);
        setDotation(null);
        setVdp(null);
      } finally {
        setLoading(false);
      }
    };
    if (armeId) fetchDetails();
  }, [armeId]);

  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;

  if (!arme)
    return <Alert type="error" message="Arme introuvable" showIcon />;

  return (
    <Card bordered>
      <Title level={4}>Détail de l'arme</Title>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="N° série">{arme.numero_serie || "—"}</Descriptions.Item>
        <Descriptions.Item label="Désignation">{arme.designation || arme.nom || "—"}</Descriptions.Item>
        <Descriptions.Item label="Type">{arme.type || arme.config_type || "—"}</Descriptions.Item>
        <Descriptions.Item label="Catégorie">{arme.categorie || arme.config_categorie || "—"}</Descriptions.Item>
        <Descriptions.Item label="Statut">
          <Tag color={arme.statut === "dotée" ? "magenta" : "blue"}>
            {arme.statut || "disponible"}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Lot">{arme.lot_nom || arme.lot_designation || "—"}</Descriptions.Item>
        <Descriptions.Item label="Entité">{arme.entite_nom || "—"}</Descriptions.Item>
        <Descriptions.Item label="Région">{arme.region_nom || "—"}</Descriptions.Item>
      </Descriptions>
      <Divider />
      <Title level={5}>Dotation</Title>
      {dotation ? (
        <>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Type dotation">{dotation.dotation_type || "—"}</Descriptions.Item>
            <Descriptions.Item label="Statut dotation">
              <Tag color={dotation.statut === "clôturée" ? "green" : "gold"}>
                {dotation.statut || "en cours"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Date dotation">
              {dotation.date_dotation || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Observation">
              {dotation.observation || "—"}
            </Descriptions.Item>
          </Descriptions>
          <Divider />
          <Title level={5}>VDP détenteur</Title>
          {vdp ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Nom">{vdp.nom || "—"}</Descriptions.Item>
              <Descriptions.Item label="Prénom">{vdp.prenom || "—"}</Descriptions.Item>
              <Descriptions.Item label="CNIB">{vdp.numero_cnib || "—"}</Descriptions.Item>
              <Descriptions.Item label="Contacts">{vdp.contacts || "—"}</Descriptions.Item>
              <Descriptions.Item label="Sexe">{vdp.sexe || "—"}</Descriptions.Item>
              <Descriptions.Item label="Date naissance">{vdp.date_naissance || "—"}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Alert type="info" message="Dotée à une entité ou coordination" showIcon />
          )}
        </>
      ) : (
        <Alert type="warning" message="Non dotée" description="Cette arme n'est attribuée à aucun VDP ou entité actuellement." showIcon />
      )}
    </Card>
  );
};

export default DetailArme;
