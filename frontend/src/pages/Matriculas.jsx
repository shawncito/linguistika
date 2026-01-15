import React, { useState, useEffect } from 'react';
import { matriculasService, estudiantesService, cursosService, tutoresService } from '../services/api';
import FormMatricula from '../components/FormMatricula';
import './Matriculas.css';

export default function Matriculas() {
  const [matriculas, setMatriculas] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [matData, estData, curData, tutData] = await Promise.all([
        matriculasService.getAll(),
        estudiantesService.getAll(),
        cursosService.getAll(),
        tutoresService.getAll()
      ]);

      setMatriculas(matData.data);
      setEstudiantes(estData.data);
      setCursos(curData.data);
      setTutores(tutData.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas cancelar esta matrícula?')) {
      try {
        await matriculasService.delete(id);
        fetchData();
      } catch (error) {
        console.error('Error eliminando matrícula:', error);
      }
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    fetchData();
  };

  return (
    <div className="matriculas-page">
      <h1>✏️ Gestión de Matrículas</h1>

      {!showForm ? (
        <button 
          className="btn btn-primary btn-large"
          onClick={() => setShowForm(true)}
        >
          + Nueva Matrícula
        </button>
      ) : null}

      {showForm && (
        <FormMatricula 
          onSuccess={handleFormSuccess}
          onCancel={() => setShowForm(false)}
          estudiantes={estudiantes}
          cursos={cursos}
          tutores={tutores}
        />
      )}

      {loading ? (
        <p className="loading">Cargando matrículas...</p>
      ) : matriculas.length > 0 ? (
        <div className="matriculas-table-container">
          <table className="matriculas-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Curso</th>
                <th>Tutor</th>
                <th>Fecha Inscripción</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {matriculas.map(matricula => (
                <tr key={matricula.id}>
                  <td className="nombre-cell">{matricula.estudiante_nombre}</td>
                  <td>{matricula.curso_nombre}</td>
                  <td>{matricula.tutor_nombre}</td>
                  <td>{new Date(matricula.fecha_inscripcion).toLocaleDateString('es-ES')}</td>
                  <td className="acciones">
                    <button 
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(matricula.id)}
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No hay matrículas registradas. ¡Crea una para comenzar!</p>
        </div>
      )}
    </div>
  );
}
