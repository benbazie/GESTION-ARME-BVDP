import React from 'react';

const Footer = () => (
  <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'gray' }}>
    <hr />
    <p>© {new Date().getFullYear()} Gestion des Armes VDP. Tous droits réservés.</p>
  </div>
);

export default Footer;
