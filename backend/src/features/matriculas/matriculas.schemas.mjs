// matriculas.schemas.mjs
export const MATRICULA_SELECT = `
  *,
  estudiantes:estudiante_id(nombre),
  cursos:curso_id(nombre,metodo,dias_turno,dias_schedule,tipo_clase,tipo_pago,max_estudiantes,grado_activo,grado_nombre,grado_color,costo_curso,pago_tutor),
  tutores:tutor_id(nombre,tarifa_por_hora)
`;
