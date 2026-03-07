import axios from "axios";

export const login = async (username: string, password: string) => {
  try {
    const response = await axios.post(
      "api/login",
      { username, password },
      { withCredentials: true },
    );

    const csrf = response.headers["x-csrf-token"] as string | undefined;
    if (csrf) localStorage.setItem("csrf", csrf);

    const token = response.data?.token;
    if (token) localStorage.setItem("token", token);

    return response.data;
  } catch (error) {
    throw new Error("Error al iniciar sesión");
  }
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("csrf");
  localStorage.removeItem("user");
};

export const getUserData = async () => {
  try {
    const csrf = localStorage.getItem("csrf") || "";
    const response = await axios.get("api/login/me", {
      withCredentials: true,
      headers: { "x-csrf-token": csrf },
    });
    return response.data;
  } catch (error) {
    throw new Error("Error al obtener datos del usuario");
  }
};

export const register = async (username: string, password: string) => {
  try {
    const { data } = await axios.get("api/users", { params: { username } });
    const exists =
      Array.isArray(data) && data.some((u: any) => u.username === username);
    if (exists) {
      throw new Error("Usuario ya existe");
    }

    await axios.post("api/users", { username, password });
    return true;
  } catch (error: any) {
    if (error?.message === "Usuario ya existe") throw error;
    throw new Error("Error al registrar usuario");
  }
};
