# SMSBower2API 接码网关

这是一个对接 SMSBower 的卡密接码网站，包含前台取号页和后台管理页。

- 前台：输入卡密、验证额度、获取手机号、刷新验证码、取消并退额度。
- 后台：生成卡密、设置服务/国家、设置 SMSBower API Key、设置首页公告。
- Webhook：接收 SMSBower 短信推送并按 `activationId` 写回验证码。

## 一键 Docker 部署

### 1. 准备服务器

服务器需要安装 Docker 和 Docker Compose。

```bash
docker --version
docker compose version
```

### 2. 拉取代码

```bash
git clone https://github.com/clzjwlcn/smsbower2api.git
cd smsbower2api
```

### 3. 创建配置文件

在项目目录创建 `.env`：

```bash
APP_PORT=3000

ADMIN_USERNAME=admin
ADMIN_PASSWORD=asd123321

SMSBOWER_API_BASE_URL=https://smsbower.page/stubs/handler_api.php
SMSBOWER_API_KEY=你的_smsbower_api_key

SMSBOWER_WEBHOOK_SECRET=改成一串随机字符
SMSBOWER_WEBHOOK_ALLOWED_IPS=167.235.198.205
```

建议上线后立刻修改 `ADMIN_PASSWORD` 和 `SMSBOWER_WEBHOOK_SECRET`。

### 4. 一键启动

```bash
docker compose up -d --build
```

访问地址：

- 前台：`http://服务器IP:3000/`
- 后台：`http://服务器IP:3000/admin`


```

如果你在 `.env` 中修改了端口，例如 `APP_PORT=8080`，访问地址就是：

```text
http://服务器IP:8080/
http://服务器IP:8080/admin
```

如果之前已经启动过旧容器，修复后请重新构建并重启：

```bash
docker compose down
docker compose up -d --build
```

如果服务器拉取 Docker Hub 基础镜像超时，但本机已经有旧镜像，可以先不重新构建，直接用最新 `docker-compose.yml` 覆盖启动命令重建容器：

```bash
git pull
docker compose down
docker compose up -d --force-recreate --no-build
docker compose logs -f smsbower2api
```

如果服务器仍然打不开，先在服务器上检查：

```bash
docker compose ps
docker compose logs --tail=100 smsbower2api
docker compose exec smsbower2api sh -lc "wget -qO- http://127.0.0.1:3000/ | head"
curl -I http://127.0.0.1:${APP_PORT:-3000}/
ss -lntp | grep ":${APP_PORT:-3000}"
```

日志里应该能看到服务监听在 `http://0.0.0.0:3000/`。如果容器内能访问、服务器本机 `curl` 也能访问，但浏览器访问 `http://服务器IP:端口/` 不通，请在云服务器安全组和系统防火墙放行对应端口。

`docker-compose.yml` 已设置 `CLOUDFLARE_CF_FETCH_ENABLED=false`，避免 Miniflare 启动时因服务器无法访问 `workers.cloudflare.com/cf.json` 而等待超时；这个 `Request.cf` 占位信息不影响接码业务。

## 后台设置

进入 `/admin` 后可以设置：

- 后台管理员账号和密码
- SMSBower API 地址
- SMSBower API Key
- 首页公告栏标题、内容、开关
- 服务代码和国家代码
- 卡密数量、额度、前缀、过期时间

后台登录成功后会在当前浏览器会话中保持登录状态，刷新 `/admin` 页面会自动重新加载后台。点击“退出登录”会清除会话密码。

SMSBower API 请求地址默认是：

```text
https://smsbower.page/stubs/handler_api.php
```

API Key 也可以不写在 `.env`，直接在后台“接口设置”里保存。

## SMSBower Webhook

在 SMSBower 个人资料里填写 Webhook 地址：

```text
http://服务器IP:3000/api/webhook/smsbower?secret=你的_SMSBOWER_WEBHOOK_SECRET
```

如果使用域名和 HTTPS：

```text
https://你的域名/api/webhook/smsbower?secret=你的_SMSBOWER_WEBHOOK_SECRET
```

SMSBower 官方 Webhook 来源 IP：

```text
167.235.198.205
```

如果你设置了 `SMSBOWER_WEBHOOK_ALLOWED_IPS=167.235.198.205`，服务端只接受这个 IP 的回调。

## 数据持久化

Docker Compose 会把本地 D1 数据保存到 Docker volume：

```text
smsbower2api_wrangler
```

卡密、订单、后台设置、公告都会保存在这个 volume 中。

停止容器但保留数据：

```bash
docker compose down
```

删除容器和数据：

```bash
docker compose down -v
```

## 更新代码

```bash
git pull
docker compose up -d --build
```

## 常用命令

查看运行状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

重启：

```bash
docker compose restart
```

停止：

```bash
docker compose down
```

## 不使用 Docker 本地开发

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

构建检查：

```bash
npm run lint
npm run build
```
