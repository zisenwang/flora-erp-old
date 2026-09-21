import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Inject JWT on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token expiry handler — only redirect on 401 outside of the login page
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginPage = window.location.pathname === "/login";
    if (err.response?.status === 401 && !isLoginPage) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default client;
