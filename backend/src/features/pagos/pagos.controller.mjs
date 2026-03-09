import * as service from './pagos.service.mjs';

export async function getAll(req, res, next) {
  try { res.json(await service.getAll()); } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const data = await service.getById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(data);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try { res.status(201).json(await service.create(req.body, req.user?.id)); } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try { res.json(await service.update(req.params.id, req.body, req.user?.id)); } catch (err) { next(err); }
}

export async function getPendientesResumen(req, res, next) {
  try { res.json(await service.getPendientesResumen(req.query)); } catch (err) { next(err); }
}

export async function getPendientesResumenTutores(_req, res, next) {
  try { res.json(await service.getPendientesResumenTutores()); } catch (err) { next(err); }
}

export async function getPendientesDetalleTutor(req, res, next) {
  try { res.json(await service.getPendientesDetalleTutor(req.query)); } catch (err) { next(err); }
}

export async function getLibroDiario(req, res, next) {
  try { res.json(await service.getLibroDiario(req.query)); } catch (err) { next(err); }
}

export async function createComprobanteIngreso(req, res, next) {
  try { res.status(201).json(await service.createComprobanteIngreso(req.body, req.user?.id)); } catch (err) { next(err); }
}

export async function registrarMovimientoManual(req, res, next) {
  try { res.status(201).json(await service.registrarMovimientoManual(req.body, req.user?.id)); } catch (err) { next(err); }
}

export async function uploadMovimientoComprobante(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Debe adjuntar un archivo (file)' });
    const host = req.get('host');
    const proto = (req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : req.protocol);
    const publicUrl = `${proto}://${host}/uploads/comprobantes/${encodeURIComponent(req.file.filename)}`;
    res.status(201).json(await service.uploadMovimientoComprobante(req.params.id, publicUrl));
  } catch (err) { next(err); }
}

export async function bulkComprobante(req, res, next) {
  try { res.json(await service.bulkComprobante(req.body?.ids, req.body?.comprobante_url)); } catch (err) { next(err); }
}
