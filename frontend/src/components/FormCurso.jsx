import React, { useState, useEffect } from 'react';
import { cursosService } from '../services/api';
import './FormCurso.css';

export default function FormCurso({ onSuccess, cursoId = null, onCancel }) {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    nivel: '',
    max_estudiantes: 10
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cursoId) {
      fetchCurso();
    }
  }, [cursoId]);

  const fetchCurso = async () => {
    try {
      const response = await cursosService.getById(cursoId);
      setFormData(response.data);
    } catch (err) {
      setError('Error al cargar el curso');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'max_estudiantes' ? parseInt(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (cursoId) {
        await cursosService.update(cursoId, formData);
      } else {
        await cursosService.create(formData);
      }
      setFormData({
        nombre: '',
        descripcion: '',
        nivel: '',
        max_estudiantes: 10
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el curso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form-curso" onSubmit={handleSubmit}>
      <h3>{cursoId ? 'Editar Curso' : 'Nuevo Curso'}</h3>
      
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-group">
        <label>Nombre del Curso *</label>
        <input
          type="text"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          required
          placeholder="Ej: Inglés Básico"
        />
      </div>

      <div className="form-group">
        <label>Descripción</label>
        <textarea
          name="descripcion"
          value={formData.descripcion}
          onChange={handleChange}
          placeholder="Descripción del curso"
          rows="4"
        />
      </div>

      <div className="form-group">
        <label>Nivel</label>
        <select
          name="nivel"
          value={formData.nivel}
          onChange={handleChange}
        >
          <option value="">Selecciona un nivel</option>
          <option value="A1">A1 - Principiante</option>
          <option value="A2">A2 - Elemental</option>
          <option value="B1">B1 - Intermedio</option>
          <option value="B2">B2 - Intermedio Alto</option>
          <option value="C1">C1 - Avanzado</option>
          <option value="C2">C2 - Dominio Completo</option>
        </select>
      </div>

      <div className="form-group">
        <label>Máximo de Estudiantes</label>
        <input
          type="number"
          name="max_estudiantes"
          value={formData.max_estudiantes}
          onChange={handleChange}
          min="1"
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
