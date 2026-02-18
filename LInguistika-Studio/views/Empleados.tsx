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

  useEffect(() => {
    cargarMe();
  }, []);

  useEffect(() => {
    if (esAdmin) {
      cargarEmpleados();
    }
  }, [esAdmin]);

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
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo actualizar el empleado');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteEmpleado = async (u: EmpleadoRow) => {
    const ok = window.confirm('¿Seguro que deseas borrar esta cuenta? Esta acción elimina el usuario y su acceso.');
    if (!ok) return;

    setDeletingId(u.id);
    setError(null);
    try {
      await api.admin.eliminarEmpleado(u.id);
      await cargarEmpleados();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo borrar el empleado');
    } finally {
      setDeletingId(null);
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
    </div>
  );
};

export default Empleados;
