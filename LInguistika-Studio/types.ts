
export enum Nivel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2'
}

export enum EstadoPago {
  PENDIENTE = 'pendiente',
  PAGADO = 'pagado'
}

export enum EstadoClase {
  PROGRAMADA = 'programada',
  COMPLETADA = 'completada',
  CANCELADA = 'cancelada'
}

export interface Tutor {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  especialidad: string;
  tarifa_por_hora?: number | null;
  color?: string | null;
  horario_preferido?: string | null;
  dias?: string[] | null;
  dias_turno?: Record<string, 'Tarde' | 'Noche'> | null;
  dias_horarios?: Record<string, { hora_inicio: string; hora_fin: string }> | null;
  horario_tipo?: 'personalizado' | 'predefinido';
  es_especializado?: boolean;
  niveles_apto?: string[] | null;
  estado: number;
  created_at: string;
}

export interface Curso {
  id: number;
  nombre: string;
  descripcion: string;
  metodo?: 'Virtual' | 'Presencial' | null;
  nivel: string | 'None' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  max_estudiantes?: number | null;
  tipo_clase?: 'grupal' | 'tutoria';
  tipo_pago?: 'sesion' | 'mensual';
  dias?: string[] | null;
  dias_turno?: Record<string, 'Tarde' | 'Noche'> | null;
  dias_schedule?: Record<string, {
    turno?: 'Tarde' | 'Noche';
    hora_inicio: string;
    hora_fin: string;
    duracion_horas?: number;
  }> | null;
  dias_semana?: string | string[] | null;
  costo_curso?: number;
  pago_tutor?: number;
  tutor_id?: number | null;
  grado_activo?: boolean;
  grado_nombre?: string | null;
  grado_color?: string | null;
  estado: number;
  created_at: string;
}

export interface Estudiante {
  id: number;
  nombre: string;
  nombre_encargado?: string | null;
  email?: string | null;
  email_encargado?: string | null;
  telefono?: string | null;
  telefono_encargado?: string | null;
  grado?: string | null;
  dias?: string[] | null;
  dias_turno?: Record<string, 'Tarde' | 'Noche'> | null;
  fecha_inscripcion: string;
  estado: number;
  created_at: string;
  matricula_grupo_id?: number | null;
}

export interface Usuario {
  id: number;
  username: string;
  rol: string;
  estado: number;
  created_at: string;
  updated_at?: string | null;
}

export interface HorasTrabajo {
  id: number;
  tutor_id: number;
  clase_id?: number | null;
  fecha: string;
  horas: number;
  tarifa_por_hora: number;
  monto: number;
  estado: 'pendiente' | 'aprobado';
  notas?: string | null;
  tutor_nombre?: string;
}

export interface Matricula {
  id: number;
  estudiante_id: number;
  curso_id: number;
  tutor_id: number;
  fecha_inscripcion: string;
  estado: number;
  created_at: string;
  es_grupo?: boolean;
  grupo_id?: string;
  grupo_nombre?: string | null;
  // Joined fields
  estudiante_nombre?: string;
  curso_nombre?: string;
  tutor_nombre?: string;
  tarifa_por_hora?: number;
  // Curso horario y metadatos
  curso_dias_turno?: Record<string, 'Tarde' | 'Noche'> | null;
  curso_dias_schedule?: Record<string, {
    turno?: 'Tarde' | 'Noche';
    hora_inicio: string;
    hora_fin: string;
    duracion_horas?: number;
  }> | null;
  curso_tipo_clase?: string | null;
  curso_tipo_pago?: 'sesion' | 'mensual' | string | null;
  curso_max_estudiantes?: number | null;
  curso_metodo?: 'Virtual' | 'Presencial' | string | null;
  curso_grado_activo?: boolean | null;
  curso_grado_nombre?: string | null;
  curso_grado_color?: string | null;
  curso_costo_curso?: number | null;
  curso_pago_tutor?: number | null;
}

export interface Clase {
  id: number;
  matricula_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoClase;
  notas: string;
  created_at: string;
  // Estado de programación/confirmación (usado en Dashboard)
  avisado?: boolean;
  confirmado?: boolean;
  motivo_cancelacion?: string | null;
  // Datos extra (cuando viene de schedule)
  turno?: string | null;
  duracion_horas?: number | null;
  // Joined fields
  tutor_id?: number;
  estudiante_id?: number;
  estudiante_nombre?: string;
  tutor_nombre?: string;
  curso_nombre?: string;
  tarifa_por_hora?: number;
}

export interface Pago {
  id: number;
  tutor_id: number;
  clase_id?: number;
  cantidad_clases?: number;
  monto: number;
  fecha_pago: string;
  periodo_inicio?: string | null;
  periodo_fin?: string | null;
  estado: EstadoPago;
  descripcion: string;
  created_at: string;
  // Joined fields
  tutor_nombre?: string;
  tutor_email?: string;
}

export interface SesionClase {
  id: number;
  curso_id: number;
  tutor_id: number;
  fecha: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_horas: number;
  estado: 'programada' | 'dada' | 'cancelada';
  created_at: string;
  // Joined fields
  curso_nombre?: string;
  tutor_nombre?: string;
}

export interface MovimientoDinero {
  id: number;
  curso_id: number;
  matricula_id?: number;
  tipo: 'ingreso_estudiante' | 'pago_tutor' | 'pago_tutor_pendiente';
  monto: number;
  factura_numero?: string;
  fecha_pago: string;
  fecha_comprobante?: string;
  estado: 'pendiente' | 'completado' | 'verificado';
  notas?: string;
  created_at: string;
  // Joined fields
  curso_nombre?: string;
}

export interface Stats {
  tutores_activos: number;
  estudiantes_activos: number;
  cursos_activos: number;
  matriculas_activas: number;
  total_clases: number;
  ingresos_pendientes: number;
}

export interface ResumenTutorEstudiantes {
  tutor_id: number;
  tutor_nombre: string;
  total_estudiantes: number;
}

export interface ResumenCursoGrupos {
  curso_id: number;
  curso_nombre: string;
  grado_activo?: boolean;
  grado_nombre?: string | null;
  grado_color?: string | null;
  tipo_clase?: string | null;
  max_estudiantes?: number | null;
  total_estudiantes: number;
  total_grupos: number;
}
