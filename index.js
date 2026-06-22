const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType
} = require('discord.js');

let config = {};
const CONFIG_PATH = path.join(__dirname, 'config.json');
if (fs.existsSync(CONFIG_PATH)) {
  config = require(CONFIG_PATH);
}
const TICKET_FILE = path.join(__dirname, 'tickets.json');
const GIVEAWAY_FILE = path.join(__dirname, 'giveaways.json');
const giveawayTimeouts = new Map();
let guild = null;

config = {
  token: null,
  guildId: null,
  ticketCategoryId: null,
  logChannelId: null,
  staffRoleId: null,
  welcomeChannelId: null,
  welcomeMessage: 'Welcome to Lunaris Hub V3, where we chill, chat and play, {user}!',
  antiRaidEnabled: true,
  antiRaidThreshold: 5,
  antiRaidWindowSeconds: 20,
  antiRaidAction: 'kick',
  raidLogChannelId: null,
  ticketCooldownSeconds: 30,
  verifyRoleId: null,
  ...config,
  token: process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || config.token,
  guildId: process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || config.guildId,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || process.env.TICKET_CATEGORY_ID || config.ticketCategoryId,
  logChannelId: process.env.LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID || config.logChannelId,
  staffRoleId: process.env.STAFF_ROLE_ID || process.env.STAFF_ROLE_ID || config.staffRoleId,
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || process.env.WELCOME_CHANNEL_ID || config.welcomeChannelId,
  welcomeMessage: process.env.WELCOME_MESSAGE || config.welcomeMessage,
  antiRaidEnabled: typeof process.env.ANTI_RAID_ENABLED !== 'undefined' ? process.env.ANTI_RAID_ENABLED === 'true' : config.antiRaidEnabled,
  antiRaidThreshold: process.env.ANTI_RAID_THRESHOLD ? parseInt(process.env.ANTI_RAID_THRESHOLD, 10) : config.antiRaidThreshold,
  antiRaidWindowSeconds: process.env.ANTI_RAID_WINDOW_SECONDS ? parseInt(process.env.ANTI_RAID_WINDOW_SECONDS, 10) : config.antiRaidWindowSeconds,
  antiRaidAction: process.env.ANTI_RAID_ACTION || config.antiRaidAction,
  raidLogChannelId: process.env.RAID_LOG_CHANNEL_ID || config.raidLogChannelId,
  ticketCooldownSeconds: process.env.TICKET_COOLDOWN_SECONDS ? parseInt(process.env.TICKET_COOLDOWN_SECONDS, 10) : config.ticketCooldownSeconds,
  verifyRoleId: process.env.VERIFY_ROLE_ID || config.verifyRoleId
};

const raidEvents = new Map();
const ticketCooldowns = new Map(); // userId -> timestamp
// additional staff role IDs (from user)
const STAFF_ROLE_IDS = ['1517239911785169087','1499940625406103674'];

const categories = [
  { label: 'Support', value: 'support', description: 'General support', emoji: '🛠', color: 0x8b7fff },
  { label: 'VIP', value: 'vip', description: 'VIP requests', emoji: '👑', color: 0xf59e0b },
  { label: 'Bug Report', value: 'bug', description: 'Report a bug', emoji: '🐛', color: 0xf87171 },
  { label: 'Suggestion', value: 'suggestion', description: 'Submit an idea', emoji: '💡', color: 0x4ade80 },
  { label: 'Pack Request', value: 'pack', description: 'Request a pack', emoji: '📦', color: 0x38bdf8 }
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

const commands = [
  { name: 'ticket-panel', description: 'Send the ticket panel in this channel' },
  {
    name: 'close',
    description: 'Close the current ticket',
    options: [{ name: 'reason', description: 'Reason for closing', type: 3, required: false }]
  },
  {
    name: 'add',
    description: 'Add a user to the ticket',
    default_member_permissions: PermissionsBitField.Flags.ManageChannels,
    options: [{ name: 'user', description: 'User', type: 6, required: true }]
  },
  {
    name: 'remove',
    description: 'Remove a user from the ticket',
    default_member_permissions: PermissionsBitField.Flags.ManageChannels,
    options: [{ name: 'user', description: 'User', type: 6, required: true }]
  },
  {
    name: 'set-welcome-channel',
    description: 'Set the welcome channel',
    default_member_permissions: PermissionsBitField.Flags.Administrator,
    options: [{ name: 'channel', description: 'Welcome channel', type: 7, required: true }]
  },
  {
    name: 'set-welcome-message',
    description: 'Save the welcome message',
    default_member_permissions: PermissionsBitField.Flags.Administrator,
    options: [{ name: 'message', description: 'Message', type: 3, required: true }]
  },
  { name: 'welcome-status', description: 'Show welcome settings' },
  {
    name: 'set-raid-channel',
    description: 'Set the raid log channel',
    default_member_permissions: PermissionsBitField.Flags.Administrator,
    options: [{ name: 'channel', description: 'Raid channel', type: 7, required: true }]
  },
  {
    name: 'set-raid-threshold',
    description: 'Set the anti-raid threshold',
    default_member_permissions: PermissionsBitField.Flags.Administrator,
    options: [{ name: 'threshold', description: 'New joins in 20 sec', type: 4, required: true }]
  },
  {
    name: 'set-raid-action',
    description: 'Set the anti-raid action',
    default_member_permissions: PermissionsBitField.Flags.Administrator,
    options: [
      {
        name: 'action',
        description: 'Action on raid',
        type: 3,
        required: true,
        choices: [
          { name: 'Kick', value: 'kick' },
          { name: 'Ban', value: 'ban' }
        ]
      }
    ]
  },
  { name: 'anti-raid-status', description: 'Show anti-raid status' },
  {
    name: 'stop',
    description: 'Stop the bot safely',
    default_member_permissions: PermissionsBitField.Flags.Administrator
  }
  ,
  {
    name: 'set-verify-role',
    description: 'Set role to assign on verification',
    default_member_permissions: PermissionsBitField.Flags.Administrator,
    options: [{ name: 'role', description: 'Role', type: 8, required: true }]
  }
  ,
  {
    name: 'test-welcome',
    description: 'Preview/send the welcome message for a user',
    default_member_permissions: PermissionsBitField.Flags.Administrator,
    options: [{ name: 'user', description: 'User to preview (optional)', type: 6, required: false }]
  },
  {
    name: 'giveaway',
    description: 'Create or end a giveaway',
    default_member_permissions: PermissionsBitField.Flags.Administrator,
    options: [
      {
        name: 'start',
        type: 1,
        description: 'Start a new giveaway',
        options: [
          { name: 'duration', description: 'Duration in minutes', type: 4, required: true },
          { name: 'prize', description: 'Prize description', type: 3, required: true },
          { name: 'winners', description: 'Number of winners', type: 4, required: false }
        ]
      },
      {
        name: 'end',
        type: 1,
        description: 'End the active giveaway now'
      }
    ]
  }
];

function loadTickets() {
  if (!fs.existsSync(TICKET_FILE)) {
    return { count: 0, open: {} };
  }
  return JSON.parse(fs.readFileSync(TICKET_FILE, 'utf8'));
}

function saveTickets(data) {
  fs.writeFileSync(TICKET_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function saveConfig(data) {
  fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(data, null, 2), 'utf8');
  config = data;
}

function loadGiveaways() {
  if (!fs.existsSync(GIVEAWAY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(GIVEAWAY_FILE, 'utf8')) || [];
  } catch {
    return [];
  }
}

function saveGiveaways(data) {
  fs.writeFileSync(GIVEAWAY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function findGiveawayById(id) {
  return loadGiveaways().find(g => g.id === id);
}

function findActiveGiveawayByChannel(channelId) {
  return loadGiveaways().find(g => g.channelId === channelId && !g.endedAt);
}

function buildGiveawayEmbed(giveaway) {
  const embed = new EmbedBuilder()
    .setTitle(giveaway.endedAt ? `🎉 Giveaway ended: ${giveaway.prize}` : `🎉 Giveaway: ${giveaway.prize}`)
    .setColor(giveaway.endedAt ? 0xf0b232 : 0x5865f2)
    .setDescription(giveaway.endedAt ? 'The giveaway has ended.' : 'Click the button below to join the giveaway!')
    .addFields(
      { name: 'Prize', value: giveaway.prize, inline: false },
      { name: 'Winners', value: `${giveaway.winners}`, inline: true },
      { name: 'Entries', value: `${giveaway.entries?.length || 0}`, inline: true },
      { name: 'Host', value: `<@${giveaway.creatorId}>`, inline: true }
    )
    .setFooter({ text: 'Lunaris Giveaway' })
    .setTimestamp();

  if (!giveaway.endedAt) {
    embed.addFields({ name: 'Ends', value: `<t:${Math.floor(giveaway.endAt / 1000)}:R>`, inline: false });
  } else {
    const winners = giveaway.winnerIds?.length ? giveaway.winnerIds.map(id => `<@${id}>`).join(', ') : 'No winners';
    embed.addFields({ name: 'Winners', value: winners, inline: false });
  }

  return embed;
}

function buildGiveawayComponents(giveaway) {
  const joinButton = new ButtonBuilder()
    .setCustomId(`giveaway_join_${giveaway.id}`)
    .setLabel(giveaway.endedAt ? 'Giveaway ended' : 'Join Giveaway')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!!giveaway.endedAt);

  const endButton = new ButtonBuilder()
    .setCustomId(`giveaway_end_${giveaway.id}`)
    .setLabel('End Giveaway')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(!!giveaway.endedAt);

  return [new ActionRowBuilder().addComponents(joinButton, endButton)];
}

async function updateGiveawayMessage(giveaway) {
  if (!giveaway.messageId) return;
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [buildGiveawayEmbed(giveaway)], components: buildGiveawayComponents(giveaway) }).catch(() => null);
}

async function endGiveaway(id, endedBy = null) {
  const giveaways = loadGiveaways();
  const giveaway = giveaways.find(g => g.id === id);
  if (!giveaway || giveaway.endedAt) return;
  giveaway.endedAt = Date.now();
  giveaway.endedBy = endedBy || giveaway.creatorId;
  const entries = [...new Set(giveaway.entries || [])];
  const winnerCount = Math.min(giveaway.winners, entries.length);
  const winners = [];
  for (let i = 0; i < winnerCount; i += 1) {
    const index = Math.floor(Math.random() * entries.length);
    winners.push(entries.splice(index, 1)[0]);
  }
  giveaway.winnerIds = winners;
  saveGiveaways(giveaways);

  if (giveawayTimeouts.has(id)) {
    clearTimeout(giveawayTimeouts.get(id));
    giveawayTimeouts.delete(id);
  }

  await updateGiveawayMessage(giveaway);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel && channel.isTextBased()) {
    const endEmbed = new EmbedBuilder()
      .setTitle('🎉 Giveaway ended')
      .setColor(0x8b7fff)
      .setDescription(`Prize: ${giveaway.prize}`)
      .addFields(
        { name: 'Entries', value: `${giveaway.entries?.length || 0}`, inline: true },
        { name: 'Winners', value: winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'No winners', inline: false },
        { name: 'Ended by', value: `<@${giveaway.endedBy}>`, inline: true }
      )
      .setTimestamp();
    channel.send({ embeds: [endEmbed] }).catch(() => null);
  }
}

function scheduleGiveaway(giveaway) {
  const delay = giveaway.endAt - Date.now();
  if (delay <= 0) {
    endGiveaway(giveaway.id);
    return;
  }
  if (giveawayTimeouts.has(giveaway.id)) {
    clearTimeout(giveawayTimeouts.get(giveaway.id));
  }
  giveawayTimeouts.set(giveaway.id, setTimeout(() => endGiveaway(giveaway.id), delay));
}

function scheduleAllGiveaways() {
  loadGiveaways().filter(g => !g.endedAt).forEach(scheduleGiveaway);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const days = Math.floor(totalMinutes / 1440);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function isStaff(member) {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (config.staffRoleId) {
    return member.roles.cache.has(config.staffRoleId);
  }
  return false;
}

function hasAnyRole(member, roleIds) {
  if (!member || !member.roles) return false;
  const ids = Array.isArray(roleIds) ? roleIds : [roleIds];
  return member.roles.cache.some(r => ids.includes(r.id));
}

// extend isStaff to consider STAFF_ROLE_IDS
const _origIsStaff = isStaff;
function isStaffExtended(member) {
  if (_origIsStaff(member)) return true;
  if (hasAnyRole(member, STAFF_ROLE_IDS)) return true;
  return false;
}

function getRecentJoins(guild) {
  const now = Date.now();
  const windowMs = (config.antiRaidWindowSeconds || 20) * 1000;
  const cutoff = now - windowMs;
  const recent = (raidEvents.get(guild.id) || []).filter(ts => ts >= cutoff);
  recent.push(now);
  raidEvents.set(guild.id, recent);
  return recent;
}

async function handleGuildMemberAdd(member) {
  if (!member.guild) return;

  let isRaid = false;
  if (config.antiRaidEnabled) {
    const recentJoins = getRecentJoins(member.guild);
    if (recentJoins.length >= (config.antiRaidThreshold || 5)) {
      isRaid = true;
      const action = config.antiRaidAction === 'ban' ? 'ban' : 'kick';
      const reason = 'Anti-raid protection triggered';
      try {
        if (action === 'ban') {
          await member.ban({ reason });
        } else {
          await member.kick(reason);
        }
      } catch (error) {
        console.warn('⚠️ Anti-raid action failed:', error);
      }

      const raidEmbed = new EmbedBuilder()
        .setTitle('🚨 Anti-raid triggered')
        .setDescription(`**Action:** ${action}\n**User:** ${member.user.tag}\n**Reason:** ${reason}`)
        .setColor(0xf87171)
        .setTimestamp();

      const logChannel = config.raidLogChannelId ? member.guild.channels.cache.get(config.raidLogChannelId) : null;
      if (logChannel) {
        logChannel.send({ embeds: [raidEmbed] }).catch(() => null);
      }
    }
  }

  if (!isRaid && config.welcomeChannelId) {
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (channel) {
      const payload = buildWelcomePayload(member);
      channel.send(payload).catch(() => null);
    }
  }
}

function makeTicketTopic(userId, ticketNumber) {
  return `ticket|user:${userId}|num:${ticketNumber}`;
}

function buildWelcomePayload(member) {
  const message = (config.welcomeMessage || 'Welcome to Lunaris Hub V3, where we chill, chat and play, {user}!').replace('{user}', `<@${member.id}>`);
  const embed = new EmbedBuilder()
    .setTitle('👋 Welcome to Lunaris Hub V3')
    .setDescription(message)
    .setColor(0x8b7fff)
    .setThumbnail(member.user.displayAvatarURL ? member.user.displayAvatarURL({ size: 128 }) : null)
    .setTimestamp()
    .setFooter({ text: 'Lunaris Hub V3' });

  const components = [];
  if (config.verifyRoleId) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('✅ Verify')
        .setStyle(ButtonStyle.Primary)
    );
    components.push(row);
  }

  return { embeds: [embed], components };
}

async function generateTranscript(channel) {
  const parts = [];
  try {
    let lastId = null;
    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const messages = await channel.messages.fetch(options);
      if (!messages || messages.size === 0) break;
      messages.forEach(m => parts.push(m));
      lastId = messages.last().id;
      if (messages.size < 100) break;
    }
  } catch (e) {
    // ignore fetch errors
  }

  // sort chronologically
  parts.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = parts.map(m => {
    const time = new Date(m.createdTimestamp).toISOString();
    const author = m.author ? `${m.author.tag}` : 'Unknown';
    let content = m.content || '';
    if (m.attachments && m.attachments.size) {
      const att = Array.from(m.attachments.values()).map(a => a.url).join(' ');
      content = content ? `${content} [Attachments: ${att}]` : `[Attachments: ${att}]`;
    }
    return `${time} | ${author}: ${content}`;
  });

  const text = lines.join('\n');
  const buffer = Buffer.from(text, 'utf8');
  const name = `transcript-${channel.name}-${Date.now()}.txt`;
  return { buffer, name };
}

function buildTicketPanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_category')
    .setPlaceholder('📂 Choose a category...')
    .addOptions(categories.map(cat => ({
      label: cat.label,
      value: cat.value,
      description: cat.description,
      emoji: cat.emoji
    })));

  return [
    new ActionRowBuilder().addComponents(menu)
  ];
}

function buildTicketButtons() {
  return [
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🔒 Close ticket')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('claim_ticket')
        .setLabel('👤 Claim')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('add_user_ticket')
        .setLabel('📌 Add user')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} is online!`);
   console.log(`🔧 guildId=${config.guildId}`);
   console.log(`🔧 token=${config.token ? 'yes' : 'no'}`);
  if (!guild) {
    try {
      guild = await client.guilds.fetch(config.guildId);
    } catch (err) {
      console.warn('⚠️ Guild fetch failed:', err?.message || err);
    }
  }

  if (!guild) {
    console.warn('⚠️ Guild ID not found. Make sure the bot is in the server. Attempting global registration...');
    try {
      await client.application.commands.set(commands);
      console.log('✅ Global Slash-Commands registered.');
    } catch (err) {
      console.error('❌ Failed to register global commands:', err);
    }
    return;
  }

  try {
    await guild.commands.set(commands);
    console.log('✅ Slash-Commands registered for guild.');
    scheduleAllGiveaways();
  } catch (err) {
    console.error('❌ Failed to register guild commands:', err, 'Attempting global registration...');
    try {
      await client.application.commands.set(commands);
      console.log('✅ Global Slash-Commands registered.');
      scheduleAllGiveaways();
    } catch (e) {
      console.error('❌ Failed to register global commands:', e);
    }
  }
});

client.on('guildMemberAdd', handleGuildMemberAdd);

async function createTicket(interaction, category, subject, description) {
  const guild = interaction.guild;
  const tickets = loadTickets();

  try {
    // cooldown
    const last = ticketCooldowns.get(interaction.user.id) || 0;
    const now = Date.now();
    const cooldownMs = (config.ticketCooldownSeconds || 30) * 1000;
    if (now - last < cooldownMs) {
      const wait = Math.ceil((cooldownMs - (now - last)) / 1000);
      return interaction.followUp({ content: `❌ Please wait ${wait}s before creating another ticket.`, ephemeral: true });
    }

    // prevent duplicate by checking saved tickets
    for (const [channelId, ticket] of Object.entries(tickets.open)) {
      if (ticket.userId === interaction.user.id) {
        const existing = guild.channels.cache.get(channelId);
        if (existing) {
          return interaction.followUp({ content: `❌ You already have an open ticket: ${existing}`, ephemeral: true });
        }
      }
    }

  for (const [channelId, ticket] of Object.entries(tickets.open)) {
    if (ticket.userId === interaction.user.id) {
      const existing = guild.channels.cache.get(channelId);
      if (existing) {
        return interaction.followUp({ content: `❌ You already have an open ticket: ${existing}`, ephemeral: true });
      }
    }
  }

  tickets.count += 1;
  const ticketNumber = tickets.count;
  const name = `ticket-${String(ticketNumber).padStart(4, '0')}-${interaction.user.username.toLowerCase().slice(0, 10)}`;

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    }
  ];

  if (config.staffRoleId) {
    overwrites.push({
      id: config.staffRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    });
  }

  const categoryChannel = config.ticketCategoryId ? guild.channels.cache.get(config.ticketCategoryId) : null;
    const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: categoryChannel ? categoryChannel.id : undefined,
    permissionOverwrites: overwrites
  });

  tickets.open[channel.id] = {
    userId: interaction.user.id,
    category,
    subject,
    number: ticketNumber,
    createdAt: new Date().toISOString(),
    claimedBy: null
  };
  saveTickets(tickets);

  const categoryData = categories.find(c => c.value === category) ?? categories[0];
  const embed = new EmbedBuilder()
    .setTitle(`${categoryData.emoji} ${categoryData.label} — Ticket #${String(ticketNumber).padStart(4, '0')}`)
    .setColor(0x8b7fff)
    .setThumbnail(interaction.user.displayAvatarURL ? interaction.user.displayAvatarURL({ size: 128 }) : null)
    .addFields(
      { name: '👤 User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: '🕒 Created', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
      { name: '📌 Status', value: 'Open', inline: true },
      { name: '📋 Subject', value: subject ? (subject.length > 250 ? subject.slice(0, 247) + '...' : subject) : 'No subject', inline: false },
      { name: '📝 Description', value: description ? (description.length > 1000 ? description.slice(0, 997) + '...' : description) : 'No description', inline: false }
    )
    .setFooter({ text: `Lunaris Hub V3 · ${makeTicketTopic(interaction.user.id, ticketNumber)}` })
    .setTimestamp();

    // set a stable topic so we can identify the ticket-channel reliably
    try {
      await channel.setTopic(makeTicketTopic(interaction.user.id, ticketNumber)).catch(() => null);
    } catch (e) {
      // ignore
    }

    // update cooldown
    ticketCooldowns.set(interaction.user.id, Date.now());

    await channel.send({ content: `${interaction.user} | Ticket erstellt ✅`, embeds: [embed], components: buildTicketButtons() });
    await interaction.followUp({ content: `✅ Dein Ticket wurde erstellt: ${channel}`, ephemeral: true });

  if (config.logChannelId) {
    const logChannel = guild.channels.cache.get(config.logChannelId);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🎫 Ticket opened')
        .setDescription(`**User:** ${interaction.user}\n**Channel:** ${channel}\n**Category:** ${categoryData.label}`)
        .setColor(0x8b7fff)
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }
  }
  } catch (err) {
    console.error('Error creating ticket:', err);
    return interaction.followUp({ content: '❌ Failed to create ticket. Please contact staff.', ephemeral: true });
  }
}

async function closeTicket(interaction, reason = 'No reason provided') {
  const tickets = loadTickets();
  const channelId = interaction.channel.id;

  if (!tickets.open[channelId]) {
    return interaction.followUp({ content: '❌ This is not an open ticket.', ephemeral: true });
  }

  const ticket = tickets.open[channelId];
  const user = await client.users.fetch(ticket.userId).catch(() => null);

  if (user) {
    const dmEmbed = new EmbedBuilder()
      .setTitle(`🔒 Ticket #${String(ticket.number).padStart(4, '0')} closed`)
      .setDescription(`**Subject:** ${ticket.subject}\n**Reason:** ${reason}\n\nIf you have more questions, please open a new ticket.`)
      .setColor(0x8b7fff)
      .setTimestamp();
    user.send({ embeds: [dmEmbed] }).catch(() => null);
  }

  delete tickets.open[channelId];
  saveTickets(tickets);

  const closeEmbed = new EmbedBuilder()
    .setTitle('🔒 Ticket is closing')
    .setDescription(`**Closed by:** ${interaction.user}\n**Reason:** ${reason}`)
    .setColor(0x8b7fff);

  await interaction.followUp({ embeds: [closeEmbed], components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('delete_ticket')
        .setLabel('🗑 Delete ticket')
        .setStyle(ButtonStyle.Danger)
    )
  ] });
}

client.on('interactionCreate', async (interaction) => {
  try {
  if (interaction.isChatInputCommand()) {
    const cmd = interaction.commandName;

    switch (cmd) {
      case 'ticket-panel': {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🌙 Lunaris Hub — Support')
              .setDescription('Choose a ticket category to open a new ticket. Our team will help you as soon as possible.')
              .setColor(0x8b7fff)
          ],
          components: buildTicketPanel(),
          ephemeral: false
        });
      }

      case 'close': {
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        await interaction.reply({ content: '🔒 Closing ticket...', ephemeral: true });
        return closeTicket(interaction, reason);
      }

      case 'add': {
        const user = interaction.options.getMember('user') || await interaction.guild.members.fetch(interaction.options.getUser('user').id).catch(() => null);
        if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true
        });
        return interaction.reply({ content: `✅ ${user} was added.`, ephemeral: true });
      }

      case 'remove': {
        const user = interaction.options.getMember('user') || await interaction.guild.members.fetch(interaction.options.getUser('user').id).catch(() => null);
        if (!user) return interaction.reply({ content: '❌ User not found.', ephemeral: true });
        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: false,
          SendMessages: false
        });
        return interaction.reply({ content: `✅ ${user} was removed.`, ephemeral: true });
      }

      case 'set-welcome-channel': {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
        const channel = interaction.options.getChannel('channel');
        saveConfig({ ...config, welcomeChannelId: channel.id });
        return interaction.reply({ content: `✅ Welcome channel set: ${channel}`, ephemeral: true });
      }

      case 'set-welcome-message': {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
        const message = interaction.options.getString('message');
        saveConfig({ ...config, welcomeMessage: message });
        return interaction.reply({ content: '✅ Welcome message saved.', ephemeral: true });
      }

      case 'welcome-status': {
        return interaction.reply({ content: `Welcome channel: ${config.welcomeChannelId || 'Not set'}\nMessage: ${config.welcomeMessage || 'Not set'}`, ephemeral: true });
      }

      case 'set-raid-channel': {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Nur Admins.', ephemeral: true });
        const channel = interaction.options.getChannel('channel');
        saveConfig({ ...config, raidLogChannelId: channel.id });
        return interaction.reply({ content: `✅ Raid log channel set: ${channel}`, ephemeral: true });
      }

      case 'set-raid-threshold': {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Nur Admins.', ephemeral: true });
        const threshold = interaction.options.getInteger('threshold');
        saveConfig({ ...config, antiRaidThreshold: threshold });
        return interaction.reply({ content: `✅ Anti-raid threshold set: ${threshold}`, ephemeral: true });
      }

      case 'set-raid-action': {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Nur Admins.', ephemeral: true });
        const action = interaction.options.getString('action');
        saveConfig({ ...config, antiRaidAction: action });
        return interaction.reply({ content: `✅ Anti-raid action set: ${action}`, ephemeral: true });
      }

      case 'set-verify-role': {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
        const role = interaction.options.getRole('role');
        if (!role) return interaction.reply({ content: '❌ Role not found.', ephemeral: true });
        saveConfig({ ...config, verifyRoleId: role.id });
        return interaction.reply({ content: `✅ Verify role set: ${role}`, ephemeral: true });
      }

      case 'test-welcome': {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ User not found in guild.', ephemeral: true });
        const payload = buildWelcomePayload(member);
        // preview to invoker
        await interaction.reply({ content: 'Preview:', embeds: payload.embeds, ephemeral: true }).catch(() => null);
        // also send to configured welcome channel as a real test
        if (config.welcomeChannelId) {
          const channel = interaction.guild.channels.cache.get(config.welcomeChannelId);
          if (channel) channel.send(payload).catch(() => null);
        }
        return;
      }

      case 'anti-raid-status': {
        return interaction.reply({ content: `Anti-raid: ${config.antiRaidEnabled ? 'Enabled' : 'Disabled'}\nThreshold: ${config.antiRaidThreshold}\nAction: ${config.antiRaidAction}\nRaid channel: ${config.raidLogChannelId || 'Not set'}`, ephemeral: true });
      }

      case 'giveaway': {
        const sub = interaction.options.getSubcommand();
        if (sub === 'start') {
          const duration = interaction.options.getInteger('duration');
          const prize = interaction.options.getString('prize');
          const winners = Math.max(1, interaction.options.getInteger('winners') || 1);
          if (duration < 1) {
            return interaction.reply({ content: '❌ Duration must be at least 1 minute.', ephemeral: true });
          }
          if (winners < 1) {
            return interaction.reply({ content: '❌ Winners must be at least 1.', ephemeral: true });
          }
          if (findActiveGiveawayByChannel(interaction.channel.id)) {
            return interaction.reply({ content: '❌ There is already an active giveaway in this channel.', ephemeral: true });
          }

          const giveaway = {
            id: `${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            prize,
            winners,
            creatorId: interaction.user.id,
            entries: [],
            endAt: Date.now() + duration * 60 * 1000,
            endedAt: null,
            endedBy: null,
            messageId: null
          };

          const message = await interaction.reply({ embeds: [buildGiveawayEmbed(giveaway)], components: buildGiveawayComponents(giveaway), fetchReply: true });
          giveaway.messageId = message.id;

          const giveaways = loadGiveaways();
          giveaways.push(giveaway);
          saveGiveaways(giveaways);
          scheduleGiveaway(giveaway);
          return;
        }

        if (sub === 'end') {
          const giveaway = findActiveGiveawayByChannel(interaction.channel.id);
          if (!giveaway) {
            return interaction.reply({ content: '❌ No active giveaway in this channel.', ephemeral: true });
          }
          await endGiveaway(giveaway.id, interaction.user.id);
          return interaction.reply({ content: '✅ Giveaway ended.', ephemeral: true });
        }

        return interaction.reply({ content: '❌ Invalid giveaway command.', ephemeral: true });
      }

      case 'stop': {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
        }
        await interaction.reply({ content: '🛑 Shutting down the bot...', ephemeral: true });
        client.destroy();
        setTimeout(() => process.exit(0), 1000);
        return;
      }

      default: {
        return interaction.reply({ content: '❌ This command is not implemented or has been removed.', ephemeral: true });
      }
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category') {
    const selected = interaction.values[0];
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_${selected}`)
        .setTitle('🌙 Create a Ticket');

      const subjectInput = new TextInputBuilder()
        .setCustomId('subject')
        .setLabel('Subject')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
    modal.addComponents(
      new ActionRowBuilder().addComponents(subjectInput),
      new ActionRowBuilder().addComponents(descriptionInput)
    );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('ticket_modal_')) {
      const category = interaction.customId.replace('ticket_modal_', '');
      const subject = interaction.fields.getTextInputValue('subject');
      const description = interaction.fields.getTextInputValue('description');
      await interaction.deferReply({ ephemeral: true });
      return createTicket(interaction, category, subject, description);
    }

    if (interaction.customId === 'close_modal') {
      const reason = interaction.fields.getTextInputValue('reason') || 'Kein Grund angegeben';
      await interaction.deferReply({ ephemeral: true });
      return closeTicket(interaction, reason);
    }

    if (interaction.customId === 'add_user_modal') {
      const userId = interaction.fields.getTextInputValue('user_id');
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return interaction.reply({ content: '❌ User not found.', ephemeral: true });
      }
      await interaction.channel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true
      });
      return interaction.reply({ content: `✅ ${member} wurde hinzugefügt.`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'close_ticket') {
      const modal = new ModalBuilder()
        .setCustomId('close_modal')
        .setTitle('Close Ticket');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'claim_ticket') {
      if (!isStaffExtended(interaction.member)) {
        return interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
      }
      try {
        const tickets = loadTickets();
        const ticket = tickets.open[interaction.channel.id];
        if (ticket) {
          ticket.claimedBy = interaction.user.id;
          ticket.claimedAt = new Date().toISOString();
          saveTickets(tickets);
        }
        // log claim
        if (config.logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
          if (logChannel) {
            const embed = new EmbedBuilder()
              .setTitle('🟦 Ticket claimed')
              .setDescription(`**Ticket:** ${interaction.channel}\n**Claimed by:** ${interaction.user}`)
              .setTimestamp()
              .setColor(0x8b7fff);
            logChannel.send({ embeds: [embed] }).catch(() => null);
          }
        }
        return interaction.reply({ content: `✅ Ticket claimed by ${interaction.user}.`, ephemeral: true });
      } catch (err) {
        console.error('Error claiming ticket:', err);
        return interaction.reply({ content: '❌ Failed to claim ticket.', ephemeral: true });
      }
    }

    if (interaction.customId === 'verify_button') {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);
      try {
        if (!config.verifyRoleId) return interaction.editReply({ content: '✅ Verification is not configured on this server.' });
        const guild = interaction.guild;
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return interaction.editReply({ content: '❌ Member not found.' });
        if (member.roles.cache.has(config.verifyRoleId)) return interaction.editReply({ content: '✅ You are already verified.' });
        await member.roles.add(config.verifyRoleId).catch(err => { throw err; });
        // optional welcome DM
        try { member.send('✅ You have been verified and given access.').catch(() => null); } catch (e) {}
        if (config.logChannelId) {
          const logCh = guild.channels.cache.get(config.logChannelId);
          if (logCh) logCh.send({ embeds: [new EmbedBuilder().setTitle('✅ User verified').setDescription(`${member} was verified.`).setColor(0x8b7fff).setTimestamp()] }).catch(() => null);
        }
        return interaction.editReply({ content: '✅ You are now verified.' });
      } catch (err) {
        console.error('Error in verify_button handler:', err);
        return interaction.editReply({ content: '❌ Verification failed.' });
      }
    }

    if (interaction.customId.startsWith('giveaway_join_')) {
      const giveawayId = interaction.customId.replace('giveaway_join_', '');
      const giveaway = findGiveawayById(giveawayId);
      if (!giveaway || giveaway.endedAt) {
        return interaction.reply({ content: '❌ This giveaway is no longer active.', ephemeral: true });
      }
      giveaway.entries = giveaway.entries || [];
      if (giveaway.entries.includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ You are already entered in this giveaway.', ephemeral: true });
      }
      giveaway.entries.push(interaction.user.id);
      saveGiveaways(loadGiveaways().map(g => g.id === giveaway.id ? giveaway : g));
      await updateGiveawayMessage(giveaway);
      return interaction.reply({ content: '🎉 You have joined the giveaway!', ephemeral: true });
    }

    if (interaction.customId.startsWith('giveaway_end_')) {
      const giveawayId = interaction.customId.replace('giveaway_end_', '');
      const giveaway = findGiveawayById(giveawayId);
      if (!giveaway || giveaway.endedAt) {
        return interaction.reply({ content: '❌ This giveaway is already ended.', ephemeral: true });
      }
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && interaction.user.id !== giveaway.creatorId) {
        return interaction.reply({ content: '❌ Only the giveaway creator or an admin can end this giveaway.', ephemeral: true });
      }
      await endGiveaway(giveaway.id, interaction.user.id);
      return interaction.reply({ content: '✅ Giveaway has been ended.', ephemeral: true });
    }

    if (interaction.customId === 'add_user_ticket') {
      if (!isStaffExtended(interaction.member)) {
        return interaction.reply({ content: '❌ Only staff.', ephemeral: true });
      }
      const modal = new ModalBuilder()
        .setCustomId('add_user_modal')
        .setTitle('Add User');

      const userIdInput = new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('User ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'delete_ticket') {
      if (!isStaffExtended(interaction.member) && interaction.user.id !== loadTickets().open[interaction.channel.id]?.userId) {
        return interaction.reply({ content: '❌ Only staff or the ticket creator can delete this.', ephemeral: true });
      }
      // ask for confirmation
      return interaction.reply({ ephemeral: true, content: 'Are you sure? Confirm delete or generate transcript first.', components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirm_delete_ticket').setLabel('🗑 Confirm Delete').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('generate_transcript').setLabel('📜 Transcript').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('cancel_delete_ticket').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
        )
      ] });
    }

    if (interaction.customId === 'confirm_delete_ticket') {
      // confirmation to delete: only staff or owner
      if (!isStaffExtended(interaction.member) && interaction.user.id !== loadTickets().open[interaction.channel.id]?.userId) {
        return interaction.reply({ content: '❌ Only staff or the ticket creator can delete this.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const tickets = loadTickets();
        const ticket = tickets.open[interaction.channel.id];
        if (ticket) {
          // optionally send transcript to owner and log channel
          const ch = interaction.channel;
          const { buffer, name } = await generateTranscript(ch);
          const attachment = new AttachmentBuilder(buffer, { name });
          // send to ticket owner
          const owner = await client.users.fetch(ticket.userId).catch(() => null);
          if (owner) owner.send({ content: `Transcript for your ticket ${ch.name}`, files: [attachment] }).catch(() => null);
          // send to log channel
          if (config.logChannelId) {
            const logCh = interaction.guild.channels.cache.get(config.logChannelId);
            if (logCh) logCh.send({ content: `Transcript for ${ch}`, files: [attachment] }).catch(() => null);
          }
          // remove ticket record
          delete tickets.open[interaction.channel.id];
          saveTickets(tickets);
        }
        await interaction.editReply({ content: '🗑 Ticket will be deleted now.' });
        await interaction.channel.delete().catch(() => null);
      } catch (err) {
        console.error('Error deleting ticket:', err);
        return interaction.editReply({ content: '❌ Failed to delete ticket.' });
      }
      return;
    }

    if (interaction.customId === 'generate_transcript') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const tickets = loadTickets();
        const ticket = tickets.open[interaction.channel.id];
        if (!ticket) return interaction.editReply({ content: '❌ Not a ticket channel.' });
        const ch = interaction.channel;
        const { buffer, name } = await generateTranscript(ch);
        const attachment = new AttachmentBuilder(buffer, { name });
        // send to requester
        const owner = await client.users.fetch(ticket.userId).catch(() => null);
        if (owner) await owner.send({ content: `Transcript for your ticket ${ch.name}`, files: [attachment] }).catch(() => null);
        await interaction.editReply({ content: '📜 Transcript generated and sent to the ticket owner.' });
      } catch (err) {
        console.error('Error generating transcript:', err);
        return interaction.editReply({ content: '❌ Failed to generate transcript.' });
      }
      return;
    }

    if (interaction.customId === 'cancel_delete_ticket') {
      return interaction.reply({ content: 'Cancelled.', ephemeral: true });
    }
  }
  } catch (err) {
    console.error('Unhandled interaction error:', err);
    try {
      if (interaction && !interaction.replied) interaction.reply({ content: '❌ An error occurred while processing this interaction.', ephemeral: true }).catch(() => null);
    } catch (e) {}
  }
});

client.login(config.token).catch((error) => {
  console.error('❌ Bot could not start:', error);
});
