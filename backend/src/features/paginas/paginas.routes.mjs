import { Router } from 'express';
import { supabaseForToken } from '../../shared/config/supabaseClient.mjs';
import { buildPublicPaginas, isPaginasTableMissingError } from './paginas.constants.mjs';

const router = Router();

/**
 * GET /api/v1/paginas-estado
 * Accesible para todos los usuarios autenticados.
 * Devuelve el estado activa/inactiva de cada página.
 */
router.get('/', async (req, res, next) => {
  try {
    const client = supabaseForToken(req.accessToken);
    const { data, error } = await client
      .from('paginas_mantenimiento')
      .select('slug, nombre, activa, mensaje')
      .order('slug');
    if (error) {
      if (isPaginasTableMissingError(error)) {
        return res.json(buildPublicPaginas());
      }
      throw error;
    }
    res.json(buildPublicPaginas(data ?? []));
  } catch (err) {
    next(err);
  }
});

export default router;
