import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { SpendingPage } from "./pages/SpendingPage";
import { InvestmentsPage } from "./pages/InvestmentsPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { BalancesPage } from "./pages/BalancesPage";

function App() {
  return (
    <ProtectedRoute>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/spending" replace />} />
          <Route path="/spending" element={<SpendingPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/balances" element={<BalancesPage />} />
          <Route path="*" element={<Navigate to="/spending" replace />} />
        </Route>
      </Routes>
    </ProtectedRoute>
  );
}

export default App;
