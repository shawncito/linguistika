
import React, { useMemo, useState, useEffect } from 'react';
import { api } from '../services/api';
import { supabaseClient } from '../lib/supabaseClient';
import { Pago, Tutor, Estudiante, EstadoPago } from '../types';
import { Button, Card, Badge, Input, Label, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dialog } from '../components/UI';
import { CreditCard, Filter, History, Download, DollarSign, Search, CheckCircle2 } from 'lucide-react';
import { formatCRC, formatDateCR } from '../lib/format';

const Pagos: React.FC = () => {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTutor, setFilterTutor] = useState<string>('all');

  const [pendientesPorTutor, setPendientesPorTutor] = useState<Array<{ tutor_id: string; tutor_nombre: string; total_pendiente: number }>>([]);
  const [loadingPendientesPorTutor, setLoadingPendientesPorTutor] = useState(false);

  const [activePanel, setActivePanel] = useState<'tutores' | 'estudiantes'>('tutores');
  const [selectedTutorDetalle, setSelectedTutorDetalle] = useState<{ tutor_id: number; tutor_nombre: string } | null>(null);
  const [detalleTutor, setDetalleTutor] = useState<any | null>(null);
  const [loadingDetalleTutor, setLoadingDetalleTutor] = useState(false);
  const [confirmLiquidarTutorOpen, setConfirmLiquidarTutorOpen] = useState(false);

  const [pendientesPorEstudiante, setPendientesPorEstudiante] = useState<Array<{ estudiante_id: string; estudiante_nombre: string; total_pendiente: number }>>([]);
  const [loadingPendientesPorEstudiante, setLoadingPendientesPorEstudiante] = useState(false);
  const [selectedEstudianteDetalle, setSelectedEstudianteDetalle] = useState<{ estudiante_id: number; estudiante_nombre: string } | null>(null);
  const [detalleEstudiante, setDetalleEstudiante] = useState<any | null>(null);
  const [loadingDetalleEstudiante, setLoadingDetalleEstudiante] = useState(false);

  const [ingresoForm, setIngresoForm] = useState({
    estudiante_id: 0,
    metodo: 'sinpe' as 'sinpe' | 'transferencia' | 'efectivo',
    referencia: '',
    fecha_comprobante: new Date().toISOString().slice(0, 10),
    periodo_inicio: '',
    periodo_fin: '',
  });
  const [loadingIngreso, setLoadingIngreso] = useState(false);
  const [ingresoFile, setIngresoFile] = useState<File | null>(null);
  const [ingresoDragOver, setIngresoDragOver] = useState(false);

  const [estudianteQuery, setEstudianteQuery] = useState('');
  const [estudiantePickerOpen, setEstudiantePickerOpen] = useState(false);

  const [ingresoTab, setIngresoTab] = useState<'pendientes' | 'manual'>('pendientes');
  const [manualQuery, setManualQuery] = useState('');
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [savingManual, setSavingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    direccion: 'entrada' as 'entrada' | 'salida',
    monto: 0,
    fecha: new Date().toISOString().slice(0, 10),
    metodo: 'sinpe' as 'sinpe' | 'transferencia' | 'efectivo',
    referencia: '',
    categoria: '',
    detalle: '',
    a_nombre_de: '',
    estudiante_id: 0,
    tutor_id: 0,
  });

  const [libroFecha, setLibroFecha] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loadingLibro, setLoadingLibro] = useState(false);
  const [libro, setLibro] = useState<any | null>(null);

  const [libroMesAnio, setLibroMesAnio] = useState<number>(new Date().getFullYear());
  const [libroMesMes, setLibroMesMes] = useState<number>(new Date().getMonth() + 1);
  const [libroMesTutorId, setLibroMesTutorId] = useState<number>(0);
  const [loadingLibroMes, setLoadingLibroMes] = useState(false);
  const [libroMes, setLibroMes] = useState<any | null>(null);

  const [loadingBolsaTotal, setLoadingBolsaTotal] = useState(false);
  const [bolsaTotal, setBolsaTotal] = useState<any | null>(null);

  const [auditOpen, setAuditOpen] = useState(false);

  const [cierreMensualDia, setCierreMensualDia] = useState<number>(1);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [cierreAnio, setCierreAnio] = useState<number>(new Date().getFullYear());
  const [cierreMes, setCierreMes] = useState<number>(new Date().getMonth() + 1);
  const [cierreForce, setCierreForce] = useState<boolean>(false);
  const [cierreResult, setCierreResult] = useState<any | null>(null);

  const [periodoInicio, setPeriodoInicio] = useState<string>('');
  const [periodoFin, setPeriodoFin] = useState<string>('');
  const [pendientesResumen, setPendientesResumen] = useState<any | null>(null);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  
  const [formData, setFormData] = useState({
    tutor_id: 0,
    monto: 0,
    descripcion: '',
    estado: EstadoPago.PAGADO
  });

  const loadData = async () => {
    setLoading(true);
    const [p, t] = await Promise.all([
      api.pagos.getAll(),
      api.tutores.getAll()
    ]);
    setPagos(p);
    setTutores(t);
    setLoading(false);
  };

  const loadEstudiantes = async () => {
    try {
      const e = await api.estudiantes.getAll();
      setEstudiantes(e);
    } catch {
      setEstudiantes([]);
    }
  };

  const loadPendientesPorTutor = async () => {
    setLoadingPendientesPorTutor(true);
    try {
      const res = await api.pagos.getPendientesResumenTutores();
      setPendientesPorTutor((res?.tutores || []) as any);
    } catch (err: any) {
      console.error(err);
      setPendientesPorTutor([]);
    } finally {
      setLoadingPendientesPorTutor(false);
    }
  };

  const loadPendientesPorEstudiante = async () => {
    setLoadingPendientesPorEstudiante(true);
    try {
      const res = await api.pagos.getPendientesResumenEstudiantes();
      setPendientesPorEstudiante((res?.estudiantes || []) as any);
    } catch (err: any) {
      console.error(err);
      setPendientesPorEstudiante([]);
    } finally {
      setLoadingPendientesPorEstudiante(false);
    }
  };

  const openTutorDetalle = async (tutor_id: number, tutor_nombre: string) => {
    setSelectedTutorDetalle({ tutor_id, tutor_nombre });
    setFormData(prev => ({ ...prev, tutor_id }));
    setDetalleTutor(null);
    setLoadingDetalleTutor(true);
    try {
      const res = await api.pagos.getPendientesDetalleTutor({ tutor_id });
      setDetalleTutor(res);
    } catch (err: any) {
      console.error(err);
      setDetalleTutor({ error: err?.response?.data?.error || err?.message || 'Error cargando detalle' });
    } finally {
      setLoadingDetalleTutor(false);
    }
  };

  const openEstudianteDetalle = async (estudiante_id: number, estudiante_nombre: string) => {
    setSelectedEstudianteDetalle({ estudiante_id, estudiante_nombre });
    setDetalleEstudiante(null);
    setLoadingDetalleEstudiante(true);
    try {
      const res = await api.pagos.getPendientesDetalleEstudiante({ estudiante_id });
      setDetalleEstudiante(res);
    } catch (err: any) {
      console.error(err);
      setDetalleEstudiante({ error: err?.response?.data?.error || err?.message || 'Error cargando detalle' });
    } finally {
      setLoadingDetalleEstudiante(false);
    }
  };

  const loadPagoConfig = async () => {
    setLoadingConfig(true);
    try {
      const cfg = await api.pagos.getConfig();
      setCierreMensualDia(cfg?.cierre_mensual_dia ?? 1);
    } catch (err: any) {
      // No bloquear la pantalla por configuración
      console.error(err);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    loadData();
    loadPagoConfig();
    loadPendientesPorTutor();
    loadPendientesPorEstudiante();
    loadEstudiantes();
  }, []);

  const savePagoConfig = async () => {
    setLoadingConfig(true);
    try {
      const updated = await api.pagos.updateConfig({ cierre_mensual_dia: cierreMensualDia });
      setCierreMensualDia(updated?.cierre_mensual_dia ?? cierreMensualDia);
      alert('Configuración guardada.');
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error guardando configuración');
    } finally {
      setLoadingConfig(false);
    }
  };

  const ejecutarCierreMensual = async () => {
    setLoadingConfig(true);
    setCierreResult(null);
    try {
      const result = await api.pagos.cierreMensual({
        anio: cierreAnio,
        mes: cierreMes,
        force: cierreForce,
      });
      setCierreResult(result);
      alert('Cierre mensual ejecutado. Revisa el resultado abajo.');
      loadPendientesPorTutor();
      loadPendientesPorEstudiante();
    } catch (err: any) {
      const data = err?.response?.data;
      // Si está fuera del día permitido, ofrecer reintento con force
      if (err?.response?.status === 409 && data?.cierre_mensual_dia && data?.hoy_dia) {
        const msg = data?.error || 'No se puede ejecutar hoy.';
        const retry = window.confirm(`${msg}\n\n¿Deseas forzar el cierre igualmente?`);
        if (retry) {
          try {
            setCierreForce(true);
            const forced = await api.pagos.cierreMensual({ anio: cierreAnio, mes: cierreMes, force: true });
            setCierreResult(forced);
            alert('Cierre mensual forzado ejecutado.');
            loadPendientesPorTutor();
            loadPendientesPorEstudiante();
            return;
          } catch (err2: any) {
            alert(err2?.response?.data?.error || err2?.message || 'Error ejecutando cierre mensual (forzado)');
            return;
          }
        }
        alert(msg);
        return;
      }

      alert(data?.error || err?.message || 'Error ejecutando cierre mensual');
    } finally {
      setLoadingConfig(false);
    }
  };

  // Suscripción en tiempo real a pagos y tutores
  useEffect(() => {
    if (!supabaseClient) return;
    const channel = supabaseClient
      .channel('realtime-pagos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutores' }, () => loadData())
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tutor_id || formData.monto <= 0) {
      return alert('Por favor complete todos los datos obligatorios.');
    }

    await api.pagos.create(formData);
    setFormData({ tutor_id: 0, monto: 0, descripcion: '', estado: EstadoPago.PAGADO });
    alert('Liquidación registrada con éxito.');
    loadData();
    loadPendientesPorTutor();
  };

  const liquidarIngresoEstudiante = async () => {
    if (!ingresoForm.estudiante_id) {
      return alert('Seleccione un estudiante.');
    }

    if (ingresoFile && !String(ingresoForm.referencia || '').trim()) {
      return alert('Para adjuntar comprobante, ingresa la Referencia (número/comprobante).');
    }

    setLoadingIngreso(true);
    try {
      const result = await api.pagos.liquidarIngresoEstudiante({
        estudiante_id: ingresoForm.estudiante_id,
        metodo: ingresoForm.metodo,
        referencia: ingresoForm.referencia?.trim() || undefined,
        fecha_comprobante: ingresoForm.fecha_comprobante || undefined,
        ...(ingresoForm.periodo_inicio ? { fecha_inicio: ingresoForm.periodo_inicio } : {}),
        ...(ingresoForm.periodo_fin ? { fecha_fin: ingresoForm.periodo_fin } : {}),
      });

      // Si hay evidencia, subir una vez y aplicar la URL a todos los movimientos liquidados
      if (ingresoFile) {
        const ids: number[] = Array.isArray((result as any)?.movimiento_ids)
          ? (result as any).movimiento_ids.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n) && n > 0)
          : [];

        if (ids.length > 0) {
          const firstId = ids[0];
          const uploadRes = await api.pagos.uploadComprobanteMovimiento(firstId, ingresoFile);
          const url = String(uploadRes?.comprobante_url || '').trim();

          if (url) {
            await api.pagos.aplicarComprobanteUrlBulk({ ids, comprobante_url: url });

            const pagadorNombre = selectedEstudiante?.nombre || `Estudiante #${ingresoForm.estudiante_id}`;
            await api.pagos.createComprobanteIngreso({
              numero_comprobante: String(ingresoForm.referencia || '').trim(),
              monto: Number((result as any)?.total_monto) || 0,
              fecha_comprobante: ingresoForm.fecha_comprobante,
              pagador_nombre: pagadorNombre,
              detalle: `Pago estudiante (${ingresoForm.metodo})`,
              movimiento_dinero_id: firstId,
              foto_url: url,
            });
          }
        }

        setIngresoFile(null);
      }

      alert('Pago del estudiante registrado y pendientes marcados como completados.');
      await loadPendientesPorEstudiante();
      // Si el estudiante estaba abierto en detalle, refrescar
      if (selectedEstudianteDetalle?.estudiante_id === ingresoForm.estudiante_id) {
        await openEstudianteDetalle(selectedEstudianteDetalle.estudiante_id, selectedEstudianteDetalle.estudiante_nombre);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error registrando pago del estudiante');
    } finally {
      setLoadingIngreso(false);
    }
  };

  const acceptIngresoFile = (file: File | null) => {
    if (!file) return setIngresoFile(null);
    const mime = String(file.type || '').toLowerCase();
    const ok = mime.startsWith('image/') || mime === 'application/pdf';
    if (!ok) {
      alert('Archivo no permitido. Solo imagen o PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Archivo demasiado grande (máximo 10MB).');
      return;
    }
    setIngresoFile(file);
  };

  const fetchPendientes = async () => {
    if (!formData.tutor_id) {
      return alert('Seleccione un tutor antes de consultar pendientes.');
    }
    setLoadingPendientes(true);
    try {
      const resumen = await api.pagos.getPendientesResumen({
        tutor_id: formData.tutor_id,
        ...(periodoInicio ? { fecha_inicio: periodoInicio } : {}),
        ...(periodoFin ? { fecha_fin: periodoFin } : {}),
      });
      setPendientesResumen(resumen);
    } catch (err: any) {
      setPendientesResumen(null);
      alert(err?.response?.data?.error || err?.message || 'Error consultando pendientes');
    } finally {
      setLoadingPendientes(false);
    }
  };

  const liquidarPendientes = async () => {
    if (!formData.tutor_id) {
      return alert('Seleccione un tutor antes de liquidar.');
    }
    setLoadingPendientes(true);
    try {
      const desc = formData.descripcion?.trim() ||
        (periodoInicio || periodoFin ? `Liquidacion ${periodoInicio || '...'} a ${periodoFin || '...'}` : 'Liquidacion de pendientes');

      await api.pagos.liquidarPendientes({
        tutor_id: formData.tutor_id,
        ...(periodoInicio ? { fecha_inicio: periodoInicio } : {}),
        ...(periodoFin ? { fecha_fin: periodoFin } : {}),
        descripcion: desc,
        estado: EstadoPago.PAGADO,
      });

      setPendientesResumen(null);
      alert('Liquidación creada y pendientes marcados como completados.');
      loadData();
      loadPendientesPorTutor();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error liquidando pendientes');
    } finally {
      setLoadingPendientes(false);
    }
  };

  const liquidarTutorDesdeDialog = async (opts?: { reopenDetalle?: boolean }) => {
    if (!selectedTutorDetalle?.tutor_id) return;
    const reopenDetalle = opts?.reopenDetalle ?? true;
    setLoadingPendientes(true);
    try {
      const desc = formData.descripcion?.trim() ||
        (periodoInicio || periodoFin
          ? `Liquidacion ${periodoInicio || '...'} a ${periodoFin || '...'}`
          : `Liquidacion pendientes - ${selectedTutorDetalle.tutor_nombre}`);

      await api.pagos.liquidarPendientes({
        tutor_id: selectedTutorDetalle.tutor_id,
        ...(periodoInicio ? { fecha_inicio: periodoInicio } : {}),
        ...(periodoFin ? { fecha_fin: periodoFin } : {}),
        descripcion: desc,
        estado: EstadoPago.PAGADO,
      });

      alert('Liquidación creada y pendientes marcados como completados.');
      await loadData();
      await loadPendientesPorTutor();
      if (reopenDetalle) {
        await openTutorDetalle(selectedTutorDetalle.tutor_id, selectedTutorDetalle.tutor_nombre);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error liquidando pendientes');
    } finally {
      setLoadingPendientes(false);
    }
  };

  const prefillIngresoDesdeDialog = () => {
    if (!selectedEstudianteDetalle?.estudiante_id) return;
    setIngresoForm(prev => ({
      ...prev,
      estudiante_id: selectedEstudianteDetalle.estudiante_id,
      referencia: '',
      fecha_comprobante: new Date().toISOString().slice(0, 10),
    }));
    setSelectedEstudianteDetalle(null);
    setDetalleEstudiante(null);
  };

  const filteredPagos = filterTutor === 'all' 
    ? pagos 
    : pagos.filter(p => p.tutor_id === parseInt(filterTutor));

  const totalFiltered = filteredPagos.reduce((acc, curr) => acc + curr.monto, 0);
  const totalPendienteGeneral = (pendientesPorTutor || []).reduce((acc, t) => acc + (Number(t.total_pendiente) || 0), 0);
  const totalPendienteEstudiantes = (pendientesPorEstudiante || []).reduce((acc, e) => acc + (Number(e.total_pendiente) || 0), 0);

  const tutoresRows = useMemo(() => {
    const rows = Array.isArray(pendientesPorTutor) ? pendientesPorTutor : [];
    return rows.slice().sort((a, b) => String(a.tutor_nombre || '').localeCompare(String(b.tutor_nombre || '')));
  }, [pendientesPorTutor]);

  const estudiantesRows = useMemo(() => {
    const rows = Array.isArray(pendientesPorEstudiante) ? pendientesPorEstudiante : [];
    return rows.slice().sort((a, b) => String(a.estudiante_nombre || '').localeCompare(String(b.estudiante_nombre || '')));
  }, [pendientesPorEstudiante]);

  const estudiantesFiltrados = useMemo(() => {
    const q = estudianteQuery.trim().toLowerCase();
    if (!q) return estudiantes;
    return (estudiantes || []).filter((e) => {
      const name = String(e.nombre || '').toLowerCase();
      const idStr = String(e.id || '');
      return name.includes(q) || idStr.includes(q);
    });
  }, [estudiantes, estudianteQuery]);

  const estudiantesFiltradosManual = useMemo(() => {
    const q = manualQuery.trim().toLowerCase();
    if (!q) return estudiantes;
    return (estudiantes || []).filter((e) => {
      const name = String(e.nombre || '').toLowerCase();
      const idStr = String(e.id || '');
      return name.includes(q) || idStr.includes(q);
    });
  }, [estudiantes, manualQuery]);

  const selectedEstudiante = useMemo(() => {
    const id = ingresoForm.estudiante_id;
    if (!id) return null;
    return (estudiantes || []).find((e) => e.id === id) ?? null;
  }, [estudiantes, ingresoForm.estudiante_id]);

  const selectedEstudianteManual = useMemo(() => {
    const id = manualForm.estudiante_id;
    if (!id) return null;
    return (estudiantes || []).find((e) => e.id === id) ?? null;
  }, [estudiantes, manualForm.estudiante_id]);

  const selectedTutorManual = useMemo(() => {
    const id = manualForm.tutor_id;
    if (!id) return null;
    return (tutores || []).find((t) => t.id === id) ?? null;
  }, [tutores, manualForm.tutor_id]);

  const getComprobanteUrl = (mov: any): string | null => {
    const direct = mov?.comprobante_url;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const notas = String(mov?.notas || '');
    const m = notas.match(/COMPROBANTE_URL:([^\s]+)/);
    return m ? m[1] : null;
  };

  const [comprobantePreviewOpen, setComprobantePreviewOpen] = useState(false);
  const [comprobantePreviewUrl, setComprobantePreviewUrl] = useState<string>('');
  const [comprobantePreviewKind, setComprobantePreviewKind] = useState<'image' | 'pdf' | 'other'>('other');

  const detectComprobanteKind = (url: string): 'image' | 'pdf' | 'other' => {
    const raw = String(url || '').trim();
    if (!raw) return 'other';
    try {
      const u = new URL(raw);
      const p = String(u.pathname || '').toLowerCase();
      if (p.endsWith('.pdf')) return 'pdf';
      if (p.match(/\.(png|jpe?g|gif|webp)$/)) return 'image';
      return 'other';
    } catch {
      const lower = raw.toLowerCase();
      if (lower.endsWith('.pdf')) return 'pdf';
      if (lower.match(/\.(png|jpe?g|gif|webp)$/)) return 'image';
      return 'other';
    }
  };

  const openComprobantePreview = (url: string) => {
    const kind = detectComprobanteKind(url);
    setComprobantePreviewUrl(url);
    setComprobantePreviewKind(kind);
    setComprobantePreviewOpen(true);
  };

  const guardarMovimientoManual = async () => {
    if (!manualForm.monto || manualForm.monto <= 0) return alert('Ingresa un monto válido.');
    if (!manualForm.fecha) return alert('Selecciona una fecha.');

    setSavingManual(true);
    try {
      const creado = await api.pagos.createMovimientoManual({
        direccion: manualForm.direccion,
        monto: Number(manualForm.monto),
        fecha: manualForm.fecha,
        metodo: manualForm.metodo,
        referencia: manualForm.referencia?.trim() || undefined,
        categoria: manualForm.categoria?.trim() || undefined,
        detalle: manualForm.detalle?.trim() || undefined,
        a_nombre_de: manualForm.a_nombre_de?.trim() || undefined,
        estudiante_id: manualForm.estudiante_id ? manualForm.estudiante_id : undefined,
        tutor_id: manualForm.tutor_id ? manualForm.tutor_id : undefined,
      });

      if (manualFile && creado?.id) {
        await api.pagos.uploadComprobanteMovimiento(creado.id, manualFile);
      }

      alert('Movimiento registrado.');
      setManualFile(null);
      setManualQuery('');
      setManualForm((prev) => ({
        ...prev,
        monto: 0,
        referencia: '',
        categoria: '',
        detalle: '',
        a_nombre_de: '',
        estudiante_id: 0,
        tutor_id: 0,
      }));

      // Si el libro está viendo la misma fecha, refrescar
      if (libroFecha === manualForm.fecha) {
        await cargarLibro();
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error registrando movimiento');
    } finally {
      setSavingManual(false);
    }
  };

  const cargarLibro = async () => {
    setLoadingLibro(true);
    try {
      const res = await api.pagos.getLibroDiario({ fecha: libroFecha });
      setLibro(res);
    } catch (e: any) {
      setLibro({ error: e?.response?.data?.error || e?.message || 'Error cargando libro diario' });
    } finally {
      setLoadingLibro(false);
    }
  };

  const toISODateLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getMonthRange = (anio: number, mes: number) => {
    const safeMes = Math.max(1, Math.min(12, Number(mes) || 1));
    const start = toISODateLocal(new Date(anio, safeMes - 1, 1));
    const end = toISODateLocal(new Date(anio, safeMes, 0));
    return { start, end };
  };

  const cargarLibroMes = async () => {
    setLoadingLibroMes(true);
    try {
      const { start, end } = getMonthRange(libroMesAnio, libroMesMes);
      const res = await api.pagos.getLibroDiario({
        fecha_inicio: start,
        fecha_fin: end,
        tutor_id: libroMesTutorId > 0 ? libroMesTutorId : undefined,
      });
      setLibroMes(res);
    } catch (e: any) {
      setLibroMes({ error: e?.response?.data?.error || e?.message || 'Error cargando libro mensual' });
    } finally {
      setLoadingLibroMes(false);
    }
  };

  const calcularBolsaTotal = async () => {
    setLoadingBolsaTotal(true);
    try {
      const hoy = toISODateLocal(new Date());
      const res = await api.pagos.getLibroDiario({ fecha_inicio: '2000-01-01', fecha_fin: hoy, only_totals: 1 });
      setBolsaTotal(res);
    } catch (e: any) {
      setBolsaTotal({ error: e?.response?.data?.error || e?.message || 'Error calculando total en bolsa' });
    } finally {
      setLoadingBolsaTotal(false);
    }
  };

  const resumenMesDias = useMemo(() => {
    const movs = Array.isArray(libroMes?.movimientos) ? libroMes.movimientos : [];
    const map: Record<string, { fecha: string; debe: number; haber: number }> = {};

    for (const m of movs) {
      const f = String(m?.fecha_pago || m?.fecha_comprobante || '').slice(0, 10);
      if (!f) continue;
      if (!map[f]) map[f] = { fecha: f, debe: 0, haber: 0 };
      map[f].debe += Number(m?.debe) || 0;
      map[f].haber += Number(m?.haber) || 0;
    }

    const days = Object.values(map).sort((a, b) => a.fecha.localeCompare(b.fecha));
    let saldo = 0;

    return days.map((d) => {
      const neto = (Number(d.debe) || 0) - (Number(d.haber) || 0);
      saldo += neto;
      return { ...d, neto, saldo };
    });
  }, [libroMes]);

  if (loading) return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sincronizando tesorería...</p>
      </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/10 pb-10">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none">
            Control de <span className="text-[#00AEEF]">Pagos</span>
          </h1>
          <p className="text-slate-300 font-medium mt-3">Tesorería y liquidación de honorarios docentes</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="secondary" className="gap-2 h-12">
            <Download className="w-5 h-5" /> Exportar Registro
          </Button>
          <Button variant="primary" className="h-12 px-8 font-bold" onClick={() => setAuditOpen(true)}>
            Auditar Pagos
          </Button>
        </div>
      </header>

      <Dialog
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        title="Auditoría y explicación (tesorería)"
        maxWidthClass="max-w-3xl"
        zIndex={200}
      >
        <div className="space-y-4 text-sm">
          <div className="text-slate-200 font-semibold">
            Este módulo registra todo como movimientos en <span className="text-white font-black">Debe</span> (ingresos) y <span className="text-white font-black">Haber</span> (egresos).
            El indicador <span className="text-white font-black">En bolsa</span> se calcula como <span className="text-white font-black">Debe − Haber</span> para el rango seleccionado.
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="font-black text-white">Qué entra en cada lado</div>
            <ul className="text-slate-200 space-y-1">
              <li><span className="font-black text-emerald-200">Debe</span>: pagos de estudiantes + entradas manuales.</li>
              <li><span className="font-black text-rose-200">Haber</span>: liquidaciones/pagos a tutores + salidas manuales.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/10 p-4 space-y-2">
            <div className="font-black text-white">Checklist rápido de auditoría</div>
            <ul className="text-slate-200 space-y-1">
              <li>Todo movimiento manual debería tener <span className="text-white font-black">categoría</span> y <span className="text-white font-black">detalle</span>.</li>
              <li>Entradas/salidas con evidencia: adjuntar comprobante (imagen/PDF) cuando aplique.</li>
              <li>Conciliación: comparar “En bolsa” con caja/banco real (por método: efectivo/SINPE/transferencia).</li>
              <li>Cierres: ejecutar cierre mensual de cursos mensuales para generar movimientos consistentes.</li>
              <li>Permisos: solo roles autorizados deben registrar salidas y liquidaciones.</li>
            </ul>
          </div>

          <div className="text-slate-300">
            Nota: “En bolsa” es un <span className="font-bold">neto operativo</span> según lo registrado; si faltan movimientos o comprobantes, la cifra puede no conciliar.
          </div>
        </div>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left panels */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-[#00AEEF] to-[#FFC800] h-2 w-full" />
            <div className="p-8 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-3">
                <History className="w-6 h-6 p-1 bg-white/10 text-[#00AEEF] rounded-lg" />
                Cierre mensual (cursos mensuales)
              </h2>

              <div>
                <Label>Día de cierre (1 a 28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={cierreMensualDia}
                  onChange={(e) => setCierreMensualDia(parseInt(e.target.value || '1', 10) || 1)}
                />
                <div className="flex gap-3 mt-3">
                  <Button type="button" variant="secondary" className="h-11" onClick={savePagoConfig} disabled={loadingConfig}>
                    {loadingConfig ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={loadPagoConfig} disabled={loadingConfig}>
                    Recargar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Año</Label>
                  <Input
                    type="number"
                    value={cierreAnio}
                    onChange={(e) => setCierreAnio(parseInt(e.target.value || String(new Date().getFullYear()), 10))}
                  />
                </div>
                <div>
                  <Label>Mes (1-12)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={cierreMes}
                    onChange={(e) => setCierreMes(Math.max(1, Math.min(12, parseInt(e.target.value || '1', 10) || 1)))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-200">
                <input
                  type="checkbox"
                  checked={cierreForce}
                  onChange={(e) => setCierreForce(e.target.checked)}
                />
                Forzar (ignorar día configurado)
              </label>

              <Button
                type="button"
                variant="primary"
                className="w-full h-12 bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026] border-0 font-bold"
                onClick={ejecutarCierreMensual}
                disabled={loadingConfig}
              >
                {loadingConfig ? 'Ejecutando...' : 'Ejecutar cierre mensual'}
              </Button>

              {cierreResult && (
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm space-y-1">
                  <div className="font-black text-white">Resultado</div>
                  <div className="text-slate-200 font-bold">Periodo: {cierreResult.periodo_inicio} a {cierreResult.periodo_fin}</div>
                  <div className="text-slate-300">Sesiones mensuales: {cierreResult.sesiones_mensuales ?? 0}</div>
                  <div className="text-slate-300">Insertados: {cierreResult.insertados ?? 0} (skipped: {cierreResult.skipped_existentes ?? 0})</div>
                  {cierreResult.supports_origen_periodo === false && (
                    <div className="text-amber-700 font-bold">⚠️ Sin idempotencia: falta migración de origen/periodo en movimientos_dinero</div>
                  )}
                </div>
              )}
            </div>
          </Card>

                  <Card className="overflow-hidden">
                    <div className="p-8 space-y-4">
                      <h2 className="text-lg font-bold text-white flex items-center gap-3">
                        <DollarSign className="w-6 h-6 p-1 bg-white/10 text-emerald-300 rounded-lg" />
                        Movimientos de dinero
                      </h2>
                      <p className="text-slate-300 font-medium text-sm">Registra entradas/salidas (servicios/otros) y/o marca pagos de estudiantes.</p>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={ingresoTab === 'pendientes' ? 'primary' : 'outline'}
                          className="h-10"
                          onClick={() => setIngresoTab('pendientes')}
                        >
                          Pago estudiante
                        </Button>
                        <Button
                          type="button"
                          variant={ingresoTab === 'manual' ? 'primary' : 'outline'}
                          className="h-10"
                          onClick={() => setIngresoTab('manual')}
                        >
                          Entrada/Salida manual
                        </Button>
                      </div>

                      {ingresoTab === 'pendientes' ? (
                        <>
                          <div>
                            <Label>Buscar estudiante (nombre o matrícula/ID)</Label>
                            <div className="relative">
                              <Input
                                value={estudianteQuery}
                                onChange={(e) => setEstudianteQuery(e.target.value)}
                                onFocus={() => setEstudiantePickerOpen(true)}
                                onBlur={() => setTimeout(() => setEstudiantePickerOpen(false), 150)}
                                placeholder="Ej: Maria o 123"
                                className="pr-10"
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <Search className="w-4 h-4" />
                              </div>
                            </div>

                            {estudiantePickerOpen && (
                              <div className="mt-2 rounded-2xl border border-white/10 bg-black/10 overflow-hidden">
                                <div className="max-h-44 overflow-auto">
                                  {(estudiantesFiltrados || []).slice(0, 15).map((es) => (
                                    <button
                                      key={es.id}
                                      type="button"
                                      onClick={() => {
                                        setIngresoForm((prev) => ({ ...prev, estudiante_id: es.id }));
                                        setEstudianteQuery(`${es.nombre} (#${es.id})`);
                                        setEstudiantePickerOpen(false);
                                      }}
                                      className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-white/5 transition-colors ${ingresoForm.estudiante_id === es.id ? 'bg-white/5' : ''}`}
                                    >
                                      <span className="font-bold text-slate-100 truncate">{es.nombre}</span>
                                      <span className="text-xs text-slate-400 font-bold">#{es.id}</span>
                                    </button>
                                  ))}
                                  {(estudiantesFiltrados || []).length === 0 && (
                                    <div className="px-4 py-4 text-sm text-slate-400">Sin resultados</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {selectedEstudiante && (
                              <div className="mt-2 text-xs text-slate-300">
                                Seleccionado: <b className="text-slate-100">{selectedEstudiante.nombre}</b> <span className="text-slate-400">(#{selectedEstudiante.id})</span>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Método</Label>
                              <Select
                                value={ingresoForm.metodo}
                                onChange={(e) => setIngresoForm(prev => ({ ...prev, metodo: e.target.value as any }))}
                              >
                                <option value="sinpe">SINPE</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                              </Select>
                            </div>
                            <div>
                              <Label>Fecha</Label>
                              <Input
                                type="date"
                                value={ingresoForm.fecha_comprobante}
                                onChange={(e) => setIngresoForm(prev => ({ ...prev, fecha_comprobante: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Referencia (SINPE/transferencia)</Label>
                            <Input
                              value={ingresoForm.referencia}
                              onChange={(e) => setIngresoForm(prev => ({ ...prev, referencia: e.target.value }))}
                              placeholder="Ej: #comprobante, teléfono, banco..."
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Periodo inicio (opcional)</Label>
                              <Input
                                type="date"
                                value={ingresoForm.periodo_inicio}
                                onChange={(e) => setIngresoForm(prev => ({ ...prev, periodo_inicio: e.target.value }))}
                              />
                            </div>
                            <div>
                              <Label>Periodo fin (opcional)</Label>
                              <Input
                                type="date"
                                value={ingresoForm.periodo_fin}
                                onChange={(e) => setIngresoForm(prev => ({ ...prev, periodo_fin: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Comprobante (opcional)</Label>
                            <div
                              className={
                                `rounded-2xl border border-dashed p-4 transition-colors ` +
                                (ingresoDragOver
                                  ? 'border-[#00AEEF]/80 bg-[#00AEEF]/10'
                                  : 'border-white/15 bg-black/10')
                              }
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIngresoDragOver(true);
                              }}
                              onDragLeave={() => setIngresoDragOver(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIngresoDragOver(false);
                                const file = e.dataTransfer?.files?.[0] || null;
                                acceptIngresoFile(file);
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-black text-slate-100">Arrastra una imagen/PDF aquí</div>
                                  <div className="text-xs text-slate-400 font-semibold">Máximo 10MB. Se vincula al pago del estudiante.</div>
                                  {ingresoFile && (
                                    <div className="mt-2 text-xs text-emerald-200 font-black">
                                      Adjuntado: {ingresoFile.name}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <label className="inline-flex">
                                    <input
                                      type="file"
                                      accept="image/*,application/pdf"
                                      className="hidden"
                                      onChange={(e) => acceptIngresoFile(e.target.files?.[0] || null)}
                                    />
                                    <span className="px-4 h-10 inline-flex items-center rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-100 font-black cursor-pointer">
                                      Elegir archivo
                                    </span>
                                  </label>
                                  {ingresoFile && (
                                    <Button type="button" variant="outline" className="h-10" onClick={() => setIngresoFile(null)}>
                                      Quitar
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {ingresoFile && !String(ingresoForm.referencia || '').trim() && (
                              <div className="mt-2 text-xs text-amber-200 font-black">
                                Para guardar el comprobante, completa la Referencia.
                              </div>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="primary"
                            className="w-full h-12 font-black"
                            onClick={liquidarIngresoEstudiante}
                            disabled={loadingIngreso}
                          >
                            {loadingIngreso ? 'Registrando...' : 'Registrar pago y marcar completado'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Tipo</Label>
                              <Select
                                value={manualForm.direccion}
                                onChange={(e) => setManualForm((prev) => ({ ...prev, direccion: e.target.value as any }))}
                              >
                                <option value="entrada">Entrada (ingreso)</option>
                                <option value="salida">Salida (egreso)</option>
                              </Select>
                            </div>
                            <div>
                              <Label>Fecha</Label>
                              <Input
                                type="date"
                                value={manualForm.fecha}
                                onChange={(e) => setManualForm((prev) => ({ ...prev, fecha: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Monto (₡)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={manualForm.monto}
                              onChange={(e) => setManualForm((prev) => ({ ...prev, monto: parseFloat(e.target.value || '0') }))}
                              placeholder="0.00"
                              className="text-lg font-black"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Método</Label>
                              <Select
                                value={manualForm.metodo}
                                onChange={(e) => setManualForm((prev) => ({ ...prev, metodo: e.target.value as any }))}
                              >
                                <option value="sinpe">SINPE</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                              </Select>
                            </div>
                            <div>
                              <Label>Referencia (opcional)</Label>
                              <Input
                                value={manualForm.referencia}
                                onChange={(e) => setManualForm((prev) => ({ ...prev, referencia: e.target.value }))}
                                placeholder="Ej: #comprobante, factura, banco..."
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Categoría (opcional)</Label>
                            <Input
                              value={manualForm.categoria}
                              onChange={(e) => setManualForm((prev) => ({ ...prev, categoria: e.target.value }))}
                              placeholder="Ej: Pago de servicio, papelería, alquiler..."
                            />
                          </div>

                          <div>
                            <Label>Detalle</Label>
                            <Input
                              value={manualForm.detalle}
                              onChange={(e) => setManualForm((prev) => ({ ...prev, detalle: e.target.value }))}
                              placeholder="Ej: Recibo ICE enero, compra de materiales..."
                            />
                          </div>

                          <div>
                            <Label>A nombre de (opcional)</Label>
                            <Input
                              value={manualForm.a_nombre_de}
                              onChange={(e) => setManualForm((prev) => ({ ...prev, a_nombre_de: e.target.value }))}
                              placeholder="Ej: Juan Pérez / Empresa / Estudiante..."
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Vincular a estudiante (opcional)</Label>
                              <div className="relative">
                                <Input
                                  value={manualQuery}
                                  onChange={(e) => setManualQuery(e.target.value)}
                                  onFocus={() => setManualPickerOpen(true)}
                                  onBlur={() => setTimeout(() => setManualPickerOpen(false), 150)}
                                  placeholder="Ej: Maria o 123"
                                  className="pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                  <Search className="w-4 h-4" />
                                </div>
                              </div>

                              {manualPickerOpen && (
                                <div className="mt-2 rounded-2xl border border-white/10 bg-black/10 overflow-hidden">
                                  <div className="max-h-44 overflow-auto">
                                    {(estudiantesFiltradosManual || []).slice(0, 15).map((es) => (
                                      <button
                                        key={es.id}
                                        type="button"
                                        onClick={() => {
                                          setManualForm((prev) => ({ ...prev, estudiante_id: es.id }));
                                          setManualQuery(`${es.nombre} (#${es.id})`);
                                          setManualPickerOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-white/5 transition-colors ${manualForm.estudiante_id === es.id ? 'bg-white/5' : ''}`}
                                      >
                                        <span className="font-bold text-slate-100 truncate">{es.nombre}</span>
                                        <span className="text-xs text-slate-400 font-bold">#{es.id}</span>
                                      </button>
                                    ))}
                                    {(estudiantesFiltradosManual || []).length === 0 && (
                                      <div className="px-4 py-4 text-sm text-slate-400">Sin resultados</div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {selectedEstudianteManual && (
                                <div className="mt-2 text-xs text-slate-300">
                                  Vinculado: <b className="text-slate-100">{selectedEstudianteManual.nombre}</b> <span className="text-slate-400">(#{selectedEstudianteManual.id})</span>
                                </div>
                              )}
                            </div>

                            <div>
                              <Label>Vincular a tutor (opcional)</Label>
                              <Select
                                value={manualForm.tutor_id}
                                onChange={(e) => setManualForm((prev) => ({ ...prev, tutor_id: parseInt(e.target.value || '0', 10) || 0 }))}
                              >
                                <option value={0}>— Ninguno —</option>
                                {tutores.map((t) => (
                                  <option key={t.id} value={t.id}>{t.nombre}</option>
                                ))}
                              </Select>
                              {selectedTutorManual && (
                                <div className="mt-2 text-xs text-slate-300">
                                  Vinculado: <b className="text-slate-100">{selectedTutorManual.nombre}</b>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <Label>Comprobante (imagen o PDF)</Label>
                            <Input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e: any) => setManualFile(e?.target?.files?.[0] || null)}
                            />
                            {manualFile && (
                              <div className="text-xs text-slate-300 mt-2">
                                Archivo: <b className="text-slate-100">{manualFile.name}</b>
                              </div>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="primary"
                            className="w-full h-12 font-black"
                            onClick={guardarMovimientoManual}
                            disabled={savingManual}
                          >
                            {savingManual ? 'Guardando...' : 'Guardar movimiento'}
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>

                  <Card className="overflow-hidden lg:sticky lg:top-28">
                    <div className="bg-gradient-to-r from-[#FFC800] to-[#00AEEF] h-2 w-full" />
                    <div className="p-8">
                      <h2 className="text-lg font-bold text-white mb-8 flex items-center gap-3">
                        <DollarSign className="w-6 h-6 p-1 bg-white/10 text-[#00AEEF] rounded-lg" />
                        Nueva Liquidación
                      </h2>
                      <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                <Label>Docente Destinatario *</Label>
                                <Select 
                                    value={formData.tutor_id} 
                                    onChange={(e) => setFormData({...formData, tutor_id: parseInt(e.target.value)})}
                                >
                                    <option value={0}>Selecciona un profesional...</option>
                                  {tutores.map(t => <option key={t.id} value={t.id}>{t.nombre} ({formatCRC(t.tarifa_por_hora)}/h)</option>)}
                                </Select>
                                </div>
                                <div>
                                <Label>Monto a Pagar (₡) *</Label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={formData.monto} 
                                    onChange={(e) => setFormData({...formData, monto: parseFloat(e.target.value)})} 
                                    placeholder="0.00"
                                    className="text-lg font-black"
                                />
                                </div>
                                <div>
                                <Label>Referencia / Concepto</Label>
                                <Input 
                                    value={formData.descripcion} 
                                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})} 
                                    placeholder="Ej: Honorarios mes de mayo"
                                />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label>Periodo Inicio</Label>
                                    <Input
                                      type="date"
                                      value={periodoInicio}
                                      onChange={(e) => setPeriodoInicio(e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <Label>Periodo Fin</Label>
                                    <Input
                                      type="date"
                                      value={periodoFin}
                                      onChange={(e) => setPeriodoFin(e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-3">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="flex-1 h-12"
                                    onClick={fetchPendientes}
                                    disabled={loadingPendientes}
                                  >
                                    {loadingPendientes ? 'Consultando...' : 'Ver pendientes'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 h-12"
                                    onClick={liquidarPendientes}
                                    disabled={loadingPendientes}
                                  >
                                    {loadingPendientes ? 'Liquidando...' : 'Liquidar pendientes'}
                                  </Button>
                                </div>

                                {pendientesResumen && (
                                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm">
                                    <div className="font-black text-white">Pendientes encontrados</div>
                                    <div className="text-slate-300 font-bold mt-1">{pendientesResumen.cantidad_movimientos ?? 0} movimientos</div>
                                    <div className="text-white font-black text-lg mt-1">{formatCRC(pendientesResumen.total_monto ?? 0)}</div>
                                  </div>
                                )}

                                <Button
                                  type="submit"
                                  variant="primary"
                                  className="w-full h-14 text-base font-black shadow-lg mt-4 rounded-2xl bg-gradient-to-r from-[#FFC800] to-[#00AEEF] hover:from-[#FFC800]/80 hover:to-[#00AEEF]/80 text-[#051026]"
                                >
                                    Emitir Pago Ahora
                                </Button>
                              </form>
                            </div>
                          </Card>
        </div>

        {/* Panel derecho */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={activePanel === 'tutores' ? 'primary' : 'outline'}
              className="h-11"
              onClick={() => setActivePanel('tutores')}
            >
              Tutores
            </Button>
            <Button
              type="button"
              variant={activePanel === 'estudiantes' ? 'primary' : 'outline'}
              className="h-11"
              onClick={() => setActivePanel('estudiantes')}
            >
              Estudiantes
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="p-8 space-y-4">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-3">
                    <DollarSign className="w-6 h-6 p-1 bg-white/10 text-emerald-300 rounded-lg" />
                    {activePanel === 'tutores' ? 'Deuda pendiente por tutor' : 'Deuda pendiente por estudiante'}
                  </h2>
                  <p className="text-slate-300 font-medium mt-1">
                    {activePanel === 'tutores'
                      ? <span>Sumatoria de movimientos <span className="font-bold">pendientes</span> del tipo “pago tutor”.</span>
                      : <span>Sumatoria de movimientos <span className="font-bold">pendientes</span> del tipo “ingreso estudiante”.</span>
                    }
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total pendiente</div>
                  <div className="text-3xl font-black text-white tracking-tighter">
                    {formatCRC(activePanel === 'tutores' ? totalPendienteGeneral : totalPendienteEstudiantes)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5">
                      <TableHead>{activePanel === 'tutores' ? 'Tutor' : 'Estudiante'}</TableHead>
                      <TableHead className="text-right">Pendiente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePanel === 'tutores' ? (
                      loadingPendientesPorTutor ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                            Cargando...
                          </TableCell>
                        </TableRow>
                      ) : tutoresRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                            No hay tutores
                          </TableCell>
                        </TableRow>
                      ) : (
                        tutoresRows.map((t) => (
                          <TableRow
                            key={t.tutor_id}
                            className="cursor-pointer"
                            onClick={() => openTutorDetalle(parseInt(String(t.tutor_id), 10), t.tutor_nombre)}
                          >
                            <TableCell className="font-bold text-slate-100">{t.tutor_nombre}</TableCell>
                            <TableCell className={`text-right font-black ${Number(t.total_pendiente) > 0 ? 'text-white' : 'text-slate-400'}`}>{formatCRC(t.total_pendiente)}</TableCell>
                          </TableRow>
                        ))
                      )
                    ) : (
                      loadingPendientesPorEstudiante ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                            Cargando...
                          </TableCell>
                        </TableRow>
                      ) : estudiantesRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                            No hay estudiantes
                          </TableCell>
                        </TableRow>
                      ) : (
                        estudiantesRows.map((e) => (
                          <TableRow
                            key={e.estudiante_id}
                            className="cursor-pointer"
                            onClick={() => openEstudianteDetalle(parseInt(String(e.estudiante_id), 10), e.estudiante_nombre)}
                          >
                            <TableCell className="font-bold text-slate-100">{e.estudiante_nombre}</TableCell>
                            <TableCell className={`text-right font-black ${Number(e.total_pendiente) > 0 ? 'text-white' : 'text-slate-400'}`}>{formatCRC(e.total_pendiente)}</TableCell>
                          </TableRow>
                        ))
                      )
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={activePanel === 'tutores' ? loadPendientesPorTutor : loadPendientesPorEstudiante}
                  disabled={activePanel === 'tutores' ? loadingPendientesPorTutor : loadingPendientesPorEstudiante}
                >
                  {(activePanel === 'tutores' ? loadingPendientesPorTutor : loadingPendientesPorEstudiante) ? 'Actualizando...' : 'Actualizar lista'}
                </Button>
              </div>
            </div>
          </Card>

          <Dialog
            isOpen={!!selectedTutorDetalle}
            onClose={() => { setSelectedTutorDetalle(null); setDetalleTutor(null); }}
            title={selectedTutorDetalle ? `Desglose: ${selectedTutorDetalle.tutor_nombre}` : 'Desglose tutor'}
            maxWidthClass="max-w-4xl"
            zIndex={100}
          >
            {loadingDetalleTutor ? (
              <div className="text-slate-200 font-bold">Cargando...</div>
            ) : detalleTutor?.error ? (
              <div className="text-red-200 font-bold">{detalleTutor.error}</div>
            ) : (
              <div className="space-y-4">
                <div className="text-slate-200 text-sm font-bold">Total pendiente: {formatCRC(detalleTutor?.total_monto ?? 0)} ({detalleTutor?.cantidad_movimientos ?? 0} movimientos)</div>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      if (!selectedTutorDetalle) return;
                      setFormData(prev => ({ ...prev, tutor_id: selectedTutorDetalle.tutor_id }));
                      setSelectedTutorDetalle(null);
                      setDetalleTutor(null);
                    }}
                  >
                    Ver en sidebar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="h-11"
                    onClick={() => setConfirmLiquidarTutorOpen(true)}
                    disabled={loadingPendientes || (Number(detalleTutor?.total_monto) || 0) <= 0}
                  >
                    {loadingPendientes ? 'Liquidando...' : 'Liquidar este tutor'}
                  </Button>
                </div>
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/5">
                        <TableHead>Tipo</TableHead>
                        <TableHead>Curso</TableHead>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detalleTutor?.movimientos || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-slate-300">Sin movimientos</TableCell>
                        </TableRow>
                      ) : (
                        (detalleTutor?.movimientos || []).map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell>
                              {(() => {
                                const isMensual = m?.origen === 'cierre_mensual' || !!m?.periodo_inicio || !!m?.periodo_fin;
                                const isPorClase = !!m?.sesion_id;
                                if (isMensual) return <Badge variant="info">Mensual</Badge>;
                                if (isPorClase) return <Badge variant="warning">Por clase</Badge>;
                                return <Badge variant="secondary">Manual</Badge>;
                              })()}
                            </TableCell>
                            <TableCell>{m?.curso?.nombre || m.curso_id || '-'}</TableCell>
                            <TableCell>{m?.matricula?.estudiante?.nombre || m?.matricula?.estudiante_id || '-'}</TableCell>
                            <TableCell>{m.fecha_pago ? formatDateCR(m.fecha_pago) : '-'}</TableCell>
                            <TableCell className="text-right font-black">{formatCRC(m.monto || 0)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Dialog>

          <Dialog
            isOpen={confirmLiquidarTutorOpen}
            onClose={() => { if (!loadingPendientes) setConfirmLiquidarTutorOpen(false); }}
            title="Confirmar liquidación"
            maxWidthClass="max-w-lg"
            zIndex={130}
          >
            <div className="space-y-5">
              <div className="text-slate-200 text-sm font-semibold">
                Vas a liquidar los pendientes del tutor <span className="text-white font-black">{selectedTutorDetalle?.tutor_nombre || '—'}</span>.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm space-y-1">
                <div className="text-slate-300 font-bold">Total pendiente</div>
                <div className="text-white font-black text-2xl">{formatCRC(detalleTutor?.total_monto ?? 0)}</div>
                {(periodoInicio || periodoFin) && (
                  <div className="text-slate-300 font-semibold">
                    Periodo: {periodoInicio || '...'} a {periodoFin || '...'}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setConfirmLiquidarTutorOpen(false)}
                  disabled={loadingPendientes}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="h-11"
                  onClick={async () => {
                    await liquidarTutorDesdeDialog({ reopenDetalle: false });
                    setConfirmLiquidarTutorOpen(false);
                    setSelectedTutorDetalle(null);
                    setDetalleTutor(null);
                  }}
                  disabled={loadingPendientes || (Number(detalleTutor?.total_monto) || 0) <= 0}
                >
                  {loadingPendientes ? 'Liquidando...' : 'Confirmar y liquidar'}
                </Button>
              </div>
            </div>
          </Dialog>

          <Dialog
            isOpen={!!selectedEstudianteDetalle}
            onClose={() => { setSelectedEstudianteDetalle(null); setDetalleEstudiante(null); }}
            title={selectedEstudianteDetalle ? `Desglose: ${selectedEstudianteDetalle.estudiante_nombre}` : 'Desglose estudiante'}
            maxWidthClass="max-w-4xl"
            zIndex={100}
          >
            {loadingDetalleEstudiante ? (
              <div className="text-slate-200 font-bold">Cargando...</div>
            ) : detalleEstudiante?.error ? (
              <div className="text-red-200 font-bold">{detalleEstudiante.error}</div>
            ) : (
              <div className="space-y-4">
                <div className="text-slate-200 text-sm font-bold">Total pendiente: {formatCRC(detalleEstudiante?.total_monto ?? 0)} ({detalleEstudiante?.cantidad_movimientos ?? 0} movimientos)</div>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    variant="primary"
                    className="h-11"
                    onClick={prefillIngresoDesdeDialog}
                    disabled={(Number(detalleEstudiante?.total_monto) || 0) <= 0}
                  >
                    Registrar pago (precargar)
                  </Button>
                </div>
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/5">
                        <TableHead>Tipo</TableHead>
                        <TableHead>Curso</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detalleEstudiante?.movimientos || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-10 text-center text-slate-300">Sin movimientos</TableCell>
                        </TableRow>
                      ) : (
                        (detalleEstudiante?.movimientos || []).map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell>
                              {(() => {
                                const isMensual = m?.origen === 'cierre_mensual' || !!m?.periodo_inicio || !!m?.periodo_fin;
                                const isPorClase = !!m?.sesion_id;
                                if (isMensual) return <Badge variant="info">Mensual</Badge>;
                                if (isPorClase) return <Badge variant="warning">Por clase</Badge>;
                                return <Badge variant="secondary">Manual</Badge>;
                              })()}
                            </TableCell>
                            <TableCell>{m?.curso?.nombre || m.curso_id || '-'}</TableCell>
                            <TableCell>{m.fecha_pago ? formatDateCR(m.fecha_pago) : '-'}</TableCell>
                            <TableCell className="text-right font-black">{formatCRC(m.monto || 0)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Dialog>

          <Card className="overflow-hidden">
            <div className="p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/10 border border-white/10 rounded-2xl text-slate-300">
                  <Filter className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <Label className="mb-0">Filtrar por Tutor</Label>
                  <Select
                    className="w-72"
                    value={filterTutor}
                    onChange={(e) => setFilterTutor(e.target.value)}
                  >
                    <option value="all">Todos los registros</option>
                    {tutores.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </Select>
                </div>
              </div>
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Monto Total Filtrado</span>
                <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter">{formatCRC(totalFiltered)}</span>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Control diario (libro)</h2>
                  <p className="text-slate-300 text-sm">Movimientos del día en formato Debe/Haber.</p>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <Label className="mb-0">Fecha</Label>
                    <Input type="date" value={libroFecha} onChange={(e) => setLibroFecha(e.target.value)} className="h-11" />
                  </div>
                  <Button type="button" variant="outline" className="h-11" onClick={cargarLibro} disabled={loadingLibro}>
                    {loadingLibro ? 'Cargando...' : 'Ver día'}
                  </Button>

                  <div className="hidden sm:block w-px h-10 bg-white/10 mx-1" />

                  <div>
                    <Label className="mb-0">Año</Label>
                    <Input
                      type="number"
                      value={libroMesAnio}
                      onChange={(e) => setLibroMesAnio(parseInt(e.target.value || String(new Date().getFullYear()), 10))}
                      className="h-11 w-28"
                    />
                  </div>
                  <div>
                    <Label className="mb-0">Mes</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={libroMesMes}
                      onChange={(e) => setLibroMesMes(Math.max(1, Math.min(12, parseInt(e.target.value || '1', 10) || 1)))}
                      className="h-11 w-24"
                    />
                  </div>
                  <div>
                    <Label className="mb-0">Tutor (mes)</Label>
                    <Select
                      className="h-11 w-72"
                      value={String(libroMesTutorId)}
                      onChange={(e) => setLibroMesTutorId(parseInt(e.target.value || '0', 10) || 0)}
                    >
                      <option value="0">Todos</option>
                      {tutores.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="button" variant="outline" className="h-11" onClick={cargarLibroMes} disabled={loadingLibroMes}>
                    {loadingLibroMes ? 'Cargando...' : 'Ver mes'}
                  </Button>

                  <Button type="button" variant="secondary" className="h-11" onClick={calcularBolsaTotal} disabled={loadingBolsaTotal}>
                    {loadingBolsaTotal ? 'Calculando...' : 'Total en bolsa'}
                  </Button>
                </div>
              </div>

              {libro?.error ? (
                <div className="text-red-200 font-bold">{libro.error}</div>
              ) : libro ? (
                <>
                  <div className="text-sm text-slate-200 font-bold">
                    Total Debe: <span className="text-white">{formatCRC(libro.total_debe ?? 0)}</span> · Total Haber: <span className="text-white">{formatCRC(libro.total_haber ?? 0)}</span>
                    {' '}· En bolsa: <span className="text-white">{formatCRC((Number(libro.total_debe) || 0) - (Number(libro.total_haber) || 0))}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-white/5">
                          <TableHead>Fecha</TableHead>
                          <TableHead>No. Comprobante</TableHead>
                          <TableHead>Detalle</TableHead>
                          <TableHead className="text-right">Debe</TableHead>
                          <TableHead className="text-right">Haber</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(libro.movimientos || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">Sin movimientos</TableCell>
                          </TableRow>
                        ) : (
                          (libro.movimientos || []).map((m: any) => (
                            <TableRow key={m.id}>
                              <TableCell>{m.fecha_comprobante ? formatDateCR(m.fecha_comprobante) : (m.fecha_pago ? formatDateCR(m.fecha_pago) : '-')}</TableCell>
                              <TableCell className="text-slate-200 font-bold">{m.factura_numero || '—'}</TableCell>
                              <TableCell className="text-slate-300">
                                <div className="font-bold text-slate-100">
                                  {m?.curso?.nombre || ''}{m?.tutor?.nombre ? ` · ${m.tutor.nombre}` : ''}{m?.matricula?.estudiante?.nombre ? ` · ${m.matricula.estudiante.nombre}` : ''}
                                </div>
                                <div className="text-xs text-slate-400">{m.notas || m.origen || m.tipo}</div>
                                {(() => {
                                  const url = getComprobanteUrl(m);
                                  if (!url) return null;
                                  const kind = detectComprobanteKind(url);
                                  return (
                                    <div className="mt-2 flex items-center gap-3">
                                      {kind === 'image' ? (
                                        <button
                                          type="button"
                                          className="h-12 w-12 rounded-xl border border-white/10 overflow-hidden bg-black/20 hover:border-[#00AEEF]/40"
                                          onClick={() => openComprobantePreview(url)}
                                          title="Ver comprobante"
                                        >
                                          <img src={url} alt="Comprobante" className="h-full w-full object-cover" loading="lazy" />
                                        </button>
                                      ) : null}

                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-2 text-xs font-black text-[#00AEEF] hover:text-[#00AEEF]/80"
                                        onClick={() => openComprobantePreview(url)}
                                      >
                                        {kind === 'pdf' ? 'Ver PDF' : 'Ver comprobante'}
                                      </button>

                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-2 text-xs font-black text-slate-300 hover:text-white"
                                        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                      >
                                        Abrir
                                      </button>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right font-black text-emerald-200">{Number(m.debe) ? formatCRC(m.debe) : '—'}</TableCell>
                              <TableCell className="text-right font-black text-rose-200">{Number(m.haber) ? formatCRC(m.haber) : '—'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400">Selecciona una fecha y presiona “Ver día”.</div>
              )}

              <Dialog
                isOpen={comprobantePreviewOpen}
                onClose={() => setComprobantePreviewOpen(false)}
                title="Comprobante"
                maxWidthClass="max-w-4xl"
              >
                {!comprobantePreviewUrl ? (
                  <div className="text-slate-300">Sin comprobante.</div>
                ) : comprobantePreviewKind === 'image' ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <img
                        src={comprobantePreviewUrl}
                        alt="Comprobante"
                        className="w-full max-h-[70vh] object-contain rounded-xl"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(comprobantePreviewUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Abrir en pestaña
                      </Button>
                      <Button type="button" onClick={() => setComprobantePreviewOpen(false)}>Cerrar</Button>
                    </div>
                  </div>
                ) : comprobantePreviewKind === 'pdf' ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                      <iframe title="Comprobante PDF" src={comprobantePreviewUrl} className="w-full h-[70vh]" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(comprobantePreviewUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Abrir en pestaña
                      </Button>
                      <Button type="button" onClick={() => setComprobantePreviewOpen(false)}>Cerrar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-slate-300 break-all">{comprobantePreviewUrl}</div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(comprobantePreviewUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Abrir en pestaña
                      </Button>
                      <Button type="button" onClick={() => setComprobantePreviewOpen(false)}>Cerrar</Button>
                    </div>
                  </div>
                )}
              </Dialog>

              {bolsaTotal?.error ? (
                <div className="text-red-200 font-bold">{bolsaTotal.error}</div>
              ) : bolsaTotal ? (
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm">
                  <div className="font-black text-white">Total en bolsa (acumulado)</div>
                  <div className="text-slate-300 font-semibold">{bolsaTotal.fecha_inicio} a {bolsaTotal.fecha_fin}</div>
                  <div className="text-white font-black text-2xl mt-1">{formatCRC(bolsaTotal.neto ?? ((Number(bolsaTotal.total_debe) || 0) - (Number(bolsaTotal.total_haber) || 0)))}</div>
                  <div className="text-slate-300 mt-1">Debe: {formatCRC(bolsaTotal.total_debe ?? 0)} · Haber: {formatCRC(bolsaTotal.total_haber ?? 0)}</div>
                </div>
              ) : null}

              {libroMes?.error ? (
                <div className="text-red-200 font-bold">{libroMes.error}</div>
              ) : libroMes ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                    <div>
                      <div className="font-black text-white">Resumen del mes</div>
                      <div className="text-slate-300 font-semibold text-sm">{libroMes.fecha_inicio} a {libroMes.fecha_fin}</div>
                    </div>
                    <div className="text-slate-200 font-black">
                      En bolsa (mes): {formatCRC((Number(libroMes.total_debe) || 0) - (Number(libroMes.total_haber) || 0))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Debe</div>
                      <div className="text-white font-black text-xl">{formatCRC(libroMes.total_debe ?? 0)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Haber</div>
                      <div className="text-white font-black text-xl">{formatCRC(libroMes.total_haber ?? 0)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Neto</div>
                      <div className="text-white font-black text-xl">{formatCRC((Number(libroMes.total_debe) || 0) - (Number(libroMes.total_haber) || 0))}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-white/5">
                          <TableHead>Día</TableHead>
                          <TableHead className="text-right">Debe</TableHead>
                          <TableHead className="text-right">Haber</TableHead>
                          <TableHead className="text-right">Neto</TableHead>
                          <TableHead className="text-right">Saldo (acum.)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resumenMesDias.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">Sin movimientos en el mes</TableCell>
                          </TableRow>
                        ) : (
                          resumenMesDias.map((d: any) => (
                            <TableRow key={d.fecha}>
                              <TableCell className="text-slate-200 font-bold">{formatDateCR(d.fecha)}</TableCell>
                              <TableCell className="text-right font-black text-emerald-200">{Number(d.debe) ? formatCRC(d.debe) : '—'}</TableCell>
                              <TableCell className="text-right font-black text-rose-200">{Number(d.haber) ? formatCRC(d.haber) : '—'}</TableCell>
                              <TableCell className="text-right font-black text-slate-100">{formatCRC(d.neto)}</TableCell>
                              <TableCell className="text-right font-black text-white">{formatCRC(d.saldo)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white/5">
                    <TableHead>Profesional</TableHead>
                    <TableHead className="text-center">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPagos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-24 text-center text-slate-400 font-bold uppercase tracking-widest italic">No se han registrado movimientos</TableCell>
                    </TableRow>
                  ) : (
                    filteredPagos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-white uppercase tracking-tight">{p.tutor_nombre}</span>
                            <span className="text-xs text-slate-400">{p.tutor_email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-black text-white text-base">
                          {formatCRC(p.monto)}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const estadoRaw = String((p as any)?.estado ?? '').trim();
                            const estado = estadoRaw.toLowerCase();
                            const isCompletado = estado === EstadoPago.PAGADO || estado === 'completado' || estado === 'pagado';
                            const isAtrasado = estado === 'atrasado';

                            const cls = isCompletado
                              ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40'
                              : (isAtrasado
                                ? 'bg-rose-500/15 text-rose-200 border border-rose-400/40'
                                : 'bg-amber-500/15 text-amber-200 border border-amber-400/40');

                            return (
                              <Badge variant="secondary" className={`font-extrabold px-4 ${cls}`}>
                                {isCompletado && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                {estadoRaw || '—'}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-slate-300 font-bold">
                          {formatDateCR(p.fecha_pago)}
                        </TableCell>
                        <TableCell className="text-slate-300 italic text-sm">
                          {p.descripcion || 'Sin concepto'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Pagos;
