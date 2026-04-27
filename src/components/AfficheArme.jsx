// src/components/AfficheArme.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Button, Descriptions, Divider, Spin, message } from "antd";
import moment from "moment";
import "./AfficheArme.css";

function AfficheArme() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State pour les données récupérées
  const [arme, setArme] = useState(null);
  const [configDetail, setConfigDetail] = useState(null);
  const [lotDetail, setLotDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fonction asynchrone pour récupérer toutes les données
    const fetchData = async () => {
      try {
        // Récupérer les données de l'arme
        const armeData = await window.electronAPI.getArme(id);
        if (!armeData) {
          message.error("Arme non trouvée");
          return;
        }
        setArme(armeData);

        // Récupérer toutes les configurations d'arme
        const configData = await window.electronAPI.getConfigArmes();
        const foundConfig = configData.find(
          (item) => item.id === armeData.config_arme_id
        );
        setConfigDetail(foundConfig);

        // Récupérer les données du lot
        const lotData = await window.electronAPI.getLot();
        const foundLot = lotData.find((item) => item.id === armeData.lot);
        setLotDetail(foundLot);
      } catch (error) {
        console.error("Erreur lors de la récupération:", error);
        message.error("Erreur lors de la récupération des données");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="affichearme-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!arme) {
    return (
      <Card className="affichearme-card">
        <p>Aucune donnée disponible pour cette arme.</p>
        <Button type="primary" onClick={() => navigate("/dashboard/armes")}>
          Retour à la liste
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title="Fiche détaillée de l'Arme"
      extra={
        <Button type="primary" onClick={() => navigate("/dashboard/armes")}>
          Retour à la liste
        </Button>
      }
      className="affichearme-card"
    >
      <Descriptions bordered column={1} title="Informations de l'Arme">
        <Descriptions.Item label="ID">{arme.id}</Descriptions.Item>
        <Descriptions.Item label="Numéro de Série">
          {arme.numero_serie}
        </Descriptions.Item>
        <Descriptions.Item label="Date d'Entrée">
          {arme.date_entree ? moment(arme.date_entree).format("L") : "N/C"}
        </Descriptions.Item>
        <Descriptions.Item label="Date de Sortie">
          {arme.date_sortie ? moment(arme.date_sortie).format("L") : "N/C"}
        </Descriptions.Item>
        <Descriptions.Item label="État">
          {arme.etat ? arme.etat : "Non défini"}
        </Descriptions.Item>
        {/* Ajoutez ici d'autres champs de la table arme si nécessaire */}
      </Descriptions>

      <Divider orientation="left">Configuration d'Arme</Divider>
      {configDetail ? (
        <Descriptions bordered column={1}>
          <Descriptions.Item label="ID de Configuration">
            {configDetail.id}
          </Descriptions.Item>
          <Descriptions.Item label="Type">
            {configDetail.type}
          </Descriptions.Item>
          <Descriptions.Item label="Catégorie">
            {configDetail.categorie}
          </Descriptions.Item>
          <Descriptions.Item label="Désignation">
            {configDetail.designation}
          </Descriptions.Item>
          {/* Ajoutez d'autres champs de la table config_arme si nécessaire */}
        </Descriptions>
      ) : (
        <p>Aucune configuration trouvée.</p>
      )}

      <Divider orientation="left">Lot</Divider>
      {lotDetail ? (
        <Descriptions bordered column={1}>
          <Descriptions.Item label="ID du Lot">
            {lotDetail.id}
          </Descriptions.Item>
          <Descriptions.Item label="Désignation">
            {lotDetail.designation}
          </Descriptions.Item>
          {/* Ajoutez ici d'autres informations du lot */}
        </Descriptions>
      ) : (
        <p>Aucun lot trouvé.</p>
      )}
    </Card>
  );
}

export default AfficheArme;
