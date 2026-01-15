import React, { useState, useEffect } from 'react';
import { tutoresService } from '../services/api';
import FormTutor from '../components/FormTutor';
import './Tutores.css';

export default function Tutores() {
  const [tutores, setTutores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchTutores();
  }, []);

  const fetchTutores = async () => {
    try {
      setLoading(true);
      const response = await tutoresService.getAll();
      setTutores(response.data);
    } catch (error) {
      console.error('Error cargando tutores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este tutor?')) {
      try {
        await tutoresService.delete(id);
        fetchTutores();
      } catch (error) {
        console.error('Error eliminando tutor:', error);
      }
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingId(null);
    fetchTutores();
  };

  return (
    <div className="tutores-page">
      <h1>👨‍🏫 Gestión de Tutores</h1>

      {!showForm ? (
        <button 
          className="btn btn-primary btn-large"
          onClick={() => setShowForm(true)}
        >
          + Nuevo Tutor
        </button>
      ) : null}

      {showForm && (
        <FormTutor 
          onSuccess={handleFormSuccess}
          tutorId={editingId}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}

      {loading ? (
        <p className="loading">Cargando tutores...</p>
      ) : tutores.length > 0 ? (
        <div className="tutores-grid">
          {tutores.map(tutor => (
            <div key={tutor.id} className="tutor-card">
              <div className="card-header">
                <h3>{tutor.nombre}</h3>
                <span className="badge">{tutor.especialidad}</span>
              </div>

              <div className="card-body">
                {tutor.email && (
                  <p><strong>📧</strong> {tutor.email}</p>
                )}
                {tutor.telefono && (
                  <p><strong>📱</strong> {tutor.telefono}</p>
                )}
                <p className="tarifa">
                  <strong>💰 Tarifa:</strong> €{tutor.tarifa_por_hora}/hora
                </p>
              </div>

              <div className="card-actions">
                <button 
                  className="btn btn-small btn-edit"
                  onClick={() => {
                    setEditingId(tutor.id);
                    setShowForm(true);
                  }}
                >
                  Editar
                </button>
                <button 
                  className="btn btn-small btn-danger"
                  onClick={() => handleDelete(tutor.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>No hay tutores registrados. ¡Crea uno para comenzar!</p>
        </div>
      )}
    </div>
  );
}
