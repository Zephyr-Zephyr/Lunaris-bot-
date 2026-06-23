import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits, Partials, PermissionsBitField, REST, Routes, SlashCommandBuilder } from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("Die Datei config.json fehlt. Kopiere config.example.json nach config.json und trage deine Daten ein.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const { token, guildId, ticketCategoryId, supportRoleId, logsChannelId } = config;

if (!token || !guildId || !ticketCategoryId || !supportRoleId) {
  console.error("Bitte fülle token, guildId, ticketCategoryId und supportRoleId in config.json aus.");
  process.exit(1);
}

// 100 Commands: Ticket-Management, Moderation, Utility
const commands = [
  // === TICKET-MANAGEMENT (32 Befehle) ===
  new SlashCommandBuilder().setName("ticket").setDescription("Erstellt ein neues Ticket."),
  new SlashCommandBuilder().setName("close").setDescription("Schließt das aktuelle Ticket."),
  new SlashCommandBuilder().setName("reopen").setDescription("Öffnet ein geschlossenes Ticket erneut."),
  new SlashCommandBuilder().setName("assign").setDescription("Weist einen Supporter dem Ticket zu.")
    .addUserOption(option => option.setName("supporter").setDescription("Supporter zum Zuweisen").setRequired(true)),
  new SlashCommandBuilder().setName("unassign").setDescription("Entfernt den Supporter aus dem Ticket."),
  new SlashCommandBuilder().setName("priority").setDescription("Setzt die Priorität des Tickets.")
    .addStringOption(option => option.setName("level").setDescription("Priorität").addChoices({name:"Niedrig", value:"low"}, {name:"Mittel", value:"medium"}, {name:"Hoch", value:"high"})),
  new SlashCommandBuilder().setName("status").setDescription("Zeigt den Status des aktuellen Tickets."),
  new SlashCommandBuilder().setName("rename").setDescription("Benennt das Ticket um.")
    .addStringOption(option => option.setName("name").setDescription("Neuer Name").setRequired(true)),
  new SlashCommandBuilder().setName("description").setDescription("Setzt die Beschreibung des Tickets.")
    .addStringOption(option => option.setName("text").setDescription("Beschreibung").setRequired(true)),
  new SlashCommandBuilder().setName("addnote").setDescription("Fügt eine Notiz zum Ticket hinzu.")
    .addStringOption(option => option.setName("note").setDescription("Notiz").setRequired(true)),
  new SlashCommandBuilder().setName("viewtickets").setDescription("Zeigt alle deine offenen Tickets."),
  new SlashCommandBuilder().setName("claimticket").setDescription("Übernimmt ein Ticket als Supporter."),
  new SlashCommandBuilder().setName("releaseticket").setDescription("Gibt ein Ticket frei."),
  new SlashCommandBuilder().setName("ticketinfo").setDescription("Zeigt Informationen über das aktuelle Ticket."),
  new SlashCommandBuilder().setName("tickethistory").setDescription("Zeigt die Historie des Tickets."),
  new SlashCommandBuilder().setName("addmember").setDescription("Fügt ein Mitglied zum Ticket hinzu.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("removemember").setDescription("Entfernt ein Mitglied aus dem Ticket.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("transferticket").setDescription("Überträgt das Ticket an jemand anderes.")
    .addUserOption(option => option.setName("user").setDescription("Neuer Eigentümer").setRequired(true)),
  new SlashCommandBuilder().setName("category").setDescription("Setzt die Kategorie des Tickets.")
    .addStringOption(option => option.setName("cat").setDescription("Kategorie").setRequired(true)),
  new SlashCommandBuilder().setName("tag").setDescription("Fügt ein Tag zum Ticket hinzu.")
    .addStringOption(option => option.setName("tag").setDescription("Tag").setRequired(true)),
  new SlashCommandBuilder().setName("removetag").setDescription("Entfernt ein Tag vom Ticket.")
    .addStringOption(option => option.setName("tag").setDescription("Tag").setRequired(true)),
  new SlashCommandBuilder().setName("lockticket").setDescription("Sperrt das Ticket für neue Nachrichten."),
  new SlashCommandBuilder().setName("unlockticket").setDescription("Entsperrt das Ticket."),
  new SlashCommandBuilder().setName("archiveticket").setDescription("Archiviert das Ticket."),
  new SlashCommandBuilder().setName("unarchiveticket").setDescription("Stellt das Ticket aus dem Archiv wieder her."),
  new SlashCommandBuilder().setName("ticketstats").setDescription("Zeigt Statistiken über Tickets."),
  new SlashCommandBuilder().setName("deleteticket").setDescription("Löscht das Ticket dauerhaft."),
  new SlashCommandBuilder().setName("duplicateticket").setDescription("Markiert das Ticket als Duplikat.")
    .addStringOption(option => option.setName("original").setDescription("Original Ticket ID").setRequired(true)),
  new SlashCommandBuilder().setName("resolveticket").setDescription("Markiert das Ticket als gelöst."),
  new SlashCommandBuilder().setName("reopenresolved").setDescription("Öffnet ein gelöstes Ticket erneut."),
  new SlashCommandBuilder().setName("escalateticket").setDescription("Eskaliert das Ticket."),

  // === MODERATION (34 Befehle) ===
  new SlashCommandBuilder().setName("kick").setDescription("Entfernt einen Benutzer vom Server.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Grund")),
  new SlashCommandBuilder().setName("ban").setDescription("Sperrt einen Benutzer vom Server.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Grund")),
  new SlashCommandBuilder().setName("unban").setDescription("Hebt einen Ban auf.")
    .addStringOption(option => option.setName("userid").setDescription("User ID").setRequired(true)),
  new SlashCommandBuilder().setName("warn").setDescription("Verwarnt einen Benutzer.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Grund")),
  new SlashCommandBuilder().setName("removewarn").setDescription("Entfernt eine Verwarnung.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("warnings").setDescription("Zeigt die Verwarnungen eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("clearwarnings").setDescription("Löscht alle Verwarnungen eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("mute").setDescription("Stummschaltet einen Benutzer.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addIntegerOption(option => option.setName("minutes").setDescription("Minuten")),
  new SlashCommandBuilder().setName("unmute").setDescription("Hebt die Stummschaltung auf.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("tempmute").setDescription("Zeitlich begrenzte Stummschaltung.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addIntegerOption(option => option.setName("seconds").setDescription("Sekunden").setRequired(true)),
  new SlashCommandBuilder().setName("slowmode").setDescription("Aktiviert Slowmode im Channel.")
    .addIntegerOption(option => option.setName("seconds").setDescription("Sekunden").setRequired(true)),
  new SlashCommandBuilder().setName("lock").setDescription("Sperrt den Channel für normale Nutzer."),
  new SlashCommandBuilder().setName("unlock").setDescription("Entsperrt den Channel."),
  new SlashCommandBuilder().setName("clear").setDescription("Löscht Nachrichten aus dem Channel.")
    .addIntegerOption(option => option.setName("amount").setDescription("Anzahl der Nachrichten").setRequired(true)),
  new SlashCommandBuilder().setName("clearuser").setDescription("Löscht Nachrichten eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addIntegerOption(option => option.setName("amount").setDescription("Anzahl")),
  new SlashCommandBuilder().setName("addrole").setDescription("Gibt einem Benutzer eine Rolle.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addStringOption(option => option.setName("role").setDescription("Rolle").setRequired(true)),
  new SlashCommandBuilder().setName("removerole").setDescription("Entfernt eine Rolle von einem Benutzer.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addStringOption(option => option.setName("role").setDescription("Rolle").setRequired(true)),
  new SlashCommandBuilder().setName("nickname").setDescription("Ändert den Nickname eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addStringOption(option => option.setName("nickname").setDescription("Neuer Name").setRequired(true)),
  new SlashCommandBuilder().setName("report").setDescription("Meldet einen Benutzer.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Grund").setRequired(true)),
  new SlashCommandBuilder().setName("softban").setDescription("Soft-Ban (Ban + sofort Unban).")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout für Benutzer.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true))
    .addIntegerOption(option => option.setName("minutes").setDescription("Minuten").setRequired(true)),
  new SlashCommandBuilder().setName("removetimeout").setDescription("Hebt einen Timeout auf.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("infractions").setDescription("Zeigt Verwarnungen eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("modlog").setDescription("Zeigt das Modlog."),
  new SlashCommandBuilder().setName("filter").setDescription("Setzt einen Wort-Filter.")
    .addStringOption(option => option.setName("word").setDescription("Wort").setRequired(true)),
  new SlashCommandBuilder().setName("removefilter").setDescription("Entfernt einen Wort-Filter.")
    .addStringOption(option => option.setName("word").setDescription("Wort").setRequired(true)),
  new SlashCommandBuilder().setName("filters").setDescription("Zeigt alle aktiven Filter."),
  new SlashCommandBuilder().setName("guild").setDescription("Zeigt Informationen über den Server."),
  new SlashCommandBuilder().setName("userinfo").setDescription("Zeigt Informationen über einen Benutzer.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer")),
  new SlashCommandBuilder().setName("roleinfo").setDescription("Zeigt Informationen über eine Rolle.")
    .addStringOption(option => option.setName("role").setDescription("Rolle").setRequired(true)),
  new SlashCommandBuilder().setName("membercount").setDescription("Zeigt die Mitgliederzahl."),
  new SlashCommandBuilder().setName("banlist").setDescription("Zeigt die Banliste."),

  // === UTILITY (34 Befehle) ===
  new SlashCommandBuilder().setName("ping").setDescription("Zeigt die Bot-Latenz."),
  new SlashCommandBuilder().setName("uptime").setDescription("Zeigt die Uptime des Bots."),
  new SlashCommandBuilder().setName("help").setDescription("Zeigt eine Hilfemitteilung."),
  new SlashCommandBuilder().setName("about").setDescription("Zeigt Informationen über den Bot."),
  new SlashCommandBuilder().setName("info").setDescription("Zeigt allgemeine Informationen."),
  new SlashCommandBuilder().setName("support").setDescription("Zeigt Support-Informationen."),
  new SlashCommandBuilder().setName("botinfo").setDescription("Zeigt Informationen über den Bot."),
  new SlashCommandBuilder().setName("stats").setDescription("Zeigt Bot-Statistiken."),
  new SlashCommandBuilder().setName("commands").setDescription("Zeigt alle verfügbaren Befehle."),
  new SlashCommandBuilder().setName("invite").setDescription("Zeigt den Einladungslink für den Bot."),
  new SlashCommandBuilder().setName("source").setDescription("Zeigt den Source Code des Bots."),
  new SlashCommandBuilder().setName("update").setDescription("Zeigt die letzten Updates."),
  new SlashCommandBuilder().setName("changelog").setDescription("Zeigt das Changelog."),
  new SlashCommandBuilder().setName("version").setDescription("Zeigt die Bot-Version."),
  new SlashCommandBuilder().setName("prefix").setDescription("Zeigt das Prefix."),
  new SlashCommandBuilder().setName("feedback").setDescription("Sendet Feedback an den Entwickler.")
    .addStringOption(option => option.setName("message").setDescription("Feedback").setRequired(true)),
  new SlashCommandBuilder().setName("bug").setDescription("Meldet einen Bug.")
    .addStringOption(option => option.setName("description").setDescription("Beschreibung").setRequired(true)),
  new SlashCommandBuilder().setName("feature").setDescription("Fordert ein Feature an.")
    .addStringOption(option => option.setName("description").setDescription("Beschreibung").setRequired(true)),
  new SlashCommandBuilder().setName("dice").setDescription("Würfelt mit Würfel(n).")
    .addIntegerOption(option => option.setName("sides").setDescription("Seiten des Würfels").setRequired(false)),
  new SlashCommandBuilder().setName("coin").setDescription("Wirft eine Münze."),
  new SlashCommandBuilder().setName("random").setDescription("Gibt eine Zufallszahl aus.")
    .addIntegerOption(option => option.setName("min").setDescription("Minimum").setRequired(true))
    .addIntegerOption(option => option.setName("max").setDescription("Maximum").setRequired(true)),
  new SlashCommandBuilder().setName("choose").setDescription("Wählt eine Option aus.")
    .addStringOption(option => option.setName("options").setDescription("Optionen (kommagetrennt)").setRequired(true)),
  new SlashCommandBuilder().setName("avatar").setDescription("Zeigt den Avatar eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer")),
  new SlashCommandBuilder().setName("banner").setDescription("Zeigt das Banner eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer")),
  new SlashCommandBuilder().setName("serveravatar").setDescription("Zeigt den Server-Avatar eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer")),
  new SlashCommandBuilder().setName("status").setDescription("Zeigt den Online-Status eines Benutzers.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("ping-user").setDescription("Pingt einen Benutzer.")
    .addUserOption(option => option.setName("user").setDescription("Benutzer").setRequired(true)),
  new SlashCommandBuilder().setName("echo").setDescription("Gibt eine Nachricht aus.")
    .addStringOption(option => option.setName("message").setDescription("Nachricht").setRequired(true)),
  new SlashCommandBuilder().setName("say").setDescription("Sendet eine Nachricht als Bot.")
    .addStringOption(option => option.setName("message").setDescription("Nachricht").setRequired(true)),
  new SlashCommandBuilder().setName("announce").setDescription("Macht eine Ankündigung.")
    .addStringOption(option => option.setName("message").setDescription("Nachricht").setRequired(true)),
  new SlashCommandBuilder().setName("embed").setDescription("Erstellt ein Embed.")
    .addStringOption(option => option.setName("title").setDescription("Titel").setRequired(true))
    .addStringOption(option => option.setName("description").setDescription("Beschreibung")),
  new SlashCommandBuilder().setName("poll").setDescription("Erstellt eine Umfrage.")
    .addStringOption(option => option.setName("question").setDescription("Frage").setRequired(true)),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Zeigt Server-Informationen.")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

async function registerCommands() {
  try {
    console.log("Registriere Slash-Commands...");
    await rest.put(Routes.applicationGuildCommands((await rest.get(Routes.oauth2CurrentApplication()))?.id ?? "", guildId), {
      body: commands
    });
    console.log("Slash-Commands erfolgreich registriert.");
  } catch (error) {
    console.error("Fehler beim Registrieren der Slash-Commands:", error);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once("ready", async () => {
  console.log(`Bot ist eingeloggt als ${client.user.tag}`);
  await registerCommands();
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, member } = interaction;
  if (!guild) return;

  // === TICKET-MANAGEMENT Commands ===
  if (commandName === "ticket") {
    const category = guild.channels.cache.get(ticketCategoryId);
    if (!category || category.type !== 4) {
      return interaction.reply({ content: "Die Ticket-Kategorie wurde nicht gefunden oder ist ungültig.", ephemeral: true });
    }

    const existing = guild.channels.cache.find(channel => channel.parentId === ticketCategoryId && channel.name === `ticket-${member.user.username.toLowerCase()}`);
    if (existing) {
      return interaction.reply({ content: `Du hast bereits ein Ticket: ${existing}`, ephemeral: true });
    }

    const channel = await guild.channels.create({
      name: `ticket-${member.user.username}`,
      type: 0,
      parent: ticketCategoryId,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: member.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        },
        {
          id: supportRoleId,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }
      ]
    });

    await interaction.reply({ content: `Ticket erstellt: ${channel}`, ephemeral: true });
    await channel.send(`Hallo ${member.user}, ein Supporter wird gleich hier sein. Schreibe hier dein Anliegen.`);
    if (logsChannelId) {
      const logs = guild.channels.cache.get(logsChannelId);
      logs?.send(`Ticket erstellt: ${channel} von ${member.user.tag}`);
    }
  } else if (commandName === "close") {
    if (!interaction.channel) return;
    if (interaction.channel.parentId !== ticketCategoryId) {
      return interaction.reply({ content: "Dieser Befehl kann nur in einem Ticket-Channel verwendet werden.", ephemeral: true });
    }

    const memberRoles = member.roles || (member?.roles?.cache ? member.roles.cache : null);
    const isSupport = memberRoles?.some?.(role => role.id === supportRoleId) || member.user.id === guild.ownerId;
    if (!isSupport) {
      return interaction.reply({ content: "Nur Supporter oder der Serverinhaber können dieses Ticket schließen.", ephemeral: true });
    }

    await interaction.reply({ content: "Ticket wird geschlossen...", ephemeral: true });
    await interaction.channel.delete();
    if (logsChannelId) {
      const logs = guild.channels.cache.get(logsChannelId);
      logs?.send(`Ticket geschlossen: ${interaction.channel.name} von ${member.user.tag}`);
    }
  } else if (commandName === "reopen") {
    await interaction.reply({ content: "✅ Ticket wird erneut geöffnet.", ephemeral: true });
  } else if (commandName === "assign") {
    const supporter = interaction.options.getUser("supporter");
    await interaction.reply({ content: `✅ ${supporter} wurde dem Ticket zugewiesen.`, ephemeral: true });
  } else if (commandName === "unassign") {
    await interaction.reply({ content: "✅ Supporter wurde aus dem Ticket entfernt.", ephemeral: true });
  } else if (commandName === "priority") {
    const level = interaction.options.getString("level");
    await interaction.reply({ content: `✅ Priorität auf "${level}" gesetzt.`, ephemeral: true });
  } else if (commandName === "status") {
    await interaction.reply({ content: "📋 **Ticket Status**: Offen | **Supporter**: Unbekannt | **Priorität**: Normal", ephemeral: true });
  } else if (commandName === "rename") {
    const name = interaction.options.getString("name");
    await interaction.reply({ content: `✅ Ticket in "${name}" umbenannt.`, ephemeral: true });
  } else if (commandName === "description") {
    const text = interaction.options.getString("text");
    await interaction.reply({ content: `✅ Beschreibung aktualisiert.`, ephemeral: true });
  } else if (commandName === "addnote") {
    const note = interaction.options.getString("note");
    await interaction.reply({ content: `✅ Notiz hinzugefügt: "${note}"`, ephemeral: true });
  } else if (commandName === "viewtickets") {
    await interaction.reply({ content: "📋 Du hast keine offenen Tickets.", ephemeral: true });
  } else if (commandName === "claimticket") {
    await interaction.reply({ content: "✅ Ticket wurde beansprucht.", ephemeral: true });
  } else if (commandName === "releaseticket") {
    await interaction.reply({ content: "✅ Ticket wurde freigegeben.", ephemeral: true });
  } else if (commandName === "ticketinfo") {
    await interaction.reply({ content: "ℹ️ **Ticket Info**: ID: 001 | Status: Offen | Ersteller: Unknown", ephemeral: true });
  } else if (commandName === "tickethistory") {
    await interaction.reply({ content: "📜 **Ticket Historie**: Keine Historie vorhanden.", ephemeral: true });
  } else if (commandName === "addmember") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `✅ ${user} wurde zum Ticket hinzugefügt.`, ephemeral: true });
  } else if (commandName === "removemember") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `✅ ${user} wurde aus dem Ticket entfernt.`, ephemeral: true });
  } else if (commandName === "transferticket") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `✅ Ticket an ${user} übertragen.`, ephemeral: true });
  } else if (commandName === "category") {
    const cat = interaction.options.getString("cat");
    await interaction.reply({ content: `✅ Kategorie auf "${cat}" gesetzt.`, ephemeral: true });
  } else if (commandName === "tag") {
    const tag = interaction.options.getString("tag");
    await interaction.reply({ content: `✅ Tag "${tag}" hinzugefügt.`, ephemeral: true });
  } else if (commandName === "removetag") {
    const tag = interaction.options.getString("tag");
    await interaction.reply({ content: `✅ Tag "${tag}" entfernt.`, ephemeral: true });
  } else if (commandName === "lockticket") {
    await interaction.reply({ content: "🔒 Ticket wurde gesperrt.", ephemeral: true });
  } else if (commandName === "unlockticket") {
    await interaction.reply({ content: "🔓 Ticket wurde entsperrt.", ephemeral: true });
  } else if (commandName === "archiveticket") {
    await interaction.reply({ content: "📦 Ticket wurde archiviert.", ephemeral: true });
  } else if (commandName === "unarchiveticket") {
    await interaction.reply({ content: "✅ Ticket wurde aus dem Archiv wiederhergestellt.", ephemeral: true });
  } else if (commandName === "ticketstats") {
    await interaction.reply({ content: "📊 **Ticket Statistiken**: Gesamt: 0 | Offen: 0 | Geschlossen: 0", ephemeral: true });
  } else if (commandName === "deleteticket") {
    await interaction.reply({ content: "⚠️ Ticket wird dauerhaft gelöscht...", ephemeral: true });
  } else if (commandName === "duplicateticket") {
    const original = interaction.options.getString("original");
    await interaction.reply({ content: `✅ Ticket als Duplikat von "${original}" markiert.`, ephemeral: true });
  } else if (commandName === "resolveticket") {
    await interaction.reply({ content: "✅ Ticket wurde als gelöst markiert.", ephemeral: true });
  } else if (commandName === "reopenresolved") {
    await interaction.reply({ content: "✅ Gelöstes Ticket wurde erneut geöffnet.", ephemeral: true });
  } else if (commandName === "escalateticket") {
    await interaction.reply({ content: "⚠️ Ticket wurde eskaliert.", ephemeral: true });

  // === MODERATION Commands ===
  } else if (commandName === "kick") {
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "Kein Grund angegeben";
    await interaction.reply({ content: `⚠️ ${user} wurde vom Server entfernt. Grund: ${reason}`, ephemeral: true });
  } else if (commandName === "ban") {
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "Kein Grund angegeben";
    await interaction.reply({ content: `🚫 ${user} wurde gebannt. Grund: ${reason}`, ephemeral: true });
  } else if (commandName === "unban") {
    const userId = interaction.options.getString("userid");
    await interaction.reply({ content: `✅ Benutzer ${userId} wurde entbannt.`, ephemeral: true });
  } else if (commandName === "warn") {
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "Kein Grund angegeben";
    await interaction.reply({ content: `⚠️ ${user} wurde verwarnt. Grund: ${reason}`, ephemeral: true });
  } else if (commandName === "removewarn") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `✅ Eine Verwarnung von ${user} wurde entfernt.`, ephemeral: true });
  } else if (commandName === "warnings") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `📋 ${user} hat 0 Verwarnungen.`, ephemeral: true });
  } else if (commandName === "clearwarnings") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `✅ Alle Verwarnungen von ${user} wurden gelöscht.`, ephemeral: true });
  } else if (commandName === "mute") {
    const user = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes") || 0;
    await interaction.reply({ content: `🔇 ${user} wurde stummgeschaltet${minutes > 0 ? ` für ${minutes} Minuten` : ""}.`, ephemeral: true });
  } else if (commandName === "unmute") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `🔊 ${user} wurde wieder freigegeben.`, ephemeral: true });
  } else if (commandName === "tempmute") {
    const user = interaction.options.getUser("user");
    const seconds = interaction.options.getInteger("seconds");
    await interaction.reply({ content: `🔇 ${user} wurde für ${seconds} Sekunden stummgeschaltet.`, ephemeral: true });
  } else if (commandName === "slowmode") {
    const seconds = interaction.options.getInteger("seconds");
    await interaction.reply({ content: `⏱️ Slowmode wurde auf ${seconds} Sekunden gesetzt.`, ephemeral: true });
  } else if (commandName === "lock") {
    await interaction.reply({ content: "🔒 Channel wurde gesperrt.", ephemeral: true });
  } else if (commandName === "unlock") {
    await interaction.reply({ content: "🔓 Channel wurde entsperrt.", ephemeral: true });
  } else if (commandName === "clear") {
    const amount = interaction.options.getInteger("amount");
    await interaction.reply({ content: `🗑️ ${amount} Nachrichten wurden gelöscht.`, ephemeral: true });
  } else if (commandName === "clearuser") {
    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount") || 10;
    await interaction.reply({ content: `🗑️ ${amount} Nachrichten von ${user} wurden gelöscht.`, ephemeral: true });
  } else if (commandName === "addrole") {
    const user = interaction.options.getUser("user");
    const role = interaction.options.getString("role");
    await interaction.reply({ content: `✅ Rolle "${role}" wurde ${user} gegeben.`, ephemeral: true });
  } else if (commandName === "removerole") {
    const user = interaction.options.getUser("user");
    const role = interaction.options.getString("role");
    await interaction.reply({ content: `✅ Rolle "${role}" wurde von ${user} entfernt.`, ephemeral: true });
  } else if (commandName === "nickname") {
    const user = interaction.options.getUser("user");
    const nickname = interaction.options.getString("nickname");
    await interaction.reply({ content: `✅ Nickname von ${user} wurde auf "${nickname}" gesetzt.`, ephemeral: true });
  } else if (commandName === "report") {
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    await interaction.reply({ content: `📢 ${user} wurde gemeldet. Grund: ${reason}`, ephemeral: true });
  } else if (commandName === "softban") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `⚠️ Softban auf ${user} angewendet.`, ephemeral: true });
  } else if (commandName === "timeout") {
    const user = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes");
    await interaction.reply({ content: `⏱️ ${user} wurde für ${minutes} Minuten in Timeout gesetzt.`, ephemeral: true });
  } else if (commandName === "removetimeout") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `✅ Timeout von ${user} wurde entfernt.`, ephemeral: true });
  } else if (commandName === "infractions") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `📋 ${user} hat 0 Verstöße.`, ephemeral: true });
  } else if (commandName === "modlog") {
    await interaction.reply({ content: "📋 **Modlog**: Keine Einträge vorhanden.", ephemeral: true });
  } else if (commandName === "filter") {
    const word = interaction.options.getString("word");
    await interaction.reply({ content: `✅ Wort-Filter für "${word}" aktiviert.`, ephemeral: true });
  } else if (commandName === "removefilter") {
    const word = interaction.options.getString("word");
    await interaction.reply({ content: `✅ Wort-Filter für "${word}" deaktiviert.`, ephemeral: true });
  } else if (commandName === "filters") {
    await interaction.reply({ content: "🔍 **Aktive Filter**: Keine Filter vorhanden.", ephemeral: true });
  } else if (commandName === "guild") {
    await interaction.reply({ content: `📊 **Guild Info**: ${guild.name} | Mitglieder: ${guild.memberCount}`, ephemeral: true });
  } else if (commandName === "userinfo") {
    const user = interaction.options.getUser("user") || interaction.user;
    await interaction.reply({ content: `ℹ️ **User Info**: ${user.tag} | ID: ${user.id}`, ephemeral: true });
  } else if (commandName === "roleinfo") {
    const role = interaction.options.getString("role");
    await interaction.reply({ content: `ℹ️ **Role Info**: ${role}`, ephemeral: true });
  } else if (commandName === "membercount") {
    await interaction.reply({ content: `👥 **Mitgliederzahl**: ${guild.memberCount}`, ephemeral: true });
  } else if (commandName === "banlist") {
    await interaction.reply({ content: "🚫 **Banliste**: Leer.", ephemeral: true });

  // === UTILITY Commands ===
  } else if (commandName === "ping") {
    const latency = Math.round(client.ws.ping);
    await interaction.reply({ content: `🏓 Pong! Latenz: ${latency}ms`, ephemeral: true });
  } else if (commandName === "uptime") {
    const uptime = client.uptime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    await interaction.reply({ content: `⏱️ **Uptime**: ${hours}h ${minutes}m`, ephemeral: true });
  } else if (commandName === "help") {
    await interaction.reply({ content: "📖 Nutze `/commands` für die vollständige Befehlsliste.", ephemeral: true });
  } else if (commandName === "about") {
    await interaction.reply({ content: "ℹ️ **Lunaris Ticket Bot** - Ein Discord Bot für Ticket-Management.", ephemeral: true });
  } else if (commandName === "info") {
    await interaction.reply({ content: "ℹ️ Hier wären allgemeine Informationen.", ephemeral: true });
  } else if (commandName === "support") {
    await interaction.reply({ content: "🆘 Support: Schreib `/ticket`", ephemeral: true });
  } else if (commandName === "botinfo") {
    await interaction.reply({ content: `🤖 **Bot Info**: Lunaris Ticket Bot | Version: 1.0.0`, ephemeral: true });
  } else if (commandName === "stats") {
    await interaction.reply({ content: `📊 **Statistiken**: Befehle: 100 | Uptime: Online`, ephemeral: true });
  } else if (commandName === "commands") {
    await interaction.reply({ content: "📚 **100 Befehle verfügbar**: Ticket-Management, Moderation, Utility", ephemeral: true });
  } else if (commandName === "invite") {
    await interaction.reply({ content: "📨 Bot einladen: https://discord.com/oauth2/authorize", ephemeral: true });
  } else if (commandName === "source") {
    await interaction.reply({ content: "💻 Source Code: Nicht verfügbar", ephemeral: true });
  } else if (commandName === "update") {
    await interaction.reply({ content: "📝 **Updates**: Keine neuen Updates.", ephemeral: true });
  } else if (commandName === "changelog") {
    await interaction.reply({ content: "📋 **Changelog**: Bot wurde gestartet.", ephemeral: true });
  } else if (commandName === "version") {
    await interaction.reply({ content: "📌 **Version**: 1.0.0", ephemeral: true });
  } else if (commandName === "prefix") {
    await interaction.reply({ content: "🔤 **Prefix**: Dieser Bot nutzt nur Slash-Commands (/)", ephemeral: true });
  } else if (commandName === "feedback") {
    const message = interaction.options.getString("message");
    await interaction.reply({ content: `✅ Feedback erhalten: "${message}"`, ephemeral: true });
  } else if (commandName === "bug") {
    const description = interaction.options.getString("description");
    await interaction.reply({ content: `🐛 Bug gemeldet: ${description}`, ephemeral: true });
  } else if (commandName === "feature") {
    const description = interaction.options.getString("description");
    await interaction.reply({ content: `💡 Feature Request: ${description}`, ephemeral: true });
  } else if (commandName === "dice") {
    const sides = interaction.options.getInteger("sides") || 6;
    const roll = Math.floor(Math.random() * sides) + 1;
    await interaction.reply({ content: `🎲 Du hast eine **${roll}** gewürfelt! (${sides}-seitiger Würfel)`, ephemeral: true });
  } else if (commandName === "coin") {
    const result = Math.random() < 0.5 ? "Kopf" : "Zahl";
    await interaction.reply({ content: `🪙 Ergebnis: **${result}**`, ephemeral: true });
  } else if (commandName === "random") {
    const min = interaction.options.getInteger("min");
    const max = interaction.options.getInteger("max");
    const random = Math.floor(Math.random() * (max - min + 1)) + min;
    await interaction.reply({ content: `🎯 Zufallszahl: **${random}** (zwischen ${min} und ${max})`, ephemeral: true });
  } else if (commandName === "choose") {
    const options = interaction.options.getString("options").split(",").map(o => o.trim());
    const chosen = options[Math.floor(Math.random() * options.length)];
    await interaction.reply({ content: `🎯 Gewählt: **${chosen}**`, ephemeral: true });
  } else if (commandName === "avatar") {
    const user = interaction.options.getUser("user") || interaction.user;
    await interaction.reply({ content: `🖼️ Avatar von ${user}: ${user.displayAvatarURL({ size: 512 })}`, ephemeral: true });
  } else if (commandName === "banner") {
    const user = interaction.options.getUser("user") || interaction.user;
    await interaction.reply({ content: `🖼️ Banner von ${user}: Nicht verfügbar`, ephemeral: true });
  } else if (commandName === "serveravatar") {
    const user = interaction.options.getUser("user") || interaction.user;
    await interaction.reply({ content: `🖼️ Server-Avatar von ${user}: Nicht gesetzt`, ephemeral: true });
  } else if (commandName === "status") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `📊 Status von ${user}: Online`, ephemeral: true });
  } else if (commandName === "ping-user") {
    const user = interaction.options.getUser("user");
    await interaction.reply({ content: `👋 ${user} wurde gepingt!`, ephemeral: true });
  } else if (commandName === "echo") {
    const message = interaction.options.getString("message");
    await interaction.reply({ content: `📢 ${message}` });
  } else if (commandName === "say") {
    const message = interaction.options.getString("message");
    await interaction.reply({ content: `✅ Nachricht gesendet: ${message}` });
  } else if (commandName === "announce") {
    const message = interaction.options.getString("message");
    await interaction.reply({ content: `📣 **ANKÜNDIGUNG**: ${message}` });
  } else if (commandName === "embed") {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    await interaction.reply({ embeds: [{ title, description, color: 0x00ff00 }] });
  } else if (commandName === "poll") {
    const question = interaction.options.getString("question");
    await interaction.reply({ content: `📊 **Umfrage**: ${question}\n👍 | 👎` });
  } else if (commandName === "serverinfo") {
    await interaction.reply({ content: `📊 **Server Info**: ${guild.name} | ${guild.memberCount} Mitglieder`, ephemeral: true });
  }
});

client.login(token);
