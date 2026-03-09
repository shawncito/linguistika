/**
 * finanzas.service.mjs
 */

import * as repo from './finanzas.repository.mjs';

export const listMovimientos = (filters) => repo.listMovimientos(filters);

export const createComprobante = ({ body, userId }) =>
  repo.createComprobante({ ...body, userId });

export const listComprobantes = () => repo.listComprobantes();

export const updateComprobanteEstado = (id, { body, userId }) =>
  repo.updateComprobanteEstado(id, { ...body, userId });
