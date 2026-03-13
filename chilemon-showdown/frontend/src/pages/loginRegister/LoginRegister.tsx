import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
} from "@mui/material";

const LoginRegister: React.FC = () => {
  const [login, setLogin] = useState("Login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const auth = useAuth();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      await auth.handleLogin(username, password);
      setError("");
      navigate("/home");
    } catch (err: any) {
      const msg =
        err?.message === "Error al iniciar sesión" ||
        err?.message === "Error en el login"
          ? "Usuario o contraseña incorrectos."
          : err?.message || "Error de conexión.";
      setError(msg);
    } finally {
      setUsername("");
      setPassword("");
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      await auth.handleRegister(username, password);
      alert("¡Registro exitoso!");
      setLogin("Login");
    } catch (err: any) {
      const msg =
        err?.message === "Usuario ya existe"
          ? "El usuario ya existe."
          : err?.message || "Error de conexión.";
      setError(msg);
    }

    setUsername("");
    setPassword("");
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Typography
          variant="h4"
          fontWeight={700}
          color="primary"
          sx={{ mb: 2 }}
        >
          Bienvenido/as a Chilemon Showdown!!!
        </Typography>

        <Typography
          variant="h6"
          fontWeight={550}
          sx={{ textAlign: "left", mb: 2 }}
        >
          {login}
        </Typography>

        <Box
          component="form"
          onSubmit={login === "Login" ? handleLogin : handleRegister}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            placeholder="Username"
            name="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
          />

          <TextField
            placeholder="Password"
            type="password"
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />

          <Button type="submit" fullWidth variant="contained">
            {login}
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}

        <Typography sx={{ mt: 3 }}>
          {login === "Register" ? (
            <>
              ¿Ya tienes cuenta?{" "}
              <Typography
                component="span"
                sx={{
                  color: "primary.main",
                  fontWeight: "bold",
                  cursor: "pointer",
                  textDecoration: "none",
                  "&:hover": {
                    textDecoration: "underline",
                    color: "primary.dark",
                  },
                }}
                onClick={() => setLogin("Login")}
              >
                Login
              </Typography>
            </>
          ) : (
            <>
              ¿No tienes cuenta?{" "}
              <Typography
                component="span"
                sx={{
                  color: "primary.main",
                  fontWeight: "bold",
                  cursor: "pointer",
                  textDecoration: "none",
                  "&:hover": {
                    textDecoration: "underline",
                    color: "primary.dark",
                  },
                }}
                onClick={() => setLogin("Register")}
              >
                Register
              </Typography>
            </>
          )}
        </Typography>
      </Paper>
    </Container>
  );
};

export default LoginRegister;
