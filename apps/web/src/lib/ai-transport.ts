"use client";

import {
  DefaultChatTransport,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

export { setCurrentAIToken } from "./ai-token";
import { getCurrentAIToken } from "./ai-token";

type RealtimeAITransportOptions = {
  realtimeUrl: string;
  getToken?: () => string | null;
  getNoteId?: () => string | null;
};

function getRealtimeHttpBaseUrl(realtimeUrl: string): string {
  try {
    const url = new URL(realtimeUrl, window.location.origin);
    if (url.protocol === "wss:") {
      url.protocol = "https:";
    } else if (url.protocol === "ws:") {
      url.protocol = "http:";
    }
    return url.origin;
  } catch {
    return window.location.origin;
  }
}

function flattenError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause ? flattenError(error.cause) : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return String(error);
    }
  }

  return error;
}

function extractLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") continue;

    const parts = message.parts ?? [];
    const textParts: string[] = [];

    for (const part of parts) {
      if (!part) continue;
      if ("text" in part && typeof part.text === "string") {
        textParts.push(part.text);
      } else if (
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        textParts.push((part as { text: string }).text);
      }
    }

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return "";
}

export class RealtimeAITransport<UI_MESSAGE extends UIMessage> extends DefaultChatTransport<UI_MESSAGE> {
  private readonly baseUrl: string;
  private readonly getToken: () => string | null;
  private readonly getNoteId?: () => string | null;

  constructor({ realtimeUrl, getToken, getNoteId }: RealtimeAITransportOptions) {
    super();
    this.baseUrl = getRealtimeHttpBaseUrl(realtimeUrl);
    this.getToken = getToken ?? getCurrentAIToken;
    this.getNoteId = getNoteId;
  }

  async sendMessages({
    messages,
    body,
    abortSignal,
  }: Parameters<ChatTransport<UI_MESSAGE>["sendMessages"]>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const token = this.getToken();
    if (!token) {
      console.error("[ai-transport] Missing authentication token for AI request", {
        baseUrl: this.baseUrl,
      });
      throw new Error("Missing authentication token for AI request");
    }

    const messageNoteId = (messages[0] as unknown as Record<string, unknown> | undefined)?.noteId;
    const noteId =
      (typeof messageNoteId === "string" ? messageNoteId : null) ??
      this.getNoteId?.() ??
      new URLSearchParams(window.location.search).get("noteId");

    if (!noteId) {
      console.error("[ai-transport] Missing noteId for AI request", {
        baseUrl: this.baseUrl,
      });
      throw new Error("Missing noteId for AI request");
    }

    const userPrompt = extractLastUserText(messages as unknown as UIMessage[]);
    if (!userPrompt) {
      console.error("[ai-transport] Missing prompt for AI request", {
        baseUrl: this.baseUrl,
        noteId,
      });
      throw new Error("Missing prompt for AI request");
    }

    console.info("[ai-transport] POST /ai", {
      url: `${this.baseUrl}/ai`,
      noteId,
      promptLength: userPrompt.length,
      hasToken: true,
    });

    const response = await fetch(`${this.baseUrl}/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ noteId, messages, body }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[ai-transport] AI request failed", {
        url: `${this.baseUrl}/ai`,
        noteId,
        status: response.status,
        errorText,
      });
      throw new Error(
        errorText || `AI request failed with status ${response.status}`,
      );
    }

    console.info("[ai-transport] AI stream connected", {
      url: `${this.baseUrl}/ai`,
      noteId,
      status: response.status,
      contentType: response.headers.get("content-type"),
    });

    const responseBody = response.body;
    if (!responseBody) {
      throw new Error("AI stream unavailable");
    }

    return this.logStreamErrors(this.processResponseStream(responseBody), {
      url: `${this.baseUrl}/ai`,
      noteId,
    });
  }

  private logStreamErrors(
    stream: ReadableStream<UIMessageChunk>,
    meta: Record<string, unknown>,
  ): ReadableStream<UIMessageChunk> {
    const openToolInputs = new Map<
      string,
      { toolName: string; inputText: string; completed: boolean }
    >();

    return stream.pipeThrough(
      new TransformStream<UIMessageChunk, UIMessageChunk>({
        transform(chunk, controller) {
          if (chunk.type === "tool-input-start") {
            openToolInputs.set(chunk.toolCallId, {
              toolName: chunk.toolName,
              inputText: "",
              completed: false,
            });
          } else if (chunk.type === "tool-input-delta") {
            const toolInput = openToolInputs.get(chunk.toolCallId);
            if (toolInput) {
              toolInput.inputText += chunk.inputTextDelta;
            }
          } else if (chunk.type === "tool-input-available") {
            const toolInput = openToolInputs.get(chunk.toolCallId);
            if (toolInput) {
              toolInput.completed = true;
            }
          }

          if (chunk.type === "finish") {
            for (const [toolCallId, toolInput] of openToolInputs) {
              if (toolInput.completed) continue;

              try {
                const input = JSON.parse(toolInput.inputText);
                console.warn(
                  "[ai-transport] Synthesizing missing tool-input-available chunk",
                  {
                    ...meta,
                    toolCallId,
                    toolName: toolInput.toolName,
                    inputLength: toolInput.inputText.length,
                  },
                );
                controller.enqueue({
                  type: "tool-input-available",
                  toolCallId,
                  toolName: toolInput.toolName,
                  input,
                });
                toolInput.completed = true;
              } catch (error) {
                console.error(
                  "[ai-transport] Unable to synthesize tool-input-available chunk",
                  {
                    ...meta,
                    toolCallId,
                    toolName: toolInput.toolName,
                    inputLength: toolInput.inputText.length,
                    inputPreview: toolInput.inputText.slice(0, 500),
                    error: flattenError(error),
                  },
                );
              }
            }
          }

          if (chunk.type === "error") {
            console.error("[ai-transport] AI stream error chunk", {
              ...meta,
              chunk: flattenError(chunk),
            });
          } else if (
            chunk.type === "tool-input-start" ||
            chunk.type === "tool-input-delta" ||
            chunk.type === "tool-input-available" ||
            chunk.type === "tool-input-error" ||
            chunk.type === "finish"
          ) {
            console.info("[ai-transport] AI stream chunk", {
              ...meta,
              type: chunk.type,
              toolName: "toolName" in chunk ? chunk.toolName : undefined,
              toolCallId: "toolCallId" in chunk ? chunk.toolCallId : undefined,
              errorText: "errorText" in chunk ? chunk.errorText : undefined,
            });
          }

          controller.enqueue(chunk);
        },
        flush() {
          console.info("[ai-transport] AI stream closed", meta);
        },
      }),
    );
  }

  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}
