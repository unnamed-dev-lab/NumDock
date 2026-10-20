import { Navigate } from "react-router";

export default function OrdersRedirect() {
  return <Navigate to="/app/billing" replace />;
}
