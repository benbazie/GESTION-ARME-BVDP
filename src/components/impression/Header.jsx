import React from 'react';

const Header = ({ title, subtitle }) => (
  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
    <h1 style={{ margin: 0 }}>{title}</h1>
    {subtitle && <h3 style={{ margin: 0, color: 'gray' }}>{subtitle}</h3>}
    <hr style={{ marginTop: '10px' }} />
  </div>
);

export default Header;
