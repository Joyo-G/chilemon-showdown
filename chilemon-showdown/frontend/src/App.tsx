import "./App.css";

import LoginRegister from "./pages/loginRegister/LoginRegister";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TeamBuilder from "./pages/teamBuilder/TeamBuilder";
import Home from "./pages/home/Home";
import Profile from "./pages/profile/Profile";
import { Battle } from "./pages/battle/Battle";
import Navtab from "./components/Navtab";

const App: React.FC = () => {
  const navTabs = [
    { label: "Home", path: "/home" },
    { label: "Team Builder", path: "/team-builder" },
    { label: "Profile", path: "/profile" },
  ];

  return (
    <BrowserRouter>
      <div className="content mt-16">
        <Navtab tabs={navTabs} hidePaths={["/"]} />
        <Routes>
          <Route path="/" element={<LoginRegister />} />
          <Route path="/home" element={<Home />} />
          <Route path="/team-builder" element={<TeamBuilder />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/battle/:battleId" element={<Battle />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
