# CloudflareIP 阿里云 DDNS 工具

## 项目概述

这是一个自动获取 Cloudflare 优选 IP 并通过阿里云 DNS 进行动态更新的工具。它能够每15分钟自动更新一次 Cloudflare 的优选 IP，并将这些 IP 应用到阿里云 DNS 的多线路（默认、电信、联通、移动）解析记录中。

## 主要功能

- 🚀 自动获取 Cloudflare 全球优选 IP
- 🔄 每15分钟自动更新阿里云 DNS 记录
- 🌐 支持 IPv4 和 IPv6 双栈更新
- 📊 多线路支持（默认、电信、联通、移动）
- 📝 详细的日志输出，方便问题排查
- 🛠️ 提供手动更新接口

## 安装指南

### 1. 克隆仓库

```bash
git clone https://github.com/QC3284/CloudflareIP-alidns-ddns.git
cd CloudflareIP-alidns-ddns
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置阿里云 AccessKey

1. 登录阿里云控制台，进入 [RAM访问控制](https://ram.console.aliyun.com/users)
2. 创建用户并授予 `AliyunDNSFullAccess` 权限
3. 获取 AccessKey ID 和 AccessKey Secret

### 4. 修改配置文件

编辑 `src/config.js`：

```javascript
module.exports = {
  // 阿里云的AccessKey ID和AccessKey Secret
  accessKeyId: "你的AccessKey ID",
  accessKeySecret: "你的AccessKey Secret",
  // 主域名和需要DDNS的子域名
  Domain: "yourdomain.com",
  // 子域名，如果是主域名请填写 '@'
  SubDomain: "subdomain" 
};
```

## 运行程序

### 启动服务

```bash
npm run dev
```

服务启动后，将监听 `52100` 端口。访问 `http://localhost:52100` 可以查看服务状态。

### 手动触发更新

```bash
curl http://localhost:52100/updateCloudflareIp
```

## 在阿里云DNS中创建记录

在运行程序前，请确保在阿里云DNS控制台中已经创建了以下记录（根据你的需求创建）：

- **A 记录**（IPv4）：
  - 线路：默认
  - 线路：电信
  - 线路：联通
  - 线路：移动
  
- **AAAA 记录**（IPv6）：
  - 线路：默认
  - 线路：电信
  - 线路：联通
  - 线路：移动

## 日志说明

程序会输出详细的日志，包括：

- Cloudflare 优选 IP 的获取结果
- 阿里云 DNS 记录的查询结果
- 每条记录的更新状态（更新成功、无需更新、更新失败）
- 定时任务的执行情况

示例日志：
```
2025-06-27 20:15:00 - 开始获取Cloudflare优选IP
获取Cloudflare优选IP成功
开始更新阿里云DNS...
创建阿里云客户端
优选IPv4结果: {
  "default": "104.16.110.218",
  "telecom": "104.16.110.218",
  "unicom": "172.67.78.63",
  "mobile": "172.67.163.145"
}
查询阿里云DNS记录: 域名=yourdomain.com, 子域名=subdomain
找到8条DNS记录
检查记录: default线路 A记录 [当前: 1.1.1.1] [新IP: 104.16.110.218]
需要更新: default线路 A记录
更新成功: default线路 A记录 -> 104.16.110.218
2025-06-27 20:15:12 - 阿里云DNS更新完成: 1更新/7跳过/0错误
```

## 问题排查

如果遇到问题，请检查以下内容：

1. 确保阿里云 AccessKey 有足够的权限（AliyunDNSFullAccess）
2. 确保在阿里云DNS中已经创建了相应的记录
3. 检查子域名配置是否正确（主域名使用 '@'）
4. 查看程序输出的错误日志
5. 运行测试脚本进行诊断：
   ```bash
   node src/test.js
   ```

## 技术支持

如果遇到任何问题，请提交 issue：
- GitHub: https://github.com/QC3284/CloudflareIP-alidns-ddns/issues

##Powerd By Deepseek
