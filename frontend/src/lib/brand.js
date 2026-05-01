// Centralized brand assets
// Logo is served from /public so it shares the frontend origin (no CORS issues for html2canvas).
export const LOGO_URL = `${process.env.PUBLIC_URL || ""}/yoshitaka-emblem.jpg`;

export const BRAND = {
  name: "Yoshitaka Karate-Do",
  short: "Yoshitaka",
  kanji: "義孝空手道",
};
