/**
 * 测试实时行情 API
 */
const path = require('path');

// 直接调用 Node API 测试
async function test() {
  // 动态加载编译后的服务
  const quoteService = require('./dist/main/main/services/quote-service');
  
  try {
    console.log('📡 查询 QQQ.US 实时行情...\n');
    const quotes = await quoteService.getQuotes(['QQQ.US']);
    
    if (quotes && quotes.length > 0) {
      const q = quotes[0];
      console.log('✅ 查询成功！');
      console.log('---');
      console.log(`股票: ${q.symbol}`);
      console.log(`最新价: $${q.lastDone}`);
      console.log(`开盘: $${q.open}`);
      console.log(`最高: $${q.high}`);
      console.log(`最低: $${q.low}`);
      console.log(`成交量: ${q.volume}`);
    } else {
      console.log('❌ 未获取到数据');
    }
  } catch (err) {
    console.error('❌ 查询失败:', err.message);
  }
}

test();
