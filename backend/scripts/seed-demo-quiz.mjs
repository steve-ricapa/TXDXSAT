#!/usr/bin/env node
/**
 * Seed the "Ciberseguridad" demo quiz.
 *
 * Creates a ready-to-host quiz through the public REST API (no database access
 * required), covering the five awareness pillars: phishing, passwords, social
 * engineering, malware and data protection.
 *
 * Usage:
 *   node scripts/seed-demo-quiz.mjs [baseUrl]
 *
 * baseUrl defaults to http://localhost:8080/sat/api/v1 (the Nginx-proxied
 * public entrypoint). Point it at http://localhost:4000/api/v1 for a bare
 * backend.
 */

const baseUrl = (process.argv[2] ?? process.env.TXDXSAT_API ?? "http://localhost:8080/sat/api/v1").replace(
  /\/$/,
  "",
);

const questions = [
  {
    type: "multiple_choice",
    text: "Recibes un correo de «soporte@micros0ft.com» que te pide confirmar tu contraseña en un enlace. ¿Qué es?",
    options: [
      "Un correo legítimo de Microsoft",
      "Un intento de phishing",
      "Una actualización normal del sistema",
      "Publicidad inofensiva",
    ],
    correctIndex: 1,
    explanation:
      "El dominio está falsificado (micros0ft con un cero). Ningún proveedor legítimo pide credenciales por correo.",
    timeSec: 20,
  },
  {
    type: "true_false",
    text: "Reutilizar la misma contraseña en varios servicios es seguro si la contraseña es muy larga.",
    options: ["Verdadero", "Falso"],
    correctIndex: 1,
    explanation:
      "La reutilización propaga el daño: si un servicio se filtra, los demás quedan comprometidos. Usa contraseñas únicas.",
    timeSec: 15,
  },
  {
    type: "multi_select",
    text: "¿Cuáles de estas señales indican un posible intento de ingeniería social?",
    options: [
      "Urgencia extrema para actuar sin verificar",
      "Una petición de datos confidenciales por un canal informal",
      "Un remitente con dominio oficial verificado",
      "Un premio inesperado que exige tus datos",
    ],
    correctIndices: [0, 1, 3],
    explanation:
      "Urgencia, canales informales y premios inesperados son banderas rojas clásicas. Un dominio verificado no es señal de riesgo.",
    timeSec: 30,
  },
  {
    type: "open_text",
    text: "¿Cómo se llama el software malicioso que cifra tus archivos y exige un pago para liberarlos?",
    correctText: "ransomware",
    explanation:
      "El ransomware cifra los datos y pide un rescate. La mejor defensa son copias de seguridad offline y parcheo.",
    timeSec: 25,
  },
  {
    type: "closest_to",
    text: "¿Cuántos caracteres como mínimo recomienda el NIST (SP 800-63B) para una contraseña sin reglas de complejidad obligatorias?",
    rangeMin: 4,
    rangeMax: 32,
    correctNumber: 8,
    explanation:
      "NIST recomienda un mínimo de 8 caracteres, priorizando la longitud y comprobando la contraseña contra listas de filtradas.",
    timeSec: 25,
  },
  {
    type: "multiple_choice",
    text: "Encuentras un USB tirado en el estacionamiento. ¿Cuál es la acción más segura?",
    options: [
      "Conectarlo a tu equipo para identificar al dueño",
      "Entregarlo a un compañero para que lo revise",
      "Entregarlo al equipo de seguridad/IT sin conectarlo",
      "Formatearlo y quedártelo",
    ],
    correctIndex: 2,
    explanation:
      "Los USB abandonados («baiting») pueden contener malware. Nunca los conectes; entrégalos a seguridad.",
    timeSec: 20,
  },
  {
    type: "multiple_choice",
    text: "El «CEO» te llama muy nervioso pidiendo una transferencia urgente y confidencial. ¿Qué haces?",
    options: [
      "Hacer la transferencia para no contradecir al jefe",
      "Verificar la petición por un canal oficial independiente",
      "Pedir la transferencia por escrito y ejecutarla",
      "Ignore both y no hacer nada nunca más",
    ],
    correctIndex: 1,
    explanation:
      "Es fraude del CEO (BEC). Verifica siempre por un canal oficial independiente antes de mover dinero.",
    timeSec: 25,
  },
  {
    type: "multi_select",
    text: "¿Cuáles son buenas prácticas de contraseñas?",
    options: [
      "Usar un gestor de contraseñas",
      "Activar la autenticación multifactor (MFA)",
      "Anotar la contraseña en un post-it del monitor",
      "Usar frases largas y únicas por servicio",
    ],
    correctIndices: [0, 1, 3],
    explanation:
      "El gestor, el MFA y las frases largas y únicas protegen tus cuentas. Anotarlas a la vista las expone a cualquiera.",
    timeSec: 30,
  },
  {
    type: "multiple_choice",
    text: "¿Qué principio de protección de datos limita a recoger solo lo estrictamente necesario para el servicio?",
    options: [
      "Minimización de datos",
      "Máxima retención",
      "Consentimiento implícito perpetuo",
      "Transferencia libre a terceros",
    ],
    correctIndex: 0,
    explanation:
      "La minimización de datos (RGPD, art. 5) exige recoger solo lo necesario y conservarlo el tiempo imprescindible.",
    timeSec: 20,
  },
  {
    type: "true_false",
    text: "Mantener actualizado el sistema operativo y el software reduce el riesgo de explotación de vulnerabilidades conocidas.",
    options: ["Verdadero", "Falso"],
    correctIndex: 0,
    explanation:
      "Las actualizaciones corrigen vulnerabilidades ya conocidas que los atacantes explotan automáticamente.",
    timeSec: 15,
  },
];

const payload = {
  title: "Ciberseguridad — Concienciación (Demo)",
  description:
    "Cuestionario en vivo de demostración sobre phishing, contraseñas, ingeniería social, malware y protección de datos.",
  questions,
};

async function main() {
  const url = `${baseUrl}/live/quizzes`;
  console.log(`Seeding demo quiz -> ${url}`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Failed (${response.status}):`, body);
    process.exit(1);
  }
  console.log(`Created quiz ${body.id} with ${body.questionCount} questions.`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
