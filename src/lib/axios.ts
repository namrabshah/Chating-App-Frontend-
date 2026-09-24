import axios from "axios";
import { getToken } from "@/lib/auth";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Let the browser set multipart boundary for FormData uploads
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const headers = config.headers as {
      delete?: (name: string) => void;
      set?: (name: string, value?: string) => void;
    } & Record<string, unknown>;

    if (typeof headers.delete === "function") {
      headers.delete("Content-Type");
    } else {
      delete headers["Content-Type"];
    }
  }

  return config;
});

export default api;