import localtunnel from 'localtunnel';
import qrcode from 'qrcode-terminal';

const SUBDOMAIN = 'gerry-smart-expense';
const PORT = 3000;

// Keep the process alive
setInterval(() => {}, 1000 * 60 * 60);

async function establishTunnel() {
    console.log(`[TUNNEL] [${new Date().toLocaleTimeString()}] Attempting to establish secure public tunnel...`);
    try {
        const tunnel = await localtunnel({ 
            port: PORT, 
            subdomain: SUBDOMAIN 
        });

        console.log(`\n\x1b[35m========================================================\x1b[0m`);
        console.log(`\x1b[35m[TUNNEL] Secure Tunnel is Active!\x1b[0m`);
        console.log(`\x1b[35m[TUNNEL] Your Public URL: ${tunnel.url}\x1b[0m`);
        console.log(`\x1b[35m========================================================\x1b[0m\n`);

        qrcode.generate(tunnel.url, { small: true }, (code) => {
            console.log("Scan this QR code with your mobile to open the app:\n");
            console.log(code);
            console.log("\nPress Ctrl+C to stop the server.\n");
        });

        tunnel.on('close', () => {
            console.warn(`[TUNNEL] [${new Date().toLocaleTimeString()}] Tunnel connection was closed. Retrying in 5 seconds...`);
            setTimeout(establishTunnel, 5000);
        });

        tunnel.on('error', (err) => {
            console.error(`[TUNNEL ERR] [${new Date().toLocaleTimeString()}] Tunnel error:`, err);
            // The close event is usually emitted after error, but just in case, close and retry
            try { tunnel.close(); } catch(e){}
        });

    } catch (err) {
        console.error(`[TUNNEL ERR] [${new Date().toLocaleTimeString()}] Failed to connect:`, err.message || err);
        console.log("[TUNNEL] Retrying connection in 10 seconds...");
        setTimeout(establishTunnel, 10000);
    }
}

// Start the tunnel
establishTunnel();
