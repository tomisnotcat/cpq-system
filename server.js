const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '请求过于频繁，请稍后再试' }
});

const app = express();
app.use(cors());
app.use(generalLimiter);
app.use(express.json({ limit: '2mb' }));

// ==================== Redis 持久化 ====================
let redis = null;
let useRedis = false;

async function initRedis() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = require('@upstash/redis');
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.ping();
      useRedis = true;
      console.log('Redis connected!');
    } catch (e) {
      console.log('Redis init failed:', e.message);
    }
  }
}

async function saveToRedis() {
  if (!useRedis || !redis) return;
  try {
    await redis.set('cpq_db', JSON.stringify(db), { EX: 86400 });
  } catch (e) {
    console.error('Save failed:', e.message);
  }
}

async function loadFromRedis() {
  if (!useRedis || !redis) return null;
  try {
    const data = await redis.get('cpq_db');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Load failed:', e.message);
    return null;
  }
}

// ==================== 默认数据 ====================
function generateDefaultData() {
  // 产品模板 - 可配置的定制产品
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
        { id: 'raid', name: 'RAID配置', type: 'select', required: false, options: [
          { value: '无', price: 0 },
          { value: 'RAID 1', price: 500 },
          { value: 'RAID 5', price: 1000 },
          { value: 'RAID 10', price: 2000 }
        ]},
        { id: 'support', name: '维保服务', type: 'select', required: true, options: [
          { value: '基础', price: 0 },
          { value: '专业', price: 1000 },
          { value: '企业', price: 3000 }
        ]},
        { id: 'install', name: '安装服务', type: 'boolean', price: 500 }
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
          { value: '桌面软件', price: 8000 },
          { value: 'API接口', price: 3000 }
        ]},
        { id: 'pages', name: '页面数量', type: 'number', unit: '页', min: 1, pricePerUnit: 500 },
        { id: 'users', name: '用户数', type: 'number', unit: '用户', min: 10, pricePerUnit: 100 },
        { id: 'backend', name: '后端开发', type: 'boolean', price: 5000 },
        { id: 'admin', name: '管理后台', type: 'boolean', price: 3000 },
        { id: 'api', name: 'API对接', type: 'boolean', price: 2000 },
        { id: 'duration', name: '开发周期', type: 'select', required: true, options: [
          { value: '1个月', price: 0 },
          { value: '2个月', price: -2000 },
          { value: '3个月', price: -5000 },
          { value: '6个月', price: -10000 }
        ]},
        { id: 'maintain', name: '一年维保', type: 'boolean', price: 3000 }
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
        { id: 'ram', name: '内存', type: 'number', unit: 'GB', min: 1, max: 128, pricePerUnit: 30 },
        { id: 'disk', name: '硬盘', type: 'number', unit: 'GB', min: 20, max: 2000, pricePerUnit: 0.5 },
        { id: 'bandwidth', name: '带宽', type: 'select', required: true, options: [
          { value: '1Mbps', price: 0 },
          { value: '5Mbps', price: 100 },
          { value: '10Mbps', price: 300 },
          { value: '100Mbps', price: 2000 }
        ]},
        { id: 'backup', name: '自动备份', type: 'boolean', price: 99 },
        { id: 'ssl', name: 'SSL证书', type: 'boolean', price: 0 },
        { id: 'cdn', name: 'CDN加速', type: 'boolean', price: 199 },
        { id: 'monitor', name: '监控服务', type: 'boolean', price: 49 }
      ]
    },
    {
      id: 4,
      name: '网站制作',
      description: '企业官网/商城网站建设',
      basePrice: 3000,
      category: '服务',
      attributes: [
        { id: 'type', name: '网站类型', type: 'select', required: true, options: [
          { value: '企业官网', price: 0 },
          { value: '商城网站', price: 5000 },
          { value: '营销落地页', price: -1000 },
          { value: '门户资讯', price: 8000 }
        ]},
        { id: 'pages', name: '页面数量', type: 'number', unit: '页', min: 3, pricePerUnit: 300 },
        { id: 'design', name: '设计等级', type: 'select', required: true, options: [
          { value: '模板套用', price: 0 },
          { value: '定制设计', price: 2000 },
          { value: '高端定制', price: 8000 }
        ]},
        { id: 'mobile', name: '移动端适配', type: 'boolean', price: 0 },
        { id: 'seo', name: 'SEO优化', type: 'boolean', price: 1000 },
        { id: 'cms', name: 'CMS后台', type: 'boolean', price: 2000 },
        { id: 'multilang', name: '多语言', type: 'boolean', price: 1500 },
        { id: '动画', name: '交互动画', type: 'boolean', price: 2000 }
      ]
    }
  ];

  // 客户
  const customers = [
    { id: 1, name: '演示客户', company: '示例公司', email: 'demo@cpq.com', phone: '13800138000', address: '北京市', created_at: new Date().toISOString() }
  ];

  // 用户
  const users = [
    { id: 1, username: 'admin', password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.hxBV7H1M5Fzp.xJ5Fy', role: 'admin', name: '管理员', email: 'admin@cpq.com', created_at: new Date().toISOString() },
    { id: 2, username: 'user', password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.hxBV7H1M5Fzp.xJ5Fy', role: 'user', name: '普通用户', email: 'user@cpq.com', created_at: new Date().toISOString() }
  ];

  // 报价单
  const quotes = [];

  return { productTemplates, customers, users, quotes, nextIds: { template: 5, customer: 2, user: 3, quote: 1 } };
}

let db = generateDefaultData();

// 初始化
initRedis().then(() => {
  loadFromRedis().then(savedDb => {
    if (savedDb) {
      // 确保数据结构完整
      if (!savedDb.productTemplates) savedDb.productTemplates = [];
      if (!savedDb.customers) savedDb.customers = [];
      if (!savedDb.users) savedDb.users = [];
      if (!savedDb.quotes) savedDb.quotes = [];
      if (!savedDb.nextIds) savedDb.nextIds = { template: 1, customer: 1, user: 1, quote: 1 };
      db = savedDb;
      console.log('Loaded data from Redis');
    }
  });
});

setInterval(() => { if (useRedis) saveToRedis(); }, 30000);
process.on('SIGTERM', () => { if (useRedis) saveToRedis(); });

// ==================== 产品模板 API ====================

// 获取所有产品模板
app.get('/api/templates', (req, res) => {
  res.json(db.productTemplates);
});

// 获取单个模板
app.get('/api/templates/:id', (req, res) => {
  const template = db.productTemplates.find(t => t.id === parseInt(req.params.id));
  if (!template) return res.status(404).json({ error: '模板不存在' });
  res.json(template);
});

// 创建产品模板
app.post('/api/templates', async (req, res) => {
  try {
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
    await saveToRedis();
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除产品模板
app.delete('/api/templates/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const idx = db.productTemplates.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: '模板不存在' });
    
    db.productTemplates.splice(idx, 1);
    await saveToRedis();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 客户 API ====================

// 获取所有客户
app.get('/api/customers', (req, res) => {
  const { search } = req.query;
  let customers = db.customers;
  if (search) {
    const s = search.toLowerCase();
    customers = customers.filter(c => 
      c.name.toLowerCase().includes(s) || 
      c.company.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s)
    );
  }
  res.json(customers);
});

// 获取单个客户
app.get('/api/customers/:id', (req, res) => {
  const customer = db.customers.find(c => c.id === parseInt(req.params.id));
  if (!customer) return res.status(404).json({ error: '客户不存在' });
  res.json(customer);
});

// 创建客户
app.post('/api/customers', async (req, res) => {
  try {
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
    await saveToRedis();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新客户
app.put('/api/customers/:id', async (req, res) => {
  try {
    const customer = db.customers.find(c => c.id === parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: '客户不存在' });
    
    const { name, company, email, phone, address } = req.body;
    if (name) customer.name = name;
    if (company !== undefined) customer.company = company;
    if (email !== undefined) customer.email = email;
    if (phone !== undefined) customer.phone = phone;
    if (address !== undefined) customer.address = address;
    
    await saveToRedis();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除客户
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const idx = db.customers.findIndex(c => c.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: '客户不存在' });
    
    db.customers.splice(idx, 1);
    await saveToRedis();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
});

// ==================== 报价 API ====================

// 计算价格
app.post('/api/calculate', (req, res) => {
  try {
    const { templateId, config } = req.body;
    const template = db.productTemplates.find(t => t.id === templateId);
    if (!template) return res.status(404).json({ error: '模板不存在' });

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
          configDetails.push({ 
            attribute: attr.name, 
            value, 
            price: attrPrice 
          });
        }
      } else if (attr.type === 'number' && attr.pricePerUnit) {
        const num = parseFloat(value) || 0;
        const min = attr.min || 0;
        const effectiveNum = Math.max(0, num - min);
        attrPrice = effectiveNum * attr.pricePerUnit;
        configDetails.push({ 
          attribute: attr.name, 
          value: `${value}${attr.unit || ''}`, 
          price: attrPrice 
        });
      } else if (attr.type === 'boolean' && value === true) {
        attrPrice = attr.price || 0;
        configDetails.push({ 
          attribute: attr.name, 
          value: '是', 
          price: attrPrice 
        });
      }

      totalPrice += attrPrice;
    }

    res.json({
      templateId,
      templateName: template.name,
      basePrice: template.basePrice || 0,
      config: configDetails,
      totalPrice,
      currency: 'CNY'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 生成报价单
app.post('/api/quotes', async (req, res) => {
  try {
    const { templateId, config, customerId, customerName, validDays, notes } = req.body;
    
    // 计算价格
    const { totalPrice, config: configDetails } = await calculatePrice(templateId, config);
    
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
    await saveToRedis();
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取报价单列表
app.get('/api/quotes', (req, res) => {
  const { status, customerId } = req.query;
  let quotes = db.quotes;
  
  if (status) {
    quotes = quotes.filter(q => q.status === status);
  }
  if (customerId) {
    quotes = quotes.filter(q => q.customerId === parseInt(customerId));
  }
  
  // 按创建时间倒序
  quotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json(quotes);
});

// 获取单个报价单
app.get('/api/quotes/:id', (req, res) => {
  const quote = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!quote) return res.status(404).json({ error: '报价单不存在' });
  
  // 填充模板信息
  const template = db.productTemplates.find(t => t.id === quote.templateId);
  quote.template = template;
  
  // 填充客户信息
  if (quote.customerId) {
    const customer = db.customers.find(c => c.id === quote.customerId);
    quote.customer = customer;
  }
  
  res.json(quote);
});

// 更新报价单状态
app.put('/api/quotes/:id/status', async (req, res) => {
  const { status } = req.body;
  const quote = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!quote) return res.status(404).json({ error: '报价单不存在' });
  
  quote.status = status;
  quote.updated_at = new Date().toISOString();
  await saveToRedis();
  
  res.json(quote);
});

// 更新报价单
app.put('/api/quotes/:id', async (req, res) => {
  const { customerName, validDays, notes, config } = req.body;
  const quote = db.quotes.find(q => q.id === parseInt(req.params.id));
  if (!quote) return res.status(404).json({ error: '报价单不存在' });
  
  if (customerName !== undefined) quote.customerName = customerName;
  if (validDays !== undefined) {
    quote.validDays = validDays;
    quote.expires_at = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();
  }
  if (notes !== undefined) quote.notes = notes;
  if (config) {
    quote.config = config;
    // 重新计算价格
    const { totalPrice, configDetails } = await calculatePrice(quote.templateId, config);
    quote.totalPrice = totalPrice;
    quote.configDetails = configDetails;
  }
  
  quote.updated_at = new Date().toISOString();
  await saveToRedis();
  
  res.json(quote);
});

// 删除报价单
app.delete('/api/quotes/:id', async (req, res) => {
  const idx = db.quotes.findIndex(q => q.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '报价单不存在' });
  
  db.quotes.splice(idx, 1);
  await saveToRedis();
  res.json({ success: true });
});

// 复制报价单
app.post('/api/quotes/:id/copy', async (req, res) => {
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
  await saveToRedis();
  res.json(newQuote);
});

// 辅助函数：计算价格
async function calculatePrice(templateId, config) {
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

// ==================== 统计 API ====================

app.get('/api/stats', (req, res) => {

// 登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: '用户名或密码错误' });
    
    res.json({ 
      id: user.id, 
      username: user.username, 
      name: user.name, 
      role: user.role,
      email: user.email 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    
    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: db.nextIds.user++,
      username,
      password: hashedPassword,
      role: 'user',
      name: name || username,
      email: email || '',
      created_at: new Date().toISOString()
    };
    db.users.push(user);
    await saveToRedis();
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取当前用户信息
app.get('/api/me', (req, res) => {
  const username = req.headers['x-username'];
  if (!username) return res.status(401).json({ error: '未登录' });
  
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role, email: user.email });
});

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
