import * as svc from './activity.service.mjs';

export async function list(req, res, next) {
  try {
    const { limit, offset, q } = req.query;
    res.json(await svc.list({ limitRaw: limit, offsetRaw: offset, q }));
  } catch (err) { next(err); }
}
