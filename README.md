# God Workbench

上帝工作台是一个独立静态网页工具，用来辅助「主题许愿、盲选愿望、匿名完成、微信群猜身份、最终揭晓」这套游戏流程。

它服务的是当轮“上帝”，不是替代 QQ 群或微信群的完整游戏平台。

## 文档

- [项目协作规则](./AGENTS.md)
- [产品说明](./docs/product.md)

## 使用

```bash
npm install
npm run dev
```

本地地址：

```text
http://localhost:43174/
```

## 部署

```bash
npm run build
```

静态产物会生成到 `dist/`，上传这个目录到腾讯云静态页面即可。
