# Créer server/index.js
cat > server/index.js << 'EOF'
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, transports: ['websocket','polling'] });

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc:["'self'"], scriptSrc:["'self'","'unsafe-inline'","'unsafe-eval'","cdnjs.cloudflare.com","cdn.jsdelivr.net"], styleSrc:["'self'","'unsafe-inline'","fonts.googleapis.com","cdnjs.cloudflare.com"], fontSrc:["'self'","fonts.gstatic.com"], imgSrc:["'self'","data:","blob:"], connectSrc:["'self'","ws:","wss:"] } } }));
app.use(cors());
app.use(compression());
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));
app.use('/api/', rateLimit({ windowMs:60000, max:500 }));
app.use(express.static(path.join(__dirname,'../public')));
app.use('/uploads', express.static(path.join(__dirname,'../data/uploads')));

async function initStorage() {
  await fs.ensureDir(path.join(__dirname,'../data/uploads/photos'));
  const dbPath = path.join(__dirname,'../data/db.json');
  if (!await fs.pathExists(dbPath)) {
    await fs.writeJSON(dbPath, { users:[], presences:[], notifications:[], settings:{ created_at: new Date().toISOString() } }, { spaces:2 });
    console.log('Base de données initialisée');
  }
}

global.io = io;
io.on('connection', socket => {
  socket.on('join:admin', () => socket.join('admin'));
  socket.on('join:scanner', () => socket.join('scanner'));
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/presence', require('./routes/presence'));
app.use('/api/scan', require('./routes/scan'));
app.use('/api/stats', require('./routes/stats'));

app.get('/', (_, r) => r.sendFile(path.join(__dirname,'../public/index.html')));
app.get('/admin*', (_, r) => r.sendFile(path.join(__dirname,'../public/admin/index.html')));
app.get('/scan*', (_, r) => r.sendFile(path.join(__dirname,'../public/scan/index.html')));
app.get('/health', (_, r) => r.json({ ok:true, time: new Date().toISOString() }));
app.use((_, res) => res.status(404).json({ error:'Route inconnue' }));

const PORT = process.env.PORT || 3000;
initStorage().then(() => {
  server.listen(PORT, () => {
    console.log('\n══════════════════════════════');
    console.log('  GSI PRESENCE SYSTEM v2.0');
    console.log('══════════════════════════════');
    console.log('  http://localhost:' + PORT);
    console.log('  http://localhost:' + PORT + '/admin');
    console.log('  http://localhost:' + PORT + '/scan');
    console.log('══════════════════════════════\n');
  });
});
EOF
