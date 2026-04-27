// src/components/RegionList.js
import React, { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "./RegionList.css"
import { SearchOutlined } from "@ant-design/icons"
import {
  Button,
  Input,
  Row,
  Col,
  Spin,
  message,
  Modal,
  Card
} from "antd"

const { Meta } = Card

// Coordonnées approximatives pour les régions du Burkina Faso
const regionCoordinates = {
  "Boucle du Mouhoun": { lat: 12.15, lng: -3.60 },
  Cascades: { lat: 11.40, lng: -4.20 },
  Centre: { lat: 12.37, lng: -1.52 },
  "Centre-Est": { lat: 12.82, lng: -0.88 },
  "Centre-Nord": { lat: 13.04, lng: -1.23 },
  "Centre-Ouest": { lat: 11.92, lng: -2.30 },
  "Hauts-Bassins": { lat: 12.70, lng: -2.45 },
  Nord: { lat: 15.0, lng: -0.70 },
  Sahel: { lat: 14.0, lng: -1.0 },
  "Sud-Ouest": { lat: 10.80, lng: -2.70 },
  Est: { lat: 13.30, lng: -0.50 }
}

const defaultCoords = { lat: 12.37, lng: -1.52 }

// Correction des icônes de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png"
})

export default function RegionList() {
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchMarkers, setSearchMarkers] = useState([])
  const [polylinePoints, setPolylinePoints] = useState([])
  const [map, setMap] = useState(null)
  const navigate = useNavigate()

  const fetchRegions = async () => {
    setLoading(true)
    try {
      // Correction : utilise la bonne méthode du preload pour charger la liste des régions
      let data = []
      if (
        window.electronAPI &&
        typeof window.electronAPI.getRegionsList === "function"
      ) {
        data = await window.electronAPI.getRegionsList()
      } else if (
        window.electronAPI &&
        typeof window.electronAPI.getRegions === "function"
      ) {
        data = await window.electronAPI.getRegions()
      }
      setRegions(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Erreur lors du chargement des régions :", error)
      message.error("Erreur lors du chargement des régions")
      setRegions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRegions()
  }, [])

  const getMapCenter = () => {
    if (!regions.length) return defaultCoords
    const firstRegion = regions[0]
    return regionCoordinates[firstRegion.nom] || defaultCoords
  }

  const deleteRegion = (id) => {
    Modal.confirm({
      title: "Confirmer la suppression",
      content: "Voulez-vous vraiment supprimer cette région ?",
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        try {
          await window.electronAPI.deleteRegion(id)
          message.success("Région supprimée avec succès")
          fetchRegions()
        } catch (error) {
          console.error("Erreur lors de la suppression :", error)
          message.error("Erreur lors de la suppression")
        }
      }
    })
  }

  const handleCardClick = (region) => {
    navigate(`/regions/edit/${region.id}`)
  }

  const handleSearch = async () => {
    if (!map || !searchQuery.trim()) {
      return message.warning("Veuillez saisir un lieu")
    }
    const query = encodeURIComponent(searchQuery.trim())
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "gestion-armes-vdp/1.0" }
      })
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        const { lat, lon } = data[0]
        const newMarker = { lat: parseFloat(lat), lng: parseFloat(lon) }
        setSearchMarkers((prev) => [...prev, newMarker])
        setPolylinePoints((prev) => [...prev, newMarker])
        map.flyTo([lat, lon], 12)
      } else {
        message.warning("Lieu non trouvé")
      }
    } catch (error) {
      console.error("Erreur lors de la recherche du lieu :", error)
      message.error("Erreur lors de la recherche du lieu")
    }
  }

  const handleResetSearch = () => {
    setSearchMarkers([])
    setPolylinePoints([])
    if (map) {
      map.setView(getMapCenter(), 6)
    }
  }

  if (loading) {
    return (
      <Spin size="large" style={{ display: "block", margin: "100px auto" }} />
    )
  }

  return (
    <div className="region-list-container">
      <div className="region-list-header">
        <h2 className="region-list-title">
          Liste des Régions (Total : {regions.length})
        </h2>
        <div className="region-list-actions">
          <Link to="/regions/add">
            <Button type="primary" size="large">
              Ajouter une Région
            </Button>
          </Link>
        </div>
      </div>

      <div className="region-cards-container">
        <Row gutter={[16, 16]}>
          {(Array.isArray(regions) ? regions : []).map((region) => (
            <Col key={region.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                className="region-card"
                style={{ textAlign: "center", cursor: "pointer" }}
                onClick={() => handleCardClick(region)}
                actions={[
                  <Button
                    key="edit"
                    type="link"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/regions/edit/${region.id}`)
                    }}
                  >
                    Modifier
                  </Button>,
                  <Button
                    key="delete"
                    type="link"
                    danger
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteRegion(region.id)
                    }}
                  >
                    Supprimer
                  </Button>
                ]}
              >
                <Meta
                  title={region.nom}
                  description={
                    <>
                      <div style={{ fontWeight: "bold" }}>
                        Code : {region.code}
                      </div>
                      <div
                        style={{
                          marginTop: "4px",
                          color: "#00bcd4",
                          fontWeight: "bold"
                        }}
                      >
                        {typeof region.nbProvinces !== "undefined"
                          ? region.nbProvinces
                          : 0}{" "}
                        provinces
                      </div>
                    </>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      <div className="region-search-container">
        <Input
          className="region-search-input"
          placeholder="Rechercher un lieu..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          suffix={<Button icon={<SearchOutlined />} onClick={handleSearch} />}
        />
        <Button
          className="region-reset-btn"
          onClick={handleResetSearch}
          type="default"
        >
          Réinitialiser
        </Button>
      </div>

      <div className="region-map-container">
        <h3 className="region-map-title">Carte des Régions</h3>
        <MapContainer
          center={getMapCenter()}
          zoom={6}
          style={{ height: "400px", width: "100%" }}
          whenCreated={setMap}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {(Array.isArray(regions) ? regions : []).map((region) => {
            const coords = regionCoordinates[region.nom] || defaultCoords
            return (
              <Marker
                key={region.id}
                position={[coords.lat, coords.lng]}
              >
                <Popup>
                  <strong>{region.nom}</strong>
                  <br />
                  Code : {region.code}
                  <br />
                  {typeof region.nbProvinces !== "undefined"
                    ? `${region.nbProvinces} provinces`
                    : "0 provinces"}
                </Popup>
              </Marker>
            )
          })}

          {(Array.isArray(searchMarkers) ? searchMarkers : []).map(
            (marker, index) => (
              <Marker
                key={`search-${index}`}
                position={[marker.lat, marker.lng]}
              >
                <Popup>Résultat de la recherche</Popup>
              </Marker>
            )
          )}

          {Array.isArray(polylinePoints) &&
            polylinePoints.length > 1 && (
              <Polyline positions={polylinePoints} color="#ff7800" />
            )}

          {Array.isArray(searchMarkers) &&
            searchMarkers.length > 0 && (
              <Circle
                center={[
                  searchMarkers[0].lat,
                  searchMarkers[0].lng
                ]}
                radius={1000}
                color="#ff0000"
              />
            )}
        </MapContainer>
      </div>
    </div>
  )
}