const moment = require("moment");
const axios = require("axios");
const RPCClient = require("@alicloud/pop-core").RPCClient;
const { accessKeyId, accessKeySecret, Domain, SubDomain } = require("./config");

// 更新 Cloudflare 优选IP
const updateCloudflareIp = async () => {
  const res = await axios.get("https://api.vvhan.com/tool/cf_ip");
  if (!res.data.success) {
    console.log("\x1b[91m%s\x1b[0m", "更新 Cloudflare 优选IP失败");
    return "更新 Cloudflare 优选IP失败";
  }
  return await updateAliDns(res.data.data);
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

  try {
    // 查询域名解析记录
    const { Records } = await client.request("DescribeDomainRecords", {
      DomainName: Domain,
      RRKeyWord: SubDomain,
      PageSize: 100
    }, {});
    
    if (!Records || !Records.Record || Records.Record.length === 0) {
      console.log("未找到DNS记录");
      return "未找到DNS记录";
    }

    // 更新记录
    for (const record of Records.Record) {
      const line = lineTypeMap[record.Line] || "default";
      const recordType = record.Type === "AAAA" ? "v6" : "v4";
      
      // 检查IP是否需要更新
      if (record.Value !== DNS_DATA[recordType][line]) {
        try {
          await client.request("UpdateDomainRecord", {
            RecordId: record.RecordId,
            RR: SubDomain,
            Type: record.Type,
            Value: DNS_DATA[recordType][line],
            Line: record.Line,
            TTL: record.TTL
          }, {});
          
          console.log(`更新成功: ${record.Line} ${record.Type} -> ${DNS_DATA[recordType][line]}`);
        } catch (error) {
          console.error(`更新记录失败: ${record.Line} ${record.Type}`, error);
        }
      } else {
        console.log(`无需更新: ${record.Line} ${record.Type}`);
      }
    }

    return `${moment().format("YYYY.MM.DD HH:mm:ss")} - 阿里云DNS更新成功`;
  } catch (error) {
    console.error("阿里云DNS操作失败", error);
    return "阿里云DNS操作失败";
  }
};

module.exports = { updateCloudflareIp };
