console.log("开始运行测试脚本...");

// 加载环境变量
require('dotenv').config();

// 加载模块
const { updateCloudflareIp } = require("./controller");

// 测试函数
async function runTest() {
  console.log("===== 测试开始 =====");
  
  try {
    // 测试Cloudflare IP获取
    console.log("测试Cloudflare IP获取...");
    const result = await updateCloudflareIp();
    console.log("测试结果:", result);
    
    // 测试阿里云API连通性
    console.log("测试阿里云API连通性...");
    const RPCClient = require("@alicloud/pop-core").RPCClient;
    const client = new RPCClient({
      accessKeyId: process.env.ACCESS_KEY_ID || require("./config").accessKeyId,
      accessKeySecret: process.env.ACCESS_KEY_SECRET || require("./config").accessKeySecret,
      endpoint: "https://alidns.cn-hangzhou.aliyuncs.com",
      apiVersion: "2015-01-09"
    });
    
    const response = await client.request("DescribeDomains", {PageSize: 1}, {});
    console.log("阿里云API响应:", response);
  } catch (error) {
    console.error("测试失败:", error);
  }
  
  console.log("===== 测试结束 =====");
}

runTest();
