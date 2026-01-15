import React, { useState, useEffect } from 'react';
import { tutoresService } from '../services/api';
import './FormTutor.css';

export default function FormTutor({ onSuccess, tutorId = null, onCancel }) {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    especialidad: '',
    tarifa_por_hora: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tutorId) {
      fetchTutor();
    }
  }, [tutorId]);

  const fetchTutor = async () => {
    try {
      const response = await tutoresService.getById(tutorId);
      setFormData(response.data);
    } catch (err) {
      setError('Error al cargar el tutor');
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
      if (tutorId) {
        await tutoresService.update(tutorId, formData);
      } else {
        await tutoresService.create(formData);
      }
      setFormData({
        nombre: '',
        email: '',
        telefono: '',
        especialidad: '',
        tarifa_por_hora: ''
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el tutor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-tutor" onSubmit={handleSubmit}>
      <h3>{tutorId ? 'Editar Tutor' : 'Nuevo Tutor'}</h3>
      
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-group">
        <label>Nombre *</label>
        <input
          type="text"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          required
          placeholder="Ej: María García"
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

      <div className="form-group">
        <label>Especialidad *</label>
        <select
          name="especialidad"
          value={formData.especialidad}
          onChange={handleChange}
          required
        >
          <option value="">Selecciona una especialidad</option>
          <option value="Inglés">Inglés</option>
          <option value="Francés">Francés</option>
          <option value="Alemán">Alemán</option>
          <option value="Español">Español</option>
          <option value="Portugués">Portugués</option>
          <option value="Italiano">Italiano</option>
          <option value="Chino">Chino</option>
          <option value="Japonés">Japonés</option>
        </select>
      </div>

      <div className="form-group">
        <label>Tarifa por Hora (€) *</label>
        <input
          type="number"
          name="tarifa_por_hora"
          value={formData.tarifa_por_hora}
          onChange={handleChange}
          step="0.01"
          required
          placeholder="25.00"
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
