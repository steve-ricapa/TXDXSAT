const FRIENDLY_MESSAGES: Record<string, string> = {
  "No live session with that PIN": "No encontramos una sesión activa con ese PIN. Revísalo e inténtalo otra vez.",
  "This session has already finished": "Esta sesión ya finalizó.",
  "Reconnect before joining another session": "La sesión anterior todavía está activa. Espera a que finalice antes de unirte a otra.",
  "Reconnect after switching accounts": "La cuenta cambió. Vuelve a entrar con la misma cuenta que usaste para unirte.",
  "That name is already taken in this session": "Ese nombre ya está en uso en esta sesión. Prueba con otro.",
  "This session is full": "La sesión alcanzó el límite de participantes.",
  "This session belongs to another organization": "Esta sesión no pertenece a tu organización.",
  "You already answered this question": "Tu respuesta ya fue registrada.",
  "No question is currently open": "La pregunta ya cerró. Espera a que el anfitrión avance.",
  "Session is not active": "La sesión todavía no está activa.",
  "This connection has another role": "Esta conexión ya está asociada a otra vista de la sesión.",
  "La sesión anterior todavía está activa. Espera a que finalice antes de unirte a otra.": "La sesión anterior todavía está activa. Espera a que finalice antes de unirte a otra.",
  "El servidor no respondió. Inténtalo de nuevo.": "El servidor no respondió. Inténtalo de nuevo.",
  "Demasiados intentos. Vuelve a conectarte.": "Hubo varios intentos fallidos. Vuelve a conectarte y revisa el PIN.",
  "Unexpected error": "Ocurrió un error. Inténtalo de nuevo en unos momentos.",
};

export function liveErrorMessage(message?: string): string {
  if (!message) return "No se pudo completar la acción. Inténtalo de nuevo.";
  return FRIENDLY_MESSAGES[message] ?? "No se pudo completar la acción. Revisa los datos e inténtalo otra vez.";
}
