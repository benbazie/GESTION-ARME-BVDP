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
import { SearchOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons"
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
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

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
  const [provinces, setProvinces] = useState([]) // Ajouté
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchMarkers, setSearchMarkers] = useState([])
  const [polylinePoints, setPolylinePoints] = useState([])
  const [map, setMap] = useState(null)
  const navigate = useNavigate()

  // Nouvelle fonction pour charger les provinces
  const fetchProvinces = async () => {
    try {
      let data = []
      if (
        window.electronAPI &&
        typeof window.electronAPI.getProvincesList === "function"
      ) {
        data = await window.electronAPI.getProvincesList()
      } else if (
        window.electronAPI &&
        typeof window.electronAPI.getProvinces === "function"
      ) {
        data = await window.electronAPI.getProvinces()
      }
      setProvinces(Array.isArray(data) ? data : [])
    } catch (error) {
      setProvinces([])
    }
  }

  // Modifie fetchRegions pour charger aussi les provinces
  const fetchRegions = async () => {
    setLoading(true)
    try {
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
      console.log("[RegionList] fetchRegions data:", data) // <-- Ajoute ce log
      if (data && data.error && /token|session/i.test(data.error)) {
        // Affiche un message d'erreur clair
        window.alert("Session expirée, veuillez vous reconnecter.")
      }
      setRegions(Array.isArray(data) ? data : [])
      // Charger les provinces après les régions
      await fetchProvinces()
    } catch (error) {
      setRegions([])
      setProvinces([])
      console.error("[RegionList] fetchRegions error:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRegions()
    // eslint-disable-next-line
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

  // Export CSV
  const handleExportCSV = () => {
    const rows = [["#", "Nom", "Code", "Nb Provinces"]]
    regions.forEach((r, idx) => {
      const nbProvinces = provinces.filter((p) => p.region_id === r.id).length
      rows.push([idx + 1, r.nom, r.code, nbProvinces])
    })
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(";")
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "regions.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export Excel
  const handleExportExcel = () => {
    const rows = [["#", "Nom", "Code", "Nb Provinces"]]
    regions.forEach((r, idx) => {
      const nbProvinces = provinces.filter((p) => p.region_id === r.id).length
      rows.push([idx + 1, r.nom, r.code, nbProvinces])
    })
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Regions")
    XLSX.writeFile(wb, "regions.xlsx")
  }

  // Export Word
  const handleExportWord = () => {
    let html = `<table border="1" style="border-collapse:collapse;"><tr><th>#</th><th>Nom</th><th>Code</th><th>Nb Provinces</th></tr>`
    regions.forEach((r, idx) => {
      const nbProvinces = provinces.filter((p) => p.region_id === r.id).length
      html += `<tr>
        <td>${idx + 1}</td>
        <td>${r.nom}</td>
        <td>${r.code}</td>
        <td>${nbProvinces}</td>
      </tr>`
    })
    html += "</table>"
    const blob = new Blob(
      [`<html><head><meta charset="utf-8"></head><body>${html}</body></html>`],
      { type: "application/msword" }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "regions.doc"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: regions.length > 6 ? "landscape" : "portrait",
      unit: "pt",
      format: "a4"
    })
    doc.text("Liste des Régions", 40, 30)
    autoTable(doc, {
      startY: 50,
      head: [["#", "Nom", "Code", "Nb Provinces"]],
      body: regions.map((r, idx) => [
        idx + 1,
        r.nom,
        r.code,
        provinces.filter((p) => p.region_id === r.id).length
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [24, 144, 255] },
      margin: { left: 20, right: 20 }
    })
    doc.save("regions.pdf")
  }

  // Impression paysage si trop large
  const handlePrint = () => {
    const style = document.createElement("style")
    style.innerHTML = `
      @media print {
        @page { size: ${4 > 6 ? "landscape" : "auto"}; }
      }
    `
    document.head.appendChild(style)
    window.print()
    setTimeout(() => {
      document.head.removeChild(style)
    }, 1000)
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
          <Button onClick={handleExportCSV}>CSV</Button>
          <Button onClick={handleExportExcel}>Excel</Button>
          <Button onClick={handleExportWord}>Word</Button>
          <Button onClick={handleExportPDF}>PDF</Button>
          <Button onClick={handlePrint}>Imprimer</Button>
          <Link to="/regions/add">
            <Button type="primary" size="large">
              Ajouter une Région
            </Button>
          </Link>
        </div>
      </div>

      <div className="region-cards-container">
        <Row gutter={[16, 16]}>
          {(Array.isArray(regions) ? regions : []).map((region) => {
            // Calcul du nombre de provinces pour chaque région
            const nbProvinces = provinces.filter(
              (p) => p.region_id === region.id
            ).length
            return (
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
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/regions/edit/${region.id}`)
                      }}
                    />,
                    <Button
                      key="delete"
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteRegion(region.id)
                      }}
                    />
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
                          {nbProvinces} provinces
                        </div>
                      </>
                    }
                  />
                </Card>
              </Col>
            )
          })}
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