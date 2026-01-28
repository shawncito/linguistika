-- Fix: Evitar recursión infinita en RLS de public.usuarios
-- Causa: policy que consulta public.usuarios dentro de la misma policy.

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_view_policy" ON public.usuarios;
CREATE POLICY "usuarios_view_policy" ON public.usuarios
FOR SELECT USING (
  auth.uid() = id
);

DROP POLICY IF EXISTS "usuarios_update_policy" ON public.usuarios;
CREATE POLICY "usuarios_update_policy" ON public.usuarios
FOR UPDATE USING (false)
WITH CHECK (false);
