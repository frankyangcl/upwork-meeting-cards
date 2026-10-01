# Upwork Meeting Cards · 100 × 3

一个不依赖后端的卡片式记忆 PWA，可在电脑、Android 手机和 iPad 上使用。内置 **100 道 Upwork 手机 App 客户 Meeting 问题**，每题包含 **3 个内容和思路都不同的英文回答方向**，并配有中译。

## 学习流程

1. 默认只显示英文问题。
2. 选择“答案 1 / 2 / 3”中的任一回答方向。
3. 点击“显示答案”查看英文答案；再次点击可遮住答案。
4. 点击“显示翻译”查看问题及当前答案的中文翻译；再次点击可遮住翻译。
5. 点击“下一张”继续。

## 快捷键

- `Space` / `A`：显示或遮住答案
- `1` / `2` / `3`：切换三种回答方向
- `T`：显示或遮住翻译
- `←` / `→`：上一张 / 下一张
- `R`：遮住答案和翻译
- `E`：编辑当前卡片

## 卡片管理

在“管理卡片”中可以：

- 新建卡片，每张卡填写英文问题、中译和三套独立答案
- 编辑或删除任意内置卡片
- 搜索全部问题和答案
- 导出 JSON 备份
- 导入 JSON 替换当前卡组
- 恢复内置 100 题

卡片会自动保存在当前设备浏览器的 `localStorage` 中。当前版本不含账号云同步；不同设备之间可通过导出和导入 JSON 转移卡组。

## 电脑运行

解压后可直接双击 `index.html` 使用核心卡片功能。为了启用完整离线缓存和安装功能，建议在目录中运行：

```bash
python -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

Windows 可双击 `start-windows.bat`，macOS 可双击 `start-mac.command`。

## Android、iPad 和电脑安装

将目录部署到 HTTPS 静态网站后：

- Windows / macOS：使用 Chrome 或 Edge 的“安装”按钮
- Android：Chrome 菜单 → “安装应用”或“添加到主屏幕”
- iPad：Safari 分享按钮 → “添加到主屏幕”

安装后支持离线打开。

## JSON 数据结构

```json
{
  "cards": [
    {
      "id": "card-id",
      "categoryEn": "Category",
      "categoryZh": "分类",
      "questionEn": "English question",
      "questionZh": "中文问题",
      "answers": [
        {
          "angleEn": "Answer angle",
          "angleZh": "回答方向",
          "answerEn": "English answer",
          "answerZh": "中文答案"
        }
      ]
    }
  ]
}
```

每张卡可保存三套答案。
