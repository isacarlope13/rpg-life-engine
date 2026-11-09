/**
 * RPG LIFE-ENGINE — ÚNICA FUENTE DE VERDAD DE VERSIONADO (SST)
 * Centraliza la versión de compilación, identificador de release y estado de API.
 */
export const SYSTEM_VERSION = {
  version: "3.5.0",
  versionLabel: "v3.5.0-autonomous-core",
  releaseTag: "v3.5.0-autonomous-core",
  apiVersion: "v3.5",
  buildDate: "2026-11-09",
  buildId: "20261109.r1",
  channel: "production" as const,
  compatibility: "scale-ready",
};

export const APP_VERSION = SYSTEM_VERSION.version;
export const API_VERSION = SYSTEM_VERSION.apiVersion;
