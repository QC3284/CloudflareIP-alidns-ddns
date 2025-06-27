const moment = require("moment");
const axios = require("axios");
const RPCClient = require("@alicloud/pop-core").RPCClient;
const { accessKeyId, accessKeySecret, Domain, SubDomain } = require("./config");

console.log("控制器模块已加载");

// 更新 Cloudflare 优选IP
const updateCloudflareIp = async () => {
  console.log(`${moment().format("YYYY-MM-DD HH:mm:ss")} - 开始获取Cloudflare优选IP`);
  try {
    const res = await axios.get("https://api.vvhan.com/tool/cf_ip", {
      timeout: 10000
    });
    
    if (!res.data || !res.data.success) {
      console.error("\x1b[91m%s\x1b[0m", "更新Cloudflare优选IP失败: API返回无效响应");
      console.log("API响应:", res.data);
      return "更新Cloudflare优选IP失败: API返回无效响应";
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
  console.log("创建阿里云客户端");
  return new RPCClient({
    accessKeyId,
    accessKeySecret,
    endpoint: "https://alidns.cn-hangzhou.aliyuncs.com",
    apiVersion: "2015-01-09",
    opts: {
      timeout: 10000
    }
  });
};

// 更新阿里云DNS
const updateAliDns = async (IP_DATA) => {
  console.log("开始更新阿里云DNS...");
  
  if (!IP_DATA || !IP_DATA.v4 || !IP_DATA.v6) {
    console.error("\x1b[91m%s\x1b[0m", "无效的IP数据");
    return "无效的IP数据";
  }
  
  const client = createClient();
  
  // 线路类型映射
  const lineTypeMap = {
    "默认": "default",
    "电信": "telecom",
    "联通": "unicom",
    "移动": "mobile"
  };

  try {
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

    // 处理子域名格式（将 @ 转换为空字符串）
    const queryRR = SubDomain === '@' ? '' : SubDomain;
    
    console.log(`查询阿里云DNS记录: 域名=${Domain}, 子域名=${queryRR || '(主域名)'}`);
    
    // 查询域名记录
    const response = await client.request("DescribeDomainRecords", {
      DomainName: Domain,
      RRKeyWord: queryRR,
      PageSize: 100
    }, {});
    
    // 检查响应结构
    if (!response || !response.Records || !response.Records.Record) {
      console.error("API响应结构异常:", JSON.stringify(response, null, 2));
      return "API响应结构异常";
    }
    
    const records = response.Records.Record;
    
    if (!Array.isArray(records) {
      console.error("记录不是数组:", typeof records);
      return "记录不是数组";
    }
    
    console.log(`找到${records.length}条DNS记录`);
    
    if (records.length === 0) {
      console.log("未找到匹配的DNS记录");
      console.log("建议：在阿里云DNS控制台创建以下记录：");
      console.log(`- 类型: A, 主机记录: ${queryRR || '@'}, 线路: 默认`);
      console.log(`- 类型: AAAA, 主机记录: ${queryRR || '@'}, 线路: 默认`);
      return "未找到匹配的DNS记录";
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 更新记录
    for (const record of records) {
      // 确保记录有必要的字段
      if (!record.Line || !record.Type || !record.Value) {
        console.warn("跳过无效记录:", record);
        continue;
      }
      
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
            RR: record.RR, // 使用查询到的RR值
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
