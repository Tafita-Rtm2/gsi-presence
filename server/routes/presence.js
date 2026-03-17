# Créer server/routes/presence.js
cat > server/routes/presence.js << 'EOF'
const router = require('express').Router();
const { v4 } = require('uuid');
const { auth, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');
router.get('/', auth, adminOnly, async (req, res) => {
  const { date, month, year, type, user_id } = req.query;
  const list = await db.getPresences({ date, month, year, type, userId:user_id });
  res.json(list.sort((a,b) => b.timestamp.localeCompare(a.timestamp)));
});
router.get('/today', auth, async (req, res) => res.json(await db.getTodayPresences()));
router.get('/member/:id', auth, adminOnly, async (req, res) => {
  const user = await db.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error:'Introuvable' });
  const all = await db.getPresences({ userId:req.params.id });
  const byDate = {};
  all.forEach(p => { if(!byDate[p.date]) byDate[p.date]=[]; byDate[p.date].push(p); });
  res.json({ user:{id:user.id,nom_complet:user.nom_complet,type:user.type,photo:user.photo,campus:user.campus,numero_id:user.numero_id}, presences:byDate, total_jours:Object.keys(byDate).length, total_scans:all.length });
});
router.get('/absences', auth, adminOnly, async (req, res) => {
  const { date, month, year, type } = req.query;
  if(!date&&!month&&!year) return res.status(400).json({ error:'date/month/year requis' });
  const users = (await db.getUsers()).filter(u => u.actif && (!type||u.type===type));
  const presences = await db.getPresences({ date, month, year });
  const presentIds = new Set(presences.map(p=>p.user_id));
  const absents = users.filter(u=>!presentIds.has(u.id)).map(({password,qr_image,qr_code,...u})=>u);
  res.json({ periode:date||month||year, total_actifs:users.length, presents:presentIds.size, absents:absents.length, liste_absents:absents });
});
router.post('/check-absences', auth, adminOnly, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const users = (await db.getUsers()).filter(u=>u.actif);
  const todayP = await db.getTodayPresences();
  const presentIds = new Set(todayP.map(p=>p.user_id));
  const absents = users.filter(u=>!presentIds.has(u.id));
  for(const u of absents) {
    const notif = { id:v4(), type:'absence', user_id:u.id, nom_complet:u.nom_complet, user_type:u.type, photo:u.photo, message:`${u.nom_complet} (${u.type}) est absent aujourd'hui`, severity:'info', read:false, date:today, timestamp:new Date().toISOString() };
    await db.saveNotification(notif);
    if(global.io) global.io.to('admin').emit('notif:new',notif);
  }
  res.json({ checked:users.length, presents:presentIds.size, absents:absents.length });
});
module.exports = router;
EOF
