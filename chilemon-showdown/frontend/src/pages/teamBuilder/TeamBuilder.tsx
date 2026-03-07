import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { isPowerNull } from "../../services/moves";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  IconButton,
  Alert,
  Avatar,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import type { Chilemon } from "../../types/Chilemon";

interface PlayerDisplay {
  id: number;
  name: string;
  avatar: string;
  selectedMoves?: number[];
  availableMoves?: number[]; // IDs de movimientos disponibles
}

interface ExistingTeam {
  id: number;
  name: string;
  members: PlayerDisplay[];
}

const TeamBuilder: React.FC = () => {
  const navigate = useNavigate();

  const [teamName, setTeamName] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerDisplay[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerDisplay[]>([]);
  const [error, setError] = useState("");
  const [existingTeams, setExistingTeams] = useState<ExistingTeam[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const auth = useCallback(
    () => ({
      withCredentials: true,
      headers: { "X-CSRF-Token": localStorage.getItem("csrf") || "" },
    }),
    [],
  );

  const getRandomMoves = useCallback(
    (availableMoves: number[], count: number = 4): number[] => {
      if (!availableMoves || availableMoves.length === 0) return [];

      // Filter out moves whose `power` is null
      const validMoves = availableMoves.filter((id) => !isPowerNull(id));
      if (validMoves.length === 0) return [];

      const shuffled = [...validMoves].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(count, shuffled.length));
    },
    [],
  );

  const loadAvailableChilemon = useCallback(async () => {
    try {
      const response = await axios.get<Chilemon[]>("chilemon");
      const players: PlayerDisplay[] = response.data.map((chilemon) => ({
        id: chilemon.id,
        name: chilemon.name,
        avatar: `/sprites/${chilemon.id}.png`,
        availableMoves: chilemon.moves || [],
      }));
      setAvailablePlayers(players);
    } catch (error) {
      console.error("Error loading Chilemon:", error);
      setError("Error al cargar los Chilemon disponibles.");
    }
  }, []);

  const loadExistingTeams = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;

      if (!user) return;
      const teamsRes = await axios.get("api/teams", auth());

      const teamsWithMembers = await Promise.all(
        teamsRes.data.map(async (team: any) => {
          const membersRes = await axios.get("api/teamChilemon", {
            params: { teamId: team.id },
            ...auth(),
          });

          const chilemonRes = await axios.get<Chilemon[]>("chilemon");

          const members = membersRes.data
            .map((m: any) => {
              const chilemon = chilemonRes.data.find(
                (c) => c.id === m.chilemonId,
              );
              return chilemon
                ? {
                    id: chilemon.id,
                    name: chilemon.name,
                    avatar: `/sprites/${chilemon.id}.png`,
                  }
                : null;
            })
            .filter(Boolean);

          return {
            id: team.id,
            name: team.name,
            members: members,
          };
        }),
      );

      setExistingTeams(teamsWithMembers);
    } catch (error) {
      console.error("Error loading teams:", error);
    }
  }, [auth]);

  useEffect(() => {
    loadAvailableChilemon();
    loadExistingTeams();
  }, [loadAvailableChilemon, loadExistingTeams]);

  const handleSelectTeam = useCallback((team: ExistingTeam) => {
    setActiveTeamId(team.id);
    setTeamName(team.name);
    setSelectedPlayers(team.members);
    setIsCreatingNew(false);
    setError("");
  }, []);

  const handleNewTeam = useCallback(() => {
    setActiveTeamId(null);
    setTeamName("");
    setSelectedPlayers([]);
    setIsCreatingNew(true);
    setError("");
  }, []);

  const handleAddPlayer = useCallback(
    (player: PlayerDisplay) => {
      if (selectedPlayers.length >= 6) {
        setError("No puedes agregar más de 6 Chilemon a tu equipo.");
        return;
      }
      if (selectedPlayers.find((p) => p.id === player.id)) {
        setError("Este Chilemon ya está en tu equipo.");
        return;
      }

      const randomMoves = getRandomMoves(player.availableMoves || [], 4);

      setSelectedPlayers((prev) => [
        ...prev,
        {
          ...player,
          selectedMoves: randomMoves,
        },
      ]);
      setError("");
    },
    [selectedPlayers, getRandomMoves],
  );

  const handleRemovePlayer = useCallback((playerId: number) => {
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setError("");
  }, []);

  const handleDeleteTeam = useCallback(
    async (teamId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        !window.confirm("¿Estás seguro de que quieres eliminar este equipo?")
      ) {
        return;
      }

      try {
        await axios.delete(`api/teams/${teamId}`, auth());
        setExistingTeams((prev) => prev.filter((t) => t.id !== teamId));
        if (activeTeamId === teamId) {
          handleNewTeam();
        }
      } catch (error) {
        setError("Error al eliminar el equipo.");
      }
    },
    [auth, activeTeamId, handleNewTeam],
  );

  const handleSaveTeam = useCallback(async () => {
    setError("");

    if (!teamName.trim()) {
      setError("Por favor, ingresa un nombre para tu equipo.");
      return;
    }

    if (selectedPlayers.length === 0) {
      setError("Debes agregar al menos un Chilemon a tu equipo.");
      return;
    }

    try {
      const storedUser = localStorage.getItem("user");
      const user = storedUser ? JSON.parse(storedUser) : null;

      if (!user) {
        setError("Debes iniciar sesión para crear un equipo.");
        return;
      }

      // Envía los movimientos junto con el ID
      const membersData = selectedPlayers.map((p) => ({
        pokemonId: p.id,
        moves: p.selectedMoves || [],
      }));

      if (activeTeamId) {
        await axios.put(
          `api/teams/${activeTeamId}`,
          {
            name: teamName,
            members: membersData,
          },
          auth(),
        );
        window.alert("¡Equipo actualizado exitosamente!");
      } else {
        await axios.post(
          "api/teams",
          {
            name: teamName,
            members: membersData,
          },
          auth(),
        );
        window.alert("¡Equipo creado exitosamente!");
      }

      setIsCreatingNew(false);
      await loadExistingTeams();
    } catch {
      setError("Error al guardar el equipo.");
    }
  }, [teamName, selectedPlayers, activeTeamId, auth, loadExistingTeams]);

  const teamSlots = useMemo(
    () =>
      Array(6)
        .fill(null)
        .map((_, index) => selectedPlayers[index] || null),
    [selectedPlayers],
  );

  return (
    <Box
      sx={{
        display: "flex",
        height: "calc(100vh - 64px)",
        bgcolor: "#f8f9fa",
        overflow: "hidden",
      }}
    >
      {/* lista de equipos */}
      <Paper
        elevation={0}
        sx={{
          width: 280,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid #e0e0e0",
          borderRadius: 5,
          p: 3,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 2,
            color: "#1a73e8",
          }}
        >
          Mis Equipos
        </Typography>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewTeam}
          sx={{
            mb: 2,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
            boxShadow: "none",
            "&:hover": {
              boxShadow: "0 2px 8px rgba(26, 115, 232, 0.3)",
            },
          }}
        >
          Crear Nuevo Equipo
        </Button>

        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            mb: 2,
            minHeight: 0,
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "#d0d0d0",
              borderRadius: "4px",
            },
          }}
        >
          {existingTeams.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4, color: "#757575" }}>
              <Typography variant="body2">No tienes equipos creados</Typography>
            </Box>
          ) : (
            existingTeams.map((team) => (
              <Paper
                key={team.id}
                elevation={0}
                onClick={() => handleSelectTeam(team)}
                className="team-sidebar-item"
                data-team-name={team.name}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 1.5,
                  mb: 1,
                  bgcolor: activeTeamId === team.id ? "#e8f0fe" : "white",
                  border: "1px solid",
                  borderColor: activeTeamId === team.id ? "#1a73e8" : "#e0e0e0",
                  borderRadius: 2,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": {
                    bgcolor: activeTeamId === team.id ? "#e8f0fe" : "#f5f5f5",
                    borderColor: "#1a73e8",
                  },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      mb: 0.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {team.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#757575" }}>
                    {team.members.length}/6 Chilemon
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => handleDeleteTeam(team.id, e)}
                  className="delete-sidebar-button"
                  sx={{
                    ml: 1,
                    color: "#d32f2f",
                    "&:hover": {
                      bgcolor: "#ffebee",
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Paper>
            ))
          )}
        </Box>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/home")}
          sx={{
            mb: 2,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
            boxShadow: "none",
            "&:hover": {
              boxShadow: "0 2px 8px rgba(26, 115, 232, 0.3)",
            },
          }}
        >
          Volver al Home
        </Button>
      </Paper>

      {/* centro */}
      <Box
        sx={{
          flex: 1,
          p: 3,
          pt: 2,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 2,
            textAlign: "center",
            color: "#1a73e8",
          }}
        >
          {isCreatingNew || !activeTeamId
            ? "Crear Nuevo Equipo"
            : "Editar Equipo"}
        </Typography>

        <Paper
          elevation={0}
          sx={{
            display: "flex",
            gap: 1.5,
            mb: 1.5,
            p: 2,
            borderRadius: 2,
            border: "1px solid #e0e0e0",
          }}
        >
          <TextField
            fullWidth
            className="team-name-input"
            name="team-name-input"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Nombre del Equipo"
            variant="outlined"
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                fontWeight: 600,
                bgcolor: "white",
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleSaveTeam}
            className="save-button"
            startIcon={<SaveIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              boxShadow: "none",
              "&:hover": {
                boxShadow: "0 2px 8px rgba(26, 115, 232, 0.3)",
              },
            }}
          >
            Guardar
          </Button>
        </Paper>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 1.5,
              borderRadius: 2,
            }}
          >
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            gap: 2,
            flex: 1,
            minHeight: 0,
          }}
        >
          {teamSlots.map((player, index) => (
            <Paper
              key={index}
              className="team-slot"
              elevation={0}
              sx={{
                position: "relative",
                border: "2px solid",
                borderColor: player ? "#1a73e8" : "#e0e0e0",
                borderRadius: 3,
                p: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                minHeight: 160,
                bgcolor: player ? "white" : "#fafafa",
                "&:hover": {
                  boxShadow: player
                    ? "0 4px 12px rgba(26, 115, 232, 0.15)"
                    : "none",
                },
              }}
            >
              {player ? (
                <>
                  <Avatar
                    src={player.avatar}
                    alt={player.name}
                    imgProps={{ className: "slot-avatar" }}
                    sx={{
                      width: 80,
                      height: 80,
                      mb: 1.5,
                      bgcolor: "#f5f5f5",
                    }}
                  />
                  <Typography
                    variant="body1"
                    className="slot-name"
                    sx={{
                      fontWeight: 700,
                      textAlign: "center",
                      color: "#212121",
                    }}
                  >
                    {player.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleRemovePlayer(player.id)}
                    className="slot-remove"
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      bgcolor: "white",
                      border: "2px solid #d32f2f",
                      color: "#d32f2f",
                      width: 28,
                      height: 28,
                      "&:hover": {
                        bgcolor: "#d32f2f",
                        color: "white",
                      },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                    color: "#9e9e9e",
                  }}
                >
                  <AddIcon sx={{ fontSize: 48 }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Slot {index + 1}
                  </Typography>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      </Box>

      {/* chilemon */}
      <Paper
        elevation={0}
        sx={{
          width: 280,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderLeft: "1px solid #e0e0e0",
          borderRadius: 5,
          p: 3,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 2,
            textAlign: "center",
            color: "#1a73e8",
          }}
        >
          Chilemon Disponibles
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            overflowY: "auto",
            minHeight: 0,
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "#d0d0d0",
              borderRadius: "4px",
            },
          }}
        >
          {availablePlayers.map((player) => {
            const isSelected = selectedPlayers.find((p) => p.id === player.id);
            return (
              <Paper
                key={player.id}
                elevation={0}
                onClick={() => !isSelected && handleAddPlayer(player)}
                className={`available-card ${isSelected ? " selected" : ""}`}
                sx={{
                  position: "relative",
                  bgcolor: isSelected ? "#f5f5f5" : "white",
                  border: "1px solid",
                  borderColor: isSelected ? "#9e9e9e" : "#e0e0e0",
                  borderRadius: 2,
                  p: 1.5,
                  cursor: isSelected ? "not-allowed" : "pointer",
                  opacity: isSelected ? 0.5 : 1,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  transition: "all 0.2s",
                  ...(!isSelected && {
                    "&:hover": {
                      bgcolor: "#e8f0fe",
                      borderColor: "#1a73e8",
                      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
                    },
                  }),
                }}
              >
                <Avatar
                  src={player.avatar}
                  alt={player.name}
                  sx={{
                    width: 64,
                    height: 64,
                    mb: 1,
                    bgcolor: "#f5f5f5",
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: isSelected ? "#757575" : "#212121",
                  }}
                >
                  {player.name}
                </Typography>
                {!isSelected && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 24,
                      height: 24,
                      bgcolor: "#1a73e8",
                      color: "white",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      fontWeight: 700,
                    }}
                  >
                    +
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
};

export default TeamBuilder;
