import { AuthPage } from "@/components/auth-page";

export const meta = () => [{ title: "Sign in · NumDock" }, { name: "description", content: "Sign in to your NumDock workspace." }];
export default function Login() { return <AuthPage mode="login" />; }
