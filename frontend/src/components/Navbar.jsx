import React, { useState } from 'react';
import './Navbar.css';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          📚 Linguistika
        </Link>
        
        <button 
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>
        
        <ul className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          <li><Link to="/" className="nav-link">Dashboard</Link></li>
          <li><Link to="/tutores" className="nav-link">Tutores</Link></li>
          <li><Link to="/cursos" className="nav-link">Cursos</Link></li>
          <li><Link to="/estudiantes" className="nav-link">Estudiantes</Link></li>
          <li><Link to="/matriculas" className="nav-link">Matrículas</Link></li>
          <li><Link to="/pagos" className="nav-link">Pagos</Link></li>
        </ul>
      </div>
    </nav>
  );
}
