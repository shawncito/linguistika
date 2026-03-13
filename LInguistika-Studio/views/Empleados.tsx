import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { uiConfirm } from '../lib/uiFeedback';
import { paginasService } from '../services/api/paginasService';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/UI';
import { PhoneInput } from '../components/PhoneInput';

type RolEmpleado = 'admin' | 'contador' | 'tutor_view_only';

type EmpleadoRow = {
  id: string;
  rol: RolEmpleado;
  nombre_completo: string | null;
  telefono: string | null;
  email: string | null;
  estado: boolean;
  created_at?: string;
  updated_at?: string;
};

type PaginaAdminRow = {
  slug: string;
  nombre: string;
  activa: boolean;
  desactivada_por: string | null;
  desactivada_por_nombre: string | null;
  mensaje: string | null;
  updated_at: string;
};

const showActionAlert = (message: string) => {
  window.alert(message);
};

const Empleados: React.FC = () => {
  const [me, setMe] = useState<any>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolEmpleado>('tutor_view_only');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRol, setEditRol] = useState<RolEmpleado>('tutor_view_only');
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editEstado, setEditEstado] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [paginas, setPaginas] = useState<PaginaAdminRow[]>([]);
  const [loadingPaginas, setLoadingPaginas] = useState(true);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);

  const esAdmin = useMemo(() => (me?.rol ?? me?.user?.rol) === 'admin', [me]);

  const cargarMe = async () => {
    setLoadingMe(true);
    try {
      const res = await api.auth.me();
      setMe(res.user);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo cargar el perfil');
    } finally {
      setLoadingMe(false);
    }
  };

  const cargarEmpleados = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const data = await api.admin.listarEmpleados();
      setEmpleados(data as EmpleadoRow[]);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo cargar empleados');
    } finally {
      setLoadingList(false);
    }
  };

  const cargarPaginas = async () => {
    if (!esAdmin) return;
    setLoadingPaginas(true);
    try {
      const data = await api.admin.listarPaginas();
      setPaginas(data as PaginaAdminRow[]);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo cargar el estado de páginas');
    } finally {
      setLoadingPaginas(false);
    }
  };

  useEffect(() => {
    // Cargar perfil y empleados en paralelo
    const init = async () => {
      setLoadingMe(true);
      try {
        const [meRes, empRes] = await Promise.all([
          api.auth.me().catch(() => ({ user: null })),
          api.admin.listarEmpleados().catch(() => []),
        ]);
        setMe(meRes.user);
        const isAdmin = (meRes.user?.rol ?? meRes.user?.user?.rol) === 'admin';
        if (isAdmin) {
          setEmpleados(empRes as EmpleadoRow[]);
          const paginasRes = await api.admin.listarPaginas().catch(() => []);
          setPaginas(paginasRes as PaginaAdminRow[]);
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || 'No se pudo cargar datos');
      } finally {
        setLoadingMe(false);
        setLoadingList(false);
        setLoadingPaginas(false);
      }
    };
    init();
  }, []);

  // Suscripción realtime
  useRealtimeSubscription('usuarios', cargarEmpleados, esAdmin);

  const onCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      await api.admin.crearEmpleado({
        email,
        password,
        rol,
        nombre_completo: nombreCompleto.trim() || null,
        telefono: telefono.trim() || null,
      });

      setEmail('');
      setPassword('');
      setRol('tutor_view_only');
      setNombreCompleto('');
      setTelefono('');

      await cargarEmpleados();
      showActionAlert('Empleado creado correctamente.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo crear el empleado');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (u: EmpleadoRow) => {
    setEditingId(u.id);
    setEditRol(u.rol);
    setEditNombre(u.nombre_completo ?? '');
    setEditTelefono(u.telefono ?? '');
    setEditEstado(!!u.estado);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSavingEdit(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    setError(null);
    try {
      await api.admin.actualizarEmpleado(editingId, {
        rol: editRol,
        estado: editEstado,
        nombre_completo: editNombre.trim() || null,
        telefono: editTelefono.trim() || null,
      });
      setEditingId(null);
      await cargarEmpleados();
      showActionAlert('Empleado actualizado correctamente.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo actualizar el empleado');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteEmpleado = async (u: EmpleadoRow) => {
    const ok = await uiConfirm({
      title: '¿Eliminar esta cuenta?',
      description: 'Esta acción elimina el usuario y su acceso.',
      confirmLabel: 'Eliminar cuenta',
      danger: true,
    });
    if (!ok) return;

    setDeletingId(u.id);
    setError(null);
    try {
      await api.admin.eliminarEmpleado(u.id);
      await cargarEmpleados();
      showActionAlert('Empleado eliminado correctamente.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo borrar el empleado');
    } finally {
      setDeletingId(null);
    }
  };

  const togglePagina = async (p: PaginaAdminRow) => {
    setTogglingSlug(p.slug);
    setError(null);
    try {
      const nextActiva = !p.activa;
      await api.admin.togglePagina(p.slug, {
        activa: nextActiva,
        mensaje: nextActiva ? null : 'Tika está trabajando en mejoras de esta página.',
      });
      paginasService.invalidate();
      await cargarPaginas();
      showActionAlert(`Página ${p.nombre} ${nextActiva ? 'activada' : 'desactivada'} correctamente.`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo actualizar la página');
    } finally {
      setTogglingSlug(null);
    }
  };

  if (loadingMe) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Empleados</CardTitle>
          <CardDescription>Cargando…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!esAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Empleados</CardTitle>
          <CardDescription>Solo disponible para rol admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant="warning">Sin permisos</Badge>
            <div className="text-sm text-slate-200">
              Tu rol actual es <span className="font-black">{me?.rol ?? 'desconocido'}</span>.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Crear empleado</CardTitle>
          <CardDescription>Crea un usuario de oficina con rol (admin/contador/tutor_view_only).</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={onCrear} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label className="text-slate-300">Correo</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="empleado@linguistika.com"
                type="email"
                required
              />
            </div>

            <div>
              <Label className="text-slate-300">Contraseña</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </div>

            <div>
              <Label className="text-slate-300">Rol</Label>
              <Select value={rol} onChange={(e) => setRol(e.target.value as RolEmpleado)}>
                <option value="admin">admin</option>
                <option value="contador">contador</option>
                <option value="tutor_view_only">tutor_view_only</option>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Teléfono (opcional)</Label>
              <PhoneInput value={telefono} onChange={(value) => setTelefono(value)} placeholder="..." />
            </div>

            <div className="md:col-span-2">
              <Label className="text-slate-300">Nombre completo (opcional)</Label>
              <Input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} placeholder="Nombre Apellido" />
            </div>

            <div className="md:col-span-2 flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creando…' : 'Crear empleado'}
              </Button>
              <div className="text-xs text-slate-400 font-semibold">
                Nota: requiere `SUPABASE_SERVICE_KEY` en el backend.
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de empleados</CardTitle>
          <CardDescription>{loadingList ? 'Cargando…' : `${empleados.length} registro(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {empleados.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-sm">{u.email || 'sin email'}</TableCell>
                  <TableCell>
                    {editingId === u.id ? (
                      <Select value={editRol} onChange={(e) => setEditRol(e.target.value as RolEmpleado)}>
                        <option value="admin">admin</option>
                        <option value="contador">contador</option>
                        <option value="tutor_view_only">tutor_view_only</option>
                      </Select>
                    ) : (
                      <Badge variant={u.rol === 'admin' ? 'warning' : u.rol === 'contador' ? 'info' : 'secondary'}>
                        {u.rol}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === u.id ? (
                      <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} placeholder="Nombre" />
                    ) : (
                      (u.nombre_completo ?? '—')
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === u.id ? (
                      <PhoneInput value={editTelefono} onChange={(value) => setEditTelefono(value)} placeholder="..." />
                    ) : (
                      (u.telefono ?? '—')
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === u.id ? (
                      <Select value={editEstado ? 'true' : 'false'} onChange={(e) => setEditEstado(e.target.value === 'true')}>
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </Select>
                    ) : (
                      <Badge variant={u.estado ? 'success' : 'destructive'}>{u.estado ? 'Activo' : 'Inactivo'}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === u.id ? (
                      <div className="flex items-center gap-2">
                        <Button variant="primary" disabled={savingEdit} onClick={saveEdit}>
                          {savingEdit ? 'Guardando…' : 'Guardar'}
                        </Button>
                        <Button variant="secondary" disabled={savingEdit} onClick={cancelEdit}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={() => startEdit(u)}>
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={deletingId === u.id}
                          onClick={() => deleteEmpleado(u)}
                        >
                          {deletingId === u.id ? 'Borrando…' : 'Borrar'}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Control de páginas</CardTitle>
          <CardDescription>
            Activa o desactiva módulos para usuarios no admin. Si una página está desactivada, verán la pantalla de mantenimiento de Tika.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPaginas ? (
            <div className="text-sm text-slate-300">Cargando páginas…</div>
          ) : paginas.length === 0 ? (
            <div className="text-sm text-slate-400">No hay páginas configuradas en mantenimiento.</div>
          ) : (
            <div className="space-y-3">
              {paginas.map((p) => {
                const disabled = togglingSlug === p.slug;
                return (
                  <div
                    key={p.slug}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-white">{p.nombre}</div>
                        <Badge variant={p.activa ? 'success' : 'warning'}>{p.activa ? 'Activa' : 'Mantenimiento'}</Badge>
                      </div>
                      <div className="text-xs text-slate-400">
                        slug: <span className="font-mono">{p.slug}</span>
                        {!p.activa && p.desactivada_por_nombre ? ` · desactivada por ${p.desactivada_por_nombre}` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.activa}
                      disabled={disabled}
                      onClick={() => togglePagina(p)}
                      className={`relative inline-flex h-8 w-16 items-center rounded-full border transition-all ${
                        p.activa
                          ? 'bg-emerald-500/25 border-emerald-300/40'
                          : 'bg-amber-500/25 border-amber-300/40'
                      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}`}
                      title={p.activa ? 'Desactivar página' : 'Activar página'}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                          p.activa ? 'translate-x-9' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Empleados;
