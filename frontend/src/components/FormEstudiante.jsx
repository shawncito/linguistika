import React, { useState, useEffect } from 'react';
import { estudiantesService } from '../services/api';
import './FormEstudiante.css';

export default function FormEstudiante({ onSuccess, estudianteId = null, onCancel }) {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (estudianteId) {
      fetchEstudiante();
    }
  }, [estudianteId]);

  const fetchEstudiante = async () => {
    try {
      const response = await estudiantesService.getById(estudianteId);
      setFormData(response.data);
    } catch (err) {
      setError('Error al cargar el estudiante');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (estudianteId) {
        await estudiantesService.update(estudianteId, formData);
      } else {
        await estudiantesService.create(formData);
      }
      setFormData({
        nombre: '',
        email: '',
        telefono: ''
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el estudiante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-estudiante" onSubmit={handleSubmit}>
      <h3>{estudianteId ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h3>
      
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-group">
        <label>Nombre *</label>
        <input
          type="text"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          required
          placeholder="Ej: Juan Pérez"
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="ejemplo@correo.com"
        />
      </div>

      <div className="form-group">
        <label>Teléfono</label>
        <input
          type="tel"
          name="telefono"
          value={formData.telefono}
          onChange={handleChange}
          placeholder="+34 123 456 789"
        />
      </div>

      <div className="form-buttons">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
