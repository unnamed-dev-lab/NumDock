import { AuthPage } from "@/components/auth-page";

export const meta = () => [{ title: "Create a workspace · NumDock" }, { name: "description", content: "Create your NumDock account and organization workspace." }];
export default function Register() { return <AuthPage mode="register" />; }
