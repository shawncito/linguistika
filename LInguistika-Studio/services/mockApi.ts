
import { 
  Tutor, Curso, Estudiante, Matricula, Clase, Pago, Stats, 
  Nivel, EstadoPago, EstadoClase 
} from '../types';

// Initial Mock Data
let tutores: Tutor[] = [
  { id: 1, nombre: 'Ana García', email: 'ana@ling.com', telefono: '600111222', especialidad: 'Inglés', tarifa_por_hora: 25, estado: 1, created_at: '2023-01-01' },
  { id: 2, nombre: 'Marc Dubois', email: 'marc@ling.com', telefono: '600333444', especialidad: 'Francés', tarifa_por_hora: 30, estado: 1, created_at: '2023-01-05' },
];

let cursos: Curso[] = [
  { id: 1, nombre: 'Inglés Avanzado', descripcion: 'Curso intensivo de C1', nivel: Nivel.C1, max_estudiantes: 12, estado: 1, created_at: '2023-02-01' },
  { id: 2, nombre: 'Francés Básico', descripcion: 'Iniciación al idioma', nivel: Nivel.A1, max_estudiantes: 8, estado: 1, created_at: '2023-02-10' },
];

let estudiantes: Estudiante[] = [
  { id: 1, nombre: 'Juan Pérez', email: 'juan@mail.com', telefono: '611222333', fecha_inscripcion: '2023-03-01', estado: 1, created_at: '2023-03-01' },
  { id: 2, nombre: 'Marta Ruiz', email: 'marta@mail.com', telefono: '622333444', fecha_inscripcion: '2023-03-15', estado: 1, created_at: '2023-03-15' },
];

let matriculas: Matricula[] = [
  { id: 1, estudiante_id: 1, curso_id: 1, tutor_id: 1, fecha_inscripcion: '2023-04-01', estado: 1, created_at: '2023-04-01' },
  { id: 2, estudiante_id: 2, curso_id: 2, tutor_id: 2, fecha_inscripcion: '2023-04-05', estado: 1, created_at: '2023-04-05' },
];

let clases: Clase[] = [
  { id: 1, matricula_id: 1, fecha: new Date().toISOString().split('T')[0], hora_inicio: '10:00', hora_fin: '11:00', estado: EstadoClase.PROGRAMADA, notas: 'Primera sesión', created_at: '2023-05-01' },
  { id: 2, matricula_id: 2, fecha: new Date().toISOString().split('T')[0], hora_inicio: '12:30', hora_fin: '13:30', estado: EstadoClase.PROGRAMADA, notas: 'Repaso gramática', created_at: '2023-05-01' },
];

let pagos: Pago[] = [
  { id: 1, tutor_id: 1, monto: 50, fecha_pago: '2023-06-01', estado: EstadoPago.PAGADO, descripcion: 'Pago mayo', created_at: '2023-06-01' },
  { id: 2, tutor_id: 2, monto: 30, fecha_pago: '2023-06-15', estado: EstadoPago.PENDIENTE, descripcion: 'Pendiente validación', created_at: '2023-06-15' },
];

// Service Layer
export const api = {
  tutores: {
    getAll: async () => tutores.filter(t => t.estado === 1),
    getById: async (id: number) => tutores.find(t => t.id === id && t.estado === 1),
    create: async (data: Partial<Tutor>) => {
      const newTutor = { ...data, id: tutores.length + 1, estado: 1, created_at: new Date().toISOString() } as Tutor;
      tutores.push(newTutor);
      return newTutor;
    },
    update: async (id: number, data: Partial<Tutor>) => {
      const index = tutores.findIndex(t => t.id === id);
      if (index === -1) throw new Error('404');
      tutores[index] = { ...tutores[index], ...data };
      return tutores[index];
    },
    delete: async (id: number) => {
      const index = tutores.findIndex(t => t.id === id);
      if (index !== -1) tutores[index].estado = 0;
    }
  },
  cursos: {
    getAll: async () => cursos.filter(c => c.estado === 1),
    getById: async (id: number) => cursos.find(c => c.id === id && c.estado === 1),
    create: async (data: Partial<Curso>) => {
      const newCurso = { ...data, id: cursos.length + 1, estado: 1, created_at: new Date().toISOString(), max_estudiantes: data.max_estudiantes || 10 } as Curso;
      cursos.push(newCurso);
      return newCurso;
    },
    update: async (id: number, data: Partial<Curso>) => {
      const index = cursos.findIndex(c => c.id === id);
      if (index === -1) throw new Error('404');
      cursos[index] = { ...cursos[index], ...data };
      return cursos[index];
    },
    delete: async (id: number) => {
      const index = cursos.findIndex(c => c.id === id);
      if (index !== -1) cursos[index].estado = 0;
    }
  },
  estudiantes: {
    getAll: async () => estudiantes.filter(e => e.estado === 1),
    create: async (data: Partial<Estudiante>) => {
      const newEst = { ...data, id: estudiantes.length + 1, estado: 1, created_at: new Date().toISOString(), fecha_inscripcion: new Date().toISOString() } as Estudiante;
      estudiantes.push(newEst);
      return newEst;
    },
    update: async (id: number, data: Partial<Estudiante>) => {
      const index = estudiantes.findIndex(e => e.id === id);
      if (index === -1) throw new Error('404');
      estudiantes[index] = { ...estudiantes[index], ...data };
      return estudiantes[index];
    },
    delete: async (id: number) => {
      const index = estudiantes.findIndex(e => e.id === id);
      if (index !== -1) estudiantes[index].estado = 0;
    }
  },
  matriculas: {
    getAll: async () => {
      return matriculas.filter(m => m.estado === 1).map(m => {
        const est = estudiantes.find(e => e.id === m.estudiante_id);
        const cur = cursos.find(c => c.id === m.curso_id);
        const tut = tutores.find(t => t.id === m.tutor_id);
        return {
          ...m,
          estudiante_nombre: est?.nombre,
          curso_nombre: cur?.nombre,
          tutor_nombre: tut?.nombre,
          tarifa_por_hora: tut?.tarifa_por_hora
        };
      });
    },
    create: async (data: Partial<Matricula>) => {
      const newMat = { ...data, id: matriculas.length + 1, estado: 1, created_at: new Date().toISOString(), fecha_inscripcion: new Date().toISOString() } as Matricula;
      matriculas.push(newMat);
      return newMat;
    },
    delete: async (id: number) => {
      const index = matriculas.findIndex(m => m.id === id);
      if (index !== -1) matriculas[index].estado = 0;
    }
  },
  pagos: {
    getAll: async () => {
      return [...pagos].reverse().map(p => {
        const tut = tutores.find(t => t.id === p.tutor_id);
        return {
          ...p,
          tutor_nombre: tut?.nombre,
          tutor_email: tut?.email
        };
      });
    },
    create: async (data: Partial<Pago>) => {
      const newPago = { ...data, id: pagos.length + 1, estado: data.estado || EstadoPago.PENDIENTE, created_at: new Date().toISOString(), fecha_pago: new Date().toISOString() } as Pago;
      pagos.push(newPago);
      return newPago;
    }
  },
  dashboard: {
    getStats: async (): Promise<Stats> => {
      return {
        tutores_activos: tutores.filter(t => t.estado === 1).length,
        estudiantes_activos: estudiantes.filter(e => e.estado === 1).length,
        cursos_activos: cursos.filter(c => c.estado === 1).length,
        matriculas_activas: matriculas.filter(m => m.estado === 1).length,
        total_clases: clases.length,
        ingresos_pendientes: pagos.filter(p => p.estado === EstadoPago.PENDIENTE).reduce((acc, curr) => acc + curr.monto, 0)
      };
    },
    getAgenda: async (fecha: string) => {
      return clases
        .filter(c => c.fecha === fecha && (c.estado === EstadoClase.PROGRAMADA || c.estado === EstadoClase.COMPLETADA))
        .map(c => {
          const mat = matriculas.find(m => m.id === c.matricula_id);
          const est = estudiantes.find(e => e.id === mat?.estudiante_id);
          const tut = tutores.find(t => t.id === mat?.tutor_id);
          const cur = cursos.find(cu => cu.id === mat?.curso_id);
          return {
            ...c,
            estudiante_nombre: est?.nombre,
            tutor_nombre: tut?.nombre,
            curso_nombre: cur?.nombre,
            tarifa_por_hora: tut?.tarifa_por_hora
          };
        });
    },
    getResumenTutores: async (fecha: string) => {
      const activeTutores = tutores.filter(t => t.estado === 1);
      return activeTutores.map(t => {
        const todayClases = clases.filter(c => {
          const mat = matriculas.find(m => m.id === c.matricula_id);
          return c.fecha === fecha && mat?.tutor_id === t.id;
        });
        
        const uniqueCursos = Array.from(new Set(todayClases.map(c => {
          const mat = matriculas.find(m => m.id === c.matricula_id);
          return cursos.find(cu => cu.id === mat?.curso_id)?.nombre;
        }))).filter(Boolean).join(', ');

        const uniqueEsts = Array.from(new Set(todayClases.map(c => {
          const mat = matriculas.find(m => m.id === c.matricula_id);
          return estudiantes.find(e => e.id === mat?.estudiante_id)?.nombre;
        }))).filter(Boolean).join(', ');

        return {
          tutor_nombre: t.nombre,
          total_clases: todayClases.length,
          cursos: uniqueCursos,
          estudiantes: uniqueEsts
        };
      });
    }
  }
};
