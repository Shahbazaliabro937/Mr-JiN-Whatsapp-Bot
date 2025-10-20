// Mr-JiN General Purpose Bot - Main Logic (index.js)
// Yeh file WhatsApp Bot aur Express server (Code Login API ke liye) dono ko chalati hai.
// Structure Reference: JIN-MD

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const pino = require('pino')({ level: 'info' });

// --- Environment Variables ---
// Aapki Heroku Config Vars yahan se values uthayengi
const BOT_NAME = process.env.BOT_NAME || 'Mr-JiN Bot';
const OWNER_NAME = process.env.OWNER_NAME || 'Mr-JiN';
// Owner Number: +923272265937
const OWNER_NUMBER = process.env.OWNER_NUMBER ? process.env.OWNER_NUMBER.replace(/[^0-9]/g, '') : '923272265937'; 
const PREFIX = process.env.PREFIX || '.'; 
const STICKER_NAME = process.env.STICKER_NAME || 'Mr-JiN Stickers';
const DESCRIPTION = process.env.DESCRIPTION || "*© Powered by JIN-MD Bot Services*";

// --- Bot State and Variables ---
let pairingCodeMode = false; // Flag for Web Code Login process
let client;

// --- Express Server Initialization (Web server for Heroku and API) ---
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// --- BOT LOGIC FUNCTIONS ---
function getMainMenu() {
    const commandsList = [
        `*${PREFIX}menu*: Main command list dekhein.`,
        `*${PREFIX}sticker*: Photo/Video ko sticker banayein.`,
        `*${PREFIX}ping*: Bot ki speed check karein.`,
        `*${PREFIX}support*: Owner se raabta karein.`,
        `*${PREFIX}antilink [on/off]*: Group mein link hatana chalu/band karein (Sirf Admins ke liye).`
    ];
    let menuText = `👑 *${BOT_NAME}* mein Khush Amdeed!\n\n`;
    menuText += `*Owner:* ${OWNER_NAME}\n*Prefix:* ${PREFIX}\n\n`;
    menuText += "*✨ Features & Commands:*\n";
    commandsList.forEach(cmd => {
        menuText += `\n${cmd}`;
    });
    menuText += `\n\n${DESCRIPTION}`;
    return menuText;
}

// --- Utility Functions ---

// Check if the user is the bot owner
function isOwner(number) {
    const cleanNum = number.replace('@c.us', '');
    return cleanNum === OWNER_NUMBER;
}

// Check if the bot is in a group
function isGroup(chat) {
    return chat.isGroup;
}

// --- WhatsApp Client Initialization ---
function initializeClient() {
    pino.info('WhatsApp Client shuru kiya ja raha hai...');
    
    if (client) {
        client.destroy().catch(pino.error);
    }
    
    // Client configuration
    client = new Client({
        authStrategy: new LocalAuth({
            clientId: "mr-jin-general-bot" 
        }),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-gpu'
            ],
            headless: true, 
        },
    });

    // --- EVENTS ---

    client.on('qr', (qr) => {
        pino.info('QR code mila. Pairing code mode band hai. User ko QR scan karna hoga.');
        pairingCodeMode = false; 
    });
    
    client.on('ready', () => {
        pino.info(`✅ ${BOT_NAME} taiyar hai!`);
        pairingCodeMode = false;
        client.setPresence({ status: process.env.ALWAYS_ONLINE === 'true' ? 'available' : 'unavailable' });
    });

    client.on('authenticated', () => {
        pino.info('Bot ki tasdeeq (authentication) kamyab ho gayi!');
    });

    client.on('auth_failure', (msg) => {
        pino.error('Tasdeeq mein nakaami (Authentication failure): %s', msg);
    });

    client.on('disconnected', (reason) => {
        pino.error('Client disconnect ho gaya:', reason);
    });

    // --- AUTOMATION EVENTS ---
    if (process.env.AUTO_STATUS_SEEN === 'true') {
        client.on('status_media', (status) => {
            if (!isOwner(status.from)) {
                pino.info(`Status dekha: ${status.sender.pushname}`);
                if (process.env.AUTO_STATUS_REACT === 'true') {
                    client.sendMessage(status.id.remote, '👀');
                }
            }
        });
    }

    if (process.env.READ_MESSAGE === 'true') {
        client.on('message', async msg => {
            const chat = await msg.getChat();
            chat.sendSeen(); // Message dekha gaya
        });
    }


    // --- COMMAND HANDLING ---
    client.on('message', async msg => {
        const userMessage = msg.body;
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const sender = contact.id.user;
        const isUserOwner = isOwner(msg.from);
        
        // --- 1. ANTI-LINK Logic (Group only) ---
        if (isGroup(chat) && process.env.ANTI_LINK === 'true' && userMessage.includes('chat.whatsapp.com')) {
            // Owner ko ignore karein
            if (!isUserOwner) {
                const groupAdmins = (await chat.getParticipantIDs()).map(p => p.id.user);
                const isSenderAdmin = groupAdmins.includes(sender);

                if (!isSenderAdmin) {
                    msg.delete(true).catch(e => pino.error('Failed to delete link:', e));
                    chat.sendMessage(`🚨 Link detect hua. Sahi link nahi bhej sakte! *${contact.pushname}* ko remove kiya ja sakta hai.`);
                }
            }
        }

        // --- 2. COMMANDS ---
        if (userMessage.startsWith(PREFIX)) {
            const args = userMessage.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            
            switch (command) {
                case 'menu':
                    msg.reply(getMainMenu());
                    break;
                case 'ping':
                    const timestamp = Date.now();
                    const latency = timestamp - msg.timestamp * 1000;
                    msg.reply(`🚀 Pong! Bot Online hai.\n*Response Time:* ${latency} ms`);
                    break;
                case 'sticker':
                    if (msg.hasMedia) {
                        const media = await msg.downloadMedia();
                        msg.reply(media, undefined, { sendMediaAsSticker: true, stickerName: STICKER_NAME });
                    } else if (msg.hasQuotedMsg) {
                        const quotedMsg = await msg.getQuotedMessage();
                        if (quotedMsg.hasMedia) {
                            const media = await quotedMsg.downloadMedia();
                            msg.reply(media, undefined, { sendMediaAsSticker: true, stickerName: STICKER_NAME });
                        } else {
                            msg.reply(`❌ Reply kisi photo ya video ko karein *${PREFIX}sticker* ke saath.`);
                        }
                    } else {
                        msg.reply(`❌ Photo ya video bhej kar *${PREFIX}sticker* likhein.`);
                    }
                    break;
                case 'support':
                    msg.reply(`💬 *Support:* Owner ${OWNER_NAME} se yahan raabta karein: wa.me/${OWNER_NUMBER}`);
                    break;

                // Owner command example
                case 'broadcast':
                    if (isUserOwner) {
                        const broadcastMsg = args.join(' ');
                        const chats = await client.getChats();
                        
                        let count = 0;
                        for (const chat of chats) {
                            if (!chat.isGroup) {
                                await chat.sendMessage(`📢 *BROADCAST FROM ${OWNER_NAME}:*\n\n${broadcastMsg}`);
                                count++;
                            }
                        }
                        msg.reply(`✅ Message ${count} chats mein successfully bheja gaya.`);
                    } else {
                        msg.reply('❌ Yeh command sirf Owner ke liye hai.');
                    }
                    break;
                
                // Add antilink toggle (Admin/Owner only)
                case 'antilink':
                    if (isGroup(chat)) {
                        const groupAdmins = (await chat.getParticipantIDs()).map(p => p.id.user);
                        const isSenderAdmin = groupAdmins.includes(sender);

                        if (isUserOwner || isSenderAdmin) {
                            const status = args[0] ? args[0].toLowerCase() : '';
                            if (status === 'on') {
                                process.env.ANTI_LINK = 'true';
                                msg.reply('✅ Anti-Link ab *chalu* ho gaya hai.');
                            } else if (status === 'off') {
                                process.env.ANTI_LINK = 'false';
                                msg.reply('❌ Anti-Link ab *band* ho gaya hai.');
                            } else {
                                msg.reply(`*Usage:* ${PREFIX}antilink [on/off]\n*Current Status:* ${process.env.ANTI_LINK}`);
                            }
                        } else {
                            msg.reply('❌ Aap Admin nahi hain, yeh command use nahi kar sakte.');
                        }
                    } else {
                        msg.reply('❌ Yeh command sirf groups mein kaam karta hai.');
                    }
                    break;
            }
        }
    });

    client.initialize().catch(pino.error);
}


// --- API Endpoint for Web Login Code ---
// Yeh endpoint aapki website se call kiya jayega

app.post('/login-code', async (req, res) => {
    const { number } = req.body;
    
    // Validation
    if (!number || !/^[0-9]{10,15}$/.test(number)) {
        return res.status(400).json({ error: '❌ Bara-e-meherbani sahi number (country code ke saath) daalein.' });
    }

    // Number cleaning and formatting (Example: +923272265937 -> 923272265937@c.us)
    const cleanNumber = number.replace(/[^0-9]/g, '');
    const numberWithCountry = cleanNumber.endsWith('@c.us') ? cleanNumber : `${cleanNumber}@c.us`;

    pino.info(`Code request mila: ${cleanNumber}`);

    if (client.isReady) {
        return res.status(400).json({ error: '⚠️ Bot pehle se connect hai. Naya user connect nahi kiya ja sakta.' });
    }
    
    if (pairingCodeMode) {
        return res.status(400).json({ error: '⏳ Puran code request process ho raha hai. Intezaar karein.' });
    }

    try {
        pairingCodeMode = true;
        pino.info(`Pairing code bhejne ki koshish: ${numberWithCountry}...`);

        // getWACode() sends the code directly to the provided number via WhatsApp.
        const code = await client.getWACode(numberWithCountry);
        
        if (code) {
            pino.info(`Code kamyab ho gaya ${cleanNumber} ke liye: ${code}`);
            res.json({ success: true, message: `✅ Code *${code}* aapke WhatsApp par bhej diya gaya hai.`, code: code });
        } else {
            res.status(500).json({ success: false, error: '❌ Code generate nahi ho saka. Number format check karein ya dobara koshish karein.' });
        }
    } catch (error) {
        pino.error('getWACode ke dauraan ghalti:', error.message);
        res.status(500).json({ success: false, error: '❌ Server error hua code bhejte waqt. Number dobara check karein.' });
    } finally {
        pairingCodeMode = false;
    }
});


// --- Web Server Start ---
// Heroku ko yeh batane ke liye ki server chal raha hai
app.get('/', (req, res) => {
    res.send(`<h1>${BOT_NAME} Status: Running</h1><p>API Endpoint /login-code is active.</p>`);
});

app.listen(port, () => {
    pino.info(`Web server port ${port} par sun raha hai.`);
    initializeClient(); // Bot ko web server ke baad shuru karein
});

