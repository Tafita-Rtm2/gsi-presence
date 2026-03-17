# Créer server/utils/db.js
cat > server/utils/db.js << 'EOF'
const path = require('path');
const fs = require('fs-extra');
const DB = path.join(__dirname, '../../data/db.json');
const EMPTY = { users:[], presences:[], notifications:[], settings:{} };
async function read() { try { return await fs.readJSON(DB); } catch { return {...EMPTY}; } }
async function write(data) { await fs.writeJSON(DB, data, { spaces:2 }); }
async function getUsers() { return (await read()).users || []; }
async function getUserById(id) { return (await getUsers()).find(u => u.id === id) || null; }
async function getUserByQR(qr) { return (await getUsers()).find(u => u.qr_code === qr) || null; }
async function getUserByEmail(email) { return (await getUsers()).find(u => u.email === email) || null; }
async function saveUser(user) { const db=await read(); const i=db.users.findIndex(u=>u.id===user.id); if(i>=0) db.users[i]=user; else db.users.push(user); await write(db); return user; }
async function deleteUser(id) { const db=await read(); db.users=db.users.filter(u=>u.id!==id); await write(db); }
async function savePresence(p) { const db=await read(); if(!db.presences) db.presences=[]; db.presences.push(p); await write(db); return p; }
async function getPresences(f={}) { const db=await read(); let list=db.presences||[]; if(f.date) list=list.filter(p=>p.date===f.date); if(f.month) list=list.filter(p=>p.date&&p.date.startsWith(f.month)); if(f.year) list=list.filter(p=>p.date&&p.date.startsWith(f.year)); if(f.userId) list=list.filter(p=>p.user_id===f.userId); if(f.type) list=list.filter(p=>p.type===f.type); return list; }
async function getTodayPresences() { return getPresences({ date: new Date().toISOString().split('T')[0] }); }
async function saveNotification(n) { const db=await read(); if(!db.notifications) db.notifications=[]; db.notifications.unshift(n); if(db.notifications.length>200) db.notifications=db.notifications.slice(0,200); await write(db); }
async function getNotifications(limit=50) { const db=await read(); return (db.notifications||[]).slice(0,limit); }
async function markNotifRead(id) { const db=await read(); const n=db.notifications?.find(x=>x.id===id); if(n){n.read=true; await write(db);} }
module.exports = { read, write, getUsers, getUserById, getUserByQR, getUserByEmail, saveUser, deleteUser, savePresence, getPresences, getTodayPresences, saveNotification, getNotifications, markNotifRead };
EOF
