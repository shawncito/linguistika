import React, { useState, useEffect } from 'react';
import { estudiantesService } from '../services/api';
import FormEstudiante from '../components/FormEstudiante';
import './Estudiantes.css';

export default function Estudiantes() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchEstudiantes();
  }, []);

  const fetchEstudiantes = async () => {
    try {
      setLoading(true);
      const response = await estudiantesService.getAll();
      setEstudiantes(response.data);
    } catch (error) {
      console.error('Error cargando estudiantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este estudiante?')) {
      try {
        await estudiantesService.delete(id);
        fetchEstudiantes();
      } catch (error) {
        console.error('Error eliminando estudiante:', error);
      }
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingId(null);
    fetchEstudiantes();
  };

  return (
    <div className="estudiantes-page">
      <h1>🎓 Gestión de Estudiantes</h1>

      {!showForm ? (
        <button 
          className="btn btn-primary btn-large"
          onClick={() => setShowForm(true)}
        >
          + Nuevo Estudiante
        </button>
      ) : null}

      {showForm && (
        <FormEstudiante 
          onSuccess={handleFormSuccess}
          estudianteId={editingId}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}

      {loading ? (
        <p className="loading">Cargando estudiantes...</p>
      ) : estudiantes.length > 0 ? (
        <div className="estudiantes-grid">
          {estudiantes.map(estudiante => (
            <div key={estudiante.id} className="estudiante-card">
              <div className="card-header">
                <h3>{estudiante.nombre}</h3>
                <span className="id">#{estudiante.id}</span>
              </div>

              <div className="card-body">
                {estudiante.email && (
                  <p><strong>📧 Email:</strong> {estudiante.email}</p>
                )}
                {estudiante.telefono && (
                  <p><strong>📱 Teléfono:</strong> {estudiante.telefono}</p>
                )}
                {estudiante.fecha_inscripcion && (
                  <p><strong>📅 Inscrito:</strong> {new Date(estudiante.fecha_inscripcion).toLocaleDateString('es-ES')}</p>
                )}
              </div>

              <div className="card-actions">
                <button 
                  className="btn btn-small btn-edit"
                  onClick={() => {
                    setEditingId(estudiante.id);
                    setShowForm(true);
                  }}
                >
                  Editar
                </button>
                <button 
                  className="btn btn-small btn-danger"
                  onClick={() => handleDelete(estudiante.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>No hay estudiantes registrados. ¡Crea uno para comenzar!</p>
        </div>
      )}
    </div>
  );
}
