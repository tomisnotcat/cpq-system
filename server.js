const express = require('express');
const cors = require('cors');
const { Redis } = require('@upstash/redis');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Redis 配置
let redis = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('Redis configured');
  }
} catch (e) {
  console.log('Redis not available:', e.message);
}

async function saveDb(data) {
  if (!redis) return;
  try {
    await redis.set('cpq_db', JSON.stringify(data), { EX: 86400 });
  } catch (e) {
    console.log('Save failed:', e.message);
  }
}

async function loadDb() {
  if (!redis) return null;
  try {
    const data = await redis.get('cpq_db');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.log('Load failed:', e.message);
    return null;
  }
}

// 启动时加载数据
let db = null;
let ready = false;

async function init() {
  const saved = await loadDb();
  if (saved) {
    db = saved;
    console.log('Loaded from Redis');
  } else {
    db = generateDefaultData();
    console.log('Using default data');
  }
  ready = true;
}

init();

// ==================== 默认数据 ====================
function generateDefaultData() {
  const productTemplates = [
    {
      id: 1,
      name: '服务器',
      description: '企业级服务器配置',
      basePrice: 5000,
      category: '硬件',
      attributes: [
        { id: 'cpu', name: 'CPU', type: 'select', required: true, options: [
          { value: '4核', price: 0 },
          { value: '8核', price: 2000 },
          { value: '16核', price: 5000 },
          { value: '32核', price: 10000 }
        ]},
        { id: 'ram', name: '内存', type: 'select', required: true, options: [
          { value: '16GB', price: 0 },
          { value: '32GB', price: 500 },
          { value: '64GB', price: 1200 },
          { value: '128GB', price: 3000 }
        ]},
        { id: 'storage', name: '存储', type: 'select', required: true, options: [
          { value: '512GB SSD', price: 0 },
          { value: '1TB SSD', price: 800 },
          { value: '2TB SSD', price: 2000 },
          { value: '4TB SSD', price: 5000 }
        ]},
        { id: 'support', name: '维保服务', type: 'select', required: true, options: [
          { value: '基础', price: 0 },
          { value: '专业', price: 1000 },
          { value: '企业', price: 3000 }
        ]}
      ]
    },
    {
      id: 2,
      name: '软件开发项目',
      description: '定制软件开发服务',
      basePrice: 10000,
      category: '服务',
      attributes: [
        { id: 'type', name: '项目类型', type: 'select', required: true, options: [
          { value: 'Web应用', price: 0 },
          { value: '移动App', price: 5000 },
          { value: '桌面软件', price: 8000 }
        ]},
        { id: 'pages', name: '页面数量', type: 'number', unit: '页', min: 1, pricePerUnit: 500 },
        { id: 'duration', name: '开发周期', type: 'select', required: true, options: [
          { value: '1个月', price: 0 },
          { value: '2个月', price: -2000 },
          { value: '3个月', price: -5000 }
        ]}
      ]
    },
    {
      id: 3,
      name: '云服务套餐',
      description: '云计算资源套餐',
      basePrice: 0,
      category: '云服务',
      attributes: [
        { id: 'instance', name: '实例类型', type: 'select', required: true, options: [
          { value: '入门型', price: 99 },
          { value: '标准型', price: 299 },
          { value: '专业型', price: 799 },
          { value: '企业型', price: 1999 }
        ]},
        { id: 'cpu', name: 'CPU', type: 'number', unit: '核', min: 1, max: 64, pricePerUnit: 50 },
        { id: 'ram', name: '内存', type: 'number', unit: 'GB', min: 1, max: 128, pricePerUnit: 30 }
      ]
    }
  ];

  const customers = [
    { id: 1, name: '演示客户', company: '示例公司', email: 'demo@cpq.com', phone: '13800138000', address: '北京市', created_at: new Date().toISOString() }
  ];

  const users = [
    { id: 1, username: 'admin', password: 'admin123', name: '管理员', role: 'admin', created_at: new Date().toISOString() }
  ];

  const quotes = [];

  return { productTemplates, customers, users, quotes, nextIds: { template: 4, customer: 2, user: 2, quote: 1 } };
}

let db = generateDefaultData();

// ==================== 用户 API ====================

app.post('/api/register', (req, res) => {
  const { username, password, name, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (db.users.find(u => u.username === username)) return res.status(400).json({ error: '用户名已存在' });
  
  const user = {
    id: db.nextIds.user++,
    username,
    password,
    name: name || username,
    email: email || '',
    role: 'user',
    created_at: new Date().toISOString()
  };
  db.users.push(user);
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
});

// ==================== 产品模板 API ====================

app.get('/api/templates', (req, res) => {
  res.json(db.productTemplates);
});

app.get('/api/templates/:id', (req, res) => {
  const template = db.productTemplates.find(t => t.id === parseInt(req.params.id));
  if (!template) return res.status(404).json({ error: '模板不存在' });
  res.json(template);
});

app.post('/api/templates', (req, res) => {
  const { name, description, basePrice, category, attributes } = req.body;
  if (!name) return res.status(400).json({ error: '模板名称不能为空' });
  
  const template = {
    id: db.nextIds.template++,
    name,
    description: description || '',
    basePrice: basePrice || 0,
    category: category || '其他',
    attributes: attributes || []
  };
  db.productTemplates.push(template);
  res.json(template);
});

app.delete('/api/templates/:id', (req, res) => {
  const idx = db.productTemplates.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '模板不存在' });
  db.productTemplates.splice(idx, 1);
  res.json({ success: true });
});

// ==================== 客户 API ====================

app.get('/api/customers', (req, res) => {
  const { search } = req.query;
  let customers = db.customers;
  if (search) {
    const s = search.toLowerCase();
    customers = customers.filter(c => c.name.toLowerCase().includes(s) || c.company.toLowerCase().includes(s));
  }
  res.json(customers);
});

app.post('/api/customers', (req, res) => {
  const { name, company, email, phone, address } = req.body;
  if (!name) return res.status(400).json({ error: '客户名称不能为空' });
  
  const customer = {
    id: db.nextIds.customer++,
    name,
    company: company || '',
    email: email || '',
    phone: phone || '',
    address: address || '',
    created_at: new Date().toISOString()
  };
  db.customers.push(customer);
  res.json(customer);
});

app.put('/api/customers/:id', (req, res) => {
  const customer = db.customers.find(c => c.id === parseInt(req.params.id));
  if (!customer) return res.status(404).json({ error: '客户不存在' });
  
  const { name, company, email, phone, address } = req.body;
  if (name) customer.name = name;
  if (company !== undefined) customer.company = company;
  if (email !== undefined) customer.email = email;
  if (phone !== undefined) customer.phone = phone;
  if (address !== undefined) customer.address = address;
  
  res.json(customer);
});

app.delete('/api/customers/:id', (req, res) => {
  const idx = db.customers.findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '客户不存在' });
  db.customers.splice(idx, 1);
  res.json({ success: true });
});

// ==================== 价格计算 ====================

function calculatePrice(templateId, config) {
  const template = db.productTemplates.find(t => t.id === templateId);
  if (!template) throw new Error('模板不存在');

  let totalPrice = template.basePrice || 0;
  const configDetails = [];

  for (const attr of template.attributes) {
    const value = config[attr.id];
    if (value === undefined || value === null || value === '') continue;

    let attrPrice = 0;

    if (attr.type === 'select' && attr.options) {
      const option = attr.options.find(o => o.value === value);
      if (option) {
        attrPrice = option.price || 0;
        configDetails.push({ attribute: attr.name, value, price: attrPrice });
      }
    } else if (attr.type === 'number' && attr.pricePerUnit) {
      const num = parseFloat(value) || 0;
      const min = attr.min || 0;
      const effectiveNum = Math.max(0, num - min);
      attrPrice = effectiveNum * attr.pricePerUnit;
      configDetails.push({ attribute: attr.name, value: `${value}${attr.unit || ''}`, price: attrPrice });
    } else if (attr.type === 'boolean' && value === true) {
      attrPrice = attr.price || 0;
      configDetails.push({ attribute: attr.name, value: '是', price: attrPrice });
    }

    totalPrice += attrPrice;
  }

  return { totalPrice, configDetails };
}

app.post('/api/calculate', (req, res) => {
  try {
    const { templateId, config } = req.body;
    const result = calculatePrice(templateId, config);
    const template = db.productTemplates.find(t => t.id === templateId);
    res.json({
      templateId,
      templateName: template?.name,
      basePrice: template?.basePrice || 0,
      config: result.configDetails,
      totalPrice: result.totalPrice,
      currency: 'CNY'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 报价单 API ====================

app.post('/api/quotes', (req, res) => {
  const { templateId, config, customerId, customerName, validDays, notes } = req.body;
  
  const { totalPrice, configDetails } = calculatePrice(templateId, config);
  
  const quote = {
    id: db.nextIds.quote++,
    templateId,
    config,
    configDetails,
    customerId: customerId || null,
    customerName: customerName || '',
    totalPrice,
    validDays: validDays || 30,
    notes: notes || '',
    status: 'draft',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + (validDays || 30) * 24 * 60 * 60 * 1000).toISOString()
  };
  
  db.quotes.push(quote);
  res.json(quote);
});

app.get('/api/quotes', (req, res) => {
  const { status, customerId } = req.query;
  let quotes = db.quotes;
  
  if (status) quotes = quotes.filter(q => q.status === status);
  if (customerId) quotes = quotes.filter(q => q.customerId === parseInt(customerId));
  
  quotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json(quotes);
});

app.get('/api/quotes/:id', (req, res) => {
  const quote = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!quote) return res.status(404).json({ error: '报价单不存在' });
  
  const template = db.productTemplates.find(t => t.id === quote.templateId);
  quote.template = template;
  
  if (quote.customerId) {
    const customer = db.customers.find(c => c.id === quote.customerId);
    quote.customer = customer;
  }
  
  res.json(quote);
});

app.put('/api/quotes/:id/status', (req, res) => {
  const { status } = req.body;
  const quote = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!quote) return res.status(404).json({ error: '报价单不存在' });
  
  quote.status = status;
  quote.updated_at = new Date().toISOString();
  
  res.json(quote);
});

app.put('/api/quotes/:id', (req, res) => {
  const quote = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!quote) return res.status(404).json({ error: '报价单不存在' });
  
  const { customerName, validDays, notes, config } = req.body;
  if (customerName !== undefined) quote.customerName = customerName;
  if (validDays !== undefined) {
    quote.validDays = validDays;
    quote.expires_at = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();
  }
  if (notes !== undefined) quote.notes = notes;
  if (config) {
    quote.config = config;
    const result = calculatePrice(quote.templateId, config);
    quote.totalPrice = result.totalPrice;
    quote.configDetails = result.configDetails;
  }
  
  quote.updated_at = new Date().toISOString();
  res.json(quote);
});

app.delete('/api/quotes/:id', (req, res) => {
  const idx = db.quotes.findIndex(q => q.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '报价单不存在' });
  db.quotes.splice(idx, 1);
  res.json({ success: true });
});

app.post('/api/quotes/:id/copy', (req, res) => {
  const quote = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!quote) return res.status(404).json({ error: '报价单不存在' });
  
  const newQuote = {
    id: db.nextIds.quote++,
    templateId: quote.templateId,
    config: { ...quote.config },
    configDetails: [...quote.configDetails],
    customerId: quote.customerId,
    customerName: quote.customerName,
    totalPrice: quote.totalPrice,
    validDays: 30,
    notes: quote.notes,
    status: 'draft',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  db.quotes.push(newQuote);
  res.json(newQuote);
});

// ==================== 统计 API ====================

app.get('/api/stats', (req, res) => {
  res.json({
    templates: db.productTemplates.length,
    customers: db.customers.length,
    quotes: db.quotes.length,
    quotesByStatus: {
      draft: db.quotes.filter(q => q.status === 'draft').length,
      sent: db.quotes.filter(q => q.status === 'sent').length,
      accepted: db.quotes.filter(q => q.status === 'accepted').length,
      rejected: db.quotes.filter(q => q.status === 'rejected').length
    },
    totalQuoteValue: db.quotes.reduce((sum, q) => sum + q.totalPrice, 0)
  });
});

// ==================== 启动 ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CPQ Server running on port ${PORT}`);
});
