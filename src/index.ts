#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";

import dotenv from "dotenv";
import { isValidImageGenerationArgs } from "./types.js";
import { ImageGenerator } from "./image-generator.js";
import { FileSaver } from "./file-saver.js";

dotenv.config();

const imageSaver = FileSaver.CreateDesktopFileSaver('generated-images');

class ImageGeneratorServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: "image-generator",
      version: "0.1.0"
    }, {
      capabilities: {
        resources: {},
        tools: {}
      }
    });

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({
        tools: [{
          name: "generate_image",
          description: "Generate an image from a prompt.",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "A prompt detailing what image to generate."
              },
              imageName: {
                type: "string",
                description: "The filename for the image excluding any extensions."
              },
              shouldSaveToFile: {
                type: "boolean",
                description: "Should the image be saved on the user's computer. The 'imageName' arguments is expected when this is true."
              }
            },
            required: ["prompt"]
          }
        }]
      })
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        if (request.params.name !== "generate_image") {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
        }

        if (!isValidImageGenerationArgs(request.params.arguments)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Invalid image generation arguments"
          )
        };
        
        const { prompt, imageName, shouldSaveToFile } = request.params.arguments;
        const base64 = await new ImageGenerator().generateImage(prompt);
        let filepath: string | null = null;
        if (shouldSaveToFile && imageName) {

          const fileName = `${imageName.replace(/\..*$/, '')}.png`;
          filepath = await imageSaver.saveBase64(fileName, base64!);
        }

        return {
          toolResult: {
            uri: !!filepath ? `file://${filepath}` : `data:image/png;base64, ${base64}`,
            type: 'image',
            data: base64
          }
        }
      }
    )
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Although this is just an informative message, we must log to stderr,
    // to avoid interfering with MCP communication that happens on stdout
    console.error("Weather MCP server running on stdio");
  }
}

const server = new ImageGeneratorServer();
server.run().catch(console.error);
