import type { Logger } from "pino";
import { prisma } from "../../../shared/database/prisma.ts";
import { hashPassword } from "../../../shared/utils/password.ts";

export const DEMO_TENANTS = {
  acme: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Acme Cybersecurity Corp",
    slug: "acme-corp",
  },
  fintech: {
    id: "22222222-2222-2222-2222-222222222222",
    name: "FinTech Global Segura",
    slug: "fintech-global",
  },
};

export const DEMO_USERS = [
  // Tenant 1: Acme Admin
  {
    id: "a1111111-1111-1111-1111-111111111111",
    email: "admin@acme.com",
    name: "Laura Ramos (Admin Acme)",
    role: "ADMIN" as const,
    tenantId: DEMO_TENANTS.acme.id,
  },
  // Tenant 1: Acme Employees
  {
    id: "e1111111-1111-1111-1111-111111111111",
    email: "carlos.mendoza@acme.com",
    name: "Carlos Mendoza",
    role: "EMPLOYEE" as const,
    tenantId: DEMO_TENANTS.acme.id,
  },
  {
    id: "e2222222-2222-2222-2222-222222222222",
    email: "maria.torres@acme.com",
    name: "María Torres",
    role: "EMPLOYEE" as const,
    tenantId: DEMO_TENANTS.acme.id,
  },
  {
    id: "e3333333-3333-3333-3333-333333333333",
    email: "lucia.castro@acme.com",
    name: "Lucía Castro",
    role: "EMPLOYEE" as const,
    tenantId: DEMO_TENANTS.acme.id,
  },
  {
    id: "e4444444-4444-4444-4444-444444444444",
    email: "jorge.vega@acme.com",
    name: "Jorge Vega",
    role: "EMPLOYEE" as const,
    tenantId: DEMO_TENANTS.acme.id,
  },
  {
    id: "e5555555-5555-5555-5555-555555555555",
    email: "andrea.rios@acme.com",
    name: "Andrea Ríos",
    role: "EMPLOYEE" as const,
    tenantId: DEMO_TENANTS.acme.id,
  },
  // Tenant 2: FinTech Admin
  {
    id: "a2222222-2222-2222-2222-222222222222",
    email: "admin@fintech.com",
    name: "Roberto Silva (Admin FinTech)",
    role: "ADMIN" as const,
    tenantId: DEMO_TENANTS.fintech.id,
  },
  // Tenant 2: FinTech Employees
  {
    id: "e6666666-6666-6666-6666-666666666666",
    email: "diego.sanchez@fintech.com",
    name: "Diego Sánchez",
    role: "EMPLOYEE" as const,
    tenantId: DEMO_TENANTS.fintech.id,
  },
  {
    id: "e7777777-7777-7777-7777-777777777777",
    email: "elena.paredes@fintech.com",
    name: "Elena Paredes",
    role: "EMPLOYEE" as const,
    tenantId: DEMO_TENANTS.fintech.id,
  },
];

export async function ensureDemoData(logger: Logger): Promise<void> {
  try {
    const passwordHash = await hashPassword("Password123!");

    // 1. Seed Tenants
    for (const tenant of Object.values(DEMO_TENANTS)) {
      await prisma.tenant.upsert({
        where: { id: tenant.id },
        update: { name: tenant.name, slug: tenant.slug },
        create: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      });
    }

    // 2. Seed Users
    for (const u of DEMO_USERS) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role, tenantId: u.tenantId, passwordHash },
        create: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          tenantId: u.tenantId,
          passwordHash,
          isActive: true,
        },
      });
    }

    // 3. Seed Model Phishing Quiz for Acme Corp
    const phishingQuizId = "33333333-3333-3333-3333-333333333333";
    const phishingQuiz = await prisma.quiz.upsert({
      where: { id: phishingQuizId },
      update: {
        title: "Evaluación Crítica: Detección y Respuesta a Phishing 2026",
        description: "Simulación práctica de correos maliciosos, suplantación de identidad (spoofing), URLs falsificadas y vectores de ingeniería social.",
        tenantId: DEMO_TENANTS.acme.id,
      },
      create: {
        id: phishingQuizId,
        title: "Evaluación Crítica: Detección y Respuesta a Phishing 2026",
        description: "Simulación práctica de correos maliciosos, suplantación de identidad (spoofing), URLs falsificadas y vectores de ingeniería social.",
        tenantId: DEMO_TENANTS.acme.id,
        language: "es",
      },
    });

    // Seed Questions for Phishing Quiz
    const phishingQuestions = [
      {
        id: "q1111111-1111-1111-1111-111111111111",
        quizId: phishingQuiz.id,
        orderIndex: 0,
        type: "MULTIPLE_CHOICE" as const,
        text: "¿Cuál es el indicador más confiable de que un correo que dice ser de 'Soporte TI' es en realidad un intento de phishing?",
        options: [
          "El logotipo corporativo se ve ligeramente pixelado",
          "El dominio del encabezado 'From/Return-Path' no coincide con el dominio oficial de la empresa",
          "El correo fue recibido después del horario laboral",
          "El saludo es informal en lugar de incluir tu nombre completo",
        ],
        correctIndex: 1,
        explanation: "Los atacantes pueden clonar logotipos y redactar saludos formales, pero no pueden falsificar el registro SPF/DKIM del dominio legítimo sin ser detectados. Siempre verifica el dominio exacto del remitente.",
        baseScore: 500,
        timeSec: 30,
      },
      {
        id: "q2222222-2222-2222-2222-222222222222",
        quizId: phishingQuiz.id,
        orderIndex: 1,
        type: "MULTIPLE_CHOICE" as const,
        text: "Un correo con el asunto 'URGENTE: Tu cuenta será bloqueada en 2 horas' te pide hacer clic en un enlace. ¿Qué técnica psicológica está utilizando el atacante?",
        options: [
          "Principio de escasez o urgencia inducida para evitar el pensamiento crítico",
          "Ataque de diccionario directo",
          "Inyección SQL ciega",
          "Fuerza bruta distribuida",
        ],
        correctIndex: 0,
        explanation: "La urgencia artificial busca provocar pánico para que la víctima actúe por impulso antes de validar la autenticidad del mensaje con el departamento de TI.",
        baseScore: 500,
        timeSec: 25,
      },
      {
        id: "q3333333-3333-3333-3333-333333333333",
        quizId: phishingQuiz.id,
        orderIndex: 2,
        type: "MULTIPLE_CHOICE" as const,
        text: "Observas el siguiente enlace en un correo supuestamente de tu banco: 'https://login.banco-seguro.com.evil-domain.ru/auth'. ¿Hacia dónde te llevará realmente si haces clic?",
        options: [
          "Al subdominio oficial de 'banco-seguro.com'",
          "A los servidores de evil-domain.ru controlados por el atacante",
          "A una página protegida por certificado bancario SSL legítimo",
          "A la intranet interna de la empresa",
        ],
        correctIndex: 1,
        explanation: "El dominio principal es el que antecede al TLD (.ru), en este caso 'evil-domain.ru'. Los atacantes agregan nombres de marcas conocidas en los subdominios para engañar la vista rápida.",
        baseScore: 500,
        timeSec: 30,
      },
      {
        id: "q4444444-4444-4444-4444-444444444444",
        quizId: phishingQuiz.id,
        orderIndex: 3,
        type: "MULTIPLE_CHOICE" as const,
        text: "Recibes una factura en formato '.zip' o '.xlsm' (Excel con macros) de un proveedor con el que tu empresa nunca ha trabajado. ¿Qué acción debes tomar?",
        options: [
          "Descomprimir el archivo y habilitar macros para ver el monto a pagar",
          "Reenviarlo a todo tu equipo para preguntar si alguien lo reconoce",
          "No abrir el adjunto ni habilitar macros; reportarlo inmediatamente mediante el canal de seguridad",
          "Responder al remitente preguntando quién autorizó la factura",
        ],
        correctIndex: 2,
        explanation: "Los archivos comprimidos o macros de Office son vectores comunes de malware (ransomware/troyanos bancarios). Nunca habilites contenido ni interactúes con el remitente.",
        baseScore: 500,
        timeSec: 25,
      },
      {
        id: "q5555555-5555-5555-5555-555555555555",
        quizId: phishingQuiz.id,
        orderIndex: 4,
        type: "MULTIPLE_CHOICE" as const,
        text: "Si ya hiciste clic por error en un enlace sospechoso e ingresaste tu contraseña corporativa, ¿cuál es el primer paso inmediato?",
        options: [
          "Esperar a ver si ocurren accesos extraños en los próximos días",
          "Desconectar el equipo de la red y notificar urgentemente al equipo de ciberseguridad / SOC para revocar credenciales",
          "Eliminar el correo de la papelera de reciclaje para borrar el rastro",
          "Reiniciar la computadora tres veces seguidas",
        ],
        correctIndex: 1,
        explanation: "La rapidez en la contención es crucial: aislar la máquina y reportar al equipo de seguridad permite invalidar sesiones activas y resetear la contraseña antes de que el atacante pivotee en la red.",
        baseScore: 500,
        timeSec: 30,
      },
    ];

    for (const q of phishingQuestions) {
      await prisma.question.upsert({
        where: { quizId_orderIndex: { quizId: phishingQuiz.id, orderIndex: q.orderIndex } },
        update: {
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          baseScore: q.baseScore,
          timeSec: q.timeSec,
        },
        create: q,
      });
    }

    // 4. Seed Second Quiz (Ready for live execution with PIN)
    const liveQuizId = "44444444-4444-4444-4444-444444444444";
    const liveQuiz = await prisma.quiz.upsert({
      where: { id: liveQuizId },
      update: {
        title: "Ingeniería Social y Protección de Credenciales (En Vivo)",
        description: "Sesión interactiva en tiempo real sobre defensas activas ante suplantación y ataques modernos.",
        tenantId: DEMO_TENANTS.acme.id,
      },
      create: {
        id: liveQuizId,
        title: "Ingeniería Social y Protección de Credenciales (En Vivo)",
        description: "Sesión interactiva en tiempo real sobre defensas activas ante suplantación y ataques modernos.",
        tenantId: DEMO_TENANTS.acme.id,
        language: "es",
      },
    });

    const liveQuestions = [
      {
        id: "l1111111-1111-1111-1111-111111111111",
        quizId: liveQuiz.id,
        orderIndex: 0,
        type: "TRUE_FALSE" as const,
        text: "La autenticación multifactor (MFA) hace innecesario prestar atención a correos de phishing.",
        options: ["Verdadero", "Falso"],
        correctIndex: 1,
        explanation: "Falso: Ataques modernos como 'MFA fatigue' o 'Session hijacking' mediante proxies inversos (ej. Evilginx) pueden evadir el segundo factor si el usuario aprueba solicitudes indebidas.",
        baseScore: 500,
        timeSec: 20,
      },
      {
        id: "l2222222-2222-2222-2222-222222222222",
        quizId: liveQuiz.id,
        orderIndex: 1,
        type: "MULTIPLE_CHOICE" as const,
        text: "Alguien llama fingiendo ser del soporte técnico de TXDX y te pide dictarle el código SMS de verificación que acaba de llegar a tu teléfono. ¿Qué debes hacer?",
        options: [
          "Dictárselo si conoce tu número de documento",
          "Rechazar la solicitud y reportar el intento de vishing; el soporte legítimo nunca te pedirá códigos temporales",
          "Pedirle que espere y enviarlo por correo electrónico",
          "Dárselo solo si te promete resolver el incidente de inmediato",
        ],
        correctIndex: 1,
        explanation: "Los códigos de un solo uso (OTP) son confidenciales. Ningún agente legítimo de soporte técnico requiere que se los dictes.",
        baseScore: 500,
        timeSec: 25,
      },
      {
        id: "l3333333-3333-3333-3333-333333333333",
        quizId: liveQuiz.id,
        orderIndex: 2,
        type: "MULTIPLE_CHOICE" as const,
        text: "¿Cuál es la práctica más segura para la gestión de contraseñas corporativas?",
        options: [
          "Reutilizar una contraseña robusta en todos los sistemas para no olvidarla",
          "Anotarlas en un post-it debajo del teclado o en un archivo de texto en el escritorio",
          "Usar un gestor de contraseñas corporativo con contraseñas únicas y complejas por servicio",
          "Cambiar únicamente el último número cada mes",
        ],
        correctIndex: 2,
        explanation: "Un gestor de contraseñas certificado permite generar contraseñas únicas, largas e indescifrables sin riesgo de reutilización ante brechas externas.",
        baseScore: 500,
        timeSec: 20,
      },
    ];

    for (const q of liveQuestions) {
      await prisma.question.upsert({
        where: { quizId_orderIndex: { quizId: liveQuiz.id, orderIndex: q.orderIndex } },
        update: {
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          baseScore: q.baseScore,
          timeSec: q.timeSec,
        },
        create: q,
      });
    }

    // 5. Seed Historical Completed Session for Phishing Quiz with Real Employee Results
    const historicalSessionId = "66666666-6666-6666-6666-666666666666";
    const historicalSession = await prisma.liveSession.upsert({
      where: { id: historicalSessionId },
      update: {
        status: "FINISHED",
        currentQuestionIndex: 4,
        participantCount: 5,
        startedAt: new Date(Date.now() - 24 * 3600 * 1000),
        finishedAt: new Date(Date.now() - 24 * 3600 * 1000 + 15 * 60 * 1000),
      },
      create: {
        id: historicalSessionId,
        tenantId: DEMO_TENANTS.acme.id,
        quizId: phishingQuiz.id,
        pin: "742190",
        status: "FINISHED",
        currentQuestionIndex: 4,
        hostToken: "host-token-demo-742190",
        viewToken: "view-token-demo-742190",
        participantCount: 5,
        startedAt: new Date(Date.now() - 24 * 3600 * 1000),
        finishedAt: new Date(Date.now() - 24 * 3600 * 1000 + 15 * 60 * 1000),
      },
    });

    // Seed LivePlayers & LiveAnswers for Acme Employees:
    // Performance distribution:
    // 1. Carlos Mendoza: 5/5 (Score: 2450) - Sobresaliente
    // 2. María Torres: 4/5 (Score: 1980) - Aprobado (falló Q3)
    // 3. Lucía Castro: 3/5 (Score: 1420) - Aprobado (falló Q3, Q4)
    // 4. Jorge Vega: 2/5 (Score: 950) - En riesgo (falló Q2, Q3, Q4)
    // 5. Andrea Ríos: 1/5 (Score: 480) - En riesgo / Requiere Refuerzo (falló Q1, Q2, Q3, Q4)
    const playerConfigs = [
      {
        userId: "e1111111-1111-1111-1111-111111111111",
        username: "Carlos Mendoza",
        score: 2450,
        answers: [true, true, true, true, true],
      },
      {
        userId: "e2222222-2222-2222-2222-222222222222",
        username: "María Torres",
        score: 1980,
        answers: [true, true, false, true, true],
      },
      {
        userId: "e3333333-3333-3333-3333-333333333333",
        username: "Lucía Castro",
        score: 1420,
        answers: [true, true, false, false, true],
      },
      {
        userId: "e4444444-4444-4444-4444-444444444444",
        username: "Jorge Vega",
        score: 950,
        answers: [true, false, false, false, true],
      },
      {
        userId: "e5555555-5555-5555-5555-555555555555",
        username: "Andrea Ríos",
        score: 480,
        answers: [false, false, false, false, true],
      },
    ];

    for (const p of playerConfigs) {
      const player = await prisma.livePlayer.upsert({
        where: { sessionId_username: { sessionId: historicalSession.id, username: p.username } },
        update: { score: p.score, userId: p.userId, tenantId: DEMO_TENANTS.acme.id },
        create: {
          sessionId: historicalSession.id,
          tenantId: DEMO_TENANTS.acme.id,
          userId: p.userId,
          username: p.username,
          avatar: "shield",
          score: p.score,
        },
      });

      for (let i = 0; i < phishingQuestions.length; i++) {
        const q = phishingQuestions[i];
        if (!q) continue;
        const isCorrect = Boolean(p.answers[i]);
        const chosenIndex = isCorrect ? (q.correctIndex ?? 0) : ((q.correctIndex ?? 0) === 0 ? 1 : 0);
        const score = isCorrect ? 480 : 0;

        await prisma.liveAnswer.upsert({
          where: { playerId_questionId: { playerId: player.id, questionId: q.id } },
          update: { chosenIndex, isCorrect, score },
          create: {
            sessionId: historicalSession.id,
            tenantId: DEMO_TENANTS.acme.id,
            playerId: player.id,
            questionId: q.id,
            chosenIndex,
            isCorrect,
            score,
            answerOrder: i + 1,
          },
        });
      }
    }

    logger.info("Demo data verified and seeded successfully (tenants, users, quizzes, session history)");
  } catch (error) {
    logger.error({ err: error }, "Failed to seed demo data");
  }
}
