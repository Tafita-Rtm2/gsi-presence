# Créer server/routes/auth.js
cat > server/routes/auth.js << 'EOF'
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const sign = (payload, exp='8h') => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn:exp });
router.post('/admin', (req, res) => {
  const { code } = req.body;
  if (!code || code !== process.env.ADMIN_SECRET_CODE) return res.status(401).json({ error:'Code incorrect' });
  res.json({ token: sign({ role:'admin', id:'admin' }), role:'admin' });
});
router.post('/scanner', (req, res) => {
  const { code } = req.body;
  if (!code || code !== process.env.ADMIN_SECRET_CODE) return res.status(401).json({ error:'Code incorrect' });
  res.json({ token: sign({ role:'scanner', id:'scanner' }, '24h'), role:'scanner' });
});
router.get('/verify', auth, (req, res) => res.json({ ok:true, user:req.user }));
module.exports = router;
EOF
