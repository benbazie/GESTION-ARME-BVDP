import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  console.log("Page non trouvée pour l'URL :", location.pathname); // Log pour débogage

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1 style={{ fontSize: '48px', color: '#ff4d4f' }}>404 - Page non trouvée</h1>
      <p style={{ fontSize: '18px', color: '#595959' }}>
        Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <Button
        type="primary"
        onClick={() => navigate('/')}
        style={{ marginTop: '20px' }}
      >
        Retour au tableau de bord
      </Button>
    </div>
  );
};

export default NotFound;
