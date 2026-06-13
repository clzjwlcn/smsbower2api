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
APP_ALLOWED_HOSTS=true

MYSQL_DATABASE=smsbower2api
MYSQL_USER=smsbower
MYSQL_PASSWORD=
MYSQL_ROOT_PASSWORD=
DATABASE_URL=

ADMIN_USERNAME=admin
ADMIN_PASSWORD=asd123321

SMSBOWER_API_BASE_URL=https://smsbower.page/stubs/handler_api.php
SMSBOWER_API_KEY=你的_smsbower_api_key

SMSBOWER_WEBHOOK_SECRET=改成一串随机字符
SMSBOWER_WEBHOOK_ALLOWED_IPS=167.235.198.205
```

`MYSQL_PASSWORD`、`MYSQL_ROOT_PASSWORD`、`DATABASE_URL` 可以留空，`sh scripts/deploy-mysql.sh` 会自动生成随机密码并写回 `.env`。

建议上线后立刻修改 `ADMIN_PASSWORD` 和 `SMSBOWER_WEBHOOK_SECRET`。

### 4. 一键启动

```bash
sh scripts/deploy-mysql.sh
```

这个脚本会自动拉取最新代码、生成 MySQL 随机账号密码、启动 `smsbower2api` 和 `mysql` 两个容器、创建 MySQL 表，并尝试把旧版 `.wrangler` D1 数据导入 MySQL。

也可以手动启动：

```bash
docker compose up -d --build
docker compose exec -T smsbower2api npm run db:migrate:d1-to-mysql
```

`docker-compose.yml` 默认使用 Docker Hub 镜像源代理拉取 Node 基础镜像，并使用 npmmirror 安装 npm 依赖，适合国内/宝塔服务器。如果服务器能直连 Docker Hub，也可以改 `.env`：

```bash
NODE_IMAGE=node:22-bookworm-slim
NPM_REGISTRY=https://registry.npmjs.org
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

默认允许所有访问域名，宝塔绑定域名后可以直接访问。如果你想限制只允许指定域名访问，可以在 `.env` 中设置：

```bash
APP_ALLOWED_HOSTS=sms.miaolv.net
```

多个域名用英文逗号分隔，例如 `APP_ALLOWED_HOSTS=sms.miaolv.net,www.example.com`。保持默认 `APP_ALLOWED_HOSTS=true` 表示允许所有域名。

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

如果仍然构建失败，运行部署诊断：

```bash
sh scripts/doctor.sh
```

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

Docker Compose 默认使用 MySQL 保存数据，数据保存在 Docker volume：

```text
smsbower2api_mysql
```

卡密、订单、后台设置、公告都会保存在这个 volume 中。

旧版本使用的 D1/Miniflare 数据仍会保留在：

```text
smsbower2api_wrangler
```

升级到 MySQL 后可以执行一次迁移：

```bash
docker compose exec -T smsbower2api npm run db:migrate:d1-to-mysql
```

迁移脚本会自动扫描 `/app/.wrangler/state/v3/d1` 下的 SQLite 数据库，并把 `service_configs`、`access_cards`、`activation_orders`、`webhook_events`、`app_settings` 导入 MySQL。重复执行会跳过已存在记录。

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
sh scripts/deploy-mysql.sh
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
