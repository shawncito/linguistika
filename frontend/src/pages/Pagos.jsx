import React, { useState, useEffect } from 'react';
import { pagosService, tutoresService } from '../services/api';
import './Pagos.css';

export default function Pagos() {
  const [pagos, setPagos] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTutor, setFiltroTutor] = useState('');
  const [formData, setFormData] = useState({
    tutor_id: '',
    monto: '',
    descripcion: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pagosData, tutoresData] = await Promise.all([
        pagosService.getAll(),
        tutoresService.getAll()
      ]);
      setPagos(pagosData.data);
      setTutores(tutoresData.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'tutor_id' ? parseInt(value) : value
    }));
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.tutor_id || !formData.monto) {
      setError('Completa los campos requeridos');
      return;
    }

    try {
      await pagosService.create({
        tutor_id: formData.tutor_id,
        monto: parseFloat(formData.monto),
        descripcion: formData.descripcion,
        estado: 'pagado'
      });

      setSuccess('¡Pago registrado exitosamente!');
      setFormData({ tutor_id: '', monto: '', descripcion: '' });
      setTimeout(() => {
        fetchData();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el pago');
    }
  };

  const pagosFiltrados = filtroTutor 
    ? pagos.filter(pago => pago.tutor_id === parseInt(filtroTutor))
    : pagos;

  const totalPagos = pagosFiltrados.reduce((sum, pago) => sum + pago.monto, 0);

  return (
    <div className="pagos-page">
      <h1>💰 Gestión de Pagos</h1>

      {/* Formulario de Registro de Pago */}
      <div className="pago-form">
        <h2>Registrar Nuevo Pago</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleRegistrarPago}>
          <div className="form-row">
            <div className="form-group">
              <label>Tutor *</label>
              <select
                name="tutor_id"
                value={formData.tutor_id}
                onChange={handleInputChange}
                required
              >
                <option value="">Selecciona un tutor</option>
                {tutores.map(tutor => (
                  <option key={tutor.id} value={tutor.id}>
                    {tutor.nombre} - €{tutor.tarifa_por_hora}/h
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Monto (€) *</label>
              <input
                type="number"
                name="monto"
                value={formData.monto}
                onChange={handleInputChange}
                step="0.01"
                placeholder="100.00"
                required
              />
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <input
                type="text"
                name="descripcion"
                value={formData.descripcion}
                onChange={handleInputChange}
                placeholder="Ej: Clases semana 1-2"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-register">
              Registrar Pago
            </button>
          </div>
        </form>
      </div>

      {/* Filtros y Resumen */}
      <div className="pagos-header">
        <div className="filtro">
          <label>Filtrar por Tutor:</label>
          <select
            value={filtroTutor}
            onChange={(e) => setFiltroTutor(e.target.value)}
          >
            <option value="">Todos los tutores</option>
            {tutores.map(tutor => (
              <option key={tutor.id} value={tutor.id}>
                {tutor.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="total-resumen">
          <div className="resumen-card">
            <span className="resumen-label">Total de Pagos</span>
            <span className="resumen-valor">€{totalPagos.toFixed(2)}</span>
          </div>
          <div className="resumen-card">
            <span className="resumen-label">Cantidad de Pagos</span>
            <span className="resumen-valor">{pagosFiltrados.length}</span>
          </div>
        </div>
      </div>

      {/* Tabla de Pagos */}
      {loading ? (
        <p className="loading">Cargando pagos...</p>
      ) : pagosFiltrados.length > 0 ? (
        <div className="pagos-table-container">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Tutor</th>
                <th>Monto</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Fecha de Pago</th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map(pago => (
                <tr key={pago.id}>
                  <td className="tutor-cell">{pago.tutor_nombre}</td>
                  <td className="monto">€{pago.monto.toFixed(2)}</td>
                  <td>{pago.descripcion || '-'}</td>
                  <td>
                    <span className={`estado-badge ${pago.estado}`}>
                      {pago.estado}
                    </span>
                  </td>
                  <td>{new Date(pago.fecha_pago).toLocaleDateString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No hay pagos registrados. ¡Crea uno para comenzar!</p>
        </div>
      )}
    </div>
  );
}
