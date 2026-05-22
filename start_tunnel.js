import { spawn } from 'child_process';
import { bin, install } from 'cloudflared';
import fs from 'fs';
import qrcode from 'qrcode-terminal';

const PORT = 3000;

// Keep the process alive
setInterval(() => {}, 1000 * 60 * 60);

async function establishTunnel() {
    console.log(`[TUNNEL] [${new Date().toLocaleTimeString()}] Checking cloudflared binary...`);
    
    // Ensure the binary is installed
    if (!fs.existsSync(bin)) {
        console.log("[TUNNEL] Downloading cloudflared binary (this may take a few seconds)...");
        try {
            await install(bin);
            console.log("[TUNNEL] Binary installed successfully.");
        } catch (err) {
            console.error("[TUNNEL ERR] Failed to download cloudflared binary:", err);
            console.log("[TUNNEL] Retrying download in 10 seconds...");
            setTimeout(establishTunnel, 10000);
            return;
        }
    }

    console.log(`[TUNNEL] [${new Date().toLocaleTimeString()}] Attempting to establish Cloudflare Quick Tunnel...`);
    
    try {
        // Expose port 3000 (which is server.js proxy)
        const child = spawn(bin, ['tunnel', '--url', `http://127.0.0.1:${PORT}`]);
        
        let tunnelUrl = '';
        
        child.stderr.on('data', (data) => {
            const line = data.toString();
            
            // Search for trycloudflare.com URL in the logs
            const match = line.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match && !tunnelUrl) {
                tunnelUrl = match[0];
                console.log(`\n\x1b[35m========================================================\x1b[0m`);
                console.log(`\x1b[35m[TUNNEL] Cloudflare Secure Tunnel is Active!\x1b[0m`);
                console.log(`\x1b[35m[TUNNEL] Your Public URL: ${tunnelUrl}\x1b[0m`);
                console.log(`\x1b[35m========================================================\x1b[0m\n`);
                
                qrcode.generate(tunnelUrl, { small: true }, (code) => {
                    console.log("Scan this QR code with your mobile to open the app:\n");
                    console.log(code);
                    console.log("\nPress Ctrl+C to stop the server.\n");
                });
            }
        });

        child.on('close', (code) => {
            console.warn(`[TUNNEL] [${new Date().toLocaleTimeString()}] Tunnel process exited with code ${code}. Retrying in 5 seconds...`);
            setTimeout(establishTunnel, 5000);
        });

        child.on('error', (err) => {
            console.error(`[TUNNEL ERR] [${new Date().toLocaleTimeString()}] Tunnel process error:`, err);
            try { child.kill(); } catch(e){}
        });

    } catch (err) {
        console.error(`[TUNNEL ERR] [${new Date().toLocaleTimeString()}] Failed to start tunnel process:`, err.message || err);
        console.log("[TUNNEL] Retrying connection in 10 seconds...");
        setTimeout(establishTunnel, 10000);
    }
}

// Start the tunnel
establishTunnel();
