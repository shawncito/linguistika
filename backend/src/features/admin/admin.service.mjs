import * as repo from './admin.repository.mjs';

export const createEmployee = (body) => repo.createEmployee(body);
export const listEmployees = () => repo.listEmployees();
export const updateEmployee = (id, body) => repo.updateEmployee(id, body);
export const deleteEmployee = (id) => repo.deleteEmployee(id);
export const listarPaginas = () => repo.listarPaginasAdmin();
export const togglePagina = (slug, body) => repo.togglePaginaAdmin(slug, body);
