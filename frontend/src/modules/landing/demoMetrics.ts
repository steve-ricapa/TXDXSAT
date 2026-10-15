// Illustrative learning cycles only. Never connect these values to client or product metrics.
export const cycles = [
  { label: "Ciclo 1", completed: 54, evaluation: 59, participation: [52, 63, 45], topics: [48, 55, 62] },
  { label: "Ciclo 2", completed: 65, evaluation: 66, participation: [64, 70, 57], topics: [59, 63, 69] },
  { label: "Ciclo 3", completed: 73, evaluation: 71, participation: [72, 78, 66], topics: [67, 69, 75] },
  { label: "Ciclo 4", completed: 81, evaluation: 77, participation: [80, 84, 76], topics: [73, 76, 81] },
] as const;

export const departments = ["Operaciones", "Tecnología", "Administración"] as const;
export const topics = ["Phishing", "Contraseñas", "Datos"] as const;
