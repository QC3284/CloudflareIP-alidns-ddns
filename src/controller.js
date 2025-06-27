const moment = require("moment");
const axios = require("axios");
// 配置
const { accessKeyId, accessKeySecret, Domain, SubDomain } = require("./config");
// 阿里云SDK
const ALY = require("@alicloud/alidns20150109");
const { Config } = require("@alicloud/openapi-client");
const { RuntimeOptions } = require("@alicloud/tea-util");

// 更新 Cloudflare 优选IP
const updateCloudflareIp = async () => {
  const res = await axios.get("https://api.vvhan.com/tool/cf_ip");
  if (!res.data.success) {
    console.log("\x1b[91m%s\x1b[0m", "更新 Cloudflare 优选IP失败");
    return "更新 Cloudflare 优选IP失败";
  }
  return await updateAliDns(res.data.data);
};

// 更新阿里云DNS
const updateAliDns = async (IP_DATA) => {
  // 创建阿里云Client
  let config = new Config({
    accessKeyId,
    accessKeySecret,
  });
  config.endpoint = `alidns.cn-hangzhou.aliyuncs.com`;
  const client = new ALY.default(config);
  
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

  // 查询域名解析记录
  let describeDomainRecordsRequest = new ALY.DescribeDomainRecordsRequest({
    domainName: Domain,
    RRKeyWord: SubDomain,
    pageSize: 100
  });
  
  const runtime = new RuntimeOptions({});
  let records;
  try {
    const resp = await client.describeDomainRecordsWithOptions(describeDomainRecordsRequest, runtime);
    records = resp.body.domainRecords.record;
  } catch (error) {
    console.error("获取阿里云DNS记录失败", error);
    return "阿里云DNS查询失败";
  }

  // 更新记录
  for (const record of records) {
    const line = lineTypeMap[record.line] || "default";
    const recordType = record.type === "AAAA" ? "v6" : "v4";
    
    // 检查IP是否需要更新
    if (record.value !== DNS_DATA[recordType][line]) {
      try {
        const updateRequest = new ALY.UpdateDomainRecordRequest({
          recordId: record.recordId,
          RR: SubDomain,
          type: record.type,
          value: DNS_DATA[recordType][line],
          line: record.line,
          TTL: record.TTL
        });
        
        await client.updateDomainRecordWithOptions(updateRequest, runtime);
        console.log(`更新成功: ${record.line} ${record.type} -> ${DNS_DATA[recordType][line]}`);
      } catch (error) {
        console.error(`更新记录失败: ${record.line} ${record.type}`, error);
      }
    } else {
      console.log(`无需更新: ${record.line} ${record.type}`);
    }
  }

  return `${moment().format("YYYY.MM.DD HH:mm:ss")} - 阿里云DNS更新成功`;
};

module.exports = { updateCloudflareIp };
