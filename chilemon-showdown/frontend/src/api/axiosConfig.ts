import axios from "axios";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;
