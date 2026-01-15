import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Tutores from './pages/Tutores';
import Cursos from './pages/Cursos';
import Estudiantes from './pages/Estudiantes';
import Matriculas from './pages/Matriculas';
import Pagos from './pages/Pagos';

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tutores" element={<Tutores />} />
            <Route path="/cursos" element={<Cursos />} />
            <Route path="/estudiantes" element={<Estudiantes />} />
            <Route path="/matriculas" element={<Matriculas />} />
            <Route path="/pagos" element={<Pagos />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
