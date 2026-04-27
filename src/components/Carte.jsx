// src/components/Carte.js
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import { PlusOutlined, ReloadOutlined, AimOutlined, SearchOutlined } from '@ant-design/icons';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corriger l'affichage des icônes de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Composant pour capturer les clics sur la carte
function MapEvents({ onMapClick }) {
  useMapEvents({
    click: onMapClick,
  });
  return null;
}

function Carte() {
  const [markers, setMarkers] = useState([]);
  const [route, setRoute] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMarkers = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getGeolocalisation();
      // On s'attend à recevoir une liste d'objets avec { id, lat, lng, popupText }
      setMarkers(data);
    } catch (err) {
      console.error("Erreur lors du chargement des marqueurs :", err);
      message.error("Erreur lors du chargement des données géographiques.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMarkers();
  }, []);

  // Ajout de marqueurs par clic sur la carte (optionnel : sauvegarde dans la DB à définir)
  const handleMapClick = (e) => {
    const newMarker = {
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      popupText: "Nouveau point ajouté",
    };
    setMarkers([...markers, newMarker]);
  };

  // Recherche dans les popupText des marqueurs
  const handleSearch = () => {
    if (!searchQuery) {
      // Si la requête est vide, recharger tous les marqueurs
      fetchMarkers();
      return;
    }
    const filtered = markers.filter(marker =>
      marker.popupText && marker.popupText.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setMarkers(filtered);
  };

  const mapCenter = [13.5838, -2.4190]; // Centre par défaut
  
  return (
    <div style={{ padding: '24px' }}>
      <h1>Carte Interactive</h1>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Input 
            placeholder="Rechercher dans les marqueurs"
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Col>
        <Col>
          <Button type="primary" onClick={handleSearch}>Rechercher</Button>
        </Col>
      </Row>
      {loading ? (
        <Spin size="large" style={{ display: "block", margin: "100px auto" }} />
      ) : (
        <MapContainer center={mapCenter} zoom={13} style={{ height: '600px', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {markers.map((marker, index) => (
            <Marker key={index} position={[marker.lat, marker.lng]}>
              <Popup>{marker.popupText}</Popup>
            </Marker>
          ))}
          {route && route.length > 0 && <Polyline positions={route} color="blue" />}
          <MapEvents onMapClick={handleMapClick} />
        </MapContainer>
      )}
      <Row justify="center" style={{ marginTop: 16 }}>
        <Col>
          <Tooltip title="Ajouter un marqueur en cliquant sur la carte">
            <Button type="primary" icon={<PlusOutlined />}>Ajouter un Marqueur</Button>
          </Tooltip>
        </Col>
        <Col>
          <Tooltip title="Actualiser la carte">
            <Button type="default" icon={<ReloadOutlined />} onClick={fetchMarkers}>Actualiser</Button>
          </Tooltip>
        </Col>
        <Col>
          <Tooltip title="Traçage d'itinéraire (fonctionnalité à venir)">
            <Button type="dashed" icon={<AimOutlined />}>Itinéraire</Button>
          </Tooltip>
        </Col>
      </Row>
    </div>
  );
}

export default Carte;
