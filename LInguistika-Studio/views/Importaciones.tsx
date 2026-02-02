import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/UI';
import { formatDateCR } from '../lib/format';
import { RefreshCw, Users, Upload } from 'lucide-react';

type GrupoImportado = {
  id: string;
  nombre_grupo: string | null;
  curso_id: string | null;
  tutor_id: string | null;
  curso_nombre?: string | null;
  tutor_nombre?: string | null;
  turno?: string | null;
  estado?: string | null;
  fecha_inicio?: string | null;
  created_at?: string | null;
  linked_count?: number | null;
  cantidad_estudiantes_esperados?: number | null;
};

type EstudianteBulk = {
  id: string;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  requiere_perfil_completo: boolean | null;
  estado?: string | null;
  created_at?: string | null;
};

const safeDate = (value: any) => {
  if (!value) return '—';
  try {
    return formatDateCR(value);
  } catch {
    return String(value);
  }
};

const Importaciones: React.FC = () => {
  const [tab, setTab] = useState<'grupos' | 'estudiantes'>('grupos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [grupos, setGrupos] = useState<GrupoImportado[]>([]);
  const [estudiantes, setEstudiantes] = useState<EstudianteBulk[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailGrupo, setDetailGrupo] = useState<GrupoImportado | null>(null);
  const [detailEstudiantes, setDetailEstudiantes] = useState<EstudianteBulk[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, e] = await Promise.all([api.bulk.listGrupos(), api.bulk.listEstudiantesBulk()]);
      setGrupos(g as any);
      setEstudiantes(e as any);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'No se pudo cargar importaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openGrupo = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailGrupo(null);
    setDetailEstudiantes([]);

    try {
      const data = await api.bulk.getGrupo(id);
      setDetailGrupo((data?.grupo ?? null) as any);
      setDetailEstudiantes((data?.estudiantes ?? []) as any);
    } catch (err: any) {
      setDetailError(err?.response?.data?.error || err?.message || 'No se pudo cargar el detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredGrupos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => {
      const hay = [g.nombre_grupo, g.curso_nombre, g.tutor_nombre, g.turno, g.estado]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [grupos, search]);

  const filteredEstudiantes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return estudiantes;
    return estudiantes.filter((s) => {
      const hay = [s.nombre, s.correo, s.telefono, s.estado].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [estudiantes, search]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#FFC800]" />
              Importaciones
            </CardTitle>
            <CardDescription>
              Aquí ves los grupos creados y estudiantes en cola (bulk).
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refrescar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={tab === 'grupos' ? 'primary' : 'secondary'}
                onClick={() => setTab('grupos')}
              >
                Grupos
                <span className="ml-2 text-xs font-bold opacity-80">({grupos.length})</span>
              </Button>
              <Button
                variant={tab === 'estudiantes' ? 'primary' : 'secondary'}
                onClick={() => setTab('estudiantes')}
              >
                Estudiantes (bulk)
                <span className="ml-2 text-xs font-bold opacity-80">({estudiantes.length})</span>
              </Button>
            </div>

            <div className="w-full md:max-w-lg">
              <Input
                placeholder="Buscar por nombre, curso, tutor, correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-slate-300">Cargando…</div>
          ) : tab === 'grupos' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Vinculados</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrupos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-slate-300">
                      No hay grupos importados que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGrupos.map((g) => (
                    <TableRow
                      key={g.id}
                      className="cursor-pointer"
                      onClick={() => openGrupo(g.id)}
                      title="Ver detalle"
                    >
                      <TableCell className="font-semibold">
                        {g.nombre_grupo || `Grupo #${g.id}`}
                      </TableCell>
                      <TableCell>{g.curso_nombre || '—'}</TableCell>
                      <TableCell>{g.tutor_nombre || '—'}</TableCell>
                      <TableCell>{g.turno || '—'}</TableCell>
                      <TableCell>{safeDate(g.fecha_inicio)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-300" />
                          <span className="font-bold">{g.linked_count ?? 0}</span>
                          {typeof g.cantidad_estudiantes_esperados === 'number' && (
                            <span className="text-slate-400">/ {g.cantidad_estudiantes_esperados}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={g.estado === 'activo' ? 'success' : 'info'}>
                          {g.estado || '—'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Perfil Completo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstudiantes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-slate-300">
                      No hay estudiantes bulk que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEstudiantes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{s.nombre || `#${s.id}`}</TableCell>
                      <TableCell>{s.correo || '—'}</TableCell>
                      <TableCell>{s.telefono || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={s.requiere_perfil_completo ? 'warning' : 'success'}>
                          {s.requiere_perfil_completo ? 'SI' : 'NO'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.estado === 'activo' ? 'success' : 'info'}>{s.estado || '—'}</Badge>
                      </TableCell>
                      <TableCell>{safeDate(s.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailGrupo?.nombre_grupo ? `Detalle: ${detailGrupo.nombre_grupo}` : 'Detalle de grupo'}
      >
        {detailLoading ? (
          <div className="text-slate-300">Cargando detalle…</div>
        ) : detailError ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {detailError}
          </div>
        ) : !detailGrupo ? (
          <div className="text-slate-300">Sin datos.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Curso</div>
                <div className="font-semibold">{detailGrupo.curso_nombre || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tutor</div>
                <div className="font-semibold">{detailGrupo.tutor_nombre || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Turno</div>
                <div className="font-semibold">{detailGrupo.turno || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inicio</div>
                <div className="font-semibold">{safeDate(detailGrupo.fecha_inicio)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#051026]/30 p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold">Estudiantes vinculados</div>
                <Badge variant="info">{detailEstudiantes.length}</Badge>
              </div>
              <div className="mt-3 max-h-72 overflow-auto space-y-2">
                {detailEstudiantes.length === 0 ? (
                  <div className="text-slate-300 text-sm">Aún no hay estudiantes vinculados a este grupo.</div>
                ) : (
                  detailEstudiantes.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col gap-1 rounded-xl border border-white/10 bg-[#0F2445] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{s.nombre || `#${s.id}`}</div>
                        <Badge variant={s.requiere_perfil_completo ? 'warning' : 'success'}>
                          Perfil: {s.requiere_perfil_completo ? 'SI' : 'NO'}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-300">
                        {s.correo || '—'} {s.telefono ? `• ${s.telefono}` : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setDetailOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default Importaciones;
