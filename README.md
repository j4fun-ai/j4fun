[![J4FUN](./assets/images/logo-banner.png?083026)](https://j4fun.com)

# J4FUN

好玩的中文互动小项目合集，为海外华人家庭和中文学习者而做。

**在线访问：** [j4fun.com](https://j4fun.com) · [识本 · 华文教材库](https://j4fun.com/shiben/)

j4fun 收录可以直接在浏览器中打开的中文小玩意。目前包括诗词互动、汉字数独、字踪，以及华文教材在线浏览器“识本”。项目以简体中文为主，无需注册，尽量在本地浏览器中完成处理。

## 当前内容

- **诗词好玩局**：飞花令、诗句接龙和诗词浏览。
- **汉字数独**：用汉字体验数独规则。
- **字踪**：藏字连线游戏。
- **识本 · 华文教材库**：基于 [TapXWorld/ChinaTextbook](https://github.com/TapXWorld/ChinaTextbook) 开源资源制作的华文教材在线浏览器。

## 项目结构

```text
index.html          j4fun 首页
about.html          关于页面
poetry.html         诗词好玩局
sudoku.html         汉字数独
strands.html        字踪
assets/             j4fun 共用样式与图片
shiben-dev/         识本开发源代码
shiben/             识本静态构建产物
playground/         历史版本和试验稿
```

`shiben-dev/` 只用于本地开发，不应作为网站内容直接发布。部署时使用已经构建好的 `shiben/`。

## 本地预览

在项目根目录启动静态服务器：

```bash
python3 -m http.server 8080
```

然后打开：

- <http://localhost:8080/>
- <http://localhost:8080/about.html>
- <http://localhost:8080/shiben/>

## 构建识本

```bash
cd shiben-dev
pnpm install
pnpm check
pnpm build:static
```

构建结果会写入根目录的 `shiben/`。

## 部署

生产部署只应包含根目录的静态页面、`poems.json`、`assets/` 和 `shiben/`。`shiben-dev/`、`node_modules/`、内部素材和试验目录不应上传。

项目计划通过本地部署脚本发布到 Cloudflare Pages。Git 仅用于版本管理，不触发自动部署。

## 数据与隐私

小游戏输入主要在浏览器本地处理。识本读取 TapXWorld/ChinaTextbook 的开源目录与文件链接，不复制或二次托管教材文件。

## License

本项目原创代码计划使用 MIT License。第三方教材、诗词内容、字体、图片及其他资源仍归各自权利人所有；项目名称和品牌素材不包含在软件许可范围内。

---

J4FUN 出品  
Made with ❤️ (AI)
