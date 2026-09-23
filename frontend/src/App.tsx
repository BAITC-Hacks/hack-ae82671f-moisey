import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { EmployeeSelector } from './pages/EmployeeSelector';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { QuestDetails } from './pages/QuestDetails';
import { HrDashboard } from './pages/HrDashboard';
import { NotFound } from './pages/NotFound';
export default function App() {
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<EmployeeSelector />} /><Route path="/employee/:id" element={<EmployeeDashboard />} /><Route path="/employee/:id/quest/:eventId" element={<QuestDetails />} /><Route path="/hr" element={<HrDashboard />} /><Route path="*" element={<NotFound />} /></Route></Routes>;
}
