import { Navigate } from "react-router";

export default function InboxRedirect() {
  return <Navigate to="/app/messages" replace />;
}
