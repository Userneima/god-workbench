import net from "node:net";
import { existsSync } from "node:fs";

const REQUIRED_NODE_MAJOR = 20;
const DEV_PORT = Number(process.env.PORT || 43174);

const fail = (message) => {
    console.error(`启动检查失败：${message}`);
    process.exit(1);
};

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < REQUIRED_NODE_MAJOR) {
    fail(`需要 Node.js ${REQUIRED_NODE_MAJOR}+，当前是 ${process.versions.node}`);
}

if (!existsSync("package-lock.json")) {
    fail("缺少 package-lock.json");
}

if (!existsSync("node_modules")) {
    fail("缺少 node_modules，请先运行 npm install");
}

const checkPort = (port) => new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
        server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
});

const portAvailable = await checkPort(DEV_PORT);
if (!portAvailable) {
    fail(`端口 ${DEV_PORT} 已被占用`);
}

console.log("启动检查通过");
