// scripts/get-token.js
// One-time tool to obtain a refresh_token for read-only Sheets access

// 🔹 THÊM 2 DÒNG NÀY ĐỂ LOAD .env.local
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import http from "http";
import open from "open";
import { google } from "googleapis";

const PORT = process.env.PORT || 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

function log(msg) {
  console.log(msg);
}

async function main() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing CLIENT_ID or CLIENT_SECRET in env");
    console.error("→ Kiểm tra lại .env.local xem có đúng 2 biến đó chưa.");
    process.exit(1);
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  log(
    "\n1) Mở link để cấp quyền (script sẽ cố mở trình duyệt tự động):\n" +
      authUrl +
      "\n"
  );
  try {
    await open(authUrl);
  } catch {
    // nếu không tự mở được thì bạn copy link ở trên dán vào trình duyệt
  }

  // Local server to capture ?code=
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Awaiting 'code' ...");
        return;
      }
      const { tokens } = await oAuth2Client.getToken(code);

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Received auth code. You can close this tab.");
      server.close();

      log("\n2) Tokens nhận được (GIỮ BÍ MẬT, dùng refresh_token):\n");
      console.log(JSON.stringify(tokens, null, 2));

      if (!tokens.refresh_token) {
        log(
          "\n⚠️ Không thấy refresh_token.\n" +
            "   - Đảm bảo prompt=consent (đã có).\n" +
            "   - Nếu vẫn không được: vào Google Account → Security → Third-party access,\n" +
            "     xóa quyền app này rồi chạy lại script.\n"
        );
      } else {
        log(
          "\n➡️ Sao chép refresh_token ở trên vào .env.local (REFRESH_TOKEN=...)\n"
        );
      }
    } catch (e) {
      console.error("Error while handling callback:", e.response?.data || e);
    }
  });

  server.listen(PORT, () =>
    log(`Listening for OAuth redirect at ${REDIRECT_URI}`)
  );
}

main().catch(console.error);
