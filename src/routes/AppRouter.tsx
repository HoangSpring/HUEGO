import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthPage } from '../pages/Auth/AuthPage';
import { LanguageSelectionPage } from '../pages/LanguageSelection/LanguageSelectionPage';
import { HomePage } from '../pages/Home/HomePage';
import { PlanTripPage } from '../pages/PlanTrip/PlanTripPage';
import { AIGeneratingPage } from '../pages/AIGenerating/AIGeneratingPage';
import { TripResultPage } from '../pages/TripResult/TripResultPage';
import { TripEditPage } from '../pages/TripEdit/TripEditPage';
import { ExplorePage } from '../pages/Explore/ExplorePage';
import { PlaceDetailPage } from '../pages/PlaceDetail/PlaceDetailPage';
import { HuegoNowPage } from '../pages/HuegoNow/HuegoNowPage';
import { MyTripsPage } from '../pages/MyTrips/MyTripsPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/language" element={<LanguageSelectionPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/"
          element={
            <MainLayout>
              <HomePage />
            </MainLayout>
          }
        />
        <Route path="/home" element={<MainLayout><HomePage /></MainLayout>} />
        <Route path="/explore" element={<MainLayout><ExplorePage /></MainLayout>} />
        <Route path="/place/:placeId" element={<MainLayout><PlaceDetailPage /></MainLayout>} />
        <Route path="/now" element={<MainLayout><HuegoNowPage /></MainLayout>} />

        <Route
          path="/plan"
          element={
            <ProtectedRoute>
              <MainLayout><PlanTripPage /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-generating"
          element={
            <ProtectedRoute>
              <MainLayout><AIGeneratingPage /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trip/:tripId"
          element={
            <ProtectedRoute>
              <MainLayout><TripResultPage /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trip/:tripId/edit"
          element={
            <ProtectedRoute>
              <MainLayout><TripEditPage /></MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-trips"
          element={
            <ProtectedRoute>
              <MainLayout><MyTripsPage /></MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
