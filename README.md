# 奶龙大乱斗 · NAILONG BRAWL

梗王大乱斗，云集了各种风云人物，后续会持续更新。

本地 Three.js 格斗页：**奶龙 VS 美鼠**。用浏览器打开即可玩，不需要打包。

## 运行

必须用本地 HTTP 服务打开（直接双击 `index.html` 会因跨域读不了 GLB）。

```bash
python -m http.server 8765
```

浏览器访问：<http://127.0.0.1:8765/>

## 操作

- **1P**：WASD 移动 · J/K 轻 · U/I 重 · L 必杀 · O 超必
- **2P 同屏**：方向键 + 数字键（见游戏内「操作说明」）

## 目录

- `index.html` / `css/` / `js/`：游戏界面与逻辑
- `assets/`：场景图、角色 GLB
- `vendor/`：Three.js 与 GLTFLoader
