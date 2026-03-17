# Créer server/routes/stats.js
cat > server/routes/stats.js << 'EOF'
const router = require('express').Router();
const { auth, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');
router.get('/dashboard', auth, adminOnly, async (req, res) => {
  const users = await db.getUsers();
  const today = new Date().toISOString().split('T')[0];
  const todayP = await db.getTodayPresences();
  const allP = await db.getPresences();
  const notifs = await db.getNotifications(20);
  const actifs = users.filter(u=>u.actif);
  const count = t => actifs.filter(u=>u.type===t).length;
  const uniq = (list,t) => new Set(list.filter(p=>p.type===t).map(p=>p.user_id)).size;
  res.json({ totaux:{etudiants:count('etudiant'),professeurs:count('professeur'),travailleurs:count('travailleur'),total:actifs.length}, aujourdhui:{etudiants:uniq(todayP,'etudiant'),professeurs:uniq(todayP,'professeur'),travailleurs:uniq(todayP,'travailleur'),scans_total:todayP.length,absent_etudiants:count('etudiant')-uniq(todayP,'etudiant'),absent_professeurs:count('professeur')-uniq(todayP,'professeur'),absent_travailleurs:count('travailleur')-uniq(todayP,'travailleur')}, total_presences:allP.length, recents:todayP.slice(-30).reverse(), notifications:notifs });
});
router.get('/weekly', auth, adminOnly, async (req, res) => {
  const allP = await db.getPresences();
  const days = [];
  for(let i=6;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    const date=d.toISOString().split('T')[0];
    const dp=allP.filter(p=>p.date===date);
    days.push({ date, label:d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'}), total:dp.length, etudiants:new Set(dp.filter(p=>p.type==='etudiant').map(p=>p.user_id)).size, professeurs:new Set(dp.filter(p=>p.type==='professeur').map(p=>p.user_id)).size, travailleurs:new Set(dp.filter(p=>p.type==='travailleur').map(p=>p.user_id)).size });
  }
  res.json(days);
});
router.get('/member/:id', auth, adminOnly, async (req, res) => {
  const user = await db.getUserById(req.params.id);
  if(!user) return res.status(404).json({ error:'Introuvable' });
  const all = await db.getPresences({ userId:req.params.id });
  const byMonth = {};
  all.forEach(p => { const m=p.date?.substring(0,7); if(m){ byMonth[m]=(byMonth[m]||0)+1; } });
  res.json({ total_jours_presents:new Set(all.map(p=>p.date)).size, total_scans:all.length, par_mois:byMonth, dernier_scan:all.at(-1)||null });
});
router.get('/notifications', auth, adminOnly, async (req, res) => res.json(await db.getNotifications(50)));
router.patch('/notifications/:id/read', auth, adminOnly, async (req, res) => { await db.markNotifRead(req.params.id); res.json({ok:true}); });
router.patch('/notifications/read-all', auth, adminOnly, async (req, res) => { const db2=await db.read(); (db2.notifications||[]).forEach(n=>n.read=true); await db.write(db2); res.json({ok:true}); });
module.exports = router;
EOF
