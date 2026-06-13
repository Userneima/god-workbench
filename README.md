# God Workbench

上帝工作台是一个独立静态网页工具，用来辅助「主题许愿、盲选愿望、匿名完成、微信群猜身份、最终揭晓」这套游戏流程。

它服务的是当轮“上帝”，不是替代 QQ 群或微信群的完整游戏平台。

## 文档

- [项目协作规则](./AGENTS.md)
- [产品说明](./docs/product.md)
- [产品进展](./docs/progress.md)
- [制作复盘](./docs/making-of.md)
- [部署说明](./docs/deployment.md)

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
npm run check
```

静态产物会生成到 `dist/`。部署前参考 [部署说明](./docs/deployment.md) 配置 Supabase 环境变量，然后上传 `dist/` 到腾讯云静态页面。
