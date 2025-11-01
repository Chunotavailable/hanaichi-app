// scripts/get-token.js
// One-time tool to obtain a refresh_token for read-only Sheets access
import http from "http";
import open from "open";
import { google } from "googleapis";

const PORT = process.env.PORT || 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

function log(msg){ console.log(msg); }

async function main(){
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  if(!clientId || !clientSecret){
    console.error("Missing CLIENT_ID or CLIENT_SECRET in env");
    process.exit(1);
  }
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent"
  });

  log("\n1) Mở link để cấp quyền (tự mở trình duyệt):\n" + authUrl + "\n");
  try { await open(authUrl); } catch {}

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

      log("\n2) Tokens nhận được (giữ bí mật, dùng REFRESH_TOKEN):\n");
      console.log(JSON.stringify(tokens, null, 2));
      if(!tokens.refresh_token){
        log("\n⚠️  Không thấy refresh_token. Hãy chạy lại với prompt=consent, hoặc xóa quyền app trong Google Account rồi cấp lại.");
      } else {
        log("\n➡️  Sao chép refresh_token vào .env.local dưới tên REFRESH_TOKEN\n");
      }
    } catch (e) {
      console.error(e);
    }
  });
  server.listen(PORT, () => log(`Listening for OAuth redirect at ${REDIRECT_URI}`));
}

main().catch(console.error);
