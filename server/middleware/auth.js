const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Réservé à l\'administrateur' });
  next();
}

function scanOrAdmin(req, res, next) {
  if (!['admin', 'scanner'].includes(req.user?.role))
    return res.status(403).json({ error: 'Accès refusé' });
  next();
}

module.exports = { auth, adminOnly, scanOrAdmin };

