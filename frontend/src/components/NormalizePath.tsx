import { Navigate, useLocation } from "react-router-dom";

/**
 * Collapses repeated slashes in the path and redirects once.
 *
 * WhatsApp template buttons are a fixed base URL on the Meta dashboard plus a
 * suffix we supply, so whether the result has one slash or two depends on how
 * that base was typed — and we cannot read it from here. A doubled slash
 * matches no route and renders the 404 page, which is what made the sold
 * notification's button dead.
 *
 * Normalising here fixes it under either spelling, and keeps working if a
 * template is ever re-approved with the other one.
 */
const NormalizePath = () => {
  const location = useLocation();
  if (!location.pathname.includes("//")) return null;

  const path = location.pathname.replace(/\/{2,}/g, "/");
  return <Navigate to={`${path}${location.search}${location.hash}`} replace />;
};

export default NormalizePath;
