#!/usr/bin/env node
/**
 * Seed the "Phishing" image demo.
 *
 * End-to-end Fase 3 demo with no external tooling:
 *   1. synthesizes a fictitious phishing-email screenshot (pure Node PNG encoder);
 *   2. uploads it to the media API (lands on the persistent Docker volume and is
 *      registered in PostgreSQL as a `media_assets` row);
 *   3. creates a quiz whose first question uses that image.
 *
 * Usage:
 *   node scripts/seed-phishing-demo.mjs [baseUrl]
 *
 * baseUrl defaults to http://localhost:8080/sat/api/v1 (Nginx entrypoint). Point
 * it at http://localhost:4000/api/v1 for a bare backend.
 */

import { renderPhishingEmail } from "./lib/png.mjs";
import { bearer, getToken } from "./lib/auth.mjs";

const baseUrl = (
  process.argv[2] ??
  process.env.TXDXSAT_API ??
  "http://localhost:8080/sat/api/v1"
).replace(/\/$/, "");

async function uploadDemoImage(token) {
  const png = renderPhishingEmail();
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "phishing-demo.png");
  form.append("purpose", "QUESTION");

  const response = await fetch(`${baseUrl}/media`, {
    method: "POST",
    headers: bearer(token),
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Image upload failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return { png, asset: body };
}

function buildQuestions(imageUrl) {
  return [
    {
      type: "multiple_choice",
      text: "¿Cuál de estos correos presenta señales de phishing?",
      imageUrl,
      options: [
        "Es seguro porque tiene un logotipo conocido.",
        "Es sospechoso por el dominio del remitente.",
        "Es seguro porque solicita verificar la cuenta.",
        "Es seguro porque contiene un archivo PDF.",
      ],
      correctIndex: 1,
      explanation:
        "El dominio del remitente (…@securebank-verify.ru) no coincide con el oficial y el mensaje usa urgencia y una llamada a la acción para robar credenciales. La premura, el dominio falsificado y el adjunto inesperado son banderas rojas clásicas.",
      timeSec: 30,
    },
    {
      type: "true_false",
      text: "Si un correo incluye el logotipo de una empresa conocida, puedes confiar en él.",
      options: ["Verdadero", "Falso"],
      correctIndex: 1,
      explanation:
        "Los logotipos se copian con facilidad. Verifica siempre el dominio real del remitente y los enlaces antes de actuar.",
      timeSec: 15,
    },
    {
      type: "multiple_choice",
      text: "¿Qué debes hacer ante un correo que pide credenciales con urgencia?",
      options: [
        "Introducir la contraseña para evitar el bloqueo",
        "Reenviarlo a compañeros para que opinen",
        "No hacer clic y reportarlo al equipo de seguridad",
        "Responder pidiendo más información",
      ],
      correctIndex: 2,
      explanation:
        "No interactúes con el mensaje: repórtalo. Ninguna entidad legítima pide credenciales por correo.",
      timeSec: 20,
    },
    {
      type: "open_text",
      text: "¿Cómo se llama la técnica de suplantar una web legítima para robar credenciales?",
      correctText: "phishing",
      explanation: "El phishing suplanta una entidad de confianza para capturar datos sensibles.",
      timeSec: 20,
    },
  ];
}

async function main() {
  const token = await getToken(baseUrl);
  console.log(`Generating phishing demo image...`);
  const { png, asset } = await uploadDemoImage(token);
  console.log(
    `Uploaded image ${asset.id} (${asset.width}x${asset.height}, ${asset.size} bytes) -> ${asset.url}`,
  );
  console.log(`Local PNG size: ${png.length} bytes`);

  const payload = {
    title: "Phishing — Demo con imagen",
    description:
      "Demo de Fase 3: pregunta con imagen de un correo fraudulento. Muestra el almacenamiento de imágenes y la visualización durante la partida.",
    questions: buildQuestions(asset.url),
  };

  const response = await fetch(`${baseUrl}/live/quizzes`, {
    method: "POST",
    headers: { "content-type": "application/json", ...bearer(token) },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Quiz creation failed (${response.status}): ${JSON.stringify(body)}`);
  }
  console.log(`Created quiz ${body.id} with ${body.questionCount} questions.`);
  console.log(`Demo image: ${asset.url}`);
}

main().catch((error) => {
  console.error("Seed failed:", error.message ?? error);
  process.exit(1);
});
