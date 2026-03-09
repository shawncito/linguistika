/**
 * tesoreria.service.mjs
 */

import * as repo from './tesoreria.repository.mjs';

export const getResumenEncargados = () => repo.getResumenEncargados();
export const getResumenTutores = () => repo.getResumenTutores();
export const getDiario = (params) => repo.getDiario(params);
export const getMovimientosEncargado = (params) => repo.getMovimientosEncargado(params);
export const getMovimientosTutor = (params) => repo.getMovimientosTutor(params);
export const exportDiario = (params) => repo.exportDiario(params);
export const exportCuenta = (params) => repo.exportCuenta(params);
export const getPagoAplicaciones = (pagoId) => repo.getPagoAplicaciones(pagoId);
export const getResumen = () => repo.getResumen();
export const getBolsa = () => repo.getBolsa();
export const getPorcentajeEncargados = () => repo.getPorcentajeEncargados();
export const getEsperadoDiario = () => repo.getEsperadoDiario();
export const getObligacionesEncargado = (id) => repo.getObligacionesEncargado(id);
export const getObligacionesTutor = (id) => repo.getObligacionesTutor(id);
export const registrarPagoEncargado = (params) => repo.registrarPagoEncargado(params);
export const registrarPagoTutor = (params) => repo.registrarPagoTutor(params);
export const actualizarPagoComprobante = (params) => repo.actualizarPagoComprobante(params);
export const registrarCobroGrupal = (params) => repo.registrarCobroGrupal(params);
export const verifyUserPassword = (email, password) => repo.verifyUserPassword(email, password);
