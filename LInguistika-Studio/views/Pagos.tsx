
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { supabaseClient } from '../lib/supabaseClient';
import { Pago, Tutor, EstadoPago } from '../types';
import { Button, Card, Badge, Input, Label, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/UI';
import { CreditCard, Filter, History, Download, DollarSign, Search, CheckCircle2 } from 'lucide-react';
import { formatCRC, formatDateCR } from '../lib/format';

const Pagos: React.FC = () => {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTutor, setFilterTutor] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    tutor_id: 0,
    monto: 0,
    descripcion: '',
    estado: EstadoPago.PAGADO
  });

  const loadData = async () => {
    setLoading(true);
    const [p, t] = await Promise.all([
      api.pagos.getAll(),
      api.tutores.getAll()
    ]);
    setPagos(p);
    setTutores(t);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Suscripción en tiempo real a pagos y tutores
  useEffect(() => {
    if (!supabaseClient) return;
    const channel = supabaseClient
      .channel('realtime-pagos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutores' }, () => loadData())
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tutor_id || formData.monto <= 0) {
      return alert('Por favor complete todos los datos obligatorios.');
    }

    await api.pagos.create(formData);
    setFormData({ tutor_id: 0, monto: 0, descripcion: '', estado: EstadoPago.PAGADO });
    alert('Liquidación registrada con éxito.');
    loadData();
  };

  const filteredPagos = filterTutor === 'all' 
    ? pagos 
    : pagos.filter(p => p.tutor_id === parseInt(filterTutor));

  const totalFiltered = filteredPagos.reduce((acc, curr) => acc + curr.monto, 0);

  if (loading) return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sincronizando tesorería...</p>
      </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-slate-200 pb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none italic">
            Control de <span className="text-blue-600">Pagos</span>
          </h1>
          <p className="text-slate-500 font-medium mt-3">Tesorería y liquidación de honorarios docentes</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            className="gap-2 h-12 shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Download className="w-5 h-5" /> Exportar Registro
          </Button>
          <Button
            variant="outline"
            className="h-12 px-8 bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026] border-0 font-bold"
          >
            Auditar Pagos
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Payment Form Panel */}
        <div className="lg:col-span-4">
            <Card className="border-slate-200 sticky top-28 overflow-hidden">
                <div className="bg-gradient-to-r from-[#FFC800] to-[#00AEEF] h-2 w-full" />
                <div className="p-8">
                    <h2 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-3">
                        <DollarSign className="w-6 h-6 p-1 bg-blue-50 text-blue-600 rounded-lg" />
                        Nueva Liquidación
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                        <Label>Docente Destinatario *</Label>
                        <Select 
                            value={formData.tutor_id} 
                            onChange={(e) => setFormData({...formData, tutor_id: parseInt(e.target.value)})}
                            className="bg-slate-50 border-slate-200"
                        >
                            <option value={0}>Selecciona un profesional...</option>
                          {tutores.map(t => <option key={t.id} value={t.id}>{t.nombre} ({formatCRC(t.tarifa_por_hora)}/h)</option>)}
                        </Select>
                        </div>
                        <div>
                        <Label>Monto a Pagar (₡) *</Label>
                        <Input 
                            type="number" 
                            step="0.01" 
                            value={formData.monto} 
                            onChange={(e) => setFormData({...formData, monto: parseFloat(e.target.value)})} 
                            placeholder="0.00"
                            className="bg-slate-50 border-slate-200 text-lg font-black"
                        />
                        </div>
                        <div>
                        <Label>Referencia / Concepto</Label>
                        <Input 
                            value={formData.descripcion} 
                            onChange={(e) => setFormData({...formData, descripcion: e.target.value})} 
                            placeholder="Ej: Honorarios mes de mayo"
                            className="bg-slate-50 border-slate-200"
                        />
                        </div>
                        <Button
                          type="submit"
                          variant="primary"
                          className="w-full h-14 text-base font-black shadow-lg mt-4 rounded-2xl bg-gradient-to-r from-[#FFC800] to-[#00AEEF] hover:from-[#FFC800]/80 hover:to-[#00AEEF]/80 text-[#051026]"
                        >
                            Emitir Pago Ahora
                        </Button>
                    </form>
                </div>
            </Card>
        </div>

        {/* History List */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400">
                <Filter className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <Label className="mb-0">Filtrar por Tutor</Label>
                <Select 
                    className="w-64 h-11 text-sm font-bold border-none bg-transparent hover:bg-slate-50 transition-colors"
                    value={filterTutor} 
                    onChange={(e) => setFilterTutor(e.target.value)}
                >
                    <option value="all">Todos los registros</option>
                    {tutores.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </Select>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Monto Total Filtrado</span>
              <span className="text-4xl font-black text-slate-900 tracking-tighter">{formatCRC(totalFiltered)}</span>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Profesional</TableHead>
                <TableHead className="text-center">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPagos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-24 text-center text-slate-400 font-bold uppercase tracking-widest italic">No se han registrado movimientos</TableCell>
                </TableRow>
              ) : (
                filteredPagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 uppercase tracking-tight">{p.tutor_nombre}</span>
                        <span className="text-xs text-slate-400">{p.tutor_email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-black text-slate-900 text-base">
                      {formatCRC(p.monto)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.estado === EstadoPago.PAGADO ? 'success' : 'warning'} className="font-extrabold px-4">
                        {p.estado === EstadoPago.PAGADO && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {p.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 font-bold">
                      {formatDateCR(p.fecha_pago)}
                    </TableCell>
                    <TableCell className="text-slate-400 italic text-sm">
                      {p.descripcion || 'Sin concepto'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Pagos;
