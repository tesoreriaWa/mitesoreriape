import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function hasValidImageSignature(bytes: Uint8Array, type: string) {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const isWebp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return (type === 'image/jpeg' && isJpeg) || (type === 'image/png' && isPng) || (type === 'image/webp' && isWebp);
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Debes iniciar sesión');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Sesión no válida');

    const { error: rateError } = await supabase.rpc('claim_profile_image_upload_slot');
    if (rateError) throw new Error('Demasiadas subidas seguidas. Espera unos minutos e inténtalo nuevamente.');

    const incoming = await request.formData();
    const file = incoming.get('file');
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Formato de imagen no permitido');
    if (file.size > 2 * 1024 * 1024) throw new Error('La imagen supera 2 MB');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(bytes, file.type)) throw new Error('El contenido del archivo no corresponde a una imagen válida');

    const apiKey = Deno.env.get('IMGBB_API_KEY');
    if (!apiKey) throw new Error('El servicio de imágenes no está configurado');
    const outbound = new FormData();
    outbound.append('image', new Blob([bytes], { type: file.type }), file.name);
    const upload = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: 'POST', body: outbound });
    const result = await upload.json();
    if (!upload.ok || !result.success || !result.data?.url) throw new Error('No se pudo almacenar la imagen');
    return Response.json({ url: result.data.url }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Error inesperado' }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
