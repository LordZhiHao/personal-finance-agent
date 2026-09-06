import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { OverviewPage } from "./pages/OverviewPage";
import { SpendingPage } from "./pages/SpendingPage";
import { InvestmentsPage } from "./pages/InvestmentsPage";
import { ChatPage } from "./pages/ChatPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  return (
    <ProtectedRoute>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/spending" element={<SpendingPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </ProtectedRoute>
  );
}

export default App;
