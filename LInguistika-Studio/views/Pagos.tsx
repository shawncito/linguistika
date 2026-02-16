
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { supabaseClient } from '../lib/supabaseClient';
import { usePersistentState } from '../lib/usePersistentState';
import { Pago, Tutor, Estudiante, EstadoPago } from '../types';
import { Button, Card, Badge, Input, Label, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dialog } from '../components/UI';
import { CreditCard, Filter, History, Download, DollarSign, Search, CheckCircle2 } from 'lucide-react';
import { formatCRC, formatDateCR } from '../lib/format';

const Pagos: React.FC = () => {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTutor, setFilterTutor] = usePersistentState<string>('ui:pagos:filterTutor', 'all', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });

  const [pendientesPorTutor, setPendientesPorTutor] = useState<Array<{ tutor_id: string; tutor_nombre: string; total_pendiente: number }>>([]);
  const [loadingPendientesPorTutor, setLoadingPendientesPorTutor] = useState(false);

  const [activePanel, setActivePanel] = usePersistentState<'tutores' | 'estudiantes'>('ui:pagos:activePanel', 'tutores', {
    version: 1,
    validate: (v: unknown): v is 'tutores' | 'estudiantes' => v === 'tutores' || v === 'estudiantes',
  });
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
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [grupoFiltroId, setGrupoFiltroId] = usePersistentState<string>('ui:pagos:grupoFiltroId', 'all', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [grupoPagoId, setGrupoPagoId] = usePersistentState<string>('ui:pagos:grupoPagoId', 'all', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });

  const [ingresoTab, setIngresoTab] = usePersistentState<'pendientes' | 'manual'>('ui:pagos:ingresoTab', 'pendientes', {
    version: 1,
    validate: (v: unknown): v is 'pendientes' | 'manual' => v === 'pendientes' || v === 'manual',
  });
  const [ingresoPendientes, setIngresoPendientes] = useState<any[]>([]);
  const [ingresoPendientesLoading, setIngresoPendientesLoading] = useState(false);
  const [ingresoPendientesError, setIngresoPendientesError] = useState('');
  const [ingresoSeleccion, setIngresoSeleccion] = useState<number[]>([]);
  const [manualQuery, setManualQuery] = useState('');
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [savingManual, setSavingManual] = useState(false);
  const [manualAdvancedOpen, setManualAdvancedOpen] = useState(false);
  const manualMontoRef = useRef<HTMLInputElement | null>(null);
  const [manualFocusMonto, setManualFocusMonto] = useState(false);
  const autoSelectIngresoRef = useRef(false);
  const [manualSesionSelected, setManualSesionSelected] = useState<any | null>(null);
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
    sesion_id: 0,
  });

  const [sesionPickerOpen, setSesionPickerOpen] = useState(false);
  const [sesionPickerQuery, setSesionPickerQuery] = useState('');
  const [sesionPickerItems, setSesionPickerItems] = useState<any[]>([]);
  const [sesionPickerLoading, setSesionPickerLoading] = useState(false);
  const [sesionPickerError, setSesionPickerError] = useState<string>('');

  const [libroFecha, setLibroFecha] = usePersistentState<string>('ui:pagos:libroFecha', new Date().toISOString().slice(0, 10), {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [loadingLibro, setLoadingLibro] = useState(false);
  const [libro, setLibro] = useState<any | null>(null);
  const [libroEsperado, setLibroEsperado] = useState<any | null>(null);

  const [libroMesAnio, setLibroMesAnio] = usePersistentState<number>('ui:pagos:libroMesAnio', new Date().getFullYear(), {
    version: 1,
    validate: (v): v is number => Number.isFinite(Number(v)),
  });
  const [libroMesMes, setLibroMesMes] = usePersistentState<number>('ui:pagos:libroMesMes', new Date().getMonth() + 1, {
    version: 1,
    validate: (v): v is number => Number.isFinite(Number(v)),
  });
  const [libroMesTutorId, setLibroMesTutorId] = usePersistentState<number>('ui:pagos:libroMesTutorId', 0, {
    version: 1,
    validate: (v): v is number => Number.isFinite(Number(v)),
  });
  const [loadingLibroMes, setLoadingLibroMes] = useState(false);
  const [libroMes, setLibroMes] = useState<any | null>(null);
  const [libroMesEsperado, setLibroMesEsperado] = useState<any | null>(null);

  const [loadingBolsaTotal, setLoadingBolsaTotal] = useState(false);
  const [bolsaTotal, setBolsaTotal] = useState<any | null>(null);

  type BolsaMesItem = {
    anio: number;
    mes: number;
    start: string;
    end: string;
    total_debe: number;
    total_haber: number;
    neto: number;
  };

  const [bolsaMesesBack, setBolsaMesesBack] = usePersistentState<number>('ui:pagos:bolsaMesesBack', 6, {
    version: 1,
    validate: (v): v is number => Number.isFinite(Number(v)),
  });
  const [loadingBolsaMes, setLoadingBolsaMes] = useState(false);
  const [bolsaMes, setBolsaMes] = useState<BolsaMesItem[]>([]);
  const [bolsaMesError, setBolsaMesError] = useState<string>('');

  const [auditOpen, setAuditOpen] = useState(false);
  const movimientosCardRef = useRef<HTMLDivElement | null>(null);

  const [periodoInicio, setPeriodoInicio] = usePersistentState<string>('ui:pagos:periodoInicio', '', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [periodoFin, setPeriodoFin] = usePersistentState<string>('ui:pagos:periodoFin', '', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [pendientesResumen, setPendientesResumen] = useState<any | null>(null);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  
  const [formData, setFormData] = useState({
    tutor_id: 0,
    monto: 0,
    descripcion: '',
    estado: EstadoPago.PAGADO
  });

  useEffect(() => {
    if (!manualFocusMonto) return;
    const t = setTimeout(() => {
      manualMontoRef.current?.focus();
      try {
        manualMontoRef.current?.select?.();
      } catch {
        // ignore
      }
      setManualFocusMonto(false);
    }, 0);
    return () => clearTimeout(t);
  }, [manualFocusMonto]);

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

  const loadGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const res = await api.bulk.listGrupos();
      setGrupos(Array.isArray(res) ? res : []);
    } catch {
      setGrupos([]);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const loadIngresoPendientes = async (estudianteId?: number, opts?: { selectAll?: boolean }) => {
    const id = Number(estudianteId || ingresoForm.estudiante_id);
    if (!Number.isFinite(id) || id <= 0) {
      setIngresoPendientes([]);
      setIngresoSeleccion([]);
      setIngresoPendientesError('');
      return;
    }

    setIngresoPendientesLoading(true);
    setIngresoPendientesError('');
    try {
      const res = await api.pagos.getPendientesSesiones({
        estudiante_id: id,
        limit: 200,
      });
      const items = Array.isArray(res?.items) ? res.items : [];
      setIngresoPendientes(items);
      const selectAll = Boolean(opts?.selectAll);
      if (selectAll) {
        const ids = items.map((it: any) => Number(it?.movimiento_id || it?.id)).filter((n: any) => Number.isFinite(n) && n > 0);
        setIngresoSeleccion(ids);
      } else {
        setIngresoSeleccion([]);
      }
    } catch (err: any) {
      setIngresoPendientes([]);
      setIngresoSeleccion([]);
      setIngresoPendientesError(err?.response?.data?.error || err?.message || 'Error cargando pendientes del estudiante');
    } finally {
      setIngresoPendientesLoading(false);
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

  const focusCobroEstudiante = (estudiante: Estudiante) => {
    if (!estudiante?.id) return;
    setIngresoTab('pendientes');
    setIngresoForm((prev) => ({
      ...prev,
      estudiante_id: estudiante.id,
      referencia: '',
      fecha_comprobante: new Date().toISOString().slice(0, 10),
    }));
    setEstudianteQuery(`${estudiante.nombre} (#${estudiante.id})`);
    setEstudiantePickerOpen(false);
    setIngresoSeleccion([]);
    autoSelectIngresoRef.current = true;
    openEstudianteDetalle(estudiante.id, estudiante.nombre || `Estudiante #${estudiante.id}`);
    window.setTimeout(() => {
      movimientosCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  useEffect(() => {
    loadData();
    loadPendientesPorTutor();
    loadPendientesPorEstudiante();
    loadEstudiantes();
    loadGrupos();
  }, []);

  useEffect(() => {
    if (ingresoTab !== 'pendientes') return;
    const selectAll = autoSelectIngresoRef.current;
    autoSelectIngresoRef.current = false;
    loadIngresoPendientes(ingresoForm.estudiante_id, { selectAll });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingresoForm.estudiante_id, ingresoTab]);

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

    if (ingresoSeleccion.length === 0) {
      return alert('Selecciona al menos una sesión pendiente para cubrir.');
    }

    const metodoNorm = String(ingresoForm.metodo || '').trim().toLowerCase();
    if (metodoNorm !== 'efectivo' && !String(ingresoForm.referencia || '').trim()) {
      return alert('El número de comprobante es requerido para pagos no-efectivo.');
    }

    if (ingresoFile && !String(ingresoForm.referencia || '').trim()) {
      return alert('Para adjuntar comprobante, ingresa la Referencia (número/comprobante).');
    }

    setLoadingIngreso(true);
    try {
      const result = await api.pagos.liquidarIngresoEstudiante({
        estudiante_id: ingresoForm.estudiante_id,
        movimiento_ids: ingresoSeleccion,
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

        const manualId = Number((result as any)?.movimiento_manual_id);
        const realMovementId = Number.isFinite(manualId) && manualId > 0 ? manualId : (ids.length > 0 ? ids[0] : null);

        if (realMovementId) {
          const uploadRes = await api.pagos.uploadComprobanteMovimiento(realMovementId, ingresoFile);
          const url = String(uploadRes?.comprobante_url || '').trim();

          if (url) {
            if (ids.length > 0) {
              await api.pagos.aplicarComprobanteUrlBulk({ ids, comprobante_url: url });
            }

            const pagadorNombre = selectedEstudiante?.nombre || `Estudiante #${ingresoForm.estudiante_id}`;
            await api.pagos.createComprobanteIngreso({
              numero_comprobante: String(ingresoForm.referencia || '').trim(),
              monto: Number((result as any)?.total_monto) || 0,
              fecha_comprobante: ingresoForm.fecha_comprobante,
              pagador_nombre: pagadorNombre,
              detalle: `Pago estudiante (${ingresoForm.metodo})`,
              movimiento_dinero_id: realMovementId,
              foto_url: url,
            });
          }
        }

        setIngresoFile(null);
      }

      alert('Pago del estudiante registrado y pendientes marcados como completados.');
      setIngresoSeleccion([]);
      await loadIngresoPendientes(ingresoForm.estudiante_id);
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
    const movs = Array.isArray(detalleEstudiante?.movimientos) ? detalleEstudiante.movimientos : [];
    const ids = movs.map((m: any) => Number(m?.id)).filter((n: any) => Number.isFinite(n) && n > 0);
    setIngresoForm(prev => ({
      ...prev,
      estudiante_id: selectedEstudianteDetalle.estudiante_id,
      referencia: '',
      fecha_comprobante: new Date().toISOString().slice(0, 10),
    }));
    setIngresoSeleccion(ids);
    setSelectedEstudianteDetalle(null);
    setDetalleEstudiante(null);
  };

  const filteredPagos = filterTutor === 'all' 
    ? pagos 
    : pagos.filter(p => p.tutor_id === parseInt(filterTutor));

  const totalPendienteGeneral = (pendientesPorTutor || []).reduce((acc, t) => acc + (Number(t.total_pendiente) || 0), 0);
  const totalPendienteEstudiantes = (pendientesPorEstudiante || []).reduce((acc, e) => acc + (Number(e.total_pendiente) || 0), 0);

  const tutoresRows = useMemo(() => {
    const rows = Array.isArray(pendientesPorTutor) ? pendientesPorTutor : [];
    return rows.slice().sort((a, b) => String(a.tutor_nombre || '').localeCompare(String(b.tutor_nombre || '')));
  }, [pendientesPorTutor]);

  const estudiantesById = useMemo(() => {
    return new Map((estudiantes || []).map((e) => [e.id, e]));
  }, [estudiantes]);

  const estudiantesRows = useMemo(() => {
    const rows = Array.isArray(pendientesPorEstudiante) ? pendientesPorEstudiante : [];
    const filtered = grupoFiltroId === 'all'
      ? rows
      : rows.filter((r) => {
        const est = estudiantesById.get(Number(r.estudiante_id)) as any;
        return est && String(est.matricula_grupo_id ?? '') === String(grupoFiltroId);
      });
    return filtered.slice().sort((a, b) => String(a.estudiante_nombre || '').localeCompare(String(b.estudiante_nombre || '')));
  }, [pendientesPorEstudiante, estudiantesById, grupoFiltroId]);

  const pendientesPorEstudianteMap = useMemo(() => {
    return new Map((pendientesPorEstudiante || []).map((e) => [Number(e.estudiante_id), e]));
  }, [pendientesPorEstudiante]);

  const grupoPagoRows = useMemo(() => {
    if (grupoPagoId === 'all') return [] as Array<{ estudiante: Estudiante; total_pendiente: number }>;
    const rows = (estudiantes || [])
      .filter((e) => String(e.matricula_grupo_id ?? '') === String(grupoPagoId))
      .map((e) => {
        const pendiente = pendientesPorEstudianteMap.get(Number(e.id));
        return { estudiante: e, total_pendiente: Number(pendiente?.total_pendiente) || 0 };
      })
      .filter((r) => r.total_pendiente > 0)
      .sort((a, b) => String(a.estudiante?.nombre || '').localeCompare(String(b.estudiante?.nombre || '')));
    return rows;
  }, [estudiantes, grupoPagoId, pendientesPorEstudianteMap]);

  const grupoPagoTotal = useMemo(() => {
    return grupoPagoRows.reduce((acc, r) => acc + (Number(r.total_pendiente) || 0), 0);
  }, [grupoPagoRows]);

  const independientesRows = useMemo(() => {
    return (pendientesPorEstudiante || [])
      .filter((e: any) => !e?.matricula_grupo_id && (Number(e?.total_pendiente) || 0) > 0)
      .sort((a: any, b: any) => String(a.estudiante_nombre || '').localeCompare(String(b.estudiante_nombre || '')));
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

  const ingresoSeleccionSet = useMemo(() => new Set(ingresoSeleccion), [ingresoSeleccion]);

  const ingresoPendientesSeleccionadas = useMemo(() => {
    return (ingresoPendientes || []).filter((it) => ingresoSeleccionSet.has(Number(it?.movimiento_id) || 0));
  }, [ingresoPendientes, ingresoSeleccionSet]);

  const ingresoPendientesTotal = useMemo(() => {
    return ingresoPendientesSeleccionadas.reduce((acc, it) => acc + (Number(it?.monto) || 0), 0);
  }, [ingresoPendientesSeleccionadas]);

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

  const cargarSesionesPendientesPicker = async (opts?: { q?: string }) => {
    setSesionPickerLoading(true);
    setSesionPickerError('');
    try {
      const q = (opts?.q ?? sesionPickerQuery)?.trim() || undefined;
      const res = await api.pagos.getPendientesSesiones({
        q,
        tutor_id: manualForm.tutor_id ? manualForm.tutor_id : undefined,
        estudiante_id: manualForm.estudiante_id ? manualForm.estudiante_id : undefined,
        limit: 30,
      });
      setSesionPickerItems((res?.items || []) as any[]);
    } catch (e: any) {
      setSesionPickerItems([]);
      setSesionPickerError(e?.response?.data?.error || e?.message || 'Error cargando sesiones pendientes');
    } finally {
      setSesionPickerLoading(false);
    }
  };

  useEffect(() => {
    if (!sesionPickerOpen) return;
    cargarSesionesPendientesPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionPickerOpen]);

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
        sesion_id: manualForm.sesion_id ? manualForm.sesion_id : undefined,
      });

      // Conciliación: si es un ingreso manual y viene sesion_id, marcar el esperado como pagado.
      if (manualForm.direccion === 'entrada' && manualForm.sesion_id && manualForm.sesion_id > 0) {
        try {
          await api.pagos.liquidarIngresoSesion({
            sesion_id: manualForm.sesion_id,
            metodo: manualForm.metodo,
            referencia: manualForm.referencia?.trim() || undefined,
            fecha_comprobante: manualForm.fecha,
          });
        } catch (e: any) {
          alert(
            `Movimiento guardado, pero no se pudo conciliar la sesión (#${manualForm.sesion_id}).\n` +
              `${e?.response?.data?.error || e?.message || 'Error conciliando sesión'}`
          );
        }
      }

      if (manualFile && creado?.id) {
        await api.pagos.uploadComprobanteMovimiento(creado.id, manualFile);
      }

      const continuar = window.confirm('Movimiento registrado.\n\n¿Desea continuar con la iteración?');

      setManualFile(null);
      setManualQuery('');
      setManualSesionSelected(null);
      if (continuar) setManualFocusMonto(true);
      setManualForm((prev) => {
        const base = {
          ...prev,
          monto: 0,
          referencia: '',
          categoria: '',
          detalle: '',
          a_nombre_de: '',
          sesion_id: 0,
        };

        // Si desea continuar, mantenemos fecha/método/dirección y vínculos
        // para agilizar el registro de varios movimientos seguidos.
        if (continuar) return base;

        // Si no, limpiamos también los vínculos para evitar arrastres.
        return {
          ...base,
          estudiante_id: 0,
          tutor_id: 0,
        };
      });

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
      const [real, esperado] = await Promise.all([
        api.pagos.getLibroDiario({ fecha: libroFecha }),
        api.pagos.getLibroDiario({ fecha: libroFecha, incluir_pendientes: 1 }),
      ]);
      setLibro(real);
      setLibroEsperado(esperado);
    } catch (e: any) {
      setLibro({ error: e?.response?.data?.error || e?.message || 'Error cargando libro diario' });
      setLibroEsperado(null);
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
      const tutor_id = libroMesTutorId > 0 ? libroMesTutorId : undefined;
      const [real, esperado] = await Promise.all([
        api.pagos.getLibroDiario({ fecha_inicio: start, fecha_fin: end, tutor_id }),
        api.pagos.getLibroDiario({ fecha_inicio: start, fecha_fin: end, tutor_id, incluir_pendientes: 1 }),
      ]);
      setLibroMes(real);
      setLibroMesEsperado(esperado);
    } catch (e: any) {
      setLibroMes({ error: e?.response?.data?.error || e?.message || 'Error cargando libro mensual' });
      setLibroMesEsperado(null);
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

  const formatMonthLabel = (anio: number, mes: number) => {
    const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const idx = Math.max(1, Math.min(12, Number(mes) || 1)) - 1;
    return `${names[idx]} ${anio}`;
  };

  const cargarBolsaPorMes = async (opts?: { months?: number }) => {
    const months = Math.max(1, Math.min(24, Number(opts?.months ?? bolsaMesesBack) || 6));
    setLoadingBolsaMes(true);
    setBolsaMesError('');
    try {
      const now = new Date();
      const hoy = toISODateLocal(now);

      const ranges: Array<{ anio: number; mes: number; start: string; end: string }> = [];
      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const anio = d.getFullYear();
        const mes = d.getMonth() + 1;
        const { start, end: rawEnd } = getMonthRange(anio, mes);
        const end = rawEnd > hoy ? hoy : rawEnd;
        ranges.push({ anio, mes, start, end });
      }

      const results = await Promise.all(
        ranges.map(async (r) => {
          const res = await api.pagos.getLibroDiario({ fecha_inicio: r.start, fecha_fin: r.end, only_totals: 1 });
          const total_debe = Number(res?.total_debe) || 0;
          const total_haber = Number(res?.total_haber) || 0;
          const neto = total_debe - total_haber;
          return { anio: r.anio, mes: r.mes, start: r.start, end: r.end, total_debe, total_haber, neto } as BolsaMesItem;
        })
      );

      setBolsaMes(results);
    } catch (e: any) {
      setBolsaMes([]);
      setBolsaMesError(e?.response?.data?.error || e?.message || 'Error cargando desglose mensual');
    } finally {
      setLoadingBolsaMes(false);
    }
  };

  useEffect(() => {
    // Mostrar “En bolsa TOTAL” y desglose mensual sin depender de clicks.
    calcularBolsaTotal();
    cargarBolsaPorMes({ months: bolsaMesesBack });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

                className="h-11"
                onClick={() => {
                  setSesionPickerQuery('');
                  cargarSesionesPendientesPicker({ q: '' });
                }}
                disabled={sesionPickerLoading}
              >
                Limpiar
              </Button>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Filtros activos: {manualForm.tutor_id ? `Tutor #${manualForm.tutor_id}` : 'Tutor: cualquiera'} · {manualForm.estudiante_id ? `Estudiante #${manualForm.estudiante_id}` : 'Estudiante: cualquiera'}
          </div>

          {sesionPickerError ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-rose-100 text-sm font-semibold">
              {sesionPickerError}
            </div>
          ) : null}

          <div className="max-h-[55vh] overflow-auto rounded-2xl border border-white/10">
            {(sesionPickerItems || []).length === 0 ? (
              <div className="p-5 text-sm text-slate-400">
                {sesionPickerLoading ? 'Cargando…' : 'Sin resultados'}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {sesionPickerItems.map((it: any) => {
                  const fecha = it?.fecha_sesion || it?.fecha_pago || '';
                  const hora = it?.hora_inicio && it?.hora_fin ? `${it.hora_inicio} - ${it.hora_fin}` : '';
                  const titulo = [
                    fecha ? formatDateCR(fecha) : null,
                    hora || null,
                    it?.curso_nombre || null,
                  ].filter(Boolean).join(' • ');

                  const subt = [
                    it?.tutor_nombre ? `Tutor: ${it.tutor_nombre}` : (it?.tutor_id ? `Tutor #${it.tutor_id}` : null),
                    it?.estudiante_nombre ? `Estudiante: ${it.estudiante_nombre}` : (it?.estudiante_id ? `Estudiante #${it.estudiante_id}` : null),
                    it?.sesion_id ? `Sesión #${it.sesion_id}` : null,
                  ].filter(Boolean).join(' · ');

                  return (
                    <button
                      key={String(it?.movimiento_id || it?.sesion_id || Math.random())}
                      type="button"
                      className="w-full text-left p-4 hover:bg-white/5 transition flex items-start justify-between gap-4"
                      onClick={() => {
                        setManualForm((prev) => {
                          const next: any = { ...prev, sesion_id: Number(it?.sesion_id) || 0 };
                          if (!prev.estudiante_id && it?.estudiante_id) next.estudiante_id = Number(it.estudiante_id) || 0;
                          if (!prev.tutor_id && it?.tutor_id) next.tutor_id = Number(it.tutor_id) || 0;
                          if ((!prev.monto || prev.monto <= 0) && it?.monto) next.monto = Number(it.monto) || 0;
                          return next;
                        });
                        setManualSesionSelected(it);
                        setSesionPickerOpen(false);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-black text-white truncate">{titulo || 'Sesión pendiente'}</div>
                        <div className="text-xs text-slate-300 mt-1 truncate">{subt}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-black text-emerald-200">{formatCRC(Number(it?.monto) || 0)}</div>
                        <div className="text-[10px] text-slate-400 font-black tracking-widest uppercase">PENDIENTE</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left panels */}
        <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
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

                                          <input
                                            type="checkbox"
                                            className="mt-1 h-4 w-4"
                                            checked={checked}
                                            onChange={(e) => {
                                              const next = e.target.checked
                                                ? Array.from(new Set([...ingresoSeleccion, movId]))
                                                : ingresoSeleccion.filter((x) => x !== movId);
                                              setIngresoSeleccion(next);
                                            }}
                                          />
                                          <div className="min-w-0">
                                            <div className="text-[11px] text-slate-300 whitespace-nowrap">
                                              {fecha ? formatDateCR(fecha) : '—'}{hora ? ` • ${hora}` : ''}
                                            </div>
                                            <div className="text-sm font-black text-white truncate">{curso}</div>
                                            <div className="text-[11px] text-slate-200 truncate">Movimiento #{movId}</div>
                                          </div>
                                        </div>
                                        <div className="text-right whitespace-nowrap text-sm font-black text-white">
                                          {formatCRC(Number(it?.monto) || 0)}
                                        </div>
                                      </label>
                                    );
                                  })}
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
                            <Label>Referencia (comprobante) · requerido para no-efectivo</Label>
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
                          <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300">
                            <div className="font-black text-white">Movimiento manual (REAL)</div>
                            <div className="mt-1 font-semibold">
                              Registra una <span className="text-white font-black">entrada</span> o <span className="text-white font-black">salida</span> que afecta la “bolsa real”.
                              {manualForm.direccion === 'entrada' ? ' Puedes conciliarlo contra una sesión pendiente.' : ''}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Dirección</Label>
                              <Select
                                value={manualForm.direccion}
                                onChange={(e) => {
                                  if (e.target.value === 'salida') setManualSesionSelected(null);
                                  setManualForm((prev) => ({
                                    ...prev,
                                    direccion: e.target.value as any,
                                    sesion_id: e.target.value === 'salida' ? 0 : prev.sesion_id,
                                  }));
                                }}
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
                              ref={manualMontoRef as any}
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
                            <Label>Detalle (recomendado)</Label>
                            <Input
                              value={manualForm.detalle}
                              onChange={(e) => setManualForm((prev) => ({ ...prev, detalle: e.target.value }))}
                              placeholder="Ej: Recibo ICE enero, compra de materiales..."
                            />
                          </div>

                          {manualForm.direccion === 'entrada' ? (
                            <div>
                              <Label>Conciliar con sesión pendiente (opcional)</Label>
                              <div className="flex items-end justify-between gap-3">
                                <div className="flex-1">
                                  <Input
                                    value={manualForm.sesion_id ? `Sesión #${manualForm.sesion_id}` : ''}
                                    readOnly
                                    placeholder="No seleccionada"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-11"
                                  onClick={() => setSesionPickerOpen(true)}
                                >
                                  Buscar
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-11"
                                  onClick={() => {
                                    setManualSesionSelected(null);
                                    setManualForm((prev) => ({ ...prev, sesion_id: 0 }));
                                  }}
                                  disabled={!manualForm.sesion_id}
                                >
                                  Quitar
                                </Button>
                              </div>
                              {manualSesionSelected ? (
                                <div className="mt-2 text-xs text-slate-300">
                                  {manualSesionSelected?.fecha_sesion ? `${formatDateCR(manualSesionSelected.fecha_sesion)} · ` : ''}
                                  {manualSesionSelected?.curso_nombre ? `${manualSesionSelected.curso_nombre} · ` : ''}
                                  {manualSesionSelected?.tutor_nombre ? `Tutor: ${manualSesionSelected.tutor_nombre} · ` : ''}
                                  {manualSesionSelected?.estudiante_nombre ? `Estudiante: ${manualSesionSelected.estudiante_nombre}` : ''}
                                </div>
                              ) : (
                                <div className="mt-1 text-xs text-slate-400">
                                  Si seleccionas una sesión, el sistema marcará como pagado el ingreso esperado de esa sesión.
                                </div>
                              )}
                            </div>
                          ) : null}

                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs text-slate-400 font-semibold">
                                Opcionales: categoría, vínculos y comprobante.
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10"
                                onClick={() => setManualAdvancedOpen((v) => !v)}
                              >
                                {manualAdvancedOpen ? 'Ocultar opciones' : 'Más opciones'}
                              </Button>
                            </div>

                            {manualAdvancedOpen ? (
                              <>
                                <div>
                                  <Label>Categoría (opcional)</Label>
                                  <Input
                                    value={manualForm.categoria}
                                    onChange={(e) => setManualForm((prev) => ({ ...prev, categoria: e.target.value }))}
                                    placeholder="Ej: Pago de servicio, papelería, alquiler..."
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
                                      onChange={(e) =>
                                        setManualForm((prev) => ({
                                          ...prev,
                                          tutor_id: parseInt(e.target.value || '0', 10) || 0,
                                        }))
                                      }
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
                              </>
                            ) : null}
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
        <div className="lg:col-span-8 space-y-8 order-1 lg:order-2">
          <Card className="overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Control diario (libro)</h2>
                  <p className="text-slate-300 text-sm">Caja operativa: Debe/Haber y “En bolsa”.</p>
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <Label className="mb-0">Meses</Label>
                    <Select
                      className="h-11 w-28"
                      value={String(bolsaMesesBack)}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(24, parseInt(e.target.value || '6', 10) || 6));
                        setBolsaMesesBack(v);
                        cargarBolsaPorMes({ months: v });
                      }}
                      disabled={loadingBolsaMes}
                    >
                      <option value="6">6</option>
                      <option value="12">12</option>
                      <option value="24">24</option>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11"
                    onClick={() => {
                      calcularBolsaTotal();
                      cargarBolsaPorMes({ months: bolsaMesesBack });
                    }}
                    disabled={loadingBolsaTotal || loadingBolsaMes}
                  >
                    {(loadingBolsaTotal || loadingBolsaMes) ? 'Actualizando...' : 'Actualizar bolsa'}
                  </Button>
                </div>
              </div>

              {bolsaTotal?.error ? (
                <div className="text-red-200 font-bold">{bolsaTotal.error}</div>
              ) : bolsaTotal ? (
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">En bolsa TOTAL (acumulado)</div>
                  <div className="text-white font-black text-3xl mt-1">
                    {formatCRC(bolsaTotal.neto ?? ((Number(bolsaTotal.total_debe) || 0) - (Number(bolsaTotal.total_haber) || 0)))}
                  </div>
                  <div className="text-slate-300 font-semibold text-sm mt-1">
                    Debe: {formatCRC(bolsaTotal.total_debe ?? 0)} · Haber: {formatCRC(bolsaTotal.total_haber ?? 0)}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">Calculando total en bolsa…</div>
              )}

              {bolsaMesError ? (
                <div className="text-red-200 font-bold">{bolsaMesError}</div>
              ) : (
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/5">
                        <TableHead>Mes</TableHead>
                        <TableHead className="text-right">Debe</TableHead>
                        <TableHead className="text-right">Haber</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingBolsaMes ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">Cargando desglose…</TableCell>
                        </TableRow>
                      ) : bolsaMes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">Sin datos</TableCell>
                        </TableRow>
                      ) : (
                        bolsaMes.map((m) => (
                          <TableRow key={`${m.anio}-${m.mes}`}>
                            <TableCell className="text-slate-200 font-bold">{formatMonthLabel(m.anio, m.mes)}</TableCell>
                            <TableCell className="text-right font-black text-emerald-200">{m.total_debe ? formatCRC(m.total_debe) : '—'}</TableCell>
                            <TableCell className="text-right font-black text-rose-200">{m.total_haber ? formatCRC(m.total_haber) : '—'}</TableCell>
                            <TableCell className="text-right font-black text-white">{formatCRC(m.neto)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
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
                </div>
              </div>

              {libro?.error ? (
                <div className="text-red-200 font-bold">{libro.error}</div>
              ) : libro ? (
                <>
                  <div className="text-sm text-slate-200 font-bold">
                    Total Debe: <span className="text-white">{formatCRC(libro.total_debe ?? 0)}</span> · Total Haber: <span className="text-white">{formatCRC(libro.total_haber ?? 0)}</span>
                    {' '}· En bolsa <span className="text-white">REAL</span>: <span className="text-white">{formatCRC((Number(libro.total_debe) || 0) - (Number(libro.total_haber) || 0))}</span>
                  </div>
                  {libroEsperado && !libroEsperado?.error ? (
                    <div className="text-xs text-slate-300 font-semibold">
                      En bolsa <span className="text-white font-black">ESPERADO</span> (incluye pendientes): {formatCRC((Number(libroEsperado.total_debe) || 0) - (Number(libroEsperado.total_haber) || 0))}
                    </div>
                  ) : null}
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
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right font-black">{formatCRC(m.debe || 0)}</TableCell>
                              <TableCell className="text-right font-black">{formatCRC(m.haber || 0)}</TableCell>
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

              {libroMes?.error ? (
                <div className="text-red-200 font-bold">{libroMes.error}</div>
              ) : libroMes ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                    <div>
                      <div className="font-black text-white">Resumen del mes</div>
                      <div className="text-slate-300 font-semibold text-sm">{libroMes.fecha_inicio} a {libroMes.fecha_fin}</div>
                    </div>
                    <div className="text-slate-200 font-black space-y-1 text-right">
                      <div>
                        En bolsa <span className="text-white">REAL</span> (mes): {formatCRC((Number(libroMes.total_debe) || 0) - (Number(libroMes.total_haber) || 0))}
                      </div>
                      {libroMesEsperado && !libroMesEsperado?.error ? (
                        <div className="text-slate-300">
                          En bolsa <span className="text-white">ESPERADO</span> (mes): {formatCRC((Number(libroMesEsperado.total_debe) || 0) - (Number(libroMesEsperado.total_haber) || 0))}
                        </div>
                      ) : null}
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

          <div ref={movimientosCardRef}>
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

              {activePanel === 'estudiantes' && (
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <Label className="mb-0">Grupo</Label>
                    <Select
                      className="h-11 w-72"
                      value={grupoFiltroId}
                      onChange={(e) => setGrupoFiltroId(e.target.value)}
                      disabled={loadingGrupos}
                    >
                      <option value="all">Todos</option>
                      {(grupos || []).map((g: any) => (
                        <option key={String(g.id)} value={String(g.id)}>
                          {g.nombre_grupo || g.id}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="text-xs text-slate-400 font-semibold">
                    {loadingGrupos ? 'Cargando grupos…' : 'Filtra estudiantes por grupo'}
                  </div>
                </div>
              )}

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
          </div>

          {activePanel === 'estudiantes' && (
            <Card className="overflow-hidden">
              <div className="p-8 space-y-4">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-3">
                      <DollarSign className="w-6 h-6 p-1 bg-white/10 text-emerald-300 rounded-lg" />
                      Pagos por grupo
                    </h2>
                    <p className="text-slate-300 font-medium mt-1">
                      Selecciona un grupo para ver quiénes tienen <span className="font-bold">ingresos pendientes</span>.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total grupo</div>
                    <div className="text-2xl font-black text-white tracking-tighter">{formatCRC(grupoPagoTotal)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <Label className="mb-0">Grupo</Label>
                    <Select
                      className="h-11 w-72"
                      value={grupoPagoId}
                      onChange={(e) => setGrupoPagoId(e.target.value)}
                      disabled={loadingGrupos}
                    >
                      <option value="all">Selecciona un grupo</option>
                      {(grupos || []).map((g: any) => (
                        <option key={String(g.id)} value={String(g.id)}>
                          {g.nombre_grupo || g.id}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="text-xs text-slate-400 font-semibold">
                    {loadingGrupos ? 'Cargando grupos…' : 'Sólo muestra estudiantes con saldo pendiente'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/5">
                        <TableHead>Estudiante</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupoPagoId === 'all' ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                            Selecciona un grupo
                          </TableCell>
                        </TableRow>
                      ) : grupoPagoRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                            Sin pendientes en este grupo
                          </TableCell>
                        </TableRow>
                      ) : (
                        grupoPagoRows.map((row) => (
                          <TableRow key={row.estudiante.id}>
                            <TableCell className="font-bold text-slate-100">{row.estudiante.nombre}</TableCell>
                            <TableCell className="text-right font-black text-white">{formatCRC(row.total_pendiente)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="primary"
                                  className="h-9"
                                  onClick={() => focusCobroEstudiante(row.estudiante)}
                                >
                                  Cobrar
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9"
                                  onClick={() => openEstudianteDetalle(row.estudiante.id, row.estudiante.nombre)}
                                >
                                  Ver detalle
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-xs text-slate-400">
                  Al usar “Cobrar”, se abre el panel de pago del estudiante abajo. Debes seleccionar las sesiones a cubrir y,
                  si el método no es efectivo, el comprobante es obligatorio.
                </div>

            </Card>
          )}

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
                                const isPorClase = !!m?.sesion_id;
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
                                const isPorClase = !!m?.sesion_id;
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
            <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/10 border border-white/10 rounded-2xl text-slate-300">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-black text-white">Liquidaciones</div>
                  <div className="text-sm text-slate-300">Pagos a tutores registrados.</div>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="mb-0">Tutor</Label>
                  <Select
                    className="h-11 w-72"
                    value={filterTutor}
                    onChange={(e) => setFilterTutor(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    {tutores.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </Select>
                </div>
                <div className="text-sm text-slate-300 font-bold pb-2">
                  {filteredPagos.length} registros
                </div>
              </div>
            </div>

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
