import * as authService from './auth.service.mjs';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Campos requeridos: email, password' });
    }
    const result = await authService.loginUser({ email, password });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Campos requeridos: email, password' });
    }
    const result = await authService.registerUser({ email, password });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const result = await authService.logoutUser(req.accessToken);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const result = await authService.getMe(req.user.id, req.accessToken);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}
