import { useEffect } from "react";
import { useLocation } from "wouter";

export default function XosPipeline() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/dev-center");
  }, [setLocation]);
  return null;
}
