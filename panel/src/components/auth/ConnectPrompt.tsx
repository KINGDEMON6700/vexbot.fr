import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.js";

type Props = {
  pageTitle: string;
};

export function ConnectPrompt({ pageTitle }: Props) {
  const location = useLocation();
  const { user } = useAuth();

  if (user) return null;

  return <Navigate to="/login" replace state={{ from: location, pageTitle }} />;
}
