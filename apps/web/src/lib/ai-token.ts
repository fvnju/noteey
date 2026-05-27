"use client";

let currentAIToken: string | null = null;

export function setCurrentAIToken(token: string | null) {
  currentAIToken = token;
}

export function getCurrentAIToken(): string | null {
  return currentAIToken;
}
