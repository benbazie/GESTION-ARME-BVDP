// src/components/NotificationDetail.jsx
import React, { useEffect, useState } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import "./NotificationDetail.css";

export default function NotificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      try {
        // appel IPC générique au lieu de fetch
        const data = await window.api.call("getNotificationById", { id });
        setNotification(data);
      } catch (err) {
        console.error("getNotificationById", err);
        message.error("Erreur lors de la récupération de la notification");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <Spin
        size="large"
        style={{ display: "block", margin: "100px auto" }}
      />
    );
  }

  if (!notification) {
    return <div>Aucune notification trouvée</div>;
  }

  return (
    <div className="notification-detail-container">
      <Button
        type="default"
        onClick={() => navigate("/notifications")}
        icon={<ArrowLeftOutlined />}
      >
        Retour à la liste
      </Button>

      <Card
        title={`Notification #${notification.id}`}
        className="notification-detail-card"
      >
        <p>
          <strong>Message :</strong> {notification.message}
        </p>
        <p>
          <strong>Statut :</strong> {notification.vue ? "Vue" : "Non vue"}
        </p>
        <p>
          <strong>Timestamp :</strong> {notification.timestamp}
        </p>
        <p>
          <strong>Détails :</strong> {notification.details}
        </p>
      </Card>
    </div>
  );
}
