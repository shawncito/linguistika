
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
  horario_preferido?: string | null;
  dias?: string[] | null;
  dias_turno?: Record<string, 'Tarde' | 'Noche'> | null;
  horario_tipo?: 'predefinido' | 'custom';
  estado: number;
  created_at: string;
}

export interface Curso {
  id: number;
  nombre: string;
  descripcion: string;
  nivel: string | 'None' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  max_estudiantes?: number | null;
  tipo_clase?: 'grupal' | 'tutoria';
  dias?: string[] | null;
  dias_turno?: Record<string, 'Tarde' | 'Noche'> | null;
  dias_schedule?: Record<string, {
    turno: 'Tarde' | 'Noche';
    hora_inicio: string;
    hora_fin: string;
    duracion_horas?: number;
  }> | null;
  dias_semana?: string | string[] | null;
  costo_curso?: number;
  pago_tutor?: number;
  estado: number;
  created_at: string;
}

export interface Estudiante {
  id: number;
  nombre: string;
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
  // Joined fields
  estudiante_nombre?: string;
  curso_nombre?: string;
  tutor_nombre?: string;
  tarifa_por_hora?: number;
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
