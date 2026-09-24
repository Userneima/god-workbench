# Auth Email Plan

这份文档记录 God Workbench 的注册确认、邮件发送和上线前检查。

当前状态：产品使用 Supabase Auth 的邮箱/密码注册登录，不自建验证码系统。

## 产品决策

- 产品入口不强制登录。
- 登录只用于草稿多端同步和发布公开归档前确认创建者身份。
- 注册使用邮箱和密码。
- 第一阶段采用邮件确认链接，不做站内 6 位验证码输入框。
- 用户可以用 Gmail 邮箱作为注册和登录邮箱。
- 不建议用个人 Gmail 作为生产 SMTP 发件身份。

## 当前实现边界

前端当前调用：

```js
supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
supabase.auth.signInWithPassword({ email, password })
supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } })
supabase.auth.resetPasswordForEmail(email, { redirectTo })
supabase.auth.updateUser({ password })
```

如果 Supabase Auth 开启 `Confirm Email`：

- 注册后 Supabase 发送确认邮件。
- 用户需要点击邮件确认链接。
- UI 会显示“确认邮件已发送”、垃圾箱提醒，并提供重发确认邮件。
- 点击确认链接回到产品后，Supabase session 会继续触发云端同步。

如果 Supabase Auth 关闭 `Confirm Email`：

- 注册后可以直接拿到 session 并登录。
- 这种方式更省事，但账号邮箱真实性较弱，不建议作为正式长期方案。

## Supabase 后台配置清单

在 Supabase Dashboard 的 Authentication 设置里确认：

- Allow new users to sign up: enabled
- Email provider: enabled
- Confirm Email: enabled for production
- Site URL: production app URL
- Redirect URLs:
  - local development URL
  - Aliyun ECS URL or production domain
  - future custom domain after binding

当前已知 URL：

```text
Local: http://localhost:43174/
Aliyun ECS: http://47.86.11.130/
```

如果之后绑定正式域名，需要把正式域名加入 Site URL 和 Redirect URLs。

Glimmer 是共享 Supabase 项目时，不要把 Site URL 或邮件文案写得只服务一个产品。单个产品优先通过代码里的 `emailRedirectTo` / `redirectTo` 指向自己的页面。

## 邮件模板

确认邮件模板应使用确认链接，不使用 6 位验证码作为第一阶段主流程。

推荐模板方向：

- 如果 Glimmer 后端只服务 God Workbench，邮件标题可以写明“上帝工作台”。
- 如果 Glimmer 后端被多个项目共享，邮件标题和正文应保持中性，例如“确认你的账号”。
- 正文说明这是账号确认邮件。
- 主按钮文案使用“确认邮箱”或“确认账号”这类中性动作。
- 确认后通过 Redirect URL 回到发起注册的产品页面。

模板里不要写复杂产品说明。用户只需要知道“点一下确认账号，然后回到产品继续同步/发布”。

## 发信服务

测试阶段可以使用 Supabase 默认邮件服务。

正式使用前应配置 Custom SMTP。原因：

- Supabase 默认邮件服务有较低额度限制，适合测试，不适合作为生产发信能力。
- 正式发信需要更稳定的送达率和发件信誉。

可选邮件服务：

- Resend
- Postmark
- SendGrid
- AWS SES
- Brevo

不建议用个人 Gmail 作为生产 SMTP 发件身份。Gmail 可以作为用户注册邮箱，但不适合作为产品的发件服务。

## Custom SMTP 检查

选择邮件服务后，需要完成：

- 创建发信域名或发件身份。
- 配置 SPF、DKIM、DMARC 等 DNS 记录。
- 在 Supabase Auth Custom SMTP 中填入 host、port、username、password、sender name、sender email。
- 发送测试邮件。
- 确认邮件不会进垃圾箱。

不要把 SMTP password、Supabase service role key 或邮件服务 API key 放进前端代码、Vite 环境变量或静态托管公开配置里。

## 产品 UI 当前状态

已落地：

- 注册成功后显示“确认邮件已发送”。
- 告诉用户去邮箱点击确认链接，并提醒检查垃圾箱。
- 提供“重发确认”。
- 提供“忘记密码”，发送密码重置邮件。
- 用户从重置邮件回到产品后，可输入新密码并保存。
- 登录失败时区分邮箱未确认、邮箱/密码错误、频率限制、网络失败等常见情况。
- 云端/本地草稿同时存在且不一致时，先让用户选择，不静默覆盖。
- 云端同步状态会显示最后同步时间或失败原因。

仍未落地：

- Custom SMTP 生产发信配置。
- 独立的管理员归档删除入口。

## 上线验收

正式开放注册前，至少完成：

- 用一个新邮箱注册。
- 收到确认邮件。
- 点击确认链接后回到产品。
- 登录状态正常显示。
- 本地草稿能同步到账号云端。
- 换浏览器或手机登录同账号能读取云端草稿。
- 未登录用户仍可进入产品和查看公开归档。
- 未登录用户发布公开归档时被引导登录。
- 已登录用户发布公开归档前看到公开范围确认。
- 邮件发送频率不会被默认额度限制卡住。

## 暂不做

- 不做站内 6 位验证码输入。
- 不做短信验证码。
- 不做成员账号体系。
- 不做 OAuth，除非真实使用中邮箱密码登录明显不够顺手。
