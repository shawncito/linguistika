import React, { useState } from 'react';
import { matriculasService } from '../services/api';
import './FormMatricula.css';

export default function FormMatricula({ onSuccess, onCancel, estudiantes, cursos, tutores }) {
  const [formData, setFormData] = useState({
    estudiante_id: '',
    curso_id: '',
    tutor_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.estudiante_id || !formData.curso_id || !formData.tutor_id) {
        setError('Todos los campos son requeridos');
        setLoading(false);
        return;
      }

      await matriculasService.create(formData);
      setSuccess('¡Matrícula creada exitosamente!');
      setFormData({
        estudiante_id: '',
        curso_id: '',
        tutor_id: ''
      });
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la matrícula');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-matricula" onSubmit={handleSubmit}>
      <h3>Nueva Matrícula</h3>
      
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="form-group">
        <label>Estudiante *</label>
        <select
          name="estudiante_id"
          value={formData.estudiante_id}
          onChange={handleChange}
          required
        >
          <option value="">Selecciona un estudiante</option>
          {estudiantes && estudiantes.map(est => (
            <option key={est.id} value={est.id}>
              {est.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Curso *</label>
        <select
          name="curso_id"
          value={formData.curso_id}
          onChange={handleChange}
          required
        >
          <option value="">Selecciona un curso</option>
          {cursos && cursos.map(curso => (
            <option key={curso.id} value={curso.id}>
              {curso.nombre} ({curso.nivel})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Tutor *</label>
        <select
          name="tutor_id"
          value={formData.tutor_id}
          onChange={handleChange}
          required
        >
          <option value="">Selecciona un tutor</option>
          {tutores && tutores.map(tutor => (
            <option key={tutor.id} value={tutor.id}>
              {tutor.nombre} ({tutor.especialidad})
            </option>
          ))}
        </select>
      </div>

      <div className="form-buttons">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Matriculando...' : 'Matricular'}
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
