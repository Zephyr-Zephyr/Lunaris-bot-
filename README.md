# Lunaris Ticket Bot (discord.js)

Ein einfaches Discord.js-Bot-Projekt mit Ticket-System.

## Setup

1. Kopiere `config.example.json` zu `config.json`.
2. Trage deinen Bot-Token und deine Server-ID ein.
3. Optional: konfiguriere `ticketCategoryId`, `logChannelId`, `staffRoleId`, `welcomeChannelId`, `welcomeMessage`, `antiRaidThreshold`, `antiRaidAction`, `raidLogChannelId`.
4. Installiere Abhängigkeiten:
   ```bash
   npm install
   ```
5. Starte den Bot:
   ```bash
   npm start
   ```

## Railway deployment
1. Erstelle ein Railway-Projekt und verbinde dein GitHub-Repository.
2. Füge in den Railway-Umgebungsvariablen folgende Werte hinzu:
   - `DISCORD_TOKEN` = dein Bot-Token
   - `GUILD_ID` = deine Server-ID
   - `WELCOME_CHANNEL_ID` = optional
   - `VERIFY_ROLE_ID` = optional
   - `LOG_CHANNEL_ID` = optional
3. Setze den Start-Befehl auf:
   ```bash
   npm start
   ```
4. Deploye das Projekt.

## Befehle

- `/ticket-panel` - sendet das Ticket-Panel
- `/close` - schließt das Ticket
- `/add` - fügt einen User zum Ticket hinzu
- `/remove` - entfernt einen User aus dem Ticket
- `/set-welcome-channel` - setzt den Welcome-Kanal
- `/set-welcome-message` - speichert die Willkommensnachricht
- `/welcome-status` - zeigt die Welcome-Einstellungen
- `/set-raid-channel` - setzt den Raid-Log-Kanal
- `/set-raid-threshold` - setzt die Anti-Raid-Schwelle
- `/set-raid-action` - setzt die Anti-Raid-Aktion
- `/anti-raid-status` - zeigt den Anti-Raid-Status
- `/stop` - stops the bot safely

Der Bot registriert die Slash-Commands automatisch beim Start.
