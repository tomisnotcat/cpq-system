const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Redis 配置 (可选)
let redis = null;
let useRedis = false;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    useRedis = true;
    console.log('Redis enabled');
  } else {
    console.log('Using memory storage');
  }
} catch (e) {
  console.log('Redis not available');
}

async function saveDb(data) {
  if (!useRedis || !redis) return;
  try {
    await redis.set('cpq_db', JSON.stringify(data), { EX: 86400 });
  } catch(e) { console.log('Save error:', e.message); }
}

async function loadDb() {
  if (!useRedis || !redis) return null;
  try {
    const data = await redis.get('cpq_db');
    return data ? JSON.parse(data) : null;
  } catch(e) { return null; }
}

// 默认数据
function generateDefaultData() {
  return {
    productTemplates: [
      { id: 1, name: '服务器', description: '企业级服务器配置', basePrice: 5000, category: '硬件', attributes: [
        { id: 'cpu', name: 'CPU', type: 'select', required: true, options: [{value: '4核',price: 0},{value: '8核',price: 2000},{value: '16核',price: 5000},{value: '32核',price: 10000}]},
        { id: 'ram', name: '内存', type: 'select', required: true, options: [{value: '16GB',price: 0},{value: '32GB',price: 500},{value: '64GB',price: 1200},{value: '128GB',price: 3000}]},
        { id: 'storage', name: '存储', type: 'select', required: true, options: [{value: '512GB SSD',price: 0},{value: '1TB SSD',price: 800},{value: '2TB SSD',price: 2000},{value: '4TB SSD',price: 5000}]},
        { id: 'support', name: '维保服务', type: 'select', required: true, options: [{value: '基础',price: 0},{value: '专业',price: 1000},{value: '企业',price: 3000}]}
      ]},
      { id: 2, name: '软件开发项目', description: '定制软件开发服务', basePrice: 10000, category: '服务', attributes: [
        { id: 'type', name: '项目类型', type: 'select', required: true, options: [{value: 'Web应用',price: 0},{value: '移动App',price: 5000},{value: '桌面软件',price: 8000}]},
        { id: 'pages', name: '页面数量', type: 'number', unit: '页', min: 1, pricePerUnit: 500 },
        { id: 'duration', name: '开发周期', type: 'select', required: true, options: [{value: '1个月',price: 0},{value: '2个月',price: -2000},{value: '3个月',price: -5000}]}
      ]},
      { id: 3, name: '云服务套餐', description: '云计算资源套餐', basePrice: 0, category: '云服务', attributes: [
        { id: 'instance', name: '实例类型', type: 'select', required: true, options: [{value: '入门型',price: 99},{value: '标准型',price: 299},{value: '专业型',price: 799},{value: '企业型',price: 1999}]},
        { id: 'cpu', name: 'CPU', type: 'number', unit: '核', min: 1, max: 64, pricePerUnit: 50 },
        { id: 'ram', name: '内存', type: 'number', unit: 'GB', min: 1, max: 128, pricePerUnit: 30 }
      ]}
    ],
    customers: [{ id: 1, name: '演示客户', company: '示例公司', email: 'demo@cpq.com', phone: '13800138000', address: '北京市', created_at: new Date().toISOString() }],
    users: [{ id: 1, username: 'admin', password: 'admin123', name: '管理员', role: 'admin', created_at: new Date().toISOString() }],
    quotes: [],
    nextIds: { template: 4, customer: 2, user: 2, quote: 1 }
  };
}

let db = generateDefaultData();

// 初始化
loadDb().then(saved => { if (saved) { db = saved; console.log('Loaded from Redis'); } });

// 保存数据的辅助函数
function saveData() { saveDb(db); }

// 用户 API
app.post('/api/register', (req, res) => {
  const { username, password, name, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (db.users.find(u => u.username === username)) return res.status(400).json({ error: '用户名已存在' });
  const user = { id: db.nextIds.user++, username, password, name: name || username, email: email || '', role: 'user', created_at: new Date().toISOString() };
  db.users.push(user);
  saveData();
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
});

// 产品模板 API
app.get('/api/templates', (req, res) => { res.json(db.productTemplates); });
app.get('/api/templates/:id', (req, res) => { const t = db.productTemplates.find(t => t.id === parseInt(req.params.id)); if (!t) return res.status(404).json({ error: '模板不存在' }); res.json(t); });

app.post('/api/templates', (req, res) => {
  const { name, description, basePrice, category, attributes } = req.body;
  if (!name) return res.status(400).json({ error: '模板名称不能为空' });
  const template = { id: db.nextIds.template++, name, description: description || '', basePrice: basePrice || 0, category: category || '其他', attributes: attributes || [] };
  db.productTemplates.push(template);
  saveData();
  res.json(template);
});

app.delete('/api/templates/:id', (req, res) => {
  const idx = db.productTemplates.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '模板不存在' });
  db.productTemplates.splice(idx, 1);
  saveData();
  res.json({ success: true });
});

// 客户 API
app.get('/api/customers', (req, res) => {
  const { search } = req.query;
  let list = db.customers;
  if (search) { const s = search.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(s) || c.company.toLowerCase().includes(s)); }
  res.json(list);
});

app.post('/api/customers', (req, res) => {
  const { name, company, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: '客户名称不能为空' });
  const customer = { id: db.nextIds.customer++, name, company: company || '', email: email || '', phone: phone || '', address: address || '', created_at: new Date().toISOString() };
  db.customers.push(customer);
  saveData();
  res.json(customer);
});

app.put('/api/customers/:id', (req, res) => {
  const c = db.customers.find(c => c.id === parseInt(req.params.id));
  if (!c) return res.status(404).json({ error: '客户不存在' });
  const { name, company, email, phone, address } = req.body;
  if (name) c.name = name;
  if (company !== undefined) c.company = company;
  if (email !== undefined) c.email = email;
  if (phone !== undefined) c.phone = phone;
  if (address !== undefined) c.address = address;
  saveData();
  res.json(c);
});

app.delete('/api/customers/:id', (req, res) => {
  const idx = db.customers.findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '客户不存在' });
  db.customers.splice(idx, 1);
  saveData();
  res.json({ success: true });
});

// 价格计算
function calcPrice(templateId, config) {
  const t = db.productTemplates.find(t => t.id === templateId);
  if (!t) throw new Error('模板不存在');
  let total = t.basePrice || 0;
  const details = [];
  for (const attr of t.attributes) {
    const val = config[attr.id];
    if (val === undefined || val === null || val === '') continue;
    let price = 0;
    if (attr.type === 'select' && attr.options) {
      const opt = attr.options.find(o => o.value === val);
      if (opt) { price = opt.price || 0; details.push({ attribute: attr.name, value: val, price }); }
    } else if (attr.type === 'number' && attr.pricePerUnit) {
      const num = parseFloat(val) || 0;
      price = Math.max(0, num - (attr.min || 0)) * attr.pricePerUnit;
      details.push({ attribute: attr.name, value: `${val}${attr.unit || ''}`, price });
    } else if (attr.type === 'boolean' && val === true) {
      price = attr.price || 0;
      details.push({ attribute: attr.name, value: '是', price });
    }
    total += price;
  }
  return { total, details };
}

app.post('/api/calculate', (req, res) => {
  try {
    const { templateId, config } = req.body;
    const { total, details } = calcPrice(templateId, config);
    const t = db.productTemplates.find(t => t.id === templateId);
    res.json({ templateId, templateName: t?.name, basePrice: t?.basePrice || 0, config: details, totalPrice: total, currency: 'CNY' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 报价单 API
app.post('/api/quotes', (req, res) => {
  const { templateId, config, customerId, customerName, validDays, notes } = req.body;
  const { total, details } = calcPrice(templateId, config);
  const quote = { id: db.nextIds.quote++, templateId, config, configDetails: details, customerId: customerId || null, customerName: customerName || '', totalPrice: total, validDays: validDays || 30, notes: notes || '', status: 'draft', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + (validDays || 30) * 86400000).toISOString() };
  db.quotes.push(quote);
  saveData();
  res.json(quote);
});

app.get('/api/quotes', (req, res) => {
  const { status } = req.query;
  let list = db.quotes;
  if (status) list = list.filter(q => q.status === status);
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(list);
});

app.get('/api/quotes/:id', (req, res) => {
  const q = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!q) return res.status(404).json({ error: '报价单不存在' });
  q.template = db.productTemplates.find(t => t.id === q.templateId);
  res.json(q);
});

app.put('/api/quotes/:id/status', (req, res) => {
  const q = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!q) return res.status(404).json({ error: '报价单不存在' });
  q.status = req.body.status;
  q.updated_at = new Date().toISOString();
  saveData();
  res.json(q);
});

app.put('/api/quotes/:id', (req, res) => {
  const q = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!q) return res.status(404).json({ error: '报价单不存在' });
  const { customerName, validDays, notes, config } = req.body;
  if (customerName !== undefined) q.customerName = customerName;
  if (validDays !== undefined) { q.validDays = validDays; q.expires_at = new Date(Date.now() + validDays * 86400000).toISOString(); }
  if (notes !== undefined) q.notes = notes;
  if (config) { q.config = config; const { total, details } = calcPrice(q.templateId, config); q.totalPrice = total; q.configDetails = details; }
  q.updated_at = new Date().toISOString();
  saveData();
  res.json(q);
});

app.delete('/api/quotes/:id', (req, res) => {
  const idx = db.quotes.findIndex(q => q.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '报价单不存在' });
  db.quotes.splice(idx, 1);
  saveData();
  res.json({ success: true });
});

app.post('/api/quotes/:id/copy', (req, res) => {
  const q = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!q) return res.status(404).json({ error: '报价单不存在' });
  const newQuote = { id: db.nextIds.quote++, templateId: q.templateId, config: {...q.config}, configDetails: [...q.configDetails], customerId: q.customerId, customerName: q.customerName, totalPrice: q.totalPrice, validDays: 30, notes: q.notes, status: 'draft', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 2592000000).toISOString() };
  db.quotes.push(newQuote);
  saveData();
  res.json(newQuote);
});

// 统计 API
app.get('/api/stats', (req, res) => {
  res.json({
    templates: db.productTemplates.length,
    customers: db.customers.length,
    quotes: db.quotes.length,
    quotesByStatus: { draft: db.quotes.filter(q => q.status === 'draft').length, sent: db.quotes.filter(q => q.status === 'sent').length, accepted: db.quotes.filter(q => q.status === 'accepted').length, rejected: db.quotes.filter(q => q.status === 'rejected').length },
    totalQuoteValue: db.quotes.reduce((s, q) => s + q.totalPrice, 0)
  });
});

app.listen(3000, () => { console.log('CPQ Server running'); });
