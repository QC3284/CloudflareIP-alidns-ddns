const RPCClient = require("@alicloud/pop-core").RPCClient;
const { accessKeyId, accessKeySecret, Domain } = require("./config");

async function verify() {
  const client = new RPCClient({
    accessKeyId,
    accessKeySecret,
    endpoint: "https://alidns.cn-hangzhou.aliyuncs.com",
    apiVersion: "2015-01-09"
  });
  
  try {
    // 测试域名列表
    const domains = await client.request("DescribeDomains", {PageSize: 10}, {});
    console.log("域名列表:", JSON.stringify(domains, null, 2));
    
    // 测试记录查询
    const records = await client.request("DescribeDomainRecords", {
      DomainName: Domain,
      PageSize: 10
    }, {});
    console.log("DNS记录:", JSON.stringify(records, null, 2));
  } catch (error) {
    console.error("验证失败:", error);
  }
}

verify();
