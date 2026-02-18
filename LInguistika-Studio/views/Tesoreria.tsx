import React, { useEffect, useMemo, useRef, useState } from 'react';

// Cargar obligaciones automáticamente al seleccionar encargado
// (esto debe ir después de la declaración de los hooks de estado)
import { api } from '../services/api';
import { Button, Card, Badge, Input, Label, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dialog } from '../components/UI';
import { formatCRC } from '../lib/format';

type EncargadoResumenItem = {
  cuenta_id: number;
  encargado_id: number;
  deuda_pendiente: number;
  saldo_a_favor: number;
  balance_neto: number;
  estado: 'deuda' | 'saldo_favor' | 'al_dia';
  encargados?: { id: number; nombre?: string | null; email?: string | null; telefono?: string | null } | null;
};

type TutorResumenItem = {
  cuenta_id: number;
  tutor_id: number;
  por_pagar: number;
  pagado: number;
  tutores?: { id: number; nombre?: string | null; email?: string | null } | null;
};

type EncargadoPorcentajeItem = {
  cuenta_id: number;
  encargado_id: number;
  saldo_a_favor: number;
  bolsa_real: number;
  porcentaje_bolsa: number;
  encargados?: { id: number; nombre?: string | null; email?: string | null; telefono?: string | null } | null;
};

type BolsaInfo = {
  debe_real: number;
  haber_real: number;
  bolsa_real: number;
};

type EsperadoDiarioItem = {
  fecha: string;
  debe_esperado: number;
  haber_esperado: number;
};


type DiarioItem = {
  id: number;
  fecha_pago: string;
  cuenta_tipo: 'encargado' | 'tutor';
  encargado_id?: number | null;
  tutor_id?: number | null;
  metodo?: string | null;
  referencia?: string | null;
  detalle?: string | null;
  estado: string;
  debe: number;
  haber: number;
  saldo_acumulado: number;
};

type CuentaMovimientoItem = {
  id: number;
  fecha_pago: string;
  detalle?: string | null;
  estado?: string | null;
  metodo?: string | null;
  referencia?: string | null;
  debe?: number | null;
  haber?: number | null;
  saldo_acumulado?: number | null;
  comprobante_url?: string | null;
};

type ObligacionPendienteItem = {
  id: number;
  tipo?: string | null;
  monto?: number | null;
  fecha_devengo?: string | null;
  estado?: string | null;
  detalle?: string | null;
  ya_aplicado?: number | null;
  restante?: number | null;
  sesion_id?: number | null;
  matricula_id?: number | null;
  curso_id?: number | null;
  tutor_id?: number | null;
  estudiante_id?: number | null;
  encargado_id?: number | null;
  cursos?: { nombre?: string | null } | null;
  tutores?: { nombre?: string | null } | null;
  estudiantes?: {
    nombre?: string | null;
    encargado_id?: number | null;
    encargados?: { nombre?: string | null } | null;
  } | null;
  encargados?: { nombre?: string | null } | null;
};

type PagoAplicacionItem = {
  id: number;
  monto?: number | null;
  obligacion?: ObligacionPendienteItem | null;
};


type PagoFormState = {
  monto: number;
  fecha_pago: string;
  metodo: string;
  numero_comprobante: string;
  fecha_comprobante: string;
  referencia: string;
  detalle: string;
};

type SelectedEstudianteDetalle = {
  estudiante_id?: number | null;
  estudiante_bulk_id?: number | null;
  estudiante_nombre: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const lastDayOfMonthISO = (mesYYYYMM: string) => {
  const raw = String(mesYYYYMM || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return '';
  const [yRaw, mRaw] = raw.split('-');
  const y = Number.parseInt(yRaw, 10);
  const m = Number.parseInt(mRaw, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return '';
  const end = new Date(Date.UTC(y, m, 0));
  return end.toISOString().slice(0, 10);
};

const extractHoraFromDetalle = (detalle?: string | null) => {
  const raw = String(detalle || '');
  const match = raw.match(/\b(\d{1,2}:\d{2})\b/);
  if (!match) return '';
  const [hRaw, mRaw] = match[1].split(':');
  const h = Number.parseInt(hRaw, 10);
  const m = Number.parseInt(mRaw, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return match[1];
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const Tesoreria: React.FC = () => {
  const [tab, setTab] = useState<'encargados' | 'tutores' | 'diario'>('encargados');

  const [loadingEnc, setLoadingEnc] = useState(false);
  const [encargados, setEncargados] = useState<EncargadoResumenItem[]>([]);
  const [selectedEncargadoId, setSelectedEncargadoId] = useState<number | null>(null);

  const [loadingBolsa, setLoadingBolsa] = useState(false);
  const [bolsa, setBolsa] = useState<BolsaInfo | null>(null);

  const [loadingTotales, setLoadingTotales] = useState(false);
  const [totalesRapidos, setTotalesRapidos] = useState({
    deudaPendiente: 0,
    saldoAFavor: 0,
    porPagarTutores: 0,
  });

  const [loadingTut, setLoadingTut] = useState(false);
  const [tutores, setTutores] = useState<TutorResumenItem[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<number | null>(null);

  const [loadingHistEnc, setLoadingHistEnc] = useState(false);
  const [histEnc, setHistEnc] = useState<DiarioItem[]>([]);

  const [loadingHistTut, setLoadingHistTut] = useState(false);
  const [histTut, setHistTut] = useState<DiarioItem[]>([]);

  const [appsOpen, setAppsOpen] = useState(false);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsPago, setAppsPago] = useState<any | null>(null);
  const [apps, setApps] = useState<PagoAplicacionItem[]>([]);

  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [cuentaLoading, setCuentaLoading] = useState(false);
  const [cuentaTitle, setCuentaTitle] = useState('Libro auxiliar');
  const [cuentaKind, setCuentaKind] = useState<'encargado' | 'tutor' | null>('encargado');
  const [cuentaPersonaId, setCuentaPersonaId] = useState<number | null>(null);
  const [cuentaId, setCuentaId] = useState<number | null>(null);
  const [cuentaMovs, setCuentaMovs] = useState<CuentaMovimientoItem[]>([]);

  const [diario, setDiario] = useState<DiarioItem[]>([]);
  const [loadingDiario, setLoadingDiario] = useState(false);
  const [diarioInicio, setDiarioInicio] = useState('');
  const [diarioFin, setDiarioFin] = useState('');
  const [diarioInclPend, setDiarioInclPend] = useState(true);

  const [esperado, setEsperado] = useState<EsperadoDiarioItem[]>([]);
  const [loadingEsperado, setLoadingEsperado] = useState(false);

  const [grupos, setGrupos] = useState<any[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [grupoDetalle, setGrupoDetalle] = useState<any | null>(null);
  const [grupoDetalleLoading, setGrupoDetalleLoading] = useState(false);
  const [grupoPagoId, setGrupoPagoId] = useState<string>('all');
  const [pendientesPorEstudiante, setPendientesPorEstudiante] = useState<any[]>([]);
  const [loadingPendientesPorEstudiante, setLoadingPendientesPorEstudiante] = useState(false);
  const [selectedEstudianteDetalle, setSelectedEstudianteDetalle] = useState<SelectedEstudianteDetalle | null>(null);
  const [detalleEstudiante, setDetalleEstudiante] = useState<any | null>(null);
  const [loadingDetalleEstudiante, setLoadingDetalleEstudiante] = useState(false);
  const [sesionDetalle, setSesionDetalle] = useState<any | null>(null);
  const [sesionDetalleOpen, setSesionDetalleOpen] = useState(false);

  const [grupoCobroOpen, setGrupoCobroOpen] = useState(false);
  const [grupoCobroSaving, setGrupoCobroSaving] = useState(false);
  const [grupoCobroTarget, setGrupoCobroTarget] = useState<any | null>(null);
  const [grupoCobroForm, setGrupoCobroForm] = useState<PagoFormState>({
    monto: 0,
    fecha_pago: todayISO(),
    metodo: 'sinpe',
    numero_comprobante: '',
    fecha_comprobante: todayISO(),
    referencia: '',
    detalle: '',
  });
  const [grupoCobroResult, setGrupoCobroResult] = useState<any | null>(null);
  const [grupoCobroError, setGrupoCobroError] = useState<string | null>(null);

  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoSaving, setPagoSaving] = useState(false);
  const [pagoTarget, setPagoTarget] = useState<EncargadoResumenItem | null>(null);
  const [pagoForm, setPagoForm] = useState<PagoFormState>({
    monto: 0,
    fecha_pago: todayISO(),
    metodo: 'sinpe',
    numero_comprobante: '',
    fecha_comprobante: todayISO(),
    referencia: '',
    detalle: '',
  });
  const [pagoFile, setPagoFile] = useState<File | null>(null);
  const [pagoResult, setPagoResult] = useState<any | null>(null);
  const [encObligaciones, setEncObligaciones] = useState<ObligacionPendienteItem[]>([]);
  const [encObligacionesLoading, setEncObligacionesLoading] = useState(false);
  const [encPagoDetallesOpen, setEncPagoDetallesOpen] = useState(false);

  const [tutorPagoOpen, setTutorPagoOpen] = useState(false);
  const [tutorPagoSaving, setTutorPagoSaving] = useState(false);
  const [tutorPagoTarget, setTutorPagoTarget] = useState<TutorResumenItem | null>(null);
  const [tutorPagoForm, setTutorPagoForm] = useState<PagoFormState>({
    monto: 0,
    fecha_pago: todayISO(),
    metodo: 'sinpe',
    numero_comprobante: '',
    fecha_comprobante: todayISO(),
    referencia: '',
    detalle: '',
  });
  const [tutorPagoFile, setTutorPagoFile] = useState<File | null>(null);
  const [tutorPagoResult, setTutorPagoResult] = useState<any | null>(null);
  const [tutorPagoError, setTutorPagoError] = useState<string | null>(null);
  const [tutorObligaciones, setTutorObligaciones] = useState<ObligacionPendienteItem[]>([]);
  const [tutorObligacionesLoading, setTutorObligacionesLoading] = useState(false);
  const [tutorObligacionesSeleccionadas, setTutorObligacionesSeleccionadas] = useState<number[]>([]);
  const [tutorPagoDetallesOpen, setTutorPagoDetallesOpen] = useState(false);
  const [cuentaDetalleOpen, setCuentaDetalleOpen] = useState(false);
  const [cuentaDetalleItem, setCuentaDetalleItem] = useState<CuentaMovimientoItem | null>(null);


  const loadEncargados = async () => {
    setLoadingEnc(true);
    try {
      const res = await api.tesoreria.getEncargadosResumen();
      const rows = (res?.encargados || []) as EncargadoResumenItem[];
      setEncargados(rows);
      setSelectedEncargadoId((prev) => {
        if (prev != null && rows.some((x) => x.encargado_id === prev)) return prev;
        return rows.length ? rows[0].encargado_id : null;
      });
    } catch {
      setEncargados([]);
      setSelectedEncargadoId(null);
    } finally {
      setLoadingEnc(false);
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

  const loadPendientesPorEstudiante = async () => {
    setLoadingPendientesPorEstudiante(true);
    try {
      const res = await api.pagos.getPendientesResumenEstudiantes();
      setPendientesPorEstudiante((res?.estudiantes || []) as any[]);
    } catch {
      setPendientesPorEstudiante([]);
    } finally {
      setLoadingPendientesPorEstudiante(false);
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
      setDetalleEstudiante({ error: err?.response?.data?.error || err?.message || 'Error cargando detalle' });
    } finally {
      setLoadingDetalleEstudiante(false);
    }
  };

  const openEstudianteDetalleBulk = async (estudiante_bulk_id: number, estudiante_nombre: string) => {
    setSelectedEstudianteDetalle({ estudiante_id: null, estudiante_bulk_id, estudiante_nombre });
    setDetalleEstudiante(null);
    setLoadingDetalleEstudiante(true);
    try {
      const res = await api.pagos.getPendientesDetalleEstudiante({ estudiante_bulk_id });
      setDetalleEstudiante(res);
    } catch (err: any) {
      setDetalleEstudiante({ error: err?.response?.data?.error || err?.message || 'Error cargando detalle' });
    } finally {
      setLoadingDetalleEstudiante(false);
    }
  };

  const openSesionDetalle = (payload: any) => {
    setSesionDetalle(payload);
    setSesionDetalleOpen(true);
  };

  const openGruppoCobro = async (grupo: any, detalle?: any) => {
    if (!grupo?.id) return;
    
    setGrupoCobroSaving(true);
    try {
      // Obtener datos frescos del grupo para asegurar que tenemos los costos correctos
      const grupoData = await api.bulk.getGrupo(String(grupo.id));
      const costoCurso = Number(grupoData?.grupo?.costo_curso) || 0;
      const pagoTutor = Number(grupoData?.grupo?.pago_tutor) || 0;
      
      setGrupoCobroTarget({
        ...grupo,
        costo_curso: costoCurso,
        pago_tutor: pagoTutor,
      });
      setGrupoCobroForm({
        monto: 0,
        fecha_pago: todayISO(),
        metodo: 'sinpe',
        numero_comprobante: '',
        fecha_comprobante: todayISO(),
        referencia: '',
        detalle: '',
      });
      setGrupoDetalle(grupoData);
      setGrupoCobroResult(null);
      setGrupoCobroError(null);
      setGrupoCobroOpen(true);
    } catch (err: any) {
      setGrupoCobroError(err?.message || 'Error cargando datos del grupo');
    } finally {
      setGrupoCobroSaving(false);
    }
  };


  const registrarCobroGrupal = async () => {
    if (!grupoCobroTarget) return;
    
    setGrupoCobroSaving(true);
    setGrupoCobroError(null);
    setGrupoCobroResult(null);

    try {
      const result = await api.tesoreria.registrarCobroGrupal(grupoCobroTarget.id, {});

      setGrupoCobroResult(result);
      
      // Recargar datos
      await Promise.all([
        loadTotalesRapidos(),
        loadPendientesPorEstudiante(),
        loadGrupos(),
      ]);

      // Cerrar modal en 2 segundos
      setTimeout(() => {
        setGrupoCobroOpen(false);
      }, 1500);
    } catch (err: any) {
      setGrupoCobroError(err?.response?.data?.error || err?.message || 'Error registrando cobro');
    } finally {
      setGrupoCobroSaving(false);
    }
  };

  const loadTutores = async () => {
    setLoadingTut(true);
    try {
      const res = await api.tesoreria.getTutoresResumen();
      const rows = (res?.tutores || []) as TutorResumenItem[];
      setTutores(rows);
      setSelectedTutorId((prev) => {
        if (prev != null && rows.some((x) => x.tutor_id === prev)) return prev;
        return rows.length ? rows[0].tutor_id : null;
      });
    } catch {
      setTutores([]);
      setSelectedTutorId(null);
    } finally {
      setLoadingTut(false);
    }
  };

  const loadBolsa = async () => {
    setLoadingBolsa(true);
    try {
      const res = await api.tesoreria.getBolsa();
      console.debug('TESORERIA: getBolsa response', res);
      // Normalizar la forma de la respuesta: algunos endpoints devuelven { bolsa: { ... } }
      // y otros devuelven los campos en la raíz { bolsa_real, debe_real, haber_real }.
      let normalized: BolsaInfo | null = null;
      const root = res || {};
      if (root?.bolsa) {
        const b = root.bolsa;
        normalized = {
          bolsa_real: Number(b?.bolsa_real) || 0,
          debe_real: Number(b?.debe_real) || 0,
          haber_real: Number(b?.haber_real) || 0,
        };
      } else if (typeof root?.bolsa_real !== 'undefined' || typeof root?.debe_real !== 'undefined' || typeof root?.haber_real !== 'undefined') {
        normalized = {
          bolsa_real: Number(root?.bolsa_real) || 0,
          debe_real: Number(root?.debe_real) || 0,
          haber_real: Number(root?.haber_real) || 0,
        };
      } else {
        // no hay datos reconocibles
        normalized = null;
      }
      setBolsa(normalized);
    } catch {
      setBolsa(null);
    } finally {
      setLoadingBolsa(false);
    }
  };

  const loadTotalesRapidos = async () => {
    setLoadingTotales(true);
    try {
      const res = await api.tesoreria.getResumen();
      setTotalesRapidos({
        deudaPendiente: res?.deudaPendiente || 0,
        saldoAFavor: res?.saldoAFavor || 0,
        porPagarTutores: res?.porPagarTutores || 0,
      });
    } catch {
      setTotalesRapidos({
        deudaPendiente: 0,
        saldoAFavor: 0,
        porPagarTutores: 0,
      });
    } finally {
      setLoadingTotales(false);
    }
  };

  const loadDiario = async () => {
    setLoadingDiario(true);
    try {
      const res = await api.tesoreria.getDiario({
        fecha_inicio: diarioInicio || undefined,
        fecha_fin: diarioFin || undefined,
        incluir_pendientes: diarioInclPend ? 1 : 0,
      });
      setDiario((res?.movimientos || []) as DiarioItem[]);
    } catch {
      setDiario([]);
    } finally {
      setLoadingDiario(false);
    }
  };

  const loadHistorialEncargado = async (encargadoId: number | null) => {
    if (!encargadoId) {
      setHistEnc([]);
      return;
    }
    setLoadingHistEnc(true);
    try {
      const res = await api.tesoreria.getDiario({
        encargado_id: encargadoId,
        incluir_pendientes: 1,
        order: 'desc',
        limit: 15,
      });
      setHistEnc((res?.movimientos || []) as DiarioItem[]);
    } catch {
      setHistEnc([]);
    } finally {
      setLoadingHistEnc(false);
    }
  };

  const loadHistorialTutor = async (tutorId: number | null) => {
    if (!tutorId) {
      setHistTut([]);
      return;
    }
    setLoadingHistTut(true);
    try {
      const res = await api.tesoreria.getDiario({
        tutor_id: tutorId,
        incluir_pendientes: 1,
        order: 'desc',
        limit: 15,
      });
      setHistTut((res?.movimientos || []) as DiarioItem[]);
    } catch {
      setHistTut([]);
    } finally {
      setLoadingHistTut(false);
    }
  };

  const openAplicaciones = async (pagoId: number) => {
    if (!Number.isFinite(pagoId) || pagoId <= 0) return;
    setAppsOpen(true);
    setAppsLoading(true);
    setAppsPago(null);
    setApps([]);
    try {
      const res = await api.tesoreria.getPagoAplicaciones(pagoId);
      setAppsPago(res?.pago ?? null);
      setApps((res?.aplicaciones ?? []) as PagoAplicacionItem[]);
    } catch {
      setAppsPago(null);
      setApps([]);
    } finally {
      setAppsLoading(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const openCuentaMovimientosEncargado = async (enc: EncargadoResumenItem) => {
    const encargadoId = Number(enc.encargado_id);
    if (!Number.isFinite(encargadoId) || encargadoId <= 0) return;
    setCuentaOpen(true);
    setCuentaLoading(true);
    setCuentaTitle(`Libro auxiliar — ${enc.encargados?.nombre || `Encargado #${encargadoId}`}`);
    setCuentaKind('encargado');
    setCuentaPersonaId(encargadoId);
    setCuentaId(null);
    setCuentaMovs([]);
    try {
      const res = await api.tesoreria.getCuentaMovimientosEncargado(encargadoId, {
        fecha_inicio: diarioInicio || undefined,
        fecha_fin: diarioFin || undefined,
        incluir_pendientes: 1,
      });
      setCuentaId(Number(res?.cuenta_id) || null);
      setCuentaMovs((res?.movimientos || []) as CuentaMovimientoItem[]);
    } catch (err: any) {
      setCuentaId(null);
      setCuentaMovs([]);
      alert(err?.response?.data?.error || err?.message || 'Error cargando libro auxiliar');
    } finally {
      setCuentaLoading(false);
    }
  };

  const openCuentaMovimientosTutor = async (tut: TutorResumenItem) => {
    const tutorId = Number(tut.tutor_id);
    if (!Number.isFinite(tutorId) || tutorId <= 0) return;
    setCuentaOpen(true);
    setCuentaLoading(true);
    setCuentaTitle(`Libro auxiliar — ${tut.tutores?.nombre || `Tutor #${tutorId}`}`);
    setCuentaKind('tutor');
    setCuentaPersonaId(tutorId);
    setCuentaId(null);
    setCuentaMovs([]);
    try {
      const res = await api.tesoreria.getCuentaMovimientosTutor(tutorId, {
        fecha_inicio: diarioInicio || undefined,
        fecha_fin: diarioFin || undefined,
        incluir_pendientes: 1,
      });
      setCuentaId(Number(res?.cuenta_id) || null);
      setCuentaMovs((res?.movimientos || []) as CuentaMovimientoItem[]);
    } catch (err: any) {
      setCuentaId(null);
      setCuentaMovs([]);
      alert(err?.response?.data?.error || err?.message || 'Error cargando libro auxiliar');
    } finally {
      setCuentaLoading(false);
    }
  };

  const exportDiarioXlsx = async () => {
    try {
      const blob = await api.tesoreria.exportDiarioXlsx({
        fecha_inicio: diarioInicio || undefined,
        fecha_fin: diarioFin || undefined,
        incluir_pendientes: diarioInclPend ? 1 : 0,
        order: 'asc',
      });
      downloadBlob(blob, `tesoreria_diario_${(diarioInicio || 'inicio')}-${(diarioFin || 'fin')}.xlsx`);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error exportando XLSX');
    }
  };

  const exportCuentaXlsx = async () => {
    if (!cuentaId) {
      alert('Cuenta inválida para exportar');
      return;
    }
    try {
      const blob = await api.tesoreria.exportCuentaXlsx(cuentaId, {
        fecha_inicio: diarioInicio || undefined,
        fecha_fin: diarioFin || undefined,
        incluir_pendientes: 1,
        order: 'asc',
      });
      downloadBlob(blob, `tesoreria_cuenta_${cuentaId}.xlsx`);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error exportando XLSX');
    }
  };

  const loadEsperado = async () => {
    setLoadingEsperado(true);
    try {
      const res = await api.tesoreria.getEsperadoDiario({
        fecha_inicio: diarioInicio || undefined,
        fecha_fin: diarioFin || undefined,
      });
      setEsperado((res?.esperado || []) as EsperadoDiarioItem[]);
    } catch {
      setEsperado([]);
    } finally {
      setLoadingEsperado(false);
    }
  };

  useEffect(() => {
    loadEncargados();
    loadBolsa();
    loadTutores();
    void loadTotalesRapidos();
    void loadGrupos();
    void loadPendientesPorEstudiante();
  }, []);

  useEffect(() => {
    loadHistorialEncargado(selectedEncargadoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEncargadoId]);

  // Cargar obligaciones del encargado seleccionado para poder mostrar el desglose
  useEffect(() => {
    const id = selectedEncargadoId;
    if (id == null) {
      setEncObligaciones([]);
      return;
    }

    setEncObligacionesLoading(true);
    void (async () => {
      try {
        const res = await api.tesoreria.getObligacionesEncargado(id);
        setEncObligaciones((res?.obligaciones || []) as ObligacionPendienteItem[]);
      } catch {
        setEncObligaciones([]);
      } finally {
        setEncObligacionesLoading(false);
      }
    })();
  }, [selectedEncargadoId]);

  useEffect(() => {
    loadHistorialTutor(selectedTutorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTutorId]);

  useEffect(() => {
    const encargadoId = pagoTarget?.encargado_id;
    if (!pagoOpen || !encargadoId) return;

    setEncObligacionesLoading(true);
    void (async () => {
      try {
        const res = await api.tesoreria.getObligacionesEncargado(encargadoId);
        setEncObligaciones((res?.obligaciones || []) as ObligacionPendienteItem[]);
      } catch {
        setEncObligaciones([]);
      } finally {
        setEncObligacionesLoading(false);
      }
    })();
  }, [pagoOpen, pagoTarget?.encargado_id]);

  useEffect(() => {
    const tutorId = tutorPagoTarget?.tutor_id;
    if (!tutorPagoOpen || !tutorId) return;

    setTutorObligacionesLoading(true);
    void (async () => {
      try {
        const res = await api.tesoreria.getObligacionesTutor(tutorId);
        setTutorObligaciones((res?.obligaciones || []) as ObligacionPendienteItem[]);
      } catch {
        setTutorObligaciones([]);
      } finally {
        setTutorObligacionesLoading(false);
      }
    })();
  }, [tutorPagoOpen, tutorPagoTarget?.tutor_id]);

  useEffect(() => {
    if (!tutorPagoOpen) return;
    const ids = new Set(tutorObligacionesSeleccionadas);
    const total = tutorObligaciones
      .filter((o) => ids.has(o.id))
      .reduce((acc, o) => acc + (Number(o.restante) || 0), 0);
    setTutorPagoForm((p) => ({ ...p, monto: total }));
  }, [tutorObligaciones, tutorObligacionesSeleccionadas, tutorPagoOpen]);

  useEffect(() => {
    if (grupoPagoId === 'all') {
      setGrupoDetalle(null);
      return;
    }

    setGrupoDetalleLoading(true);
    void (async () => {
      try {
        const res = await api.bulk.getGrupo(String(grupoPagoId));
        setGrupoDetalle(res);
      } catch {
        setGrupoDetalle(null);
      } finally {
        setGrupoDetalleLoading(false);
      }
    })();
  }, [grupoPagoId]);

  const openPago = (item: EncargadoResumenItem) => {
    setPagoTarget(item);
    setPagoResult(null);
    setPagoFile(null);
    setEncObligaciones([]);
    setEncPagoDetallesOpen(false);
    setPagoForm({
      monto: 0,
      fecha_pago: todayISO(),
      metodo: 'sinpe',
      numero_comprobante: '',
      fecha_comprobante: todayISO(),
      referencia: '',
      detalle: '',
    });
    setPagoOpen(true);
  };

  const openTutorPago = (item: TutorResumenItem) => {
    setTutorPagoTarget(item);
    setTutorPagoResult(null);
    setTutorPagoError(null);
    setTutorPagoFile(null);
    setTutorObligaciones([]);
    setTutorObligacionesSeleccionadas([]);
    setTutorPagoDetallesOpen(false);
    setTutorPagoForm({
      monto: 0,
      fecha_pago: todayISO(),
      metodo: 'sinpe',
      numero_comprobante: '',
      fecha_comprobante: todayISO(),
      referencia: '',
      detalle: '',
    });
    setTutorPagoOpen(true);
  };

  const savePago = async () => {
    if (!pagoTarget) return;
    if (!pagoForm.monto || pagoForm.monto <= 0) {
      alert('Monto debe ser mayor a 0');
      return;
    }

    const metodo = (pagoForm.metodo || '').trim().toLowerCase();
    const requiereEvidencia = metodo !== 'efectivo';

    if (requiereEvidencia) {
      if (!pagoForm.numero_comprobante.trim()) {
        alert('Número de comprobante es requerido');
        return;
      }
      if (!pagoForm.fecha_comprobante) {
        alert('Fecha de comprobante es requerida');
        return;
      }
      if (!pagoFile) {
        alert('Comprobante (imagen/PDF) es requerido para pagos no-efectivo');
        return;
      }
    }

    setPagoSaving(true);
    setPagoResult(null);
    try {
      const result = await api.tesoreria.registrarPagoEncargado(pagoTarget.encargado_id, {
        monto: pagoForm.monto,
        fecha_pago: pagoForm.fecha_pago,
        metodo: pagoForm.metodo,
        numero_comprobante: pagoForm.numero_comprobante || undefined,
        fecha_comprobante: pagoForm.fecha_comprobante || undefined,
        referencia: pagoForm.referencia || undefined,
        detalle: pagoForm.detalle || undefined,
      });

      const pagoId = Number(result?.pago_id);

      // Si es efectivo, podemos completar sin evidencia
      if (pagoId && metodo === 'efectivo') {
        await api.tesoreria.updatePago(pagoId, {
          metodo: pagoForm.metodo,
          referencia: pagoForm.referencia || undefined,
          detalle: pagoForm.detalle || undefined,
          estado: 'completado',
        });
      }

      // Si hay archivo, lo subimos y luego marcamos completado
      if (pagoFile && pagoId) {
        await api.tesoreria.uploadComprobantePago(pagoId, pagoFile);
        await api.tesoreria.updatePago(pagoId, {
          metodo: pagoForm.metodo,
          numero_comprobante: pagoForm.numero_comprobante || undefined,
          fecha_comprobante: pagoForm.fecha_comprobante || undefined,
          referencia: pagoForm.referencia || undefined,
          detalle: pagoForm.detalle || undefined,
          estado: 'completado',
        });
      }

      setPagoResult(result);
      await loadEncargados();
      await loadBolsa();
      await loadTotalesRapidos();

      // Refrescar obligaciones pendientes (para que las ya cubiertas no sigan saliendo como pendientes)
      try {
        const res = await api.tesoreria.getObligacionesEncargado(pagoTarget.encargado_id);
        setEncObligaciones((res?.obligaciones || []) as ObligacionPendienteItem[]);
      } catch {
        // noop
      }
      setPagoOpen(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error registrando pago');
    } finally {
      setPagoSaving(false);
    }
  };

  const saveTutorPago = async () => {
    if (!tutorPagoTarget) return;
    setTutorPagoError(null);
    if (!tutorObligacionesSeleccionadas.length) {
      setTutorPagoError('Selecciona al menos una sesión/obligación a pagar.');
      return;
    }
    if (!tutorPagoForm.monto || tutorPagoForm.monto <= 0) {
      setTutorPagoError('Monto debe ser mayor a 0.');
      return;
    }

    const metodo = (tutorPagoForm.metodo || '').trim().toLowerCase();
    const requiereEvidencia = metodo !== 'efectivo';
    if (requiereEvidencia) {
      if (!tutorPagoForm.numero_comprobante.trim()) {
        setTutorPagoError('Número de comprobante es requerido.');
        return;
      }
      if (!tutorPagoForm.fecha_comprobante) {
        setTutorPagoError('Fecha de comprobante es requerida.');
        return;
      }
      if (!tutorPagoFile) {
        setTutorPagoError('Comprobante (imagen/PDF) es requerido para pagos no-efectivo.');
        return;
      }
    }

    setTutorPagoSaving(true);
    setTutorPagoResult(null);
    try {
      const result = await api.tesoreria.registrarPagoTutor(tutorPagoTarget.tutor_id, {
        monto: tutorPagoForm.monto,
        fecha_pago: tutorPagoForm.fecha_pago,
        metodo: tutorPagoForm.metodo,
        numero_comprobante: tutorPagoForm.numero_comprobante || undefined,
        fecha_comprobante: tutorPagoForm.fecha_comprobante || undefined,
        referencia: tutorPagoForm.referencia || undefined,
        detalle: tutorPagoForm.detalle || undefined,
        funding_mode: 'sistema',
        obligacion_ids: tutorObligacionesSeleccionadas,
      });

      const pagoId = Number(result?.pago_id);

      // Si es efectivo, podemos completar sin evidencia
      if (pagoId && metodo === 'efectivo') {
        await api.tesoreria.updatePago(pagoId, {
          metodo: tutorPagoForm.metodo,
          referencia: tutorPagoForm.referencia || undefined,
          detalle: tutorPagoForm.detalle || undefined,
          estado: 'completado',
        });
      }

      if (tutorPagoFile && pagoId) {
        await api.tesoreria.uploadComprobantePago(pagoId, tutorPagoFile);
        await api.tesoreria.updatePago(pagoId, {
          metodo: tutorPagoForm.metodo,
          numero_comprobante: tutorPagoForm.numero_comprobante || undefined,
          fecha_comprobante: tutorPagoForm.fecha_comprobante || undefined,
          referencia: tutorPagoForm.referencia || undefined,
          detalle: tutorPagoForm.detalle || undefined,
          estado: 'completado',
        });
      }

      setTutorPagoResult(result);
      await loadTutores();
      await loadBolsa();
      await loadTotalesRapidos();

      // Refrescar pendientes y limpiar selección/detalles
      try {
        const res = await api.tesoreria.getObligacionesTutor(tutorPagoTarget.tutor_id);
        setTutorObligaciones((res?.obligaciones || []) as ObligacionPendienteItem[]);
      } catch {
        // noop
      }
      setTutorObligacionesSeleccionadas([]);
      setTutorPagoDetallesOpen(false);
      setTutorPagoOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Error pagando tutor';
      const closedMatch = String(msg).match(/Periodo cerrado:[^\n]*fecha\s*<=\s*(\d{4}-\d{2}-\d{2})/i);
      if (closedMatch?.[1]) {
        setTutorPagoError(
          `Periodo cerrado: no se permite modificar movimientos con fecha <= ${closedMatch[1]}\n\n` +
          `Cambia la fecha del pago y/o comprobante a una posterior.`
        );
      } else if (/bolsa/i.test(String(msg)) && /insuf/i.test(String(msg))) {
        setTutorPagoError(
          `${String(msg)}\n\n` +
          `Opciones: registra ingresos primero o reduce las sesiones seleccionadas.`
        );
      } else {
        setTutorPagoError(String(msg));
      }
    } finally {
      setTutorPagoSaving(false);
    }
  };

  const encObligacionesPreview = useMemo(() => {
    let rem = Number(pagoForm.monto) || 0;
    return encObligaciones.map((o) => {
      const restante = Number(o.restante) || 0;
      const aplicar = Math.max(0, Math.min(rem, restante));
      rem -= aplicar;
      return {
        ...o,
        _preview_aplicar: aplicar,
        _preview_queda: restante - aplicar,
      };
    });
  }, [encObligaciones, pagoForm.monto]);

  const encObligacionesResumen = useMemo(() => {
    // COMPENSACIÓN: usar datos de la vista (pagoTarget) en vez de obligaciones crudas
    if (pagoTarget) {
      const deuda = Number(pagoTarget.deuda_pendiente) || 0;
      const saldo = Number(pagoTarget.saldo_a_favor) || 0;
      const balance = deuda - saldo;
      
      // Solo contar si realmente debe (balance > 0)
      if (balance > 0) {
        return { count: encObligaciones.filter(o => (Number(o.restante) || 0) > 0).length, totalRestante: balance };
      }
      return { count: 0, totalRestante: 0 };
    }
    
    // Fallback: calcular desde obligaciones (sin compensación)
    const pendientes = encObligaciones.filter((o) => (Number(o.restante) || 0) > 0);
    const totalRestante = pendientes.reduce((acc, o) => acc + (Number(o.restante) || 0), 0);
    return { count: pendientes.length, totalRestante };
  }, [encObligaciones, pagoTarget]);

  const tutorObligacionesSeleccionTotal = useMemo(() => {
    const ids = new Set(tutorObligacionesSeleccionadas);
    return tutorObligaciones.filter((o) => ids.has(o.id)).reduce((acc, o) => acc + (Number(o.restante) || 0), 0);
  }, [tutorObligaciones, tutorObligacionesSeleccionadas]);

  const tutorObligacionesSeleccionList = useMemo(() => {
    const ids = new Set(tutorObligacionesSeleccionadas);
    return tutorObligaciones
      .filter((o) => ids.has(o.id))
      .slice()
      .sort((a, b) => String(a.fecha_devengo || '').localeCompare(String(b.fecha_devengo || '')));
  }, [tutorObligaciones, tutorObligacionesSeleccionadas]);


  const comparativoDiario = useMemo(() => {
    const realMap = new Map<string, { debe: number; haber: number }>();
    for (const m of diario) {
      const fecha = (m.fecha_pago || '').slice(0, 10);
      if (!fecha) continue;
      const prev = realMap.get(fecha) || { debe: 0, haber: 0 };
      realMap.set(fecha, {
        debe: prev.debe + (Number(m.debe) || 0),
        haber: prev.haber + (Number(m.haber) || 0),
      });
    }

    const esperadoMap = new Map<string, { debe: number; haber: number }>();
    for (const e of esperado) {
      const fecha = (e.fecha || '').slice(0, 10);
      if (!fecha) continue;
      const prev = esperadoMap.get(fecha) || { debe: 0, haber: 0 };
      esperadoMap.set(fecha, {
        debe: prev.debe + (Number(e.debe_esperado) || 0),
        haber: prev.haber + (Number(e.haber_esperado) || 0),
      });
    }

    const fechas = Array.from(new Set([...realMap.keys(), ...esperadoMap.keys()])).sort();
    return fechas.map((fecha) => {
      const real = realMap.get(fecha) || { debe: 0, haber: 0 };
      const esp = esperadoMap.get(fecha) || { debe: 0, haber: 0 };
      return {
        fecha,
        realDebe: real.debe,
        realHaber: real.haber,
        espDebe: esp.debe,
        espHaber: esp.haber,
      };
    });
  }, [diario, esperado]);

  const diarioTotals = useMemo(() => {
    const totalDebe = diario.reduce((acc, x) => acc + (Number(x.debe) || 0), 0);
    const totalHaber = diario.reduce((acc, x) => acc + (Number(x.haber) || 0), 0);
    const neto = totalDebe - totalHaber;
    const saldoFinal = diario.length ? Number(diario[diario.length - 1].saldo_acumulado) || 0 : 0;
    return { totalDebe, totalHaber, neto, saldoFinal };
  }, [diario]);

  const selectedEnc = useMemo(() => {
    if (selectedEncargadoId == null) return null;
    return encargados.find((x) => x.encargado_id === selectedEncargadoId) || null;
  }, [encargados, selectedEncargadoId]);

  const selectedTut = useMemo(() => {
    if (selectedTutorId == null) return null;
    return tutores.find((x) => x.tutor_id === selectedTutorId) || null;
  }, [tutores, selectedTutorId]);

  const selectedEstudianteResumen = useMemo(() => {
    if (!selectedEstudianteDetalle) return null;
    if (selectedEstudianteDetalle.estudiante_id != null) {
      return (pendientesPorEstudiante || []).find(
        (e: any) => Number(e.estudiante_id) === Number(selectedEstudianteDetalle.estudiante_id)
      ) || null;
    }
    if (selectedEstudianteDetalle.estudiante_bulk_id != null) {
      return (pendientesPorEstudiante || []).find(
        (e: any) => Number(e.estudiante_bulk_id) === Number(selectedEstudianteDetalle.estudiante_bulk_id)
      ) || null;
    }
    return null;
  }, [pendientesPorEstudiante, selectedEstudianteDetalle]);

  const pendientesByEstudiante = useMemo(() => {
    const map = new Map<number, any>();
    for (const e of pendientesPorEstudiante || []) {
      const id = Number(e?.estudiante_id);
      if (Number.isFinite(id)) map.set(id, e);
    }
    return map;
  }, [pendientesPorEstudiante]);

  const pendientesByBulk = useMemo(() => {
    const map = new Map<number, any>();
    for (const e of pendientesPorEstudiante || []) {
      const id = Number(e?.estudiante_bulk_id);
      if (Number.isFinite(id)) map.set(id, e);
    }
    return map;
  }, [pendientesPorEstudiante]);

  const grupoPagoRows = useMemo(() => {
    if (grupoPagoId === 'all') return [] as any[];
    const normales = grupoDetalle?.estudiantes?.normales || [];
    const bulk = grupoDetalle?.estudiantes?.bulk || [];
    const rows: any[] = [];

    for (const n of normales) {
      const id = Number(n?.id);
      const pendiente = pendientesByEstudiante.get(id) || null;
      rows.push({
        key: `n-${id}`,
        estudiante_id: id,
        estudiante_nombre: n?.nombre || pendiente?.estudiante_nombre || `Estudiante #${id}`,
        total_pendiente: Number(pendiente?.total_pendiente) || 0,
        is_bulk: false,
      });
    }

    for (const b of bulk) {
      const bid = Number(b?.id);
      const pendiente = pendientesByBulk.get(bid) || null;
      rows.push({
        key: `b-${bid}`,
        estudiante_bulk_id: bid,
        estudiante_nombre: b?.nombre || pendiente?.estudiante_nombre || `Estudiante bulk #${bid}`,
        total_pendiente: Number(pendiente?.total_pendiente) || 0,
        is_bulk: true,
      });
    }

    return rows.sort((a, b) => String(a.estudiante_nombre || '').localeCompare(String(b.estudiante_nombre || '')));
  }, [grupoPagoId, grupoDetalle, pendientesByEstudiante, pendientesByBulk]);

  const grupoPagoTotal = useMemo(() => {
    return grupoPagoRows.reduce((acc: number, r: any) => acc + (Number(r.total_pendiente) || 0), 0);
  }, [grupoPagoRows]);

  const encargadosById = useMemo(() => {
    const map = new Map<number, EncargadoResumenItem>();
    for (const enc of encargados || []) {
      const id = Number(enc.encargado_id);
      if (Number.isFinite(id)) map.set(id, enc);
    }
    return map;
  }, [encargados]);

  const gruposOptions = useMemo(() => {
    if ((grupos || []).length) return grupos;
    const ids = new Set(
      (pendientesPorEstudiante || [])
        .map((e: any) => e?.matricula_grupo_id)
        .filter((id: any) => id != null && String(id).trim() !== '')
        .map((id: any) => String(id))
    );
    return Array.from(ids).map((id) => ({ id, nombre_grupo: `Grupo #${id}` }));
  }, [grupos, pendientesPorEstudiante]);

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/10 pb-10">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none">
            Control de <span className="text-[#00AEEF]">Tesorería</span>
          </h1>
          <p className="text-slate-300 font-medium mt-3">Cuentas por encargado/tutor, FIFO, evidencia y diario real vs esperado.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            className="gap-2 h-12"
            onClick={async () => {
              await loadEncargados();
              await loadTutores();
              await loadBolsa();
              await loadTotalesRapidos();
            }}
            disabled={loadingEnc || loadingTut || loadingBolsa || loadingTotales}
          >
            {(loadingEnc || loadingTut || loadingBolsa || loadingTotales) ? 'Refrescando…' : 'Refrescar'}
          </Button>
          <Button
            variant="primary"
            className="h-12 px-8 font-bold"
            onClick={async () => {
              setTab('diario');
              await loadDiario();
              await loadEsperado();
              await loadBolsa();
            }}
            disabled={loadingDiario || loadingEsperado || loadingBolsa}
          >
            Diario + Tabla
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button variant={tab === 'encargados' ? 'primary' : 'outline'} className="h-12" onClick={() => setTab('encargados')}>Encargados</Button>
            <Button variant={tab === 'tutores' ? 'primary' : 'outline'} className="h-12" onClick={() => setTab('tutores')}>Tutores</Button>
            <Button variant={tab === 'diario' ? 'primary' : 'outline'} className="h-12" onClick={() => setTab('diario')}>Diario</Button>
          </div>

          {tab === 'encargados' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-7">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-black text-white">Encargados</h2>
                    <div className="text-xs text-slate-300">Selecciona uno para ver detalle y acciones</div>
                  </div>
                  <Button variant="outline" onClick={async () => { await loadEncargados(); await loadBolsa(); await loadTotalesRapidos(); }} disabled={loadingEnc || loadingBolsa || loadingTotales}>
                    {(loadingEnc || loadingBolsa || loadingTotales) ? 'Cargando…' : 'Refrescar'}
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Encargado</TableHead>
                      <TableHead className="text-right">Deuda</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {encargados.map((x) => {
                      const selected = selectedEncargadoId === x.encargado_id;
                      return (
                        <TableRow
                          key={x.cuenta_id || `encargado-${x.encargado_id}`}
                          className={`${selected ? 'border-[#00AEEF]/60 bg-white/5' : ''} cursor-pointer`}
                          onClick={() => setSelectedEncargadoId(x.encargado_id)}
                        >
                          <TableCell className="font-semibold">
                            <div className="text-white font-black truncate">{x.encargados?.nombre || `Encargado #${x.encargado_id}`}</div>
                            <div className="text-[11px] text-slate-300 truncate">{[x.encargados?.email, x.encargados?.telefono].filter(Boolean).join(' • ')}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatCRC(Number(x.deuda_pendiente) || 0)}</TableCell>
                          <TableCell className="text-right">{formatCRC(Number(x.saldo_a_favor) || 0)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!loadingEnc && encargados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-slate-500">Sin datos</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>

              <Card className="p-6 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-white">Detalle</div>
                    <div className="text-xs text-slate-300">Acciones y resumen del seleccionado</div>
                  </div>
                  {selectedEnc ? (
                    <div className="flex gap-2">
                      <Button variant="primary" className="h-11" onClick={() => openPago(selectedEnc)}>Registrar pago</Button>
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() => setEncPagoDetallesOpen((v) => !v)}
                        disabled={!selectedEnc}
                      >
                        {encPagoDetallesOpen ? 'Ocultar detalle de clases' : 'Ver detalle de clases'}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {!selectedEnc ? (
                  <div className="mt-6 text-sm text-slate-300">Selecciona un encargado para ver su detalle.</div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div>
                      <div className="text-lg font-black text-white">
                        {selectedEnc.encargados?.nombre || `Encargado #${selectedEnc.encargado_id}`}
                      </div>
                      <div className="text-xs text-slate-300">
                        {selectedEnc.encargados?.email || ''} {selectedEnc.encargados?.telefono ? `• ${selectedEnc.encargados.telefono}` : ''}
                      </div>
                    </div>

                    {/* TARJETA ÚNICA CON COMPENSACIÓN AUTOMÁTICA */}
                    <div className={`rounded-2xl border p-4 ${
                      selectedEnc.estado === 'deuda' 
                        ? 'border-red-500/30 bg-red-500/5' 
                        : selectedEnc.estado === 'saldo_favor'
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-blue-500/30 bg-blue-500/5'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {selectedEnc.estado === 'deuda' && (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-red-400 font-bold uppercase tracking-wider">🔴 Deuda pendiente</div>
                              </div>
                              <div className="text-3xl font-black text-red-400 mt-2">{formatCRC(Number(selectedEnc.deuda_pendiente) || 0)}</div>
                              <div className="text-xs text-slate-400 mt-1">Requiere pago</div>
                            </>
                          )}
                          {selectedEnc.estado === 'saldo_favor' && (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-green-400 font-bold uppercase tracking-wider">🟢 Saldo a favor</div>
                              </div>
                              <div className="text-3xl font-black text-green-400 mt-2">{formatCRC(Number(selectedEnc.saldo_a_favor) || 0)}</div>
                              <div className="text-xs text-slate-400 mt-1">Disponible para aplicar</div>
                            </>
                          )}
                          {selectedEnc.estado === 'al_dia' && (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-blue-400 font-bold uppercase tracking-wider">✅ Cuenta al día</div>
                              </div>
                              <div className="text-3xl font-black text-blue-400 mt-2">{formatCRC(0)}</div>
                              <div className="text-xs text-slate-400 mt-1">Sin pagos pendientes</div>
                            </>
                          )}
                        </div>
                        {selectedEnc.estado === 'deuda' && (
                          <Button 
                            variant="primary" 
                            className="h-10 bg-red-600 hover:bg-red-700"
                            onClick={() => openPago(selectedEnc)}
                          >
                            Pagar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* DESGLOSE DE CLASES EN LA TARJETA PRINCIPAL */}
                    {encPagoDetallesOpen && (
                      <div className="mt-4">
                        {encObligaciones.length > 0 ? (
                          <>
                            <div className="text-[11px] text-slate-400 px-1 mb-2">
                              Historial de clases ({encObligaciones.length})
                            </div>
                            <div className="max-h-[280px] overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                              {encObligaciones.map((o: any) => {
                                const date = String(o.fecha_devengo || '').slice(0, 10) || '—';
                                const hora = extractHoraFromDetalle(o.detalle);
                                const curso = o.cursos?.nombre || (o.detalle ? String(o.detalle) : 'Clase');
                                const estudiante = o.estudiantes?.nombre || '—';
                                const montoTotal = Number(o.monto) || 0;
                                const restante = Number(o.restante) || 0;
                                // Preferir campo explícito si existe
                                const yaAplicadoField = Number(o.ya_aplicado ?? NaN);
                                const yaAplicado = Number.isFinite(yaAplicadoField) ? yaAplicadoField : (montoTotal - restante);
                                const aplicaAhora = Number(o._preview_aplicar) || 0;
                                const estado = String(o.estado || '').toLowerCase();
                                // Estado visual para historial — priorizar datos reales sobre texto libre
                                let estadoBadge = '';
                                let estadoColor = '';
                                let estadoTexto = '';
                                if (restante === 0 || yaAplicado >= montoTotal || estado === 'aplicado' || estado === 'completado' || estado === 'pagada') {
                                  estadoBadge = '✅';
                                  estadoColor = 'text-green-400';
                                  estadoTexto = 'Pagada';
                                } else if (yaAplicado > 0 && restante > 0) {
                                  estadoBadge = '🟡';
                                  estadoColor = 'text-yellow-400';
                                  estadoTexto = 'Parcial';
                                } else {
                                  estadoBadge = '🔴';
                                  estadoColor = 'text-red-400';
                                  estadoTexto = 'Pendiente';
                                }
                                // Mostrar tutor, hora de marcado y empleado
                                const tutorNombre = o.tutores?.nombre || o.tutor_nombre || '—';
                                const horaMarcado = o.hora_marcado || hora || '—';
                                const empleadoNombre = o.empleado_nombre || o.marcado_por_nombre || o.marcado_por || '—';
                                return (
                                  <div
                                    key={o.id}
                                    className="w-full flex items-start justify-between gap-3 px-3 py-3 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                                          {date}
                                        </span>
                                        {hora && (
                                          <span className="text-[10px] text-slate-400">
                                            {hora}
                                          </span>
                                        )}
                                        <span className={`text-[10px] font-bold ${estadoColor}`}>
                                          {estadoBadge} {estadoTexto}
                                        </span>
                                      </div>
                                      <div className="text-sm font-black text-white truncate">{curso}</div>
                                      <div className="text-[11px] text-slate-200 truncate">{estudiante}</div>
                                      <div className="text-[11px] text-slate-400 mt-1">
                                        <b>Profesor:</b> {tutorNombre} &nbsp;|&nbsp; <b>Marcado:</b> {horaMarcado} &nbsp;|&nbsp; <b>Empleado:</b> {empleadoNombre}
                                      </div>
                                      {yaAplicado > 0 && (
                                        <div className="text-[10px] text-emerald-400 mt-1">
                                          ✓ Aplicado: {formatCRC(yaAplicado)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right whitespace-nowrap flex flex-col items-end gap-1.5">
                                      <div className="text-sm font-black text-white">
                                        {formatCRC(montoTotal)}
                                      </div>
                                      {restante > 0 && restante !== montoTotal && (
                                        <div className="text-[11px] text-amber-300">
                                          Falta: {formatCRC(restante)}
                                        </div>
                                      )}
                                      {restante === 0 && (
                                        <div className="text-[11px] text-green-400 font-bold">
                                          ✓ Completa
                                        </div>
                                      )}
                                      {aplicaAhora > 0 && (
                                        <div className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                                          +{formatCRC(aplicaAhora)}
                                        </div>
                                      )}
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-7 px-2 text-[11px] mt-1"
                                        onClick={() => {
                                          openSesionDetalle({
                                            title: curso,
                                            fecha: date,
                                            monto: montoTotal,
                                            estado: estado,
                                            tipo: o.tipo || null,
                                            sesion_id: o.sesion_id || null,
                                            matricula_id: o.matricula_id || null,
                                            detalle: o.detalle || null,
                                          });
                                        }}
                                      >
                                        Detalle
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-400">No hay clases registradas.</div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                      <Button variant="secondary" className="h-11" onClick={() => setTab('diario')}>Ver diario + tabla</Button>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-black text-white">Últimos movimientos</div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            className="h-9 px-3"
                            onClick={() => openCuentaMovimientosEncargado(selectedEnc)}
                          >
                            Ver historial
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-9 px-3"
                            onClick={() => loadHistorialEncargado(selectedEnc.encargado_id)}
                            disabled={loadingHistEnc}
                          >
                            {loadingHistEnc ? 'Cargando…' : 'Refrescar'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        {histEnc.length === 0 ? (
                          <div className="text-sm text-slate-300">Sin movimientos recientes.</div>
                        ) : (
                          histEnc.map((m) => {
                            const debe = Number(m.debe) || 0;
                            const haber = Number(m.haber) || 0;
                            const monto = debe > 0 ? debe : haber;
                            const isEntrada = debe > 0;
                            return (
                              <div key={m.id} className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[11px] text-slate-300">{String(m.fecha_pago || '').slice(0, 10)} • {m.estado}</div>
                                  <div className="text-sm text-white font-black truncate">{m.detalle || (isEntrada ? 'Entrada' : 'Salida')}</div>
                                  <div className="text-[11px] text-slate-300 truncate">{m.metodo ? `Método: ${m.metodo}` : ''}{m.referencia ? ` • ${m.referencia}` : ''}</div>
                                  <div className="mt-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 px-3"
                                      onClick={() => openAplicaciones(Number(m.id))}
                                    >
                                      Ver aplicaciones
                                    </Button>
                                  </div>
                                </div>
                                <div className={`text-right font-black ${isEntrada ? 'text-emerald-200' : 'text-rose-200'}`}>
                                  {isEntrada ? '+' : '-'}{formatCRC(monto)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === 'tutores' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="p-6 lg:col-span-7">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-black text-white">Tutores</h2>
                    <div className="text-xs text-slate-300">Selecciona uno para ver detalle y pagar</div>
                  </div>
                  <Button variant="outline" onClick={loadTutores} disabled={loadingTut}>
                    {loadingTut ? 'Cargando…' : 'Refrescar'}
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tutor</TableHead>
                      <TableHead className="text-right">Por pagar</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tutores.map((x) => {
                      const selected = selectedTutorId === x.tutor_id;
                      return (
                        <TableRow
                          key={x.cuenta_id || `tutor-${x.tutor_id}`}
                          className={`${selected ? 'border-[#00AEEF]/60 bg-white/5' : ''} cursor-pointer`}
                          onClick={() => setSelectedTutorId(x.tutor_id)}
                        >
                          <TableCell className="font-semibold">
                            <div className="text-white font-black truncate">{x.tutores?.nombre || `Tutor #${x.tutor_id}`}</div>
                            <div className="text-[11px] text-slate-300 truncate">{x.tutores?.email || ''}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatCRC(Number(x.por_pagar) || 0)}</TableCell>
                          <TableCell className="text-right">{formatCRC(Number(x.pagado) || 0)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!loadingTut && tutores.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-slate-500">Sin datos</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>

              <Card className="p-6 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-white">Detalle</div>
                    <div className="text-xs text-slate-300">Pago de tutor afecta la bolsa real</div>
                  </div>
                  {selectedTut ? (
                    <Button variant="primary" className="h-11" onClick={() => openTutorPago(selectedTut)}>Pagar tutor</Button>
                  ) : null}
                </div>

                {!selectedTut ? (
                  <div className="mt-6 text-sm text-slate-300">Selecciona un tutor para ver su detalle.</div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <div>
                      <div className="text-lg font-black text-white">
                        {selectedTut.tutores?.nombre || `Tutor #${selectedTut.tutor_id}`}
                      </div>
                      <div className="text-xs text-slate-300">{selectedTut.tutores?.email || ''}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Por pagar</div>
                        <div className="text-xl font-black text-white mt-1">{formatCRC(Number(selectedTut.por_pagar) || 0)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Pagado</div>
                        <div className="text-xl font-black text-white mt-1">{formatCRC(Number(selectedTut.pagado) || 0)}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Bolsa real actual</div>
                      <div className={`text-2xl font-black mt-1 ${(Number(bolsa?.bolsa_real) || 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{formatCRC(Number(bolsa?.bolsa_real) || 0)}</div>
                      <div className="text-[11px] text-slate-300 mt-2">Recuerda: no se puede pagar más que la bolsa (RPC lo bloquea).</div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Button variant="secondary" className="h-11" onClick={() => setTab('diario')}>Ver diario + tabla</Button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-black text-white">Últimos movimientos</div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            className="h-9 px-3"
                            onClick={() => openCuentaMovimientosTutor(selectedTut)}
                          >
                            Ver historial
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-9 px-3"
                            onClick={() => loadHistorialTutor(selectedTut.tutor_id)}
                            disabled={loadingHistTut}
                          >
                            {loadingHistTut ? 'Cargando…' : 'Refrescar'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        {histTut.length === 0 ? (
                          <div className="text-sm text-slate-300">Sin movimientos recientes.</div>
                        ) : (
                          histTut.map((m) => {
                            const debe = Number(m.debe) || 0;
                            const haber = Number(m.haber) || 0;
                            const monto = debe > 0 ? debe : haber;
                            const isEntrada = debe > 0;
                            return (
                              <div key={m.id} className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[11px] text-slate-300">{String(m.fecha_pago || '').slice(0, 10)} • {m.estado}</div>
                                  <div className="text-sm text-white font-black truncate">{m.detalle || (isEntrada ? 'Entrada' : 'Salida')}</div>
                                  <div className="text-[11px] text-slate-300 truncate">{m.metodo ? `Método: ${m.metodo}` : ''}{m.referencia ? ` • ${m.referencia}` : ''}</div>
                                  <div className="mt-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 px-3"
                                      onClick={() => openAplicaciones(Number(m.id))}
                                    >
                                      Ver aplicaciones
                                    </Button>
                                  </div>
                                </div>
                                <div className={`text-right font-black ${isEntrada ? 'text-emerald-200' : 'text-rose-200'}`}>
                                  {isEntrada ? '+' : '-'}{formatCRC(monto)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === 'diario' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-white">Diario</h2>
                  <div className="text-xs text-slate-300">Movimientos reales + tabla comparativa con esperado</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={async () => { await loadDiario(); await loadEsperado(); await loadBolsa(); await loadTotalesRapidos(); }}
                    disabled={loadingDiario || loadingEsperado || loadingBolsa || loadingTotales}
                  >
                    {(loadingDiario || loadingEsperado || loadingBolsa || loadingTotales) ? 'Cargando…' : 'Cargar'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={exportDiarioXlsx}
                    disabled={loadingDiario || loadingEsperado || loadingBolsa}
                  >
                    Exportar XLSX
                  </Button>
                </div>
              </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label>Fecha inicio</Label>
              <Input value={diarioInicio} onChange={(e) => setDiarioInicio(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <Input value={diarioFin} onChange={(e) => setDiarioFin(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Label>Incluir pendientes</Label>
              <Select value={diarioInclPend ? '1' : '0'} onChange={(e) => setDiarioInclPend(e.target.value === '1')}>
                <option value="0">No</option>
                <option value="1">Sí</option>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-slate-200">
                <div><strong>Debe:</strong> {formatCRC(diarioTotals.totalDebe)}</div>
                <div><strong>Haber:</strong> {formatCRC(diarioTotals.totalHaber)}</div>
                <div><strong>Neto:</strong> {formatCRC(diarioTotals.neto)}</div>
              </div>
            </div>
          </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card className="p-6">
              <div className="text-sm font-bold mb-1">Bolsa real</div>
              <div className={`text-xl font-extrabold ${(Number(bolsa?.bolsa_real) || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCRC(Number(bolsa?.bolsa_real) || 0)}</div>
              <div className="text-xs text-slate-300">Debe: {formatCRC(Number(bolsa?.debe_real) || 0)} • Haber: {formatCRC(Number(bolsa?.haber_real) || 0)}</div>
                </Card>
                <Card className="p-6">
              <div className="text-sm font-bold mb-1">Esperado (rango)</div>
              <div className="text-xs text-slate-200">
                <div><strong>Debe esperado:</strong> {formatCRC(esperado.reduce((a, x) => a + (Number(x.debe_esperado) || 0), 0))}</div>
                <div><strong>Haber esperado:</strong> {formatCRC(esperado.reduce((a, x) => a + (Number(x.haber_esperado) || 0), 0))}</div>
              </div>
                </Card>
                <Card className="p-6">
              <div className="text-sm font-bold mb-1">Real (rango)</div>
              <div className="text-xs text-slate-200">
                <div><strong>Debe real:</strong> {formatCRC(diarioTotals.totalDebe)}</div>
                <div><strong>Haber real:</strong> {formatCRC(diarioTotals.totalHaber)}</div>
              </div>
                </Card>
              </div>

              <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold">Comparativo diario (Esperado vs Real)</div>
              <div className="text-xs text-slate-300">Agrupado por fecha</div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Debe esp.</TableHead>
                  <TableHead className="text-right">Debe real</TableHead>
                  <TableHead className="text-right">Haber esp.</TableHead>
                  <TableHead className="text-right">Haber real</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparativoDiario.map((r) => (
                  <TableRow key={r.fecha}>
                    <TableCell className="text-sm">{r.fecha}</TableCell>
                    <TableCell className="text-right">{formatCRC(r.espDebe)}</TableCell>
                    <TableCell className="text-right">{formatCRC(r.realDebe)}</TableCell>
                    <TableCell className="text-right">{formatCRC(r.espHaber)}</TableCell>
                    <TableCell className="text-right">{formatCRC(r.realHaber)}</TableCell>
                  </TableRow>
                ))}
                {comparativoDiario.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500">Sin datos en el rango</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
              </Card>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diario.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="text-sm">{x.fecha_pago}</TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold">{x.detalle || 'Movimiento'}</div>
                    <div className="text-xs text-slate-300">{x.metodo ? `Método: ${x.metodo}` : ''} {x.referencia ? `• Ref: ${x.referencia}` : ''}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={x.estado === 'verificado' ? 'success' : x.estado === 'pendiente' ? 'warning' : 'default'}>
                      {x.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCRC(Number(x.debe) || 0)}</TableCell>
                  <TableCell className="text-right">{formatCRC(Number(x.haber) || 0)}</TableCell>
                  <TableCell className="text-right">{formatCRC(Number(x.saldo_acumulado) || 0)}</TableCell>
                </TableRow>
              ))}
              {!loadingDiario && diario.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">Sin movimientos</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

              <div className="mt-4 text-sm text-slate-200">
                <strong>Saldo final:</strong> {formatCRC(diarioTotals.saldoFinal)}
              </div>
            </Card>
          )}

          {tab !== 'diario' && (
            <Card className="overflow-hidden">
              <div className="p-8 space-y-4">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-bold text-white">Pagos por grupo</h2>
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
                      {(gruposOptions || []).map((g: any) => (
                        <option key={String(g.id)} value={String(g.id)}>
                          {g.nombre_grupo || g.id}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="text-xs text-slate-400 font-semibold">
                      {loadingGrupos ? 'Cargando grupos…' : 'Muestra todos los estudiantes del grupo'}
                    </div>
                    {grupoPagoId !== 'all' && grupoDetalle && grupoDetalle.grupo?.curso_nombre && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => openGruppoCobro(grupoDetalle?.grupo)}
                        disabled={grupoCobroSaving}
                      >
                        {grupoCobroSaving ? 'Cargando…' : '+ Agregar cobro'}
                      </Button>
                    )}
                  </div>
                </div>

                {grupoPagoId !== 'all' && grupoDetalle && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-widest">Curso</div>
                        <div className="font-bold text-white mt-1">{grupoDetalle.grupo?.curso_nombre || 'Sin asignar'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 uppercase tracking-widest">Tutor</div>
                        <div className="font-bold text-white mt-1">{grupoDetalle.grupo?.tutor_nombre || 'Sin asignar'}</div>
                      </div>
                    </div>
                  </div>
                )}

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
                      ) : (loadingPendientesPorEstudiante || grupoDetalleLoading) ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                            Cargando...
                          </TableCell>
                        </TableRow>
                      ) : grupoPagoRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                            Sin estudiantes en este grupo
                          </TableCell>
                        </TableRow>
                      ) : (
                        grupoPagoRows.map((row: any) => (
                          <TableRow key={row.key || row.estudiante_id || row.estudiante_bulk_id}>
                            <TableCell className="font-bold text-slate-100">
                              <div className="flex items-center gap-2">
                                <span>{row.estudiante_nombre}</span>
                                {row.is_bulk ? (
                                  <Badge variant="outline">Bulk</Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-black text-white">{formatCRC(row.total_pendiente)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9"
                                onClick={() => {
                                  if (row.is_bulk) {
                                    openEstudianteDetalleBulk(Number(row.estudiante_bulk_id), row.estudiante_nombre);
                                  } else {
                                    openEstudianteDetalle(Number(row.estudiante_id), row.estudiante_nombre);
                                  }
                                }}
                              >
                                Ver detalle
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

              </div>
            </Card>
          )}


        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6">
            <div className="text-sm font-black text-white">Dinero actual</div>
            <div className={`text-3xl font-black mt-2 ${(Number(bolsa?.bolsa_real) || 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{formatCRC(Number(bolsa?.bolsa_real) || 0)}</div>
            <div className="text-xs text-slate-300 mt-2">Debe: {formatCRC(Number(bolsa?.debe_real) || 0)} • Haber: {formatCRC(Number(bolsa?.haber_real) || 0)}</div>
            <div className="mt-3 text-[11px] text-slate-400">Resumen dinero real en caja (ingresos - egresos).</div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-black text-white">Totales rápidos</div>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <div className="flex items-center justify-between"><span>Deuda pendiente</span><span className="font-black">{formatCRC(totalesRapidos.deudaPendiente)}</span></div>
              <div className="flex items-center justify-between"><span>Saldo a favor</span><span className="font-black">{formatCRC(totalesRapidos.saldoAFavor)}</span></div>
              <div className="flex items-center justify-between"><span>Por pagar tutores</span><span className="font-black">{formatCRC(totalesRapidos.porPagarTutores)}</span></div>
            </div>
          </Card>

        </div>
      </div>

      <Dialog
        isOpen={!!selectedEstudianteDetalle}
        onClose={() => { setSelectedEstudianteDetalle(null); setDetalleEstudiante(null); }}
        title={selectedEstudianteDetalle ? `Desglose: ${selectedEstudianteDetalle.estudiante_nombre}` : 'Desglose estudiante'}
        maxWidthClass="max-w-3xl"
        zIndex={100}
        position={sesionDetalleOpen ? 'left' : 'center'}
      >
        {loadingDetalleEstudiante ? (
          <div className="text-slate-200 font-bold">Cargando...</div>
        ) : detalleEstudiante?.error ? (
          <div className="text-red-200 font-bold">{detalleEstudiante.error}</div>
        ) : (
          <div className="space-y-4">
            {selectedEstudianteResumen?.encargado_id ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  Encargado: {selectedEstudianteResumen?.encargado_nombre || `#${selectedEstudianteResumen.encargado_id}`}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  disabled={!encargadosById.has(Number(selectedEstudianteResumen.encargado_id))}
                  onClick={() => {
                    const enc = encargadosById.get(Number(selectedEstudianteResumen.encargado_id));
                    if (enc) openPago(enc);
                  }}
                >
                  Registrar pago
                </Button>
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                <div className="text-[11px] text-slate-400">Total pendiente</div>
                <div className="text-lg font-black text-white">
                  {formatCRC(detalleEstudiante?.total_monto ?? 0)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {detalleEstudiante?.cantidad_movimientos ?? 0} movimientos
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                <div className="text-[11px] text-slate-400">Saldo a favor</div>
                <div className="text-lg font-black text-emerald-200">
                  {formatCRC(selectedEstudianteResumen?.saldo_a_favor ?? 0)}
                </div>
                <div className="text-[11px] text-slate-400">
                  Encargado: {selectedEstudianteResumen?.encargado_nombre || (selectedEstudianteResumen?.encargado_id ? `#${selectedEstudianteResumen.encargado_id}` : '—')}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white/5">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detalleEstudiante?.movimientos || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-slate-300">Sin movimientos</TableCell>
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
                        <TableCell>{m?.curso?.nombre || '—'}</TableCell>
                        <TableCell>{String(m?.fecha_pago || '').slice(0, 10) || '—'}</TableCell>
                        <TableCell className="text-right font-black">{formatCRC(m?.monto ?? 0)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              openSesionDetalle({
                                title: m?.curso?.nombre || 'Sesión pendiente',
                                fecha: String(m?.fecha_pago || '').slice(0, 10) || null,
                                monto: Number(m?.monto) || 0,
                                estado: m?.estado || null,
                                tipo: m?.tipo || null,
                                origen: m?.origen || null,
                                periodo_inicio: m?.periodo_inicio || null,
                                periodo_fin: m?.periodo_fin || null,
                                sesion_id: m?.sesion_id || null,
                                matricula_id: m?.matricula_id || null,
                              });
                            }}
                          >
                            Ver sesión
                          </Button>
                        </TableCell>
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
        isOpen={sesionDetalleOpen}
        onClose={() => { setSesionDetalleOpen(false); setSesionDetalle(null); }}
        title={sesionDetalle?.title || 'Detalle de sesión'}
        maxWidthClass="max-w-md"
        zIndex={160}
        showBackdrop={false}
        position="right"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Fecha</div>
              <div className="text-sm font-black text-white">{sesionDetalle?.fecha || '—'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Monto</div>
              <div className="text-sm font-black text-white">{formatCRC(Number(sesionDetalle?.monto) || 0)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Estado</div>
              <div className="text-sm font-black text-white">{sesionDetalle?.estado || '—'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Tipo</div>
              <div className="text-sm font-black text-white">{sesionDetalle?.tipo || '—'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-400">Origen</div>
            <div className="text-sm font-black text-white">{sesionDetalle?.origen || '—'}</div>
          </div>

          {(sesionDetalle?.periodo_inicio || sesionDetalle?.periodo_fin) ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Periodo</div>
              <div className="text-sm font-black text-white">
                {sesionDetalle?.periodo_inicio || '—'} a {sesionDetalle?.periodo_fin || '—'}
              </div>
            </div>
          ) : null}

          {(sesionDetalle?.sesion_id || sesionDetalle?.matricula_id) ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Referencias</div>
              <div className="text-sm font-black text-white">
                {sesionDetalle?.sesion_id ? `Sesión #${sesionDetalle.sesion_id}` : 'Sesión —'}
                {sesionDetalle?.matricula_id ? ` • Matrícula #${sesionDetalle.matricula_id}` : ''}
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        isOpen={appsOpen}
        onClose={() => setAppsOpen(false)}
        title="Aplicaciones FIFO"
        maxWidthClass="max-w-3xl"
      >
        {appsLoading ? (
          <div className="text-sm text-slate-200">Cargando aplicaciones…</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-black text-white">Pago</div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="text-sm text-slate-200">
                  <div className="text-[11px] text-slate-400">Fecha</div>
                  <div className="font-black">{String(appsPago?.fecha_pago || '').slice(0, 10) || '—'}</div>
                </div>
                <div className="text-sm text-slate-200">
                  <div className="text-[11px] text-slate-400">Dirección</div>
                  <div className="font-black">{appsPago?.direccion || '—'}</div>
                </div>
                <div className="text-sm text-slate-200">
                  <div className="text-[11px] text-slate-400">Monto</div>
                  <div className="font-black">{formatCRC(Number(appsPago?.monto) || 0)}</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-300">
                {appsPago?.estado ? `Estado: ${appsPago.estado}` : ''}
                {appsPago?.metodo ? ` • Método: ${appsPago.metodo}` : ''}
                {appsPago?.referencia ? ` • Ref: ${appsPago.referencia}` : ''}
              </div>
              {appsPago?.comprobante_url ? (
                <div className="mt-2 text-[11px]">
                  <a className="text-cyan-200 underline" href={appsPago.comprobante_url} target="_blank" rel="noreferrer">
                    Ver comprobante (PDF/imagen)
                  </a>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-black text-white">Obligaciones aplicadas</div>
                <div className="text-xs text-slate-300">{apps.length} aplicación(es)</div>
              </div>

              {apps.length === 0 ? (
                <div className="mt-3 text-sm text-slate-300">Este pago no tiene aplicaciones registradas.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {apps.map((a) => {
                    const o = a.obligacion || null;
                    const who = o?.tipo === 'pago_tutor_sesion'
                      ? (o?.tutores?.nombre ? `Tutor: ${o.tutores.nombre}` : 'Tutor')
                      : (o?.estudiantes?.nombre ? `Estudiante: ${o.estudiantes.nombre}` : 'Estudiante');
                    const curso = o?.cursos?.nombre ? ` • Curso: ${o.cursos.nombre}` : '';
                    const dev = o?.fecha_devengo ? String(o.fecha_devengo).slice(0, 10) : '—';
                    return (
                      <div key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-[#0F2445] p-4">
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-300">{dev} • {o?.tipo || '—'} • {o?.estado || '—'}</div>
                          <div className="text-sm font-black text-white truncate">{who}{curso}</div>
                          <div className="text-[11px] text-slate-300 truncate">{o?.detalle || ''}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-cyan-200">{formatCRC(Number(a.monto) || 0)}</div>
                          <div className="text-[11px] text-slate-400">de {formatCRC(Number(o?.monto) || 0)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={cuentaOpen}
        onClose={() => setCuentaOpen(false)}
        title={cuentaTitle}
        maxWidthClass="max-w-5xl"
        position={cuentaDetalleOpen ? 'left' : 'center'}
      >
        {cuentaLoading ? (
          <div className="text-sm text-slate-200">Cargando movimientos…</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                Cuenta: <span className="text-slate-100 font-black">{cuentaId ?? '—'}</span>
                {cuentaKind && cuentaPersonaId ? <span> • {cuentaKind}: {cuentaPersonaId}</span> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-9 px-3" onClick={exportCuentaXlsx} disabled={!cuentaId}>
                  Exportar XLSX
                </Button>
              </div>
            </div>

            {cuentaMovs.length === 0 ? (
              <div className="text-sm text-slate-300">Sin movimientos en el rango.</div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead>Comp.</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cuentaMovs.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{String(m.fecha_pago || '').slice(0, 10)}</TableCell>
                        <TableCell className="min-w-[280px]">
                          <div className="text-white font-black truncate">{m.detalle || '—'}</div>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCRC(Number(m.debe) || 0)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCRC(Number(m.haber) || 0)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {m.estado ? <Badge variant={m.estado === 'verificado' ? 'success' : (m.estado === 'pendiente' ? 'warning' : 'default')}>{m.estado}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{m.metodo || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{m.referencia || '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {m.comprobante_url ? (
                            <button
                              className="text-cyan-200 underline hover:text-cyan-100"
                              onClick={() => { if (m.comprobante_url) window.open(m.comprobante_url, '_blank', 'noopener,noreferrer'); }}
                            >
                              Ver
                            </button>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              setCuentaDetalleItem(m);
                              setCuentaDetalleOpen(true);
                            }}
                          >
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={cuentaDetalleOpen}
        onClose={() => { setCuentaDetalleOpen(false); setCuentaDetalleItem(null); }}
        title="Detalle de movimiento"
        maxWidthClass="max-w-md"
        zIndex={160}
        showBackdrop={true}
        position="center"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Fecha</div>
              <div className="text-sm font-black text-white">{String(cuentaDetalleItem?.fecha_pago || '').slice(0, 10) || '—'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Estado</div>
              <div className="text-sm font-black text-white">{cuentaDetalleItem?.estado || '—'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Método</div>
              <div className="text-sm font-black text-white">{cuentaDetalleItem?.metodo || '—'}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Referencia</div>
              <div className="text-sm font-black text-white">{cuentaDetalleItem?.referencia || '—'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-400">Detalle</div>
            <div className="text-sm font-black text-white">{cuentaDetalleItem?.detalle || '—'}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Debe</div>
              <div className="text-sm font-black text-white">{formatCRC(Number(cuentaDetalleItem?.debe) || 0)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-slate-400">Haber</div>
              <div className="text-sm font-black text-white">{formatCRC(Number(cuentaDetalleItem?.haber) || 0)}</div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-400">Comprobante</div>
            {cuentaDetalleItem?.comprobante_url ? (
              <button
                className="text-cyan-200 underline hover:text-cyan-100"
                onClick={() => { if (cuentaDetalleItem?.comprobante_url) window.open(cuentaDetalleItem.comprobante_url, '_blank', 'noopener,noreferrer'); }}
              >
                Ver PDF/Imagen
              </button>
            ) : (
              <div className="text-sm text-slate-200">—</div>
            )}
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={pagoOpen}
        onClose={() => setPagoOpen(false)}
        title="Registrar pago"
        maxWidthClass="max-w-3xl"
        position={sesionDetalleOpen ? 'left' : 'center'}
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-200">
            <strong>Encargado:</strong> {pagoTarget?.encargados?.nombre || (pagoTarget ? `#${pagoTarget.encargado_id}` : '')}
          </div>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Balance pendiente</div>
                {encObligacionesResumen.totalRestante > 0 ? (
                  <div className="text-xs text-red-300">🔴 Deuda: {formatCRC(Number(encObligacionesResumen.totalRestante) || 0)}</div>
                ) : (
                  <div className="text-xs text-green-300">✅ Al día • Sin pagos pendientes</div>
                )}
                {encObligaciones.length > 0 && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    {encObligaciones.length} {encObligaciones.length === 1 ? 'clase' : 'clases'} registrada{encObligaciones.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>
              {encObligaciones.length > 0 && (
                <Button variant="outline" onClick={() => setEncPagoDetallesOpen((v) => !v)}>
                  {encPagoDetallesOpen ? 'Ocultar desglose' : 'Ver desglose'}
                </Button>
              )}
            </div>
            {encObligacionesLoading ? (
              <div className="text-xs text-slate-300 mt-3">Cargando desglose…</div>
            ) : encPagoDetallesOpen && encObligacionesPreview.length > 0 ? (
              <div className="mt-3 space-y-2">
                <div className="text-[11px] text-slate-400 px-1 mb-2">
                  Desglose de {encObligacionesPreview.length} {encObligacionesPreview.length === 1 ? 'clase' : 'clases'}
                </div>
                <div className="max-h-[280px] overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                  {encObligacionesPreview.map((o: any) => {
                  const date = String(o.fecha_devengo || '').slice(0, 10) || '—';
                  const hora = extractHoraFromDetalle(o.detalle);
                  const curso = o.cursos?.nombre || (o.detalle ? String(o.detalle) : 'Clase');
                  const estudiante = o.estudiantes?.nombre || '—';
                  const montoTotal = Number(o.monto) || 0;
                  const restante = Number(o.restante) || 0;
                  const yaAplicado = montoTotal - restante;
                  const aplicaAhora = Number(o._preview_aplicar) || 0;
                  const estado = o.estado || 'pendiente';
                  
                  // Determinar estado visual
                  let estadoBadge = '';
                  let estadoColor = '';
                  let estadoTexto = '';
                  
                  if (estado === 'aplicado') {
                    estadoBadge = '✅';
                    estadoColor = 'text-green-400';
                    estadoTexto = 'Pagada';
                  } else if (yaAplicado > 0 && restante > 0) {
                    estadoBadge = '🟡';
                    estadoColor = 'text-yellow-400';
                    estadoTexto = 'Parcial';
                  } else if (restante > 0) {
                    estadoBadge = '🔴';
                    estadoColor = 'text-red-400';
                    estadoTexto = 'Pendiente';
                  } else {
                    estadoBadge = '✅';
                    estadoColor = 'text-green-400';
                    estadoTexto = 'Pagada';
                  }
                  
                  return (
                    <div
                      key={o.id}
                      className="w-full flex items-start justify-between gap-3 px-3 py-3 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                            {date}
                          </span>
                          {hora && (
                            <span className="text-[10px] text-slate-400">
                              {hora}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold ${estadoColor}`}>
                            {estadoBadge} {estadoTexto}
                          </span>
                        </div>
                        <div className="text-sm font-black text-white truncate">{curso}</div>
                        <div className="text-[11px] text-slate-200 truncate">{estudiante}</div>
                        
                        {yaAplicado > 0 && (
                          <div className="text-[10px] text-emerald-400 mt-1">
                            ✓ Aplicado: {formatCRC(yaAplicado)}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right whitespace-nowrap flex flex-col items-end gap-1.5">
                        <div className="text-sm font-black text-white">
                          {formatCRC(montoTotal)}
                        </div>
                        
                        {restante > 0 && restante !== montoTotal && (
                          <div className="text-[11px] text-amber-300">
                            Falta: {formatCRC(restante)}
                          </div>
                        )}
                        
                        {restante === 0 && (
                          <div className="text-[11px] text-green-400 font-bold">
                            ✓ Completa
                          </div>
                        )}
                        
                        {aplicaAhora > 0 && (
                          <div className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                            +{formatCRC(aplicaAhora)}
                          </div>
                        )}
                        
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 px-2 text-[11px] mt-1"
                          onClick={() => {
                            openSesionDetalle({
                              title: curso,
                              fecha: date,
                              monto: montoTotal,
                              estado: estado,
                              tipo: o.tipo || null,
                              sesion_id: o.sesion_id || null,
                              matricula_id: o.matricula_id || null,
                              detalle: o.detalle || null,
                            });
                          }}
                        >
                          Detalle
                        </Button>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-300 mt-3">{encObligacionesPreview.length ? 'Pulsa “Detalles” para ver el desglose.' : 'No hay sesiones/obligaciones pendientes.'}</div>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Monto</Label>
              <Input type="number" value={pagoForm.monto} onChange={(e) => setPagoForm((p) => ({ ...p, monto: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Fecha pago</Label>
              <Input value={pagoForm.fecha_pago} onChange={(e) => setPagoForm((p) => ({ ...p, fecha_pago: e.target.value }))} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Label>Método</Label>
              <Select value={pagoForm.metodo} onChange={(e) => setPagoForm((p) => ({ ...p, metodo: e.target.value }))}>
                <option value="sinpe">SINPE</option>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
              </Select>
            </div>
            <div>
              <Label>Referencia</Label>
              <Input value={pagoForm.referencia} onChange={(e) => setPagoForm((p) => ({ ...p, referencia: e.target.value }))} />
            </div>
            <div>
              <Label>Número comprobante</Label>
              <Input value={pagoForm.numero_comprobante} onChange={(e) => setPagoForm((p) => ({ ...p, numero_comprobante: e.target.value }))} />
            </div>
            <div>
              <Label>Fecha comprobante</Label>
              <Input value={pagoForm.fecha_comprobante} onChange={(e) => setPagoForm((p) => ({ ...p, fecha_comprobante: e.target.value }))} placeholder="YYYY-MM-DD" />
            </div>
          </div>

          <div>
            <Label>Detalle</Label>
            <Input value={pagoForm.detalle} onChange={(e) => setPagoForm((p) => ({ ...p, detalle: e.target.value }))} />
          </div>

          <div>
            <Label>Comprobante (imagen/PDF)</Label>
            <Input type="file" onChange={(e) => setPagoFile(e.target.files?.[0] ?? null)} />
            <div className="text-xs text-slate-300 mt-1">Si el método no es efectivo, sube el comprobante para poder completar.</div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setPagoOpen(false)}>Cerrar</Button>
            <Button variant="primary" onClick={savePago} disabled={pagoSaving}>{pagoSaving ? 'Guardando…' : 'Registrar'}</Button>
          </div>

          {pagoResult && (
            <Card>
              <div className="text-sm font-bold mb-2">Resultado</div>
              <div className="text-xs text-slate-200">Pago ID: {String(pagoResult?.pago_id || '')}</div>
              <div className="text-xs text-slate-200">Aplicado total: {formatCRC(Number(pagoResult?.aplicado_total) || 0)}</div>
              <div className="text-xs text-slate-200">Saldo a favor generado: {formatCRC(Number(pagoResult?.saldo_a_favor_generado) || 0)}</div>
              {Number(pagoResult?.pago_id) > 0 && (
                <div className="mt-3">
                  <Button variant="outline" onClick={() => openAplicaciones(Number(pagoResult?.pago_id))}>Ver aplicaciones (sesiones cubiertas)</Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </Dialog>

      <Dialog
        isOpen={tutorPagoOpen}
        onClose={() => setTutorPagoOpen(false)}
        title="Pagar tutor"
        maxWidthClass="max-w-3xl"
        position={sesionDetalleOpen ? 'left' : 'center'}
      >
        <div className="flex flex-col gap-4 min-h-0">
          <div className="text-sm text-slate-200">
            <strong>Tutor:</strong> {tutorPagoTarget?.tutores?.nombre || (tutorPagoTarget ? `#${tutorPagoTarget.tutor_id}` : '')}
          </div>

          {tutorPagoError ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2">
                <Badge variant="warning">No se pudo guardar</Badge>
                <div className="text-sm font-black text-white">Revisa los datos</div>
              </div>
              <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{tutorPagoError}</div>
            </div>
          ) : null}

          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Sesiones pendientes por pagar</div>
                <div className="text-xs text-slate-300">
                  Seleccionadas: {tutorObligacionesSeleccionadas.length} • total: {formatCRC(Number(tutorObligacionesSeleccionTotal) || 0)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setTutorObligacionesSeleccionadas(tutorObligaciones.map((o) => o.id))}
                  disabled={!tutorObligaciones.length}
                >
                  Seleccionar todas
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTutorObligacionesSeleccionadas([])}
                  disabled={!tutorObligacionesSeleccionadas.length}
                >
                  Limpiar
                </Button>
                <Button variant="outline" onClick={() => setTutorPagoDetallesOpen((v) => !v)}>
                  {tutorPagoDetallesOpen ? 'Ocultar detalles' : 'Detalles'}
                </Button>
              </div>
            </div>


            {tutorObligacionesLoading ? (
              <div className="text-xs text-slate-300 mt-3">Cargando…</div>
            ) : tutorPagoDetallesOpen && tutorObligaciones.length ? (
              <div className="mt-3 max-h-[260px] overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                {tutorObligaciones.map((o) => {
                  const checked = tutorObligacionesSeleccionadas.includes(o.id);
                  const date = String(o.fecha_devengo || '').slice(0, 10) || '—';
                  const hora = extractHoraFromDetalle(o.detalle);
                  const curso = o.cursos?.nombre || (o.detalle ? String(o.detalle) : 'Clase');
                  const estudiante = o.estudiantes?.nombre || '—';
                  const costo = Number(o.restante) || 0;

                  return (
                    <div
                      key={o.id}
                      className="w-full flex items-start justify-between gap-3 px-3 py-2 border-b border-white/10 last:border-b-0 hover:bg-white/5"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          className="h-4 w-4 mt-1"
                          checked={checked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            const next = e.target.checked
                              ? Array.from(new Set([...tutorObligacionesSeleccionadas, o.id]))
                              : tutorObligacionesSeleccionadas.filter((x) => x !== o.id);
                            setTutorObligacionesSeleccionadas(next);
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-300 whitespace-nowrap">{date}{hora ? ` • ${hora}` : ''}</div>
                          <div className="text-sm font-black text-white truncate">{curso}</div>
                          <div className="text-[11px] text-slate-200 truncate">{estudiante}</div>
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap flex flex-col items-end gap-1">
                        <div className="text-sm font-black text-white">{formatCRC(costo)}</div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3"
                          onClick={() => {
                            openSesionDetalle({
                              title: curso,
                              fecha: date,
                              monto: Number(o.restante) || 0,
                              estado: o.estado || null,
                              tipo: o.tipo || null,
                              sesion_id: o.sesion_id || null,
                              matricula_id: o.matricula_id || null,
                              detalle: o.detalle || null,
                            });
                          }}
                        >
                          Ver detalle
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-300 mt-3">{tutorObligaciones.length ? 'Pulsa “Detalles” para ver y seleccionar sesiones.' : 'No hay sesiones pendientes.'}</div>
            )}
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Clases a adjuntar</div>
                <div className="text-xs text-slate-300">
                  Este comprobante/registro se aplicará a las sesiones seleccionadas.
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-300">Seleccionadas</div>
                <div className="text-sm font-black text-white">{tutorObligacionesSeleccionList.length}</div>
              </div>
            </div>

            {tutorObligacionesSeleccionList.length === 0 ? (
              <div className="text-xs text-slate-300 mt-3">Aún no hay sesiones seleccionadas.</div>
            ) : (
              <div className="mt-3 max-h-[180px] overflow-y-auto rounded-xl border border-white/10 bg-white/5">
                {tutorObligacionesSeleccionList.map((o) => (
                  <div key={o.id} className="flex items-start justify-between gap-3 px-3 py-2 border-b border-white/10 last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-300 whitespace-nowrap">
                        {String(o.fecha_devengo || '').slice(0, 10) || '—'}
                        {extractHoraFromDetalle(o.detalle) ? ` • ${extractHoraFromDetalle(o.detalle)}` : ''}
                      </div>
                      <div className="text-sm font-black text-white truncate">{o.cursos?.nombre || (o.detalle ? String(o.detalle) : 'Clase')}</div>
                      <div className="text-[11px] text-slate-200 truncate">{o.estudiantes?.nombre || '—'}</div>
                    </div>
                    <div className="text-right whitespace-nowrap text-sm font-black text-white">{formatCRC(Number(o.restante) || 0)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Monto</Label>
              <Input type="number" value={tutorPagoForm.monto} readOnly />
              <div className="text-xs text-slate-300 mt-1">El monto se calcula según las sesiones seleccionadas.</div>
            </div>
            <div>
              <Label>Fuente</Label>
              <div className="text-sm font-bold text-slate-200">Bolsa del sistema</div>
              <div className="text-xs text-slate-300 mt-1">
                El pago se registra desde la bolsa del sistema.
              </div>
            </div>
            <div>
              <Label>Fecha pago</Label>
              <Input value={tutorPagoForm.fecha_pago} onChange={(e) => setTutorPagoForm((p) => ({ ...p, fecha_pago: e.target.value }))} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Label>Método</Label>
              <Select value={tutorPagoForm.metodo} onChange={(e) => setTutorPagoForm((p) => ({ ...p, metodo: e.target.value }))}>
                <option value="sinpe">SINPE</option>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
              </Select>
            </div>
            <div>
              <Label>Referencia</Label>
              <Input value={tutorPagoForm.referencia} onChange={(e) => setTutorPagoForm((p) => ({ ...p, referencia: e.target.value }))} />
            </div>
            <div>
              <Label>Número comprobante</Label>
              <Input value={tutorPagoForm.numero_comprobante} onChange={(e) => setTutorPagoForm((p) => ({ ...p, numero_comprobante: e.target.value }))} />
            </div>
            <div>
              <Label>Fecha comprobante</Label>
              <Input value={tutorPagoForm.fecha_comprobante} onChange={(e) => setTutorPagoForm((p) => ({ ...p, fecha_comprobante: e.target.value }))} placeholder="YYYY-MM-DD" />
            </div>
          </div>

          <div>
            <Label>Detalle</Label>
            <Input value={tutorPagoForm.detalle} onChange={(e) => setTutorPagoForm((p) => ({ ...p, detalle: e.target.value }))} />
          </div>

          <div>
            <Label>Comprobante (imagen/PDF)</Label>
            <Input type="file" onChange={(e) => setTutorPagoFile(e.target.files?.[0] ?? null)} />
            <div className="text-xs text-slate-300 mt-1">Si el método no es efectivo, sube el comprobante para completar.</div>
          </div>

          <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-[#0F2445] border-t border-white/10 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setTutorPagoOpen(false)}>Cerrar</Button>
            <Button variant="primary" onClick={saveTutorPago} disabled={tutorPagoSaving}>{tutorPagoSaving ? 'Guardando…' : 'Pagar'}</Button>
          </div>

          {tutorPagoResult && (
            <Card>
              <div className="text-sm font-bold mb-2">Resultado</div>
              <div className="text-xs text-slate-200">Pago ID: {String(tutorPagoResult?.pago_id || '')}</div>
              <div className="text-xs text-slate-200">Aplicado total: {formatCRC(Number(tutorPagoResult?.aplicado_total) || 0)}</div>
              <div className="text-xs text-slate-200">Pendiente aplicar: {formatCRC(Number(tutorPagoResult?.pendiente_aplicar) || 0)}</div>
              {Number(tutorPagoResult?.pago_id) > 0 && (
                <div className="mt-3">
                  <Button variant="outline" onClick={() => openAplicaciones(Number(tutorPagoResult?.pago_id))}>Ver aplicaciones (sesiones pagadas)</Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </Dialog>

      <Dialog
        isOpen={grupoCobroOpen}
        onClose={() => setGrupoCobroOpen(false)}
        title={grupoCobroTarget ? `Agregar cobro: ${grupoCobroTarget.nombre_grupo}` : 'Agregar cobro grupal'}
        maxWidthClass="max-w-4xl"
      >
        {grupoCobroResult ? (
          <div className="space-y-4">
            <Card className="bg-emerald-950/30 border border-emerald-500/30">
              <div className="text-sm font-bold text-emerald-200 mb-3">✓ Cobro registrado</div>
              <div className="text-xs text-emerald-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Grupo:</span>
                  <span className="font-bold text-emerald-200">{grupoCobroResult.grupo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Curso:</span>
                  <span className="font-bold text-emerald-200">{grupoCobroResult.curso}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Estudiantes:</span>
                  <span className="font-bold text-emerald-200">{grupoCobroResult.estudiantes_count}</span>
                </div>
                <div className="border-t border-emerald-500/30 pt-2 mt-2 flex items-center justify-between">
                  <span>Monto por estudiante:</span>
                  <span className="font-bold text-emerald-200">{formatCRC(grupoCobroResult.monto_por_estudiante)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 text-emerald-200 font-bold text-sm">
                  <span>Total estudiantes:</span>
                  <span className="text-lg">{formatCRC(grupoCobroResult.total_estudiantes)}</span>
                </div>
                {grupoCobroResult.pago_tutor && (
                  <div className="border-t border-emerald-500/30 pt-2 mt-2 flex items-center justify-between text-emerald-200 font-bold">
                    <span>+ Tutor:</span>
                    <span>{formatCRC(grupoCobroResult.pago_tutor?.monto || 0)}</span>
                  </div>
                )}
              </div>
            </Card>
            <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-[#0F2445] border-t border-white/10 flex gap-2 justify-end">
              <Button variant="primary" onClick={() => setGrupoCobroOpen(false)}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {grupoCobroError && (
              <Card className="bg-red-950/30 border border-red-500/30">
                <div className="text-sm font-bold text-red-200 mb-2">Error</div>
                <div className="text-xs text-red-100">{grupoCobroError}</div>
              </Card>
            )}

            {grupoCobroTarget && grupoDetalle && (
              <div className="space-y-4">
                <Card className="bg-white/5 border border-white/10">
                  <div className="text-sm font-bold text-white mb-4">Detalles del cobro</div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <span className="text-xs text-slate-400 uppercase">Grupo</span>
                      <span className="font-bold text-white">{grupoCobroTarget.nombre_grupo}</span>
                    </div>
                    
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <span className="text-xs text-slate-400 uppercase">Curso</span>
                      <span className="font-bold text-white">{grupoCobroTarget.curso_nombre}</span>
                    </div>

                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <span className="text-xs text-slate-400 uppercase">Tutor</span>
                      <span className="font-bold text-white">{grupoCobroTarget.tutor_nombre || 'Sin asignar'}</span>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400 uppercase mb-2">Estudiantes a cargar</div>
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-blue-300 bg-blue-950/30 px-3 py-2 rounded border border-blue-500/30">
                          Total: {((grupoDetalle.estudiantes?.bulk || []).length || 0) + ((grupoDetalle.estudiantes?.normales || []).length || 0)} estudiante{((grupoDetalle.estudiantes?.bulk || []).length || 0) + ((grupoDetalle.estudiantes?.normales || []).length || 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <div className="text-xs text-slate-400 uppercase mb-2">Montos</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span>C/estudiante:</span>
                          <span className="font-bold text-white">{formatCRC(grupoCobroTarget.costo_curso || 0)}</span>
                        </div>
                        {grupoCobroTarget.pago_tutor > 0 && (
                          <div className="flex items-center justify-between text-slate-300">
                            <span>Tutor:</span>
                            <span className="font-bold text-white">{formatCRC(grupoCobroTarget.pago_tutor || 0)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-3">
                  <div className="text-xs text-amber-100">
                    <div className="font-bold mb-1">⚠️ Se registrará como deuda</div>
                    <div>Se agregará {formatCRC(grupoCobroTarget.costo_curso || 0)} a cada estudiante y {formatCRC(grupoCobroTarget.pago_tutor || 0)} al tutor.</div>
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-[#0F2445] border-t border-white/10 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setGrupoCobroOpen(false)}>Cancelar</Button>
              <Button variant="primary" onClick={registrarCobroGrupal} disabled={grupoCobroSaving}>
                {grupoCobroSaving ? 'Registrando…' : 'Confirmar cobro'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Tesoreria;
