# 🌸 治愈/恐怖双模式 · 个人博客主页模板

[查看在线演示](https://ling71671.github.io/personal-blog/)

这是一个具有“双重人格”的单页个人主页模板。默认展现温馨治愈的日系胶片风格，但在特定触发条件下会切换到令人不安的“模拟恐怖 (Analog Horror)”模式。

基于 GitHub API 动态获取用户信息和仓库列表，无需后端，纯原生 HTML/CSS/JS 实现。

## ✨ 特性

- **双主题切换**：
  - 🌿 **治愈模式**：奶油色调、Neumorphism 柔和阴影、呼吸动画。
  - 🩸 **恐怖模式**：故障艺术 (Glitch)、噪点背景、光标残留、随机惊吓。
- **隐藏触发器**：
  - 快速点击用户名 6 次。
  - 点击页脚底部的隐形像素点。
- **动态数据**：
  - 自动拉取 GitHub 头像、简介。
  - 展示 Star 数最高的前 6 个公开仓库。
- **易于配置**：
  - 只需修改 `config.js` 即可适配你的账号。

## 🚀 快速开始

### 1. 使用此模板

点击仓库右上角的 **[Use this template](https://github.com/LING71671/personal-blog/generate)** 按钮，创建一个新的仓库。

或者直接 Fork 本仓库。

### 2. 修改配置

在你的仓库中，打开 `config.js` 文件，修改 `githubUsername` 为你的 GitHub 用户名：

```javascript
window.BlogConfig = {
  // 将此处修改为你的 GitHub 用户名
  githubUsername: 'YourUsername', 

  // 其他配置...
  blogTitle: 'Personal Blog',
};
```

### 3. (可选) 修改样式

- `style.css`: 包含了 css 变量系统。你可以在 `:root` 中修改治愈模式的配色，在 `.horror-mode` 中修改恐怖模式的配色。

### 4. 开启 GitHub Pages

1. 进入仓库 **Settings** > **Pages**。
2. 在 **Branch** 选项中选择 `main` 分支。
3. 点击 **Save**。
4. 等待几分钟，GitHub 会给出你的访问链接（通常是 `https://yourname.github.io/repo-name/`）。

## ⚠️ 注意事项

- **光敏性癫痫警告**：恐怖模式包含闪烁和抖动效果。如果你希望添加警告弹窗，可以查看本仓库的历史提交记录。
- **API 限制**：GitHub API 对未认证请求有每小时 60 次的速率限制。如果页面加载不出数据，可能是因为你刷新太频繁了，稍等一小时即可恢复。

## 📄 License

MIT License. 欢迎随意修改和使用！
