// Función de borde que vacía la bandeja de salida.
//
// POR QUÉ EXISTE: la aplicación corre entera en el navegador, con la
// clave pública de Supabase. Si el envío de correo se hiciera desde ahí,
// la clave del proveedor tendría que viajar al navegador y cualquiera
// podría leerla en el código fuente de la página y mandar correos a
// nombre del negocio. Esta función corre en el servidor de Supabase, lee
// su clave de una variable de entorno y nunca la expone.
//
// Qué hace: toma los correos en estado PENDIENTE de cola_correo, los
// manda por Resend y marca el resultado. Un correo que falla queda en
// ERROR con el motivo, se reintenta hasta tres veces y después se deja
// quieto para que un humano lo mire en Administración → Bandeja de salida.
//
// Despliegue:
//   supabase functions deploy enviar-correos --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=re_xxxxx
//
// Programación (cada 5 minutos) desde el SQL Editor de Supabase:
//   select cron.schedule('vaciar-bandeja', '*/5 * * * *', $$
//     select net.http_post(
//       url := 'https://<proyecto>.supabase.co/functions/v1/enviar-correos',
//       headers := jsonb_build_object('Authorization', 'Bearer ' || '<anon key>')
//     );
//   $$);

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_INTENTOS = 3;
const LOTE = 20;

Deno.serve(async (req) => {
  // La clave de servicio solo existe aquí dentro, como secreto del proyecto.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return json({ error: 'Falta el secreto RESEND_API_KEY' }, 500);
  }

  const { data: config } = await supabase
    .from('correo_config').select('*').limit(1).maybeSingle();

  if (!config?.activo) {
    return json({ enviados: 0, nota: 'El envío de correo está desactivado en Administración.' });
  }
  if (!config.remitente_email) {
    return json({ error: 'No hay correo remitente configurado' }, 400);
  }

  const { data: pendientes, error } = await supabase
    .from('cola_correo')
    .select('*')
    .eq('estado', 'PENDIENTE')
    .lt('intentos', MAX_INTENTOS)
    .order('created_at')
    .limit(LOTE);

  if (error) return json({ error: error.message }, 500);

  const remitente = config.remitente_nombre
    ? `${config.remitente_nombre} <${config.remitente_email}>`
    : config.remitente_email;

  let enviados = 0;
  let fallidos = 0;

  for (const correo of pendientes ?? []) {
    try {
      const cuerpo: Record<string, unknown> = {
        from: remitente,
        to: [correo.destinatario],
        subject: correo.asunto,
        html: correo.cuerpo_html,
      };
      if (config.responder_a) cuerpo.reply_to = config.responder_a;
      if (config.copia_oculta) cuerpo.bcc = [config.copia_oculta];

      const respuesta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cuerpo),
      });

      if (!respuesta.ok) {
        throw new Error(`${respuesta.status} ${await respuesta.text()}`);
      }

      await supabase.from('cola_correo').update({
        estado: 'ENVIADO',
        enviado_at: new Date().toISOString(),
        intentos: correo.intentos + 1,
        ultimo_error: null,
      }).eq('id', correo.id);
      enviados++;

    } catch (err) {
      const intentos = correo.intentos + 1;
      await supabase.from('cola_correo').update({
        // Se deja en PENDIENTE mientras queden reintentos: un rebote
        // temporal del proveedor no debe perder la factura del cliente.
        estado: intentos >= MAX_INTENTOS ? 'ERROR' : 'PENDIENTE',
        intentos,
        ultimo_error: String(err instanceof Error ? err.message : err).slice(0, 500),
      }).eq('id', correo.id);
      fallidos++;
    }
  }

  return json({ enviados, fallidos, revisados: pendientes?.length ?? 0 });
});

function json(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}
