import React, { useState, useEffect } from 'react';
import { cursosService } from '../services/api';
import FormCurso from '../components/FormCurso';
import './Cursos.css';

export default function Cursos() {
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchCursos();
  }, []);

  const fetchCursos = async () => {
    try {
      setLoading(true);
      const response = await cursosService.getAll();
      setCursos(response.data);
    } catch (error) {
      console.error('Error cargando cursos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este curso?')) {
      try {
        await cursosService.delete(id);
        fetchCursos();
      } catch (error) {
        console.error('Error eliminando curso:', error);
      }
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingId(null);
    fetchCursos();
  };

  return (
    <div className="cursos-page">
      <h1>📚 Gestión de Cursos</h1>

      {!showForm ? (
        <button 
          className="btn btn-primary btn-large"
          onClick={() => setShowForm(true)}
        >
          + Nuevo Curso
        </button>
      ) : null}

      {showForm && (
        <FormCurso 
          onSuccess={handleFormSuccess}
          cursoId={editingId}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}

      {loading ? (
        <p className="loading">Cargando cursos...</p>
      ) : cursos.length > 0 ? (
        <div className="cursos-table-container">
          <table className="cursos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Nivel</th>
                <th>Descripción</th>
                <th>Máx. Estudiantes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cursos.map(curso => (
                <tr key={curso.id}>
                  <td className="nombre-cell">{curso.nombre}</td>
                  <td>
                    <span className="nivel-badge">{curso.nivel || 'N/A'}</span>
                  </td>
                  <td>{curso.descripcion || '-'}</td>
                  <td className="centro">{curso.max_estudiantes}</td>
                  <td className="acciones">
                    <button 
                      className="btn btn-small btn-edit"
                      onClick={() => {
                        setEditingId(curso.id);
                        setShowForm(true);
                      }}
                    >
                      Editar
                    </button>
                    <button 
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(curso.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No hay cursos registrados. ¡Crea uno para comenzar!</p>
        </div>
      )}
    </div>
  );
}
