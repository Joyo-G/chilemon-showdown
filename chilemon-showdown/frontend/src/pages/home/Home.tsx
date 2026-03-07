import { useState, useEffect } from "react";
import axios from "axios";
import type { Team } from "../../types/Team";
import type { TeamChilemon } from "../../types/TeamChilemon";

import ButtonLink from "../../components/ButtonLink";
import TeamSelector from "../../components/TeamSelector";
import { createBattle } from "../../services/battle";
import { useNavigate } from "react-router-dom";

import { Container, Paper, Typography, Stack } from "@mui/material";

type TeamView = {
  id: string;
  name: string;
  members: string[];
};

export default function Home() {
  const storedUser =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user: { id: number; username: string; password: string } = JSON.parse(
    storedUser!,
  ); // mock user para test
  // este debería ser un usuario autenticado pero setiene que implementar auth primero
  console.log("Usuario en Home:", user.id, user.username, user.password);
  // Definimos los estados
  const [teams, setTeams] = useState<TeamView[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamView | null>(null);
  //const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const auth = {
          withCredentials: true,
          headers: { "X-CSRF-Token": localStorage.getItem("csrf") || "" },
        };

        // Equipos del usuario autenticado (el backend usa la cookie, no userId)
        const teamsRes = await axios.get<Team[]>("api/teams", auth);

        const teamsCargados = teamsRes.data;

        // Por cada equipo, extrae sus miembros
        const teamsWithMembers: TeamView[] = await Promise.all(
          teamsCargados.map(async (t) => {
            const membersRes = await axios.get<TeamChilemon[]>(
              "api/teamChilemon",
              {
                params: { teamId: t.id },
                ...auth,
              },
            );

            const members = membersRes.data
              .sort((a, b) => a.position - b.position)
              .map((m) => m.nickname.trim().slice(0, 2).toUpperCase());

            return {
              id: String(t.id),
              name: t.name,
              members,
            };
          }),
        );

        setTeams(teamsWithMembers);
        setSelectedTeam(teamsWithMembers[0] || null);
      } catch (e: any) {
        console.error(e);
      }
    }

    load();
  }, [user?.id]);
  console.log(teams);
  const navigate = useNavigate();

  const handleBattleCreation = async () => {
    // Use frontend service to create/join a battle and navigate to Battle page
    if (!selectedTeam) {
      console.warn("No team selected");
      return;
    }
    try {
      const userId = (user?.id || "") as string;
      const res = await createBattle(userId, selectedTeam.id);
      const id = (res as any)._id ?? (res as any).id;
      console.log("Created battle with ID:", id);
      if (id) {
        // navigate to battle page with query param
        navigate(`/battle/${id}`);
      }
    } catch (err) {
      console.error("Error creating battle via service", err);
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        minHeight: "calc(100vh - 64px)", // Navbar height
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: "100%",
          p: 4,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          textAlign: "center",
        }}
      >
        <Typography
          variant="h4"
          fontWeight={700}
          color="primary"
          sx={{ mb: 1 }}
        >
          Chilemon Showdown
        </Typography>

        <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
          <ButtonLink route="team-builder" text="Team Builder" fullWidth />

          <TeamSelector
            teams={teams}
            selectedTeamId={selectedTeam?.id ?? null}
            onChange={(id) =>
              setSelectedTeam(teams.find((t) => t.id === id) || null)
            }
          />

          <ButtonLink
            text="Battle with Selected Team"
            onClick={handleBattleCreation}
          />

          {teams.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No tienes equipos todavía.
            </Typography>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
