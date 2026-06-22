# Lunaris Ticket Bot (Discord.js)

A simple Discord.js v14 ticket bot with welcome and anti-raid support.

## Setup

1. Copy `config.example.json` to `config.json`.
2. Fill in your server IDs and any desired settings.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the bot:
   ```bash
   npm start
   ```

> Do not commit `config.json` to GitHub. Keep `config.example.json` in the repo as a template.

## Environment Variables (Railway / Hosting)

The bot supports environment variables for secure deployment:

- `DISCORD_TOKEN` - your bot token
- `GUILD_ID` - your server ID
- `TICKET_CATEGORY_ID` - category ID where tickets are created
- `LOG_CHANNEL_ID` - optional log channel ID
- `WELCOME_CHANNEL_ID` - optional welcome channel ID
- `VERIFY_ROLE_ID` - optional verify role ID
- `ANTI_RAID_ENABLED` - `true` or `false`
- `ANTI_RAID_THRESHOLD` - number of joins before anti-raid triggers
- `ANTI_RAID_WINDOW_SECONDS` - time window for join count
- `ANTI_RAID_ACTION` - `kick` or `ban`
- `TICKET_COOLDOWN_SECONDS` - cooldown between ticket creation

## Railway Deployment

1. Create a Railway project and connect your GitHub repository.
2. Add the required environment variables in Railway.
3. Set the start command to:
   ```bash
   npm start
   ```
4. Deploy the project and watch the logs for startup success.

## Available Commands

- `/ticket-panel` - sends the ticket panel
- `/close` - close the current ticket
- `/add` - add a user to the ticket
- `/remove` - remove a user from the ticket
- `/set-welcome-channel` - set the welcome channel
- `/set-welcome-message` - save the welcome message
- `/welcome-status` - show welcome settings
- `/set-raid-channel` - set the anti-raid log channel
- `/set-raid-threshold` - set the anti-raid threshold
- `/set-raid-action` - set the anti-raid action
- `/anti-raid-status` - show anti-raid status
- `/set-verify-role` - set the verify role
- `/test-welcome` - preview the welcome message
- `/stop` - stop the bot safely

## Notes

- The bot automatically registers slash commands when it starts.
- Use `config.example.json` as the template for local configuration.
- Keep your bot token and sensitive IDs out of version control.

> This project was mostly developed by Zephyr and enhanced with the help of AI. ❤️
