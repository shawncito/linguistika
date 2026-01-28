export function requireRoles(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const role = req.userRole;
    if (!role) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!allowed.includes(role)) {
      return res.status(403).json({ error: 'No autorizado', role, allowed });
    }

    return next();
  };
}
