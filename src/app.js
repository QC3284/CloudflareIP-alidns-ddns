const Koa = require("koa");
const { updateCloudflareIp } = require("./controller");
const schedule = require("node-schedule");
const app = new Koa();

// 全局错误处理
process.on("uncaughtException", (err) => {
  console.error("\x1b[91m%s\x1b[0m", `未捕获的异常: ${err.message}`);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\x1b[91m%s\x1b[0m", "未处理的Promise拒绝:");
  console.error(reason);
});

// 添加请求日志中间件
app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    console.log(`\x1b[36m%s\x1b[0m`, `请求: ${ctx.method} ${ctx.url}`);
    await next();
    const duration = Date.now() - start;
    console.log(`\x1b[36m%s\x1b[0m`, `响应: ${ctx.status} ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - start;
    console.error("\x1b[91m%s\x1b[0m", `错误: ${err.message} ${duration}ms`);
    ctx.status = err.status || 500;
    ctx.body = err.message;
  }
});

app.use(async ctx => {
  if (ctx.request.url === "/updateCloudflareIp") {
    console.log("手动触发更新Cloudflare优选IP");
    ctx.body = await updateCloudflareIp();
  } else {
    ctx.body = "Cloudflare IP DDNS Running Successfully!";
  }
});

// 每隔15分钟更新Cloudflare优选IP
schedule.scheduleJob("*/15 * * * *", () => {
  console.log("\x1b[93m%s\x1b[0m", `${new Date().toLocaleString()} - 定时任务触发更新Cloudflare优选IP`);
  updateCloudflareIp()
    .then(result => console.log(result))
    .catch(err => console.error("\x1b[91m%s\x1b[0m", `定时任务更新失败: ${err.message}`));
});

console.log("\x1b[93m%s\x1b[0m", "15分钟自动更新已开启");

// 初始化
const PORT = 52100;
app.listen(PORT, () => {
  console.log("\x1b[92m%s\x1b[0m", `服务器运行中：http://localhost:${PORT}`);
});
