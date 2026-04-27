// src/components/CarteVisuel.js
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./CarteVisuel.css";

// Correction des icônes par défaut de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

function CarteVisuel() {
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Point de centrage par défaut
  const defaultCenter = { lat: 12.37, lng: -1.52 };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Remplacement de fetch par IPC
        const data = await window.api.call("getCarteVisuel", {});
        const mappedData = data.map((item) => ({
          ...item,
          key: item.id.toString(),
        }));
        setMarkers(mappedData);
      } catch (err) {
        message.error(
          err.message || "Erreur lors du chargement des données de Carte Visuel"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Spin size="large" style={{ display: "block", margin: "100px auto" }} />
    );
  }

  return (
    <div className="carte-visuel-container">
      <h1>Carte Visuelle</h1>
      <MapContainer
        center={defaultCenter}
        zoom={6}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker) => (
          <Marker key={marker.id} position={[marker.lat, marker.lng]}>
            <Popup>
              <strong>{marker.nom}</strong>
              <br />
              {marker.description}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default CarteVisuel;
