const moment = require("moment");
const axios = require("axios");
const RPCClient = require("@alicloud/pop-core").RPCClient;
const { accessKeyId, accessKeySecret, Domain, SubDomain } = require("./config");

// 更新 Cloudflare 优选IP
const updateCloudflareIp = async () => {
  console.log(`${moment().format("YYYY-MM-DD HH:mm:ss")} - 开始获取Cloudflare优选IP`);
  try {
    const res = await axios.get("https://api.vvhan.com/tool/cf_ip");
    if (!res.data.success) {
      console.error("\x1b[91m%s\x1b[0m", "更新Cloudflare优选IP失败: API返回失败状态");
      return "更新Cloudflare优选IP失败: API返回失败状态";
    }
    console.log("获取Cloudflare优选IP成功");
    return await updateAliDns(res.data.data);
  } catch (error) {
    console.error("\x1b[91m%s\x1b[0m", `获取Cloudflare优选IP失败: ${error.message}`);
    return `获取Cloudflare优选IP失败: ${error.message}`;
  }
};

// 创建阿里云客户端
const createClient = () => {
  return new RPCClient({
    accessKeyId,
    accessKeySecret,
    endpoint: "https://alidns.cn-hangzhou.aliyuncs.com",
    apiVersion: "2015-01-09"
  });
};

// 更新阿里云DNS
const updateAliDns = async (IP_DATA) => {
  console.log("开始更新阿里云DNS...");
  const client = createClient();
  
  // 线路类型映射
  const lineTypeMap = {
    "默认": "default",
    "电信": "telecom",
    "联通": "unicom",
    "移动": "mobile"
  };

  // 取最优选IP IPv4
  const CM_IP_V4 = IP_DATA.v4.CM.reduce((minItem, currentItem) => 
    currentItem.latency < minItem.latency ? currentItem : minItem, IP_DATA.v4.CM[0]);
  const CU_IP_V4 = IP_DATA.v4.CU.reduce((minItem, currentItem) => 
    currentItem.latency < minItem.latency ? currentItem : minItem, IP_DATA.v4.CU[0]);
  const CT_IP_V4 = IP_DATA.v4.CT.reduce((minItem, currentItem) => 
    currentItem.latency < minItem.latency ? currentItem : minItem, IP_DATA.v4.CT[0]);
  
  // 取最优选IP IPv6
  const CM_IP_V6 = IP_DATA.v6.CM.reduce((minItem, currentItem) => 
    currentItem.latency < minItem.latency ? currentItem : minItem, IP_DATA.v6.CM[0]);
  const CU_IP_V6 = IP_DATA.v6.CU.reduce((minItem, currentItem) => 
    currentItem.latency < minItem.latency ? currentItem : minItem, IP_DATA.v6.CU[0]);
  const CT_IP_V6 = IP_DATA.v6.CT.reduce((minItem, currentItem) => 
    currentItem.latency < minItem.latency ? currentItem : minItem, IP_DATA.v6.CT[0]);

  const DNS_DATA = {
    v4: {
      "default": CT_IP_V4.ip,
      "telecom": CT_IP_V4.ip,
      "unicom": CU_IP_V4.ip,
      "mobile": CM_IP_V4.ip
    },
    v6: {
      "default": CT_IP_V6.ip,
      "telecom": CT_IP_V6.ip,
      "unicom": CU_IP_V6.ip,
      "mobile": CM_IP_V6.ip
    }
  };

  console.log("优选IPv4结果:", JSON.stringify(DNS_DATA.v4, null, 2));
  console.log("优选IPv6结果:", JSON.stringify(DNS_DATA.v6, null, 2));

  try {
    // 查询域名解析记录
    console.log(`查询阿里云DNS记录: 域名=${Domain}, 子域名=${SubDomain}`);
    const { Records } = await client.request("DescribeDomainRecords", {
      DomainName: Domain,
      RRKeyWord: SubDomain,
      PageSize: 100
    }, {});
    
    if (!Records || !Records.Record) {
      console.error("未找到任何DNS记录");
      return "未找到任何DNS记录";
    }
    
    console.log(`找到${Records.Record.length}条DNS记录`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 更新记录
    for (const record of Records.Record) {
      const line = record.Line;
      const mappedLine = lineTypeMap[line] || "default";
      const recordType = record.Type === "AAAA" ? "v6" : "v4";
      
      const currentIp = record.Value;
      const newIp = DNS_DATA[recordType][mappedLine];
      
      console.log(`检查记录: ${line}线路 ${record.Type}记录 [当前: ${currentIp}] [新IP: ${newIp}]`);
      
      // 检查IP是否需要更新
      if (currentIp !== newIp) {
        console.log(`需要更新: ${line}线路 ${record.Type}记录`);
        try {
          await client.request("UpdateDomainRecord", {
            RecordId: record.RecordId,
            RR: SubDomain,
            Type: record.Type,
            Value: newIp,
            Line: line,
            TTL: record.TTL || 600
          }, {});
          
          console.log(`\x1b[92m更新成功\x1b[0m: ${line}线路 ${record.Type}记录 -> ${newIp}`);
          updatedCount++;
        } catch (error) {
          console.error(`\x1b[91m更新记录失败\x1b[0m: ${line}线路 ${record.Type}记录`, error);
          errorCount++;
        }
      } else {
        console.log(`\x1b[93m无需更新\x1b[0m: ${line}线路 ${record.Type}记录 (IP相同)`);
        skippedCount++;
      }
    }

    const result = `${moment().format("YYYY.MM.DD HH:mm:ss")} - 阿里云DNS更新完成: ${updatedCount}更新/${skippedCount}跳过/${errorCount}错误`;
    console.log(result);
    return result;
  } catch (error) {
    console.error("阿里云DNS操作失败", error);
    return `阿里云DNS操作失败: ${error.message}`;
  }
};

module.exports = { updateCloudflareIp };
