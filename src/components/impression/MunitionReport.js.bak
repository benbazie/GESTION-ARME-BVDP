import React from 'react';
import Header from './Header';
import Footer from './Footer';

const MunitionReport = ({ data }) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = `
      <html>
        <head>
          <title>Rapport des Munitions</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Rapport des Munitions</h1>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Calibre</th>
                <th>Quantité</th>
                <th>Date d'entrée</th>
              </tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (munition) => `
                  <tr>
                    <td>${munition.id}</td>
                    <td>${munition.type}</td>
                    <td>${munition.calibre}</td>
                    <td>${munition.quantite}</td>
                    <td>${munition.date_entree}</td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div>
      <Header title="Rapport des Munitions" subtitle="Liste détaillée des munitions" />
      <button onClick={handlePrint}>Imprimer</button>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid black', padding: '8px' }}>ID</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>Type</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>Calibre</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>Quantité</th>
            <th style={{ border: '1px solid black', padding: '8px' }}>Date d'entrée</th>
          </tr>
        </thead>
        <tbody>
          {data.map((munition) => (
            <tr key={munition.id}>
              <td style={{ border: '1px solid black', padding: '8px' }}>{munition.id}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{munition.type}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{munition.calibre}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{munition.quantite}</td>
              <td style={{ border: '1px solid black', padding: '8px' }}>{munition.date_entree}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Footer />
    </div>
  );
};

export default MunitionReport;
