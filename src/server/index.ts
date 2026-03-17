import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { searchListingsSchema, handleSearchListings } from '../tools/search-listings.js';
import { getListingSchema, handleGetListing } from '../tools/get-listing.js';
import { marketPriceSchema, handleMarketPrice } from '../tools/market-price.js';
import { registerItemSchema, handleRegisterItem } from '../tools/register-item.js';
import { updateListingSchema, handleUpdateListing } from '../tools/update-listing.js';
import { manageListingSchema, handleManageListing } from '../tools/manage-listing.js';
import type { AuthInfo } from '../lib/auth.js';
import { logger } from '../lib/logger.js';

function createServer(): McpServer {
  const server = new McpServer(
    { name: 'haggle', version: '0.1.0' },
    { capabilities: { logging: {} } },
  );

  server.registerTool(
    'search_listings',
    {
      title: '매물 검색',
      description: '키워드, 가격, 지역 등으로 중고 매물을 검색합니다.',
      inputSchema: searchListingsSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => handleSearchListings(args),
  );

  server.registerTool(
    'get_listing',
    {
      title: '매물 상세',
      description: '매물 ID로 상세 정보(판매자, 제안 현황)를 조회합니다.',
      inputSchema: getListingSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => handleGetListing(args),
  );

  server.registerTool(
    'market_price',
    {
      title: '시세 조회',
      description: '키워드로 유사 매물의 가격 분포(최저/최고/평균/중간값)를 조회합니다.',
      inputSchema: marketPriceSchema,
      annotations: { readOnlyHint: true },
    },
    async (args) => handleMarketPrice(args),
  );

  server.registerTool(
    'register_item',
    {
      title: '매물 등록',
      description: '중고 매물을 등록합니다. 인증 필수.',
      inputSchema: registerItemSchema,
    },
    async (args, extra) =>
      handleRegisterItem(args, { authInfo: extra.authInfo as AuthInfo | undefined }),
  );

  server.registerTool(
    'update_listing',
    {
      title: '매물 수정',
      description: '매물 정보(가격, 설명 등)를 수정합니다. 소유자만 가능.',
      inputSchema: updateListingSchema,
    },
    async (args, extra) =>
      handleUpdateListing(args, { authInfo: extra.authInfo as AuthInfo | undefined }),
  );

  server.registerTool(
    'manage_listing',
    {
      title: '매물 상태 변경',
      description: '매물 상태를 변경합니다 (예약, 판매완료, 삭제, 재등록). 소유자만 가능.',
      inputSchema: manageListingSchema,
    },
    async (args, extra) =>
      handleManageListing(args, { authInfo: extra.authInfo as AuthInfo | undefined }),
  );

  return server;
}

async function runStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server started (stdio)');
}

async function softAuth(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = header.slice(7);
  try {
    const { verifyToken } = await import('../lib/auth.js');
    (req as express.Request & { auth?: unknown }).auth = await verifyToken(token);
  } catch {
    /* invalid token — tool handler will reject if auth required */
  }
  next();
}

async function runHttp(port: number) {
  const transports: Record<string, StreamableHTTPServerTransport> = {};
  const app = express();
  app.use(express.json());

  app.post('/mcp', softAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport;
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          transports[sid] = undefined as unknown as StreamableHTTPServerTransport;
          Reflect.deleteProperty(transports, sid);
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: missing session or initialize' },
      id: null,
    });
  });

  app.get('/mcp', softAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid session');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.delete('/mcp', softAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res);
    } else {
      res.status(400).send('Invalid session');
    }
  });

  app.listen(port, () => {
    logger.info('MCP server started (HTTP)', { port });
  });
}

const isStdio = process.argv.includes('--stdio');
const port = parseInt(process.env['PORT'] ?? '3000', 10);

if (isStdio) {
  runStdio().catch((err: unknown) => {
    process.stderr.write(`Fatal: ${err}\n`);
    process.exit(1);
  });
} else {
  runHttp(port).catch((err: unknown) => {
    process.stderr.write(`Fatal: ${err}\n`);
    process.exit(1);
  });
}
