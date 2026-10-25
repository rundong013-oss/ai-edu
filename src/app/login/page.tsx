import { LoginForm } from "./LoginForm";

// 本地开发显示「演示账号一键登录」；服务器部署（生产环境）不显示
export default function LoginPage() {
  return <LoginForm showDemo={process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGIN === "true"} />;
}
