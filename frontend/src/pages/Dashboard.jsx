import React, { useState, useEffect } from 'react';
import { dashboardService } from '../services/api';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [tutoriasDia, setTutoriasDia] = useState([]);
  const [resumenTutores, setResumenTutores] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, tutoriasData, resumenData] = await Promise.all([
        dashboardService.getEstadisticas(),
        dashboardService.getTutoriasPorDia(selectedDate),
        dashboardService.getResumenTutores(selectedDate)
      ]);

      setStats(statsData.data);
      setTutoriasDia(tutoriasData.data || []);
      setResumenTutores(resumenData.data || []);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dashboard"><p>Cargando...</p></div>;
  }

  return (
    <div className="dashboard">
      <h1>📊 Dashboard Principal</h1>

      {/* Estadísticas Generales */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats?.tutores || 0}</div>
          <div className="stat-label">Tutores Activos</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats?.estudiantes || 0}</div>
          <div className="stat-label">Estudiantes</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats?.cursos || 0}</div>
          <div className="stat-label">Cursos</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats?.matriculas || 0}</div>
          <div className="stat-label">Matrículas</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats?.clases_totales || 0}</div>
          <div className="stat-label">Clases Totales</div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-number">${stats?.ingresos_pendientes?.toFixed(2) || '0.00'}</div>
          <div className="stat-label">Ingresos Pendientes</div>
        </div>
      </div>

      {/* Filtro por fecha */}
      <div className="date-filter">
        <label>Selecciona una fecha para ver tutorías:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* Tutorías del Día */}
      <div className="tutorías-section">
        <h2>📅 Tutorías del {selectedDate}</h2>
        {tutoriasDia.length > 0 ? (
          <div className="tutorías-grid">
            {tutoriasDia.map(tutoría => (
              <div key={tutoría.id} className="tutoría-card">
                <div className="tutoría-header">
                  <span className="tutoría-hora">{tutoría.hora_inicio} - {tutoría.hora_fin}</span>
                  <span className={`status ${tutoría.estado}`}>{tutoría.estado}</span>
                </div>
                <h4>{tutoría.estudiante_nombre}</h4>
                <p><strong>Curso:</strong> {tutoría.curso_nombre}</p>
                <p><strong>Tutor:</strong> {tutoría.tutor_nombre}</p>
                <p><strong>Tarifa:</strong> €{tutoría.tarifa_por_hora}/h</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No hay tutorías programadas para esta fecha</p>
        )}
      </div>

      {/* Resumen por Tutor */}
      <div className="resumen-section">
        <h2>👨‍🏫 Resumen de Tutores - {selectedDate}</h2>
        {resumenTutores.length > 0 ? (
          <div className="tutores-table">
            <table>
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Clases</th>
                  <th>Cursos</th>
                  <th>Estudiantes</th>
                </tr>
              </thead>
              <tbody>
                {resumenTutores.map(tutor => (
                  <tr key={tutor.id}>
                    <td>{tutor.nombre}</td>
                    <td><strong>{tutor.total_clases}</strong></td>
                    <td>{tutor.cursos || '-'}</td>
                    <td>{tutor.estudiantes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No hay datos de tutores para esta fecha</p>
        )}
      </div>
    </div>
  );
}
