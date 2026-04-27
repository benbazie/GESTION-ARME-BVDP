import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { PlusCircleOutlined, SearchOutlined, FlagOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import 'leaflet/dist/leaflet.css';
import './CartePage.css';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Configuration des icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default,
  iconUrl: require('leaflet/dist/images/marker-icon.png').default,
  shadowUrl: require('leaflet/dist/images/marker-shadow.png').default,
});

function CartePage() {
  return (
    <div>
      <MapContainer center={[13.5784, -2.4216]} zoom={13} style={{ height: "600px", width: "100%", marginBottom: "24px" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[13.5784, -2.4216]}>
          <Popup>
            Ouahigouya, Burkina Faso
          </Popup>
        </Marker>
      </MapContainer>
      <Space size="middle" style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <Button type="primary" icon={<SearchOutlined />} className="btn btn-blue">Rechercher une Zone</Button>
        <Button type="primary" icon={<PlusCircleOutlined />} className="btn btn-green">Enregistrer une Zone</Button>
        <Button type="primary" icon={<FlagOutlined />} className="btn btn-yellow">Marquer une Zone</Button>
        <Button type="primary" icon={<AppstoreAddOutlined />} className="btn btn-red">Créer un Itinéraire</Button>
      </Space>
    </div>
  );
}

export default CartePage;
