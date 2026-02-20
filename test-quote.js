/**
 * Longbridge 实时行情测试脚本
 * 使用方法: 设置环境变量后运行
 *   set LONGPORT_APP_KEY=你的Key
 *   set LONGPORT_APP_SECRET=你的Secret
 *   set LONGPORT_ACCESS_TOKEN=你的Token
 *   node test-quote.js
 */

const { Config, QuoteContext } = require("longbridge");

async function testQuote() {
  console.log("=== Longbridge 实时行情测试 ===\n");

  // 直接使用硬编码的凭证
  const appKey = "110cf270ca570e1b8b60b8a74bef3346";
  const appSecret = "721b3835d40a07b2a1146ad6f9b3254c1007c8443b3ab9328485a244cb460f39";
  const accessToken = "m_eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJsb25nYnJpZGdlIiwic3ViIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzc3NDc1MTkwLCJpYXQiOjE3Njk2OTkxOTEsImFrIjoiMTEwY2YyNzBjYTU3MGUxYjhiNjBiOGE3NGJlZjMzNDYiLCJhYWlkIjoyMDg2MTQ1NCwiYWMiOiJsYl9wYXBlcnRyYWRpbmciLCJtaWQiOjE2Mzg0NTQ4LCJzaWQiOiJlaW9ick5LT0k2QzdXTGhtYVZSeCtRPT0iLCJibCI6MywidWwiOjAsImlrIjoibGJfcGFwZXJ0cmFkaW5nXzIwODYxNDU0In0.tIayuixRJTc-ZahxVtjl8jZU80wyn2n-UMO5Z-BoBQ8H7yzeJUA9pxGjUHTSsRZm0uLWe1l7oj_eBM-WgmTO4Dty8bs5_l0PTcQjaF2mFW9HNEBj8ITwnxRsnbSzRiLNTFKPJl8ckKV0HfNhed_Kzf7uRkGWoYt3hrKDS8Dr_XwJX6Kv4WUJQ3k9bqO3r8nptqRuY6XI7z7TCwLb-ZhdO67VwPi6KDNC-Gk9wLsoWmaZtLIyGX1f2i2gF70JK-J4BfAIqPMqP3N1Uh6Xoq0h--aAI9YQDl8PYhVyBh-EuxpwjQoaO-kUjRxeQKtgLDj3dj0EW8dmGqsa-VQw2o4xG3px4mPDfsd6JuoeupIfVPiMqmwRK1LiFa0OnCuNajnDIzd-6IGi8QDKfWlk-VpjT9WPsw8be7QKMmt804RA-O8Llmk6ZR4LTxLlRKHJq031IkPsRPUS-tx7QYDWjOxa_mKgOozqIR1YuoiUdYTy1uDX-sT2iXOv2uQ19Cmo79qRFxcPsDkO1XJDr1kSA0_gsBj5GpNawbOPITPtuE6NVcYjHU8lHItrs7QulE_9jUb0CPgO21yC29yMuYEnmCKG9MhVOmkbV9RMAI53VOuk_GlmsptLs0aEewD-A-bts2K0daKp207K3C4qhoJk2F9d2go8fM8cDEJbU2bZgzYwvv4";

  console.log("✅ 凭证已配置\n");

  // 创建配置
  const config = new Config({
    appKey: appKey,
    appSecret: appSecret,
    accessToken: accessToken,
  });

  try {
    // 创建行情上下文
    const ctx = await QuoteContext.new(config);

    // 测试查询的股票代码
    const symbols = ["QQQ.US", "AAPL.US", "700.HK", "TSLA.US"];

    console.log(`📊 查询行情: ${symbols.join(", ")}\n`);

    // 获取实时行情
    const quotes = await ctx.quote(symbols);

    console.log("=== 实时行情 ===\n");
    for (const quote of quotes) {
      console.log(`📈 ${quote.symbol}`);
      console.log(`   最新价: ${quote.lastDone}`);
      console.log(`   涨跌: ${quote.change} (${quote.changeRate}%)`);
      console.log(`   开盘: ${quote.open}`);
      console.log(`   最高: ${quote.high}`);
      console.log(`   最低: ${quote.low}`);
      console.log(`   成交量: ${quote.volume}`);
      console.log(`   成交额: ${quote.turnover}`);
      console.log("");
    }

    console.log("✅ API 测试成功！");

    await ctx.close();
  } catch (error) {
    console.log("❌ API 调用失败:");
    console.log(error);
  }
}

testQuote();
